"""
Multi-agent Agora discussion — single-process orchestrator.

All three agents connect to the same LiveKit room from one process,
sharing a DiscussionState for coordinated turn-taking, urgency-based
speaker selection, and intention-based interruption handling.

Usage:
    python multi_agent.py
"""

from __future__ import annotations

import asyncio
import contextlib
from collections.abc import AsyncIterator, Awaitable, Callable
from functools import partial
import json
import logging
import math
import os
import random
import re
import sys
import time
from pathlib import Path

import aiohttp
import anthropic
from dotenv import load_dotenv
from livekit import api, rtc
from livekit.agents import stt
from livekit.plugins import cartesia, deepgram
from openai import AsyncOpenAI

from config import ROOM_NAME, TOPIC, AgentConfig, build_agents
from discussion_state import DiscussionState, HistoryEntry, StateSnapshot, detect_addressed

# Voices to cycle through when building agents from AGENTS_JSON
_OPENAI_VOICES = ["onyx", "echo", "fable", "alloy", "nova"]
_CARTESIA_VOICES = [
    "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
    "f31cc6a7-c1e8-4764-980c-60a361443dd1",
    "a167e0f3-df7e-4d52-a9c3-f949145efdab",
    "b7d50908-b17c-442d-ad8d-810c63997ed9",
    "726d5ae5-055f-4c3d-8355-d9677de68937",
]


def _build_agents_from_json(agents_raw: list[dict], topic: str) -> list[AgentConfig]:
    """Convert a frontend agent config array into AgentConfig objects."""
    configs = []
    for i, a in enumerate(agents_raw):
        name = a.get("name", f"Agent{i+1}")
        identity = name.lower().replace(" ", "_")
        configs.append(AgentConfig(
            identity=identity,
            name=name,
            voice_id=_CARTESIA_VOICES[i % len(_CARTESIA_VOICES)],
            openai_voice=_OPENAI_VOICES[i % len(_OPENAI_VOICES)],
            disposition=a.get("disposition", ""),
            ui_color=a.get("color", "#7A9E87"),
            system_prompt=a.get("systemPrompt", ""),
        ))
    return configs

_backend_dir = Path(__file__).resolve().parent
for _env in (".env", ".env.local"):
    load_dotenv(_backend_dir / _env)

# Room name is fixed per orchestrator process (Express sets ROOM_NAME).
_RUNTIME_ROOM: str = os.getenv("ROOM_NAME") or ROOM_NAME

# Normalized UI positions for drift hint calculations.
# Keyed by agent identity and populated at runtime in DiscussionOrchestrator.run().
_UI_POS: dict[str, tuple[float, float]] = {}
_USER_POS: tuple[float, float] = (0.50, 0.82)


def _split_words_for_caption(text: str) -> list[str]:
    return re.findall(r"\S+\s*", text) or []


# After a comma, flush once this many words follow. Higher = fewer mid-clause
# TTS cuts (each cut sounds like a new utterance).
_MIN_WORDS_AFTER_COMMA = 10

# Silence between streamed TTS segments (ms) so phrases don’t slam together.
_INTER_SEGMENT_SILENCE_MS = 220

# Sentence-ending punctuation: match through optional closing quote, then space or end.
_STRONG_SENTENCE_END = re.compile(
    r".+?[.!?]+(?:[\"'])?(?=(?:\s+|$))", re.DOTALL
)


def _comma_clause_flush_end(buffer: str) -> int | None:
    """If buffer has ', ' followed by enough words, return exclusive end index."""
    m = re.search(r",\s+", buffer)
    if not m:
        return None
    after_start = m.end()
    tail = buffer[after_start:]
    tokens = list(re.finditer(r"\S+", tail))
    if len(tokens) < _MIN_WORDS_AFTER_COMMA:
        return None
    return after_start + tokens[_MIN_WORDS_AFTER_COMMA - 1].end()


def _pop_next_segment(buffer: str) -> tuple[str, str] | None:
    """Split one speakable segment from the front of buffer, or None if incomplete."""
    if not buffer:
        return None
    candidates: list[int] = []
    sm = _STRONG_SENTENCE_END.search(buffer)
    if sm:
        end = sm.end()
        while end < len(buffer) and buffer[end] in " \t":
            end += 1
        candidates.append(end)
    ce = _comma_clause_flush_end(buffer)
    if ce is not None:
        candidates.append(ce)
    if not candidates:
        return None
    cut = min(candidates)
    segment = buffer[:cut]
    rest = buffer[cut:]
    if not segment.strip():
        return _pop_next_segment(rest.lstrip()) if rest.strip() else None
    return segment, rest


def _join_stream_segments(chunks: list[str]) -> str:
    """Join LLM stream segments without losing spaces between chunk boundaries."""
    parts = [c for c in chunks if c]
    if not parts:
        return ""
    out = parts[0]
    for nxt in parts[1:]:
        if out and nxt and not out[-1].isspace() and not nxt[0].isspace():
            out += " "
        out += nxt
    return out.strip()


def _glue_tts_segment_boundary(prev: str | None, seg: str) -> tuple[str, bool]:
    """Insert a word boundary between consecutive TTS segments when missing.

    Each segment is synthesized separately; without this, '...is' + 'that...'
    becomes missing UI space and choppy prosody. Returns (adjusted_segment,
    whether to publish a standalone space token before captions for this segment).
    """
    if not seg:
        return seg, False
    if not prev or not prev.strip():
        return seg, False
    p = prev.rstrip()
    s = seg
    if not s:
        return seg, False
    if p[-1].isspace() or s[0].isspace():
        return seg, False
    return (" " + seg, True)


def _maybe_space_between_stream_chunks(buffer: str, delta: str) -> str:
    """If the API glued two words across deltas, insert a space (letters only)."""
    if not buffer or not delta:
        return delta
    if buffer[-1].isalpha() and delta[0].isalpha():
        return " " + delta
    return delta


# Words in an agent's OWN speech that signal agreement with the previous speaker.
# When detected, the agent drifts toward whoever they're agreeing with.
_AGREE_WORDS: tuple[str, ...] = (
    "agree", "exactly", "precisely", "absolutely", "you're right", "that's right",
    "good point", "fair point", "building on", "yes and", "indeed", "true",
    "spot on", "well said", "i think you", "that's a good", "that's fair",
    "totally", "definitely", "you're onto", "i see that",
)


