from pathlib import Path

from dotenv import load_dotenv

from livekit import agents
from livekit.agents import AgentServer, AgentSession, Agent, TurnHandlingOptions
from livekit.plugins import cartesia, deepgram, anthropic, silero

_backend_dir = Path(__file__).resolve().parent
# Load env from the folder that contains this file (works even if cwd is not `backend/`)
for _env_name in (".env", ".env.local"):
    load_dotenv(_backend_dir / _env_name)

EDGE_INSTRUCTIONS = (
    "You are Edge, a sharp skeptical thinker in a live discussion "
    "about whether college is worth it. Keep responses to 2 sentences "
    "maximum. Be direct and opinionated."
)

CARTESIA_VOICE_BLAKE = "a167e0f3-df7e-4d52-a9c3-f949145efdab"


class Edge(Agent):
    def __init__(self) -> None:
        super().__init__(instructions=EDGE_INSTRUCTIONS)


server = AgentServer()


@server.rtc_session(agent_name="edge-agent")
async def edge_entrypoint(ctx: agents.JobContext):
    # Use STT endpointing (Deepgram speech_final) to end turns. A separate ML turn
    # detector + VAD can disagree with the browser mic and leave you with transcripts
    # but no LLM reply — "stt" matches Deepgram's utterance boundaries.
    session = AgentSession(
        stt=deepgram.STT(model="nova-3", language="en"),
        llm=anthropic.LLM(model="claude-sonnet-4-6"),
        tts=cartesia.TTS(model="sonic-3", voice=CARTESIA_VOICE_BLAKE),
        vad=silero.VAD.load(),
        turn_handling=TurnHandlingOptions(
            turn_detection="stt",
            endpointing={"min_delay": 0.35, "max_delay": 2.5},
        ),
    )

    await session.start(room=ctx.room, agent=Edge())

    await session.generate_reply(
        instructions="Introduce yourself briefly as Edge and state your position on the topic."
    )


if __name__ == "__main__":
    agents.cli.run_app(server)
