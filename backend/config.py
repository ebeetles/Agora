from dataclasses import dataclass

TOPIC = "Should I drop out of college to pursue my startup?"
ROOM_NAME = "agora-discussion"

VOICE_CONFIDENT_WOMAN = "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc"  # Jacqueline
VOICE_CALM_WOMAN = "f31cc6a7-c1e8-4764-980c-60a361443dd1"  # Robyn
VOICE_ENERGETIC_MAN = "a167e0f3-df7e-4d52-a9c3-f949145efdab"  # Blake


@dataclass(frozen=True)
class AgentConfig:
    identity: str
    name: str
    voice_id: str
    """Cartesia voice id (used when TTS_PROVIDER=cartesia)."""
    openai_voice: str
    """OpenAI TTS voice name (used when TTS_PROVIDER=openai, model tts-1)."""
    disposition: str
    """One-line UI subtitle for the frontend."""
    ui_color: str
    """Hex fill color for the avatar circle in the web UI."""
    system_prompt: str
    disagree_triggers: tuple[str, ...] = ()
    build_on_triggers: tuple[str, ...] = ()
    user_align_triggers: tuple[str, ...] = ()


def _prompt(name: str, personality: str, others: str, topic: str = TOPIC) -> str:
    return (
        f"You are {name}. {personality}\n\n"
        f"You are in a live group discussion room called Agora.\n"
        f'Topic: "{topic}"\n'
        f"Other participants: {others}\n"
        f"Human listeners may also join the room as 'You'.\n\n"
        f"Rules:\n"
        f"- Keep responses to 2 sentences maximum.\n"
        f"- React to what was just said before making your own point.\n"
        f"- Occasionally address other agents by name to create natural dialogue flow.\n"
        f"- Respond naturally — no name prefix, no quotes, just speak.\n"
        f"- Don't repeat what's already been said.\n"
        f"- Never start your response with your own name.\n"
    )


def build_agents(topic: str = TOPIC) -> list[AgentConfig]:
    """Build the three agent configs with the given discussion topic."""
    return [
        AgentConfig(
            identity="edge",
            name="Edge",
            voice_id=VOICE_CONFIDENT_WOMAN,
            openai_voice="onyx",
            disposition="Cuts through polite stories.",
            ui_color="#7A9E87",
            system_prompt=_prompt(
                "Edge",
                "You are sharp, skeptical, and direct. You challenge assumptions "
                "and cut through feel-good narratives. You respect evidence over "
                "emotion. You're not cruel — you're rigorous.",
                "Sage (calm philosophical reasoner) and Spark (energetic creative connector)",
                topic=topic,
            ),
            disagree_triggers=(
                "feel", "believe", "hope", "dream", "passion", "heart",
                "leap of faith", "just do it", "follow your", "meant to be",
                "trust the process",
            ),
            build_on_triggers=(
                "data", "evidence", "statistic", "research", "study", "fact",
                "number", "cost", "return", "market", "revenue", "metric",
            ),
            user_align_triggers=(
                "realistic", "practical", "risk", "cost", "evidence", "proof",
                "actually work", "data", "statistics",
            ),
        ),
        AgentConfig(
            identity="sage",
            name="Sage",
            voice_id=VOICE_CALM_WOMAN,
            openai_voice="echo",
            disposition="Names the question under the fight.",
            ui_color="#6B7FA3",
            system_prompt=_prompt(
                "Sage",
                "You are calm, philosophical, and measured. You find the deeper "
                "question beneath the surface argument. You synthesize opposing "
                "views and illuminate what others missed.",
                "Edge (sharp skeptical thinker) and Spark (energetic creative connector)",
                topic=topic,
            ),
            disagree_triggers=(
                "never", "always", "obviously", "clearly", "simple", "just",
                "easy", "no brainer", "everyone knows", "black and white",
            ),
            build_on_triggers=(
                "question", "why", "meaning", "purpose", "identity", "deeper",
                "beneath", "underlying", "really about", "perspective",
            ),
            user_align_triggers=(
                "meaning", "purpose", "why", "worth", "value", "life",
                "important", "matter", "deeper",
            ),
        ),
        AgentConfig(
            identity="spark",
            name="Spark",
            voice_id=VOICE_ENERGETIC_MAN,
            openai_voice="fable",
            disposition="Finds the door nobody saw.",
            ui_color="#C4A882",
            system_prompt=_prompt(
                "Spark",
                "You are energetic, creative, and lateral. You make unexpected "
                "connections, find analogies nobody saw, and reframe debates into "
                "adventures. You're optimistic but not naive.",
                "Edge (sharp skeptical thinker) and Sage (calm philosophical reasoner)",
                topic=topic,
            ),
            disagree_triggers=(
                "can't", "impossible", "unrealistic", "impractical", "safe",
                "conventional", "traditional", "normal", "standard", "settle",
            ),
            build_on_triggers=(
                "imagine", "what if", "create", "build", "explore", "connect",
                "pattern", "analogy", "new", "different", "experiment",
            ),
            user_align_triggers=(
                "idea", "create", "imagine", "possible", "what if", "try",
                "new", "different", "interesting",
            ),
        ),
    ]


AGENTS: list[AgentConfig] = build_agents()
AGENT_IDENTITIES = frozenset(a.identity for a in AGENTS)


def agents_for_api() -> list[dict[str, str]]:
    """Payload for POST /create-room (topic-independent UI fields)."""
    return [
        {
            "name": a.name,
            "personality": a.disposition,
            "color": a.ui_color,
        }
        for a in build_agents(TOPIC)
    ]