def _drift_pixels(from_id: str, to_id: str, magnitude: float) -> tuple[int, int]:
    """Return (dx, dy) pixel offset — already the *absolute* target displacement.

    The frontend treats this as a final offset from the base position, not an
    additive delta.  Scale is chosen so ±30px is the practical max at full magnitude.
    Negative magnitude reverses direction (drift *away* from to_id).
    """
    fx, fy = _UI_POS.get(from_id, (0.5, 0.5))
    tx, ty = _USER_POS if to_id == "user" else _UI_POS.get(to_id, (0.5, 0.5))
    dxn, dyn = tx - fx, ty - fy
    n = math.hypot(dxn, dyn) or 1.0
    ux, uy = dxn / n, dyn / n
    if magnitude < 0:
        ux, uy = -ux, -uy
        magnitude = abs(magnitude)
    # scale tuned so magnitude=25 → ~30px along a diagonal (frontend MAX_DRIFT=30)
    scale = 75.0
    dx = int(max(-30, min(30, ux * magnitude * scale / 25.0)))
    dy = int(max(-30, min(30, uy * magnitude * scale / 25.0)))
    return dx, dy

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-5s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("agora")

HUMAN_IDLE_SECONDS = 60.0
_IDLE_POLL_SECONDS = 2.0
# OpenAI TTS pcm + Cartesia both publish at 24 kHz mono in this pipeline.
TTS_SAMPLE_RATE = 24000
# ~10 ms frames: 240 samples × 2 bytes (s16le) for LiveKit capture_frame.
_TTS_PCM_FRAME_SAMPLES = 240
_TTS_PCM_FRAME_BYTES = _TTS_PCM_FRAME_SAMPLES * 2

INTERRUPTION_SIGNALS = (
    "wait", "hold on", "actually", "no no", "but ", "let me",
    "one second", "what about", "sorry", "hang on", "yeah but",
    "okay but", "i think",
)

_TRAIL_OFF_MAX_WORDS = 4


def _clamp_trail_off_words(text: str, max_words: int = _TRAIL_OFF_MAX_WORDS) -> str:
    """Keep only a short spoken phrase for interruption landings."""
    t = text.strip().strip('"').strip("'")
    if not t:
        return ""
    words = t.split()
    return " ".join(words[:max_words]) if words else ""


