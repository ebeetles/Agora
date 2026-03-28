# Agora – Edge Agent Backend

A LiveKit voice agent that joins a room as **Edge**, a sharp skeptical thinker who debates whether college is worth it.

Pipeline: **Deepgram STT → Anthropic Claude Sonnet → Cartesia TTS**

## Intended behavior

1. You run **`python agent.py dev`** in `backend/` (worker registers with LiveKit and waits for jobs).
2. You connect a client (e.g. [Agents Playground](https://agents-playground.livekit.io)) with **Agent name `edge-agent`** — that starts a job and joins the agent to your room.
3. Edge speaks first (short intro), then **you talk**; your speech is transcribed, then **Claude** replies, then **Cartesia** plays Edge’s voice back into the room.

If you **only see text and no spoken reply**, check the worker terminal: common causes are a bad **Anthropic model id** (must be a valid API id such as `claude-sonnet-4-6`), missing **`ANTHROPIC_API_KEY` / `CARTESIA_API_KEY`**, or turn detection never “closing” your utterance (this project uses **`turn_detection="stt"`** so Deepgram’s `speech_final` ends your turn).

## Prerequisites

- Python 3.10+
- A [LiveKit Cloud](https://cloud.livekit.io/) project (free tier works)
- API keys for [Deepgram](https://console.deepgram.com/), [Anthropic](https://console.anthropic.com/), and [Cartesia](https://play.cartesia.ai/)

## Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Copy the env template and fill in your keys in **`backend/.env`** (same folder as `agent.py`):

```bash
cp .env.example .env
```

**`LIVEKIT_URL`** must be your project’s **WebSocket URL** (starts with `wss://`), from the LiveKit Cloud dashboard — not the HTTP REST URL. If this is missing or wrong, the worker exits with `ws_url is required, or set LIVEKIT_URL`.

Download required model files (Silero VAD):

```bash
python agent.py download-files
```

## Run the agent

### Development mode (auto-connects to LiveKit Cloud)

```bash
python agent.py dev
```

The agent registers with your LiveKit server and waits for a room session.

### Console mode (local testing, no room needed)

```bash
python agent.py console
```

This launches a local terminal session where you can speak directly to Edge through your microphone.

## Connect a test client

### Option A – LiveKit Agents Playground

1. Go to [agents-playground.livekit.io](https://agents-playground.livekit.io)
2. Connect with your LiveKit Cloud project credentials
3. Set the **Agent name** to `edge-agent`
4. Click **Connect** — Edge will greet you and you can start talking

### Option B – LiveKit Meet (self-hosted)

1. Clone [livekit/meet](https://github.com/livekit/meet) and follow its README
2. Create a room; once the agent worker is running in `dev` mode it joins automatically

### Option C – Programmatic token

Generate a token with the LiveKit CLI and open the playground URL:

```bash
lk token create --join --room my-room --identity user1 \
  --api-key $LIVEKIT_API_KEY --api-secret $LIVEKIT_API_SECRET
```

Use the token in any LiveKit client SDK to join the same room.

---

## Multi-agent discussion (`launch.py`) — step by step

Three agents (Edge, Sage, Spark) connect to LiveKit room **`agora-discussion`** from a **single process** sharing a `DiscussionState`. They **do not speak until you join** the same room as a human; then Edge gives the opening line.

**Architecture highlights:**

- **Shared state** — one `DiscussionState` object holds topic, history, speaker, and participant states; all access goes through asyncio locks.
- **Urgency-based turn-taking** — after each statement, every agent scores urgency (addressed-by-name, personality disagreement, build-on potential, silence count, etc.); highest score above 0.35 speaks next; natural 800–1200 ms pause between turns; 2 s silence if no one clears threshold.
- **Room lock** — `asyncio.Lock` mutex; an agent must hold it to generate + speak; others retry with 300–700 ms backoff.
- **Interruption detection** — user's partial STT is scanned for intention signals ("wait", "hold on", "actually", …); active TTS is cancelled immediately and user gets the floor.
- **Idle timeout** — 20 s without human activity pauses all agent turns.

### 0) No extra tools required

You **do not** need the `lk` command. A token is printed by **`mint_token.py`** using the same **`LIVEKIT_API_KEY`** / **`LIVEKIT_API_SECRET`** already in **`backend/.env`**.

*(Optional)* If you like the CLI: `brew install livekit-cli` then `lk cloud auth` — see [LiveKit CLI](https://docs.livekit.io/home/cli/cli-setup/).

### 1) Terminal A — start the orchestrator

1. Open **Terminal** (or your IDE terminal).
2. Go to **`backend`** and activate your venv if you use one:

   ```bash
   cd /path/to/Agora/backend
   source .venv/bin/activate    # Windows: .venv\Scripts\activate
   ```

3. Start:

   ```bash
   python launch.py
   ```

   Or directly: `python multi_agent.py`

Leave this window **open**. You should see log lines like `connected to room 'agora-discussion'` and **`Waiting for a human to join before starting…`**. That is normal — they are waiting for you.

### 2) Terminal B — create a token for *you*

Open a **second** terminal.

1. **`cd` into `backend`** (same folder as `.env`).

2. Activate your venv if you use one, then run:

   ```bash
   python mint_token.py
   ```

3. The script prints **one long line** (a JWT, starts with `eyJ`). **Copy the whole line** — you will paste it into the browser in step 4.

   Optional: `python mint_token.py --identity alex --name Alex`

**Important:** Identity must **not** be `edge`, `sage`, or `spark`.

**If you use `lk` instead** (after `brew install livekit-cli` and `lk cloud auth`):

```bash
lk token create --join --room agora-discussion --identity you --name "You" --valid-for 24h
```

### 3) Terminal C — serve the join page

Open a **third** terminal (or reuse B after the token is copied).

```bash
cd /path/to/Agora/backend
python -m http.server 8765
```

Leave it running. This only serves a small HTML file so your browser can use the microphone reliably.

### 4) Browser — join, listen, talk

1. Open: **http://localhost:8765/join_room.html**
2. **LiveKit URL:** open `backend/.env`, copy the value of **`LIVEKIT_URL`** (must start with `wss://`) and paste it into the first box.
3. **Access token:** paste the **JWT** you copied in step 2.
4. Click **Connect & enable mic** and allow the microphone when the browser asks.

After you connect, Edge should start speaking within a moment. You will hear all agents and they can hear you (your audio is transcribed for the group).

### Quick checklist

| Step | Where        | What |
|------|--------------|------|
| 1    | Terminal A   | `cd backend` → `python launch.py` |
| 2    | Terminal B   | `cd backend` → `python mint_token.py` → copy JWT |
| 3    | Terminal C   | `cd backend` → `python -m http.server 8765` |
| 4    | Browser      | `join_room.html` → `LIVEKIT_URL` + JWT → Connect |

Other clients: any app built with the [LiveKit client SDKs](https://docs.livekit.io/home/client/connect/) using the same **`LIVEKIT_URL`**, **room `agora-discussion`**, and a **human** token works the same way.

### Billing / stopping

- **Disconnect in the browser** only leaves the room as *you*. The Python process keeps running and **can keep calling the LLM and Cartesia** until idle timeout kicks in or you stop it.
- **Always stop `launch.py` with Ctrl+C** when you are done testing.
- **Idle timeout:** if there is **no human join or speech** for **20 seconds**, all agents **pause** (no new LLM/TTS turns) until someone **joins again** or **speaks** (STT picks up speech).

### `DISABLE_TTS` (save Cartesia credits)

In **`backend/.env`** add:

```env
DISABLE_TTS=true
```

Restart `launch.py`. Agents still run the same conversation logic and **Cartesia is never called**; each line is printed to that process’s terminal as `(DISABLE_TTS) …` instead. Set to `false` or remove the line for real voice.

*(Applies to **`multi_agent.py` / `launch.py`**, not the single `agent.py` LiveKit worker.)*
