"""
Shared discussion state for one Agora room.

A single instance is created per room and passed to all agent workers.
All reads and writes go through asyncio locks.
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass


@dataclass
class HistoryEntry:
    speaker: str
    text: str
    timestamp: float
    interrupted: bool = False
    addressed_to: str | None = None


@dataclass
class ParticipantState:
    last_spoke_at: float | None = None
    exchanges_since_spoke: int = 0


@dataclass
class UserState:
    is_speaking: bool = False
    last_spoke_at: float | None = None


@dataclass
class StateSnapshot:
    """Atomic read of everything urgency scoring needs."""

    last_entry: HistoryEntry | None
    participant_states: dict[str, ParticipantState]
    recent_speakers: list[str]


def detect_addressed(text: str, known_names: frozenset[str]) -> str | None:
    """Public helper: which agent name (if any) is addressed in text."""
    return _detect_addressed_impl(text, known_names)


def _detect_addressed_impl(text: str, known_names: frozenset[str]) -> str | None:
    lower = text.lower()
    for name in known_names:
        # word-boundary-ish check: name surrounded by non-alpha
        pos = lower.find(name.lower())
        if pos == -1:
            continue
        end = pos + len(name)
        before_ok = pos == 0 or not lower[pos - 1].isalpha()
        after_ok = end >= len(lower) or not lower[end].isalpha()
        if before_ok and after_ok:
            return name
    return None


class DiscussionState:
    """Thread-safe shared state for one discussion room."""

    def __init__(self, topic: str, agent_names: list[str]) -> None:
        self.topic = topic
        self.current_speaker: str | None = None
        self.history: list[HistoryEntry] = []
        self.participant_states: dict[str, ParticipantState] = {
            n: ParticipantState() for n in agent_names
        }
        self.user_state = UserState()
        self._agent_names = frozenset(agent_names)
        self._lock = asyncio.Lock()

    async def add_entry(
        self,
        speaker: str,
        text: str,
        *,
        interrupted: bool = False,
    ) -> HistoryEntry:
        async with self._lock:
            entry = HistoryEntry(
                speaker=speaker,
                text=text,
                timestamp=time.time(),
                interrupted=interrupted,
                addressed_to=_detect_addressed_impl(text, self._agent_names),
            )
            self.history.append(entry)
            for name, ps in self.participant_states.items():
                if name == speaker:
                    ps.last_spoke_at = entry.timestamp
                    ps.exchanges_since_spoke = 0
                else:
                    ps.exchanges_since_spoke += 1
            if speaker == "You":
                self.user_state.last_spoke_at = entry.timestamp
            return entry

    async def mark_interrupted(self, entry: HistoryEntry) -> None:
        async with self._lock:
            entry.interrupted = True

    async def set_speaker(self, speaker: str | None) -> None:
        async with self._lock:
            self.current_speaker = speaker

    async def get_speaker(self) -> str | None:
        async with self._lock:
            return self.current_speaker

    async def set_user_speaking(self, speaking: bool) -> None:
        async with self._lock:
            self.user_state.is_speaking = speaking
            if speaking:
                self.user_state.last_spoke_at = time.time()

    async def set_topic(self, topic: str) -> None:
        async with self._lock:
            self.topic = topic

    async def snapshot(self) -> StateSnapshot:
        async with self._lock:
            return StateSnapshot(
                last_entry=self.history[-1] if self.history else None,
                participant_states={
                    k: ParticipantState(v.last_spoke_at, v.exchanges_since_spoke)
                    for k, v in self.participant_states.items()
                },
                recent_speakers=[e.speaker for e in self.history[-8:]],
            )

    async def format_transcript(self, n: int = 20) -> str:
        async with self._lock:
            entries = self.history[-n:]
        lines: list[str] = []
        for e in entries:
            tag = " [INTERRUPTED]" if e.interrupted else ""
            lines.append(f"{e.speaker}: {e.text}{tag}")
        return "\n".join(lines)