def _env_truthy(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in ("1", "true", "yes", "on")


def _tts_provider() -> str:
    return os.getenv("TTS_PROVIDER", "openai").strip().lower()


# ── Agent worker ─────────────────────────────────────────────────────


class AgentWorker:
    """Manages one agent's LiveKit room connection, audio track, and TTS."""

    def __init__(
        self,
        config: AgentConfig,
        http: aiohttp.ClientSession,
    ) -> None:
        self.config = config
        self.room = rtc.Room()
        self._http = http
        self._audio_source: rtc.AudioSource | None = None
        self._llm = anthropic.AsyncAnthropic()
        self._tts_mode: str = "off"
        self._cartesia_tts: cartesia.TTS | None = None
        self._openai: AsyncOpenAI | None = None

        # ------------------------------------------------------------------
        # Cartesia-only setup (previous default before OpenAI TTS). Kept intact
        # for reference; set TTS_PROVIDER=cartesia to use the live branch below.
        #
        # if _env_truthy("DISABLE_TTS"):
        #     self._tts = None
        # else:
        #     self._tts = cartesia.TTS(
        #         model="sonic-3",
        #         voice=config.voice_id,
        #         http_session=http,
        #     )
        # ------------------------------------------------------------------

        if _env_truthy("DISABLE_TTS"):
            self._tts_mode = "off"
        elif _tts_provider() == "cartesia":
            self._tts_mode = "cartesia"
            self._cartesia_tts = cartesia.TTS(
                model="sonic-3",
                voice=config.voice_id,
                http_session=http,
            )
        else:
            self._tts_mode = "openai"
            self._openai = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])

        self._system_prompt_override: str | None = None

    async def _build_prompt(
        self, state: DiscussionState, *, is_opener: bool
    ) -> tuple[str, str]:
        transcript = await state.format_transcript(20)
        if is_opener:
            user_content = (
                "You're opening this discussion. Make a sharp, provocative "
                "opening statement about the topic. 2 sentences max."
            )
        else:
            user_content = (
                f"Conversation so far:\n---\n{transcript}\n---\n\n"
                f"Respond as {self.config.name}. 2 sentences max."
            )
        system = (
            self._system_prompt_override
            if self._system_prompt_override is not None
            else self.config.system_prompt
        )
        return system, user_content

    async def connect(self, url: str, room_name: str) -> None:
        token = (
            api.AccessToken()
            .with_identity(self.config.identity)
            .with_name(self.config.name)
            .with_grants(api.VideoGrants(room_join=True, room=room_name))
            .to_jwt()
        )
        await self.room.connect(
            url, token, options=rtc.RoomOptions(auto_subscribe=True)
        )
        self._audio_source = rtc.AudioSource(
            sample_rate=TTS_SAMPLE_RATE, num_channels=1
        )
        track = rtc.LocalAudioTrack.create_audio_track(
            f"{self.config.identity}-voice", self._audio_source
        )
        await self.room.local_participant.publish_track(track)

    async def generate(self, state: DiscussionState, *, is_opener: bool = False) -> str:
        system, user_content = await self._build_prompt(state, is_opener=is_opener)
        response = await self._llm.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=200,
            system=system,
            messages=[{"role": "user", "content": user_content}],
        )
        return response.content[0].text.strip()

    async def generate_interrupt_trail_off(self, state: DiscussionState) -> str:
        """Short LLM completion when the user interjects — only trail-off words."""
        transcript = await state.format_transcript(15)
        base = (
            self._system_prompt_override
            if self._system_prompt_override is not None
            else self.config.system_prompt
        )
        completion_instruction = (
            "\n\n--- INTERRUPTION (this message only) ---\n"
            "Stop immediately and say only a natural 2 to 3 word trail-off that "
            "fits your personality before yielding. Examples: fair enough, go on, "
            "interesting point, oh wait, right yes.\n"
            "Do not continue your previous thought. Just land softly and stop.\n"
            "Generate only the trail-off text — no quotes, no names, no preamble."
        )
        user = (
            f"Recent conversation:\n{transcript}\n\n"
            f"You were mid-utterance and the user interjected. "
            "Output only your 2-3 word trail-off."
        )
        response = await self._llm.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=32,
            system=base + completion_instruction,
            messages=[{"role": "user", "content": user}],
        )
        raw = response.content[0].text.strip()
        return _clamp_trail_off_words(raw, _TRAIL_OFF_MAX_WORDS)

    async def iter_sentence_segments(
        self,
        state: DiscussionState,
        *,
        is_opener: bool = False,
        interrupt_event: asyncio.Event | None = None,
    ) -> AsyncIterator[str]:
        """Stream Claude text and yield segments at natural boundaries for TTS."""
        system, user_content = await self._build_prompt(state, is_opener=is_opener)
        buffer = ""
        async with self._llm.messages.stream(
            model="claude-sonnet-4-6",
            max_tokens=200,
            system=system,
            messages=[{"role": "user", "content": user_content}],
        ) as stream:
            async for delta in stream.text_stream:
                if interrupt_event is not None and interrupt_event.is_set():
                    break
                buffer += _maybe_space_between_stream_chunks(buffer, delta)
                while True:
                    if interrupt_event is not None and interrupt_event.is_set():
                        break
                    popped = _pop_next_segment(buffer)
                    if popped is None:
                        break
                    seg, buffer = popped
                    yield seg
                if interrupt_event is not None and interrupt_event.is_set():
                    break
            if interrupt_event is None or not interrupt_event.is_set():
                tail = buffer.strip()
                if tail:
                    yield tail

    async def _openai_tts_pcm(self, text: str) -> bytes:
        assert self._openai is not None
        t = text.strip()
        if not t:
            return b""
        resp = await self._openai.audio.speech.create(
            model="tts-1",
            voice=self.config.openai_voice,
            input=t,
            response_format="pcm",
        )
        return await resp.aread()

    async def _cartesia_segment_pcm(self, text: str) -> bytes:
        assert self._cartesia_tts is not None
        t = text.strip()
        if not t:
            return b""
        out = bytearray()
        async with self._cartesia_tts.synthesize(t) as stream:
            async for audio in stream:
                out += audio.frame.data.tobytes()
        return bytes(out)

    async def fetch_segment_pcm(self, text: str) -> bytes:
        """Fetch raw PCM for one segment (used to overlap TTS with the next LLM chunk)."""
        if self._tts_mode == "off":
            return b""
        if self._tts_mode == "openai":
            return await self._openai_tts_pcm(text)
        return await self._cartesia_segment_pcm(text)

    async def _play_pcm_with_captions(
        self,
        pcm: bytes,
        caption_text: str,
        publish_word: Callable[[str], Awaitable[None]],
    ) -> None:
        """Play PCM while revealing caption tokens in proportion to audio progress."""
        assert self._audio_source is not None
        if not pcm:
            return
        words = _split_words_for_caption(caption_text)
        if not words:
            await self._stream_pcm_to_source(pcm)
            return
        await publish_word(words[0])
        if len(words) == 1:
            await self._stream_pcm_to_source(pcm)
            return
        weights = [max(1, len(re.sub(r"\s+", "", w))) for w in words]
        total_w = sum(weights)
        thresholds: list[float] = []
        acc = 0.0
        for i in range(len(weights) - 1):
            acc += weights[i] / total_w
            thresholds.append(acc)
        total_bytes = len(pcm)
        wi = 0
        idx = 0
        try:
            while idx < len(pcm):
                chunk_end = min(idx + _TTS_PCM_FRAME_BYTES, len(pcm))
                chunk = pcm[idx:chunk_end]
                if len(chunk) < _TTS_PCM_FRAME_BYTES:
                    chunk = chunk + b"\x00" * (_TTS_PCM_FRAME_BYTES - len(chunk))
                frame = rtc.AudioFrame(
                    chunk,
                    TTS_SAMPLE_RATE,
                    1,
                    _TTS_PCM_FRAME_SAMPLES,
                )
                await self._audio_source.capture_frame(frame)
                idx = chunk_end
                frac = idx / max(total_bytes, 1)
                while wi < len(thresholds) and frac >= thresholds[wi]:
                    await publish_word(words[wi + 1])
                    wi += 1
            while wi < len(words) - 1:
                await publish_word(words[wi + 1])
                wi += 1
        except asyncio.CancelledError:
            self._audio_source.clear_queue()
            raise

    async def speak_segment_with_captions(
        self,
        text: str,
        publish_word: Callable[[str], Awaitable[None]],
    ) -> None:
        assert self._audio_source is not None
        t = text.strip()
        if not t:
            return
        if self._tts_mode == "off":
            for w in _split_words_for_caption(t):
                await publish_word(w)
                await asyncio.sleep(0.22)
            return
        try:
            if self._tts_mode == "openai":
                pcm = await self._openai_tts_pcm(t)
                await self._play_pcm_with_captions(pcm, t, publish_word)
            else:
                pcm = await self._cartesia_segment_pcm(t)
                await self._play_pcm_with_captions(pcm, t, publish_word)
        except asyncio.CancelledError:
            self._audio_source.clear_queue()
            raise
        await asyncio.sleep(0.05)

    async def speak(self, text: str) -> None:
        assert self._audio_source is not None
        if self._tts_mode == "off":
            print(f"[{self.config.name}] (TTS off) {text}", flush=True)
            await asyncio.sleep(0.5)
            return

        try:
            if self._tts_mode == "openai":
                assert self._openai is not None
                resp = await self._openai.audio.speech.create(
                    model="tts-1",
                    voice=self.config.openai_voice,
                    input=text,
                    response_format="pcm",
                )
                pcm = await resp.aread()
                await self._stream_pcm_to_source(pcm)
            else:
                assert self._cartesia_tts is not None
                async with self._cartesia_tts.synthesize(text) as stream:
                    async for audio in stream:
                        await self._audio_source.capture_frame(audio.frame)
        except asyncio.CancelledError:
            self._audio_source.clear_queue()
            raise
        await asyncio.sleep(0.3)

    async def _stream_silence_ms(self, duration_ms: float) -> None:
        """Push s16le silence (real audio gap between TTS API calls)."""
        assert self._audio_source is not None
        if duration_ms <= 0:
            return
        n_bytes = int(TTS_SAMPLE_RATE * (duration_ms / 1000.0)) * 2
        if n_bytes <= 0:
            return
        try:
            await self._stream_pcm_to_source(b"\x00" * n_bytes)
        except asyncio.CancelledError:
            self._audio_source.clear_queue()
            raise

    async def _stream_pcm_to_source(self, pcm: bytes) -> None:
        """Push OpenAI pcm (24 kHz s16le mono) to LiveKit in ~10 ms frames."""
        assert self._audio_source is not None
        for i in range(0, len(pcm), _TTS_PCM_FRAME_BYTES):
            chunk = pcm[i : i + _TTS_PCM_FRAME_BYTES]
            if len(chunk) < _TTS_PCM_FRAME_BYTES:
                chunk = chunk + b"\x00" * (_TTS_PCM_FRAME_BYTES - len(chunk))
            frame = rtc.AudioFrame(
                chunk,
                TTS_SAMPLE_RATE,
                1,
                _TTS_PCM_FRAME_SAMPLES,
            )
            await self._audio_source.capture_frame(frame)

    async def disconnect(self) -> None:
        if self._cartesia_tts is not None:
            await self._cartesia_tts.aclose()
        await self.room.disconnect()


# ── Orchestrator ─────────────────────────────────────────────────────


