#!/usr/bin/env bash
# start.sh — install dependencies and start Agora (one command)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"

# ── check .env ─────────────────────────────────────────────────────────────────
if [[ ! -f "$BACKEND/.env" ]]; then
  echo ""
  echo "  ✗  backend/.env not found."
  echo "     Copy the template and fill in your API keys:"
  echo ""
  echo "       cp backend/.env.example backend/.env"
  echo ""
  exit 1
fi

# ── cleanup trap ───────────────────────────────────────────────────────────────
SERVER_PID=""
cleanup() {
  if [[ -n "$SERVER_PID" ]]; then
    echo ""
    echo "  → Shutting down API server…"
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

# ── frontend npm deps ──────────────────────────────────────────────────────────
echo "  → Installing frontend dependencies…"
cd "$ROOT"
npm install

# ── Python venv + deps ─────────────────────────────────────────────────────────
echo "  → Setting up Python environment…"
cd "$BACKEND"
if [[ ! -d ".venv" ]]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -r requirements.txt

# ── backend Node deps ──────────────────────────────────────────────────────────
echo "  → Installing server dependencies…"
cd "$BACKEND"
npm install

# ── start Express API server ───────────────────────────────────────────────────
echo "  → Starting API server on :3001…"
node server.js &
SERVER_PID=$!

# Give it a moment to print its ready line before Vite's output arrives
sleep 0.5

# ── start Vite dev server (foreground) ────────────────────────────────────────
echo "  → Starting Vite dev server…"
cd "$ROOT"
npm run dev
