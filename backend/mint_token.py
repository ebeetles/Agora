#!/usr/bin/env python3
"""
Print a LiveKit JWT for joining the Agora room as a human (listen + speak).

Uses LIVEKIT_API_KEY and LIVEKIT_API_SECRET from backend/.env — no `lk` CLI required.

Usage (from the backend folder):
    python mint_token.py
    python mint_token.py --identity alex --name Alex
"""

from __future__ import annotations

import argparse
import datetime
from pathlib import Path

from dotenv import load_dotenv
from livekit import api

from config import ROOM_NAME

_backend = Path(__file__).resolve().parent
for _env in (".env", ".env.local"):
    load_dotenv(_backend / _env)


def main() -> None:
    p = argparse.ArgumentParser(description="Mint a human join token for Agora")
    p.add_argument(
        "--identity",
        default="you",
        help="Participant identity (must not be edge, sage, or spark)",
    )
    p.add_argument("--name", default="You", help="Display name")
    p.add_argument(
        "--room",
        default=ROOM_NAME,
        help=f"Room name (default: {ROOM_NAME})",
    )
    p.add_argument(
        "--hours",
        type=int,
        default=24,
        help="How long the token is valid (default: 24)",
    )
    args = p.parse_args()


    token = (
        api.AccessToken()
        .with_ttl(datetime.timedelta(hours=args.hours))
        .with_identity(args.identity)
        .with_name(args.name)
        .with_grants(api.VideoGrants(room_join=True, room=args.room))
        .to_jwt()
    )
    print(token)


if __name__ == "__main__":
    main()