class DiscussionOrchestrator:
    """Coordinates all agents in a single process with shared state."""

    def __init__(self) -> None:
        self._room_name = _RUNTIME_ROOM
        self._topic = os.getenv("TOPIC") or TOPIC
        _agents_json_str = os.getenv("AGENTS_JSON", "").strip()
        if _agents_json_str:
            try:
                _agents_raw = json.loads(_agents_json_str)
                self._agent_configs: list[AgentConfig] = _build_agents_from_json(
                    _agents_raw, self._topic
                )
            except Exception:
                log.exception("Failed to parse AGENTS_JSON; falling back to defaults")
                self._agent_configs = build_agents(self._topic)
        else:
            self._agent_configs = build_agents(self._topic)
        # Runtime identities — always reflects the actual agents in this room,
        # unlike the static AGENT_IDENTITIES constant from config.py which only
        # knows about the hardcoded edge/sage/spark cast.
        self._agent_identities: frozenset[str] = frozenset(
            a.identity for a in self._agent_configs
        )
        self.state = DiscussionState(
            topic=self._topic,
            agent_names=[a.name for a in self._agent_configs],
        )
        self.room_lock = asyncio.Lock()
        self.workers: dict[str, AgentWorker] = {}
        self._configs: dict[str, AgentConfig] = {
            a.name: a for a in self._agent_configs
        }

        self._discussion_started = False
        self._last_human_activity: float | None = None
        self._idle_paused = False

        self._active_turn_task: asyncio.Task[None] | None = None
        self._active_entry: HistoryEntry | None = None
        self._speaking_identity: str | None = None

        self._user_has_floor = False
        self._resume_timer: asyncio.Task[None] | None = None
        self._interruption_triggered = False
        self._graceful_interrupt_event = asyncio.Event()
        # Humans in room (non-agent participants); pause turns when 0.
        self._human_count = 0
        # One STT pipeline per subscribed human audio track (avoid duplicates).
        self._human_stt_tracks: set[str] = set()

    @property
    def _primary(self) -> AgentWorker:
        return list(self.workers.values())[0]

    async def _publish_ui(self, payload: dict) -> None:
        if not self.workers:
            return
        data = json.dumps(payload).encode("utf-8")
        try:
            await self._primary.room.local_participant.publish_data(
                data, reliable=True
            )
        except Exception:
            log.exception("publish_data (UI) failed")

    async def apply_topic_update(self, new_topic: str) -> None:
        self._topic = new_topic.strip()
        await self.state.set_topic(self._topic)
        self._agent_configs = build_agents(self._topic)
        self._configs = {a.name: a for a in self._agent_configs}
        for cfg in self._agent_configs:
            w = self.workers.get(cfg.identity)
            if w:
                w._system_prompt_override = cfg.system_prompt
        await self._publish_ui({"type": "topicUpdate", "newTopic": self._topic})
        for cfg in self._agent_configs:
            await self._publish_ui(
                {"type": "agentMove", "agentName": cfg.name, "dx": 0, "dy": 0}
            )

    async def _stdin_command_loop(self) -> None:
        while True:
            line = await asyncio.to_thread(sys.stdin.readline)
            if not line:
                await asyncio.sleep(0.2)
                continue
            line = line.strip()
            if not line:
                continue
            try:
                cmd = json.loads(line)
            except json.JSONDecodeError:
                continue
            if cmd.get("cmd") == "set_topic" and isinstance(cmd.get("topic"), str):
                await self.apply_topic_update(cmd["topic"])

    def _on_room_data(self, packet: rtc.DataPacket) -> None:
        if packet.participant and packet.participant.identity in self._agent_identities:
            return
        try:
            msg = json.loads(packet.data.decode("utf-8"))
        except Exception:
            return
        if msg.get("type") == "userMessage" and isinstance(msg.get("text"), str):
            text = msg["text"].strip()
            if text:
                asyncio.create_task(self._ingest_user_text(text))

    async def _ingest_user_text(self, text: str) -> None:
        self._note_human_activity()
        entry = await self.state.add_entry("You", text)
        log.info("You (typed): %s", text)
        if entry.addressed_to:
            await self._publish_ui(
                {"type": "agentReact", "agentName": entry.addressed_to}
            )
        await self._broadcast_user_drift()
        self._user_has_floor = False
        await self._post_user_statement(entry.addressed_to)

    async def _broadcast_user_drift(self) -> None:
        for cfg in self._agent_configs:
            dx, dy = _drift_pixels(
                cfg.identity, "user", random.uniform(15.0, 25.0)
            )
            await self._publish_ui(
                {"type": "agentMove", "agentName": cfg.name, "dx": dx, "dy": dy}
            )

    async def _emit_agent_dynamics(
        self, worker: AgentWorker, text: str, snap: StateSnapshot
    ) -> None:
        names = frozenset(a.name for a in self._agent_configs)
        cur_low = text.lower()

        # ── 1. Explicitly addressing another agent → drift toward them ──────
        target = detect_addressed(text, names)
        if target and target != worker.config.name:
            other = next(a for a in self._agent_configs if a.name == target)
            mag = random.uniform(20.0, 30.0)
            dx, dy = _drift_pixels(worker.config.identity, other.identity, mag)
            await self._publish_ui(
                {"type": "agentMove", "agentName": worker.config.name, "dx": dx, "dy": dy}
            )
            return

        last = snap.last_entry
        if not (last and last.speaker in names and last.speaker != worker.config.name):
            return

        cfg = self._configs[worker.config.name]
        last_low = last.text.lower()
        other = next(a for a in self._agent_configs if a.name == last.speaker)

        # ── 2. Previous speaker said something that triggers disagreement → drift away ──
        if any(k in last_low for k in cfg.disagree_triggers):
            mag = -random.uniform(15.0, 25.0)
            dx, dy = _drift_pixels(worker.config.identity, other.identity, mag)
            await self._publish_ui(
                {"type": "agentMove", "agentName": worker.config.name, "dx": dx, "dy": dy}
            )

        # ── 3. Current agent agrees / builds on previous speaker → drift toward ──
        elif (
            any(k in cur_low for k in _AGREE_WORDS)
            or any(k in cur_low for k in cfg.build_on_triggers)
        ):
            mag = random.uniform(12.0, 22.0)
            dx, dy = _drift_pixels(worker.config.identity, other.identity, mag)
            await self._publish_ui(
                {"type": "agentMove", "agentName": worker.config.name, "dx": dx, "dy": dy}
            )

    # ── main loop ────────────────────────────────────────────────────

    async def run(self) -> None:
        url = os.environ["LIVEKIT_URL"]
        if _env_truthy("DISABLE_TTS"):
            log.warning("DISABLE_TTS is on — no TTS API calls.")
        elif _tts_provider() == "openai":
            _ = os.environ["OPENAI_API_KEY"]
        elif _tts_provider() == "cartesia":
            _ = os.environ["CARTESIA_API_KEY"]

        async with aiohttp.ClientSession() as http:
            pending: list[tuple[AgentConfig, AgentWorker]] = []
            for cfg in self._agent_configs:
                pending.append((cfg, AgentWorker(cfg, http)))

            primary_w = pending[0][1]
            # Register primary room events *before* connect so early track_subscribed
            # events (e.g. human already publishing) are not missed.
            primary_w.room.on("track_subscribed", self._on_track_subscribed)
            primary_w.room.on("track_published", self._on_remote_track_published_primary)
            primary_w.room.on("participant_connected", self._on_participant_connected)
            primary_w.room.on(
                "participant_disconnected", self._on_participant_disconnected
            )
            primary_w.room.on("data_received", self._on_room_data)

            for cfg, w in pending[1:]:
                w.room.on(
                    "track_subscribed",
                    partial(self._on_auxiliary_track_subscribed, w),
                )
                w.room.on(
                    "track_published",
                    partial(self._on_auxiliary_track_published, w),
                )
                w.room.on(
                    "participant_connected",
                    partial(self._on_auxiliary_participant_connected, w),
                )

            for cfg, w in pending:
                await w.connect(url, self._room_name)
                self.workers[cfg.identity] = w
                log.info("[%s] connected to room '%s'", cfg.name, self._room_name)

            # Build UI positions dynamically so drift hints work for any cast size.
            _UI_POS.clear()
            _positions_by_count = {
                2: [(0.35, 0.35), (0.65, 0.35)],
                3: [(0.28, 0.32), (0.72, 0.32), (0.50, 0.56)],
                4: [(0.25, 0.30), (0.75, 0.30), (0.35, 0.60), (0.65, 0.60)],
            }
            n = len(self._agent_configs)
            positions = _positions_by_count.get(n) or _positions_by_count[3][:n] or [(0.5, 0.4)]
            for i, cfg in enumerate(self._agent_configs):
                _UI_POS[cfg.identity] = positions[i] if i < len(positions) else (0.5, 0.4)

            primary = self._primary
            asyncio.create_task(self._stdin_command_loop())
            self._sweep_remote_subscriptions_post_connect()

            for p in primary.room.remote_participants.values():
                if p.identity not in self._agent_identities:
                    self._human_count += 1
            if self._human_count > 0:
                self._note_human_activity()
                self._maybe_start()

            if not self._discussion_started:
                log.info("Waiting for a human to join before starting…")

            watchdog = asyncio.create_task(self._idle_watchdog())
            stop = asyncio.Event()
            try:
                await stop.wait()
            except asyncio.CancelledError:
                pass
            finally:
                watchdog.cancel()
                try:
                    await watchdog
                except asyncio.CancelledError:
                    pass
                for w in self.workers.values():
                    await w.disconnect()

    # ── human presence ───────────────────────────────────────────────

    def _on_participant_connected(self, participant: rtc.RemoteParticipant) -> None:
        log.info(
            "[audio/participant_connected] room_owner=%s remote_identity=%r remote_name=%r "
            "in_agent_identities=%s track_pubs=%d",
            self._primary.config.identity,
            participant.identity,
            participant.name,
            participant.identity in self._agent_identities,
            len(participant.track_publications),
        )
        self._ensure_remote_audio_subscribed(self._primary, participant)
        if participant.identity in self._agent_identities:
            return
        log.info("Human '%s' joined.", participant.name or participant.identity)
        self._human_count += 1
        self._note_human_activity()
        self._maybe_start()

    def _on_participant_disconnected(
        self, participant: rtc.RemoteParticipant
    ) -> None:
        if participant.identity in self._agent_identities:
            return
        log.info("Human '%s' left.", participant.name or participant.identity)
        self._human_count = max(0, self._human_count - 1)
        if self._human_count == 0:
            log.info(
                "[orchestration] last human left — pausing agent turns (room empty for agents)"
            )
            self._enter_idle_pause()

    def _note_human_activity(self) -> None:
        was_paused = self._idle_paused
        self._last_human_activity = time.monotonic()
        self._idle_paused = False
        if was_paused:
            log.info("Human active — resuming discussion.")
            asyncio.create_task(self._evaluate_and_schedule())

    def _maybe_start(self) -> None:
        if self._discussion_started:
            return
        self._discussion_started = True
        log.info("Human joined — starting discussion.")
        opener = next(iter(self.workers.values()), None)
        if opener:
            self._active_turn_task = asyncio.create_task(
                self._execute_turn(opener, is_opener=True)
            )

    # ── idle watchdog ────────────────────────────────────────────────

    async def _idle_watchdog(self) -> None:
        while True:
            await asyncio.sleep(_IDLE_POLL_SECONDS)
            if self._last_human_activity is None:
                continue
            if self._idle_paused:
                continue
            if time.monotonic() - self._last_human_activity < HUMAN_IDLE_SECONDS:
                continue
            if self._speaking_identity is not None:
                continue
            self._enter_idle_pause()

    def _enter_idle_pause(self) -> None:
        if self._idle_paused:
            return
        self._idle_paused = True
        if self._active_turn_task and not self._active_turn_task.done():
            self._active_turn_task.cancel()
        log.info(
            "No human activity for %.0fs — pausing all agent turns.",
            HUMAN_IDLE_SECONDS,
        )

    # ── human STT + interruption ─────────────────────────────────────

    def _ensure_remote_audio_subscribed(
        self, owner: AgentWorker, participant: rtc.RemoteParticipant
    ) -> None:
        """Subscribe to every remote audio publication (mesh). STT only runs on primary for humans."""
        if participant.identity == owner.config.identity:
            return
        for pub in participant.track_publications.values():
            if pub.kind != rtc.TrackKind.KIND_AUDIO:
                continue
            log.info(
                "[audio/ensure_subscribe] room_owner=%s remote=%s pub_sid=%s "
                "name=%r subscribed=%s has_track=%s",
                owner.config.identity,
                participant.identity,
                pub.sid,
                pub.name,
                pub.subscribed,
                pub.track is not None,
            )
            if not pub.subscribed:
                pub.set_subscribed(True)

    def _sweep_remote_subscriptions_post_connect(self) -> None:
        """After all agents join, subscribe to any tracks already in the room."""
        for w in self.workers.values():
            for participant in w.room.remote_participants.values():
                self._ensure_remote_audio_subscribed(w, participant)
                if w is self._primary:
                    for pub in participant.track_publications.values():
                        if (
                            pub.kind == rtc.TrackKind.KIND_AUDIO
                            and pub.track is not None
                            and participant.identity not in self._agent_identities
                        ):
                            self._schedule_human_stt(pub.track, pub, participant)

    def _on_remote_track_published_primary(
        self,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ) -> None:
        log.info(
            "[audio/track_published] room_owner=%s remote_identity=%r remote_name=%r "
            "kind=%s pub_sid=%r subscribed=%s in_agent_identities=%s",
            self._primary.config.identity,
            participant.identity,
            participant.name,
            publication.kind,
            publication.sid,
            publication.subscribed,
            participant.identity in self._agent_identities,
        )
        if publication.kind != rtc.TrackKind.KIND_AUDIO:
            return
        if not publication.subscribed:
            publication.set_subscribed(True)
            log.info(
                "[audio/track_published] set_subscribed(True) pub_sid=%s",
                publication.sid,
            )

    def _on_auxiliary_track_subscribed(
        self,
        owner: AgentWorker,
        track: rtc.Track,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ) -> None:
        log.info(
            "[audio/track_subscribed] room_owner=%s remote_identity=%r remote_name=%r "
            "kind=%s track_sid=%s pub_sid=%s (STT runs on primary only)",
            owner.config.identity,
            participant.identity,
            participant.name,
            track.kind,
            track.sid,
            publication.sid,
        )

    def _on_auxiliary_track_published(
        self,
        owner: AgentWorker,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ) -> None:
        log.info(
            "[audio/track_published] room_owner=%s remote_identity=%r kind=%s pub_sid=%s",
            owner.config.identity,
            participant.identity,
            publication.kind,
            publication.sid,
        )
        if publication.kind != rtc.TrackKind.KIND_AUDIO:
            return
        if not publication.subscribed:
            publication.set_subscribed(True)

    def _on_auxiliary_participant_connected(
        self, owner: AgentWorker, participant: rtc.RemoteParticipant
    ) -> None:
        log.info(
            "[audio/participant_connected] room_owner=%s remote_identity=%r remote_name=%r "
            "in_agent_identities=%s",
            owner.config.identity,
            participant.identity,
            participant.name,
            participant.identity in self._agent_identities,
        )
        self._ensure_remote_audio_subscribed(owner, participant)

    def _schedule_human_stt(
        self,
        track: rtc.Track,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ) -> None:
        """Start Deepgram for human audio only; dedupe by track sid."""
        in_agent = participant.identity in self._agent_identities
        log.info(
            "[stt/schedule] remote_identity=%r remote_name=%r in_agent_identities=%s "
            "track_sid=%s pub_sid=%s kind=%s",
            participant.identity,
            participant.name,
            in_agent,
            track.sid,
            publication.sid,
            track.kind,
        )
        if track.kind != rtc.TrackKind.KIND_AUDIO:
            log.info("[stt/schedule] skip — not audio")
            return
        if in_agent:
            log.info(
                "[stt/schedule] skip — participant is an agent identity "
                "(not piped to STT; agent voices are not confused with human)"
            )
            return
        tid = track.sid
        if tid in self._human_stt_tracks:
            log.info("[stt/schedule] skip — already have STT for track_sid=%s", tid)
            return
        self._human_stt_tracks.add(tid)

        async def _run() -> None:
            try:
                await self._transcribe_human(track, participant)
            finally:
                self._human_stt_tracks.discard(tid)

        asyncio.ensure_future(_run())

    def _on_track_subscribed(
        self,
        track: rtc.Track,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ) -> None:
        log.info(
            "[audio/track_subscribed] room_owner=%s remote_identity=%r remote_name=%r "
            "kind=%s track_sid=%s pub_sid=%s subscribed=%s in_agent_identities=%s",
            self._primary.config.identity,
            participant.identity,
            participant.name,
            track.kind,
            track.sid,
            publication.sid,
            publication.subscribed,
            participant.identity in self._agent_identities,
        )
        if track.kind != rtc.TrackKind.KIND_AUDIO:
            return
        self._schedule_human_stt(track, publication, participant)

    async def _transcribe_human(
        self, track: rtc.Track, participant: rtc.RemoteParticipant
    ) -> None:
        primary = list(self.workers.values())[0]
        stt_instance = deepgram.STT(
            model="nova-3",
            language="en",
            http_session=primary._http,
        )
        stream = stt_instance.stream()
        audio = rtc.AudioStream(track, sample_rate=16000, num_channels=1)

        async def _push() -> None:
            async for ev in audio:
                stream.push_frame(ev.frame)
            await stream.aclose()

        push_task = asyncio.create_task(_push())
        try:
            async for ev in stream:
                if ev.type == stt.SpeechEventType.INTERIM_TRANSCRIPT:
                    text = (
                        ev.alternatives[0].text.strip() if ev.alternatives else ""
                    )
                    if text:
                        await self._check_interruption(text)

                elif ev.type == stt.SpeechEventType.FINAL_TRANSCRIPT:
                    text = (
                        ev.alternatives[0].text.strip() if ev.alternatives else ""
                    )
                    if text:
                        self._interruption_triggered = False
                        self._note_human_activity()
                        entry = await self.state.add_entry("You", text)
                        log.info("You: %s", text)
                        await self._publish_ui({"type": "userCaption", "text": text})
                        if entry.addressed_to:
                            await self._publish_ui(
                                {
                                    "type": "agentReact",
                                    "agentName": entry.addressed_to,
                                }
                            )
                        await self._broadcast_user_drift()

                        if self._resume_timer and not self._resume_timer.done():
                            self._resume_timer.cancel()
                        self._user_has_floor = False
                        asyncio.create_task(
                            self._post_user_statement(entry.addressed_to)
                        )
        except Exception:
            log.exception("STT stream error for %s", participant.identity)
        finally:
            push_task.cancel()

    async def _check_interruption(self, partial_text: str) -> None:
        if self._interruption_triggered:
            return
        speaker = await self.state.get_speaker()
        if not speaker or speaker == "You":
            return

        lower = partial_text.lower()
        if not any(signal in lower for signal in INTERRUPTION_SIGNALS):
            return

        self._interruption_triggered = True
        log.info(
            "Interruption '%s' — graceful land for %s",
            partial_text.strip(),
            speaker,
        )
        self._graceful_interrupt_event.set()

        self._user_has_floor = True

        if self._resume_timer and not self._resume_timer.done():
            self._resume_timer.cancel()
        self._resume_timer = asyncio.create_task(self._resume_after_timeout())

    async def _resume_after_timeout(self) -> None:
        """If user stays silent 3s after interrupting, resume normal flow."""
        await asyncio.sleep(3.0)
        if self._user_has_floor:
            log.info("User silent after interruption — resuming conversation.")
            self._user_has_floor = False
            await self._evaluate_and_schedule()

    # ── urgency scoring ──────────────────────────────────────────────

    def _calculate_urgency(
        self, agent_name: str, cfg: AgentConfig, snap: StateSnapshot
    ) -> float:
        score = 0.0
        last = snap.last_entry
        if last is None:
            return random.uniform(0.0, 0.2)

        last_lower = last.text.lower()

        if last.addressed_to == agent_name:
            score += 0.9

        if any(kw in last_lower for kw in cfg.disagree_triggers):
            score += 0.7

        if any(kw in last_lower for kw in cfg.build_on_triggers):
            score += 0.5

        ps = snap.participant_states.get(agent_name)
        if ps and ps.exchanges_since_spoke >= 3:
            score += 0.3

        last_speaker = last.speaker
        if last_speaker == agent_name:
            score -= 0.4

        if last.speaker == "You":
            if cfg.user_align_triggers:
                if any(kw in last_lower for kw in cfg.user_align_triggers):
                    score += 0.6
            else:
                # No triggers configured (custom agent) — apply a mild random
                # boost so the conversation still feels responsive to user speech.
                score += random.uniform(0.1, 0.4)

        # boost the third agent if two have been going back and forth
        pair, pair_count = self._consecutive_pair(snap)
        if pair and pair_count >= 3 and agent_name not in pair:
            score += 0.5

        score += random.uniform(0.0, 0.2)
        return score

    @staticmethod
    def _consecutive_pair(snap: StateSnapshot) -> tuple[frozenset[str], int]:
        speakers = snap.recent_speakers
        if len(speakers) < 3:
            return frozenset(), 0
        seen: set[str] = set()
        count = 0
        for s in reversed(speakers):
            seen.add(s)
            if len(seen) > 2:
                break
            count += 1
        if len(seen) == 2 and count >= 3:
            return frozenset(seen), count
        return frozenset(), 0

    # ── turn scheduling ──────────────────────────────────────────────

    async def _post_statement_evaluate(self) -> None:
        """Natural pause after an agent finishes, then evaluate."""
        log.info(
            "[orchestration] _post_statement_evaluate entered "
            "(idle_paused=%s user_has_floor=%s humans=%s)",
            self._idle_paused,
            self._user_has_floor,
            self._human_count,
        )
        if self._idle_paused or self._user_has_floor:
            log.info(
                "[orchestration] _post_statement_evaluate SKIP — "
                "will not call _evaluate_next_speaker yet"
            )
            return
        await asyncio.sleep(random.uniform(0.8, 1.2))
        log.info("[orchestration] _evaluate_next_speaker (after inter-turn pause)")
        await self._evaluate_and_schedule()

    async def _post_user_statement(self, addressed_to: str | None = None) -> None:
        """Immediate evaluation after user finishes speaking (no pause)."""
        if self._idle_paused:
            return
        self._user_has_floor = False
        log.info("[orchestration] _evaluate_next_speaker (after user statement)")
        await self._evaluate_and_schedule(addressed_to=addressed_to)

    def _pick_next_speaker_name(
        self, scores: dict[str, float], snap: StateSnapshot
    ) -> tuple[str, float]:
        """Choose agent name to speak; avoid immediate monologue when possible."""
        best = max(scores, key=lambda k: scores[k])
        last = snap.last_entry
        if (
            last
            and last.speaker == best
            and len(self._agent_configs) > 1
        ):
            others = [n for n in scores if n != last.speaker]
            if others:
                alt = max(others, key=lambda n: scores[n])
                log.info(
                    "[orchestration] last speaker was %s; rotating to %s "
                    "(scores: best=%.3f alt=%.3f)",
                    best,
                    alt,
                    scores[best],
                    scores[alt],
                )
                return alt, scores[alt]
        return best, scores[best]

    async def _evaluate_and_schedule(
        self, addressed_to: str | None = None
    ) -> None:
        """Pick the next agent and schedule _execute_turn. Runs continuously while humans are present."""
        if self._idle_paused or self._user_has_floor:
            log.info(
                "[orchestration] _evaluate_next_speaker SKIP "
                "(idle_paused=%s user_has_floor=%s)",
                self._idle_paused,
                self._user_has_floor,
            )
            return
        if self._human_count <= 0:
            log.info(
                "[orchestration] _evaluate_next_speaker SKIP (no humans in room)"
            )
            return

        # Hard-lock: the addressed_to value is passed in directly from the
        # user statement handler, so it is immune to any race where a concurrent
        # agent turn finishes and replaces history[-1] before snapshot() runs.
        if addressed_to is not None:
            cfg_match = next(
                (a for a in self._agent_configs if a.name == addressed_to), None
            )
            if cfg_match:
                log.info(
                    "[orchestration] user addressed %s directly — hard-selecting them",
                    addressed_to,
                )
                worker = self.workers[cfg_match.identity]
                if self._active_turn_task and not self._active_turn_task.done():
                    self._active_turn_task.cancel()
                self._active_turn_task = asyncio.create_task(
                    self._execute_turn(worker)
                )
                return

        snap = await self.state.snapshot()

        scores: dict[str, float] = {}
        for cfg in self._agent_configs:
            scores[cfg.name] = self._calculate_urgency(cfg.name, cfg, snap)

        best = max(scores, key=lambda k: scores[k])
        best_score = scores[best]
        score_line = " | ".join(f"{k}={v:.3f}" for k, v in sorted(scores.items()))
        log.info("[orchestration] urgency scores: %s", score_line)

        if best_score <= 0.35:
            log.info(
                "[orchestration] no agent above threshold 0.35 (best=%s=%.3f); "
                "natural silence 2s then scheduling best pick anyway",
                best,
                best_score,
            )
            await asyncio.sleep(2.0)
            if self._idle_paused or self._user_has_floor or self._human_count <= 0:
                log.info(
                    "[orchestration] _evaluate_next_speaker aborted after wait "
                    "(state changed)"
                )
                return
            snap = await self.state.snapshot()
            scores = {
                cfg.name: self._calculate_urgency(cfg.name, cfg, snap)
                for cfg in self._agent_configs
            }
            best = max(scores, key=lambda k: scores[k])
            best_score = scores[best]
            score_line = " | ".join(f"{k}={v:.3f}" for k, v in sorted(scores.items()))
            log.info("[orchestration] urgency after wait: %s", score_line)

        chosen, chosen_score = self._pick_next_speaker_name(scores, snap)
        identity = next(a.identity for a in self._agent_configs if a.name == chosen)
        worker = self.workers[identity]

        if self._active_turn_task and not self._active_turn_task.done():
            self._active_turn_task.cancel()

        log.info(
            "[orchestration] scheduling next turn -> %s (score=%.3f)",
            chosen,
            chosen_score,
        )
        self._active_turn_task = asyncio.create_task(self._execute_turn(worker))

    # ── turn execution ───────────────────────────────────────────────

    async def _execute_turn(
        self, worker: AgentWorker, *, is_opener: bool = False
    ) -> None:
        # Retry loop: back off if room lock is held
        for _ in range(10):
            if self._idle_paused or self._user_has_floor:
                return
            if not self.room_lock.locked():
                break
            await asyncio.sleep(random.uniform(0.3, 0.7))
        else:
            log.warning("[%s] gave up waiting for room lock", worker.config.name)
            return

        async with self.room_lock:
            if self._idle_paused or self._user_has_floor:
                return

            self._graceful_interrupt_event.clear()
            self._speaking_identity = worker.config.identity
            await self.state.set_speaker(worker.config.name)
            snap_pre = await self.state.snapshot()
            try:
                await self._publish_ui(
                    {
                        "type": "speaking",
                        "agentName": worker.config.name,
                        "isThinking": True,
                    }
                )
                sentence_q: asyncio.Queue[str | None] = asyncio.Queue()
                thinking_cleared = False

                async def clear_thinking_once() -> None:
                    nonlocal thinking_cleared
                    if thinking_cleared:
                        return
                    thinking_cleared = True
                    await self._publish_ui(
                        {
                            "type": "speaking",
                            "agentName": worker.config.name,
                            "isThinking": False,
                        }
                    )

                async def produce_sentences() -> None:
                    try:
                        async for seg in worker.iter_sentence_segments(
                            self.state,
                            is_opener=is_opener,
                            interrupt_event=self._graceful_interrupt_event,
                        ):
                            await clear_thinking_once()
                            await sentence_q.put(seg)
                        if self._graceful_interrupt_event.is_set():
                            try:
                                trail = await worker.generate_interrupt_trail_off(
                                    self.state
                                )
                                if trail:
                                    await clear_thinking_once()
                                    await sentence_q.put(trail)
                            except Exception:
                                log.exception(
                                    "[%s] interrupt trail-off failed",
                                    worker.config.name,
                                )
                    except asyncio.CancelledError:
                        raise
                    except Exception:
                        log.exception(
                            "[%s] streaming LLM failed", worker.config.name
                        )
                        raise
                    finally:
                        await clear_thinking_once()
                        await sentence_q.put(None)

                async def publish_word(word: str) -> None:
                    await self._publish_ui(
                        {
                            "type": "caption",
                            "agentName": worker.config.name,
                            "word": word,
                        }
                    )

                produce_task = asyncio.create_task(produce_sentences())
                text_chunks: list[str] = []
                next_fetch: asyncio.Task[bytes] | None = None
                next_text: str | None = None
                try:
                    if worker._tts_mode == "off":
                        _off_first = True
                        prev_spoken = ""
                        while True:
                            seg = await sentence_q.get()
                            if seg is None:
                                break
                            adj, need_gap = _glue_tts_segment_boundary(
                                prev_spoken, seg
                            )
                            tts_line = adj.strip()
                            if not _off_first:
                                await asyncio.sleep(
                                    _INTER_SEGMENT_SILENCE_MS / 1000.0
                                )
                                if need_gap:
                                    await publish_word(" ")
                            _off_first = False
                            text_chunks.append(adj)
                            await worker.speak_segment_with_captions(
                                tts_line, publish_word
                            )
                            prev_spoken = tts_line
                    else:
                        try:
                            prev_spoken = ""
                            while True:
                                seg = await sentence_q.get()
                                if seg is None:
                                    if next_fetch is not None:
                                        assert next_text is not None
                                        pcm = await next_fetch
                                        await worker._play_pcm_with_captions(
                                            pcm,
                                            next_text.strip(),
                                            publish_word,
                                        )
                                    break
                                adj, need_gap = _glue_tts_segment_boundary(
                                    prev_spoken, seg
                                )
                                tts_line = adj.strip()
                                if next_fetch is not None:
                                    pcm_prev = await next_fetch
                                    assert next_text is not None
                                    await worker._play_pcm_with_captions(
                                        pcm_prev,
                                        next_text.strip(),
                                        publish_word,
                                    )
                                    await worker._stream_silence_ms(
                                        _INTER_SEGMENT_SILENCE_MS
                                    )
                                    if need_gap:
                                        await publish_word(" ")
                                text_chunks.append(adj)
                                fetch_task = asyncio.create_task(
                                    worker.fetch_segment_pcm(tts_line)
                                )
                                next_fetch = fetch_task
                                next_text = tts_line
                                prev_spoken = tts_line
                        finally:
                            if (
                                next_fetch is not None
                                and not next_fetch.done()
                            ):
                                next_fetch.cancel()
                                with contextlib.suppress(
                                    asyncio.CancelledError,
                                    Exception,
                                ):
                                    await next_fetch
                finally:
                    if not produce_task.done():
                        produce_task.cancel()
                    try:
                        await produce_task
                    except asyncio.CancelledError:
                        pass

                text = _join_stream_segments(text_chunks)
                log.info("[%s] %s", worker.config.name, text)
                await self._emit_agent_dynamics(worker, text, snap_pre)
                self._active_entry = await self.state.add_entry(
                    worker.config.name, text
                )
                await self._publish_ui(
                    {"type": "captionEnd", "agentName": worker.config.name}
                )
            except asyncio.CancelledError:
                if self._active_entry:
                    self._active_entry.interrupted = True
                await self._publish_ui(
                    {"type": "captionEnd", "agentName": worker.config.name}
                )
                raise
            except Exception:
                log.exception("[%s] error during turn", worker.config.name)
                await self._publish_ui(
                    {"type": "captionEnd", "agentName": worker.config.name}
                )
            finally:
                self._active_entry = None
                self._speaking_identity = None
                await self.state.set_speaker(None)

        # Lock released — schedule next turn
        log.info(
            "[orchestration] statement_complete agent=%s "
            "should_next_speaker=%s (user_floor=%s idle_paused=%s humans=%s)",
            worker.config.name,
            not self._user_has_floor and not self._idle_paused,
            self._user_has_floor,
            self._idle_paused,
            self._human_count,
        )
        if not self._user_has_floor and not self._idle_paused:
            await self._post_statement_evaluate()
        else:
            log.info(
                "[orchestration] not calling _post_statement_evaluate "
                "(user_floor=%s idle_paused=%s)",
                self._user_has_floor,
                self._idle_paused,
            )


# ── entry point ──────────────────────────────────────────────────────


async def run_orchestrator() -> None:
    orch = DiscussionOrchestrator()
    await orch.run()


if __name__ == "__main__":
    try:
        asyncio.run(run_orchestrator())
    except KeyboardInterrupt:
        pass
