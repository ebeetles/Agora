"""
Launch the Agora multi-agent discussion.

All three agents run inside a single process sharing a DiscussionState.
Press Ctrl+C to shut down.
"""

import asyncio

from multi_agent import run_orchestrator


def main() -> None:
    print("  starting Agora orchestrator (Edge, Sage, Spark)…")
    try:
        asyncio.run(run_orchestrator())
    except KeyboardInterrupt:
        print("\n  shutting down…")


if __name__ == "__main__":
    main()
