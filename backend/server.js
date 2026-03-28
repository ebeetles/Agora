/**
 * Agora API server
 *
 * POST /create-room  { topic: string }
 *   → spawns Python agent orchestrator, mints a LiveKit token for the human,
 *     returns { roomName, token, livekitUrl }
 *
 * DELETE /room/:roomName
 *   → kills the agent process for that room
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { execFileSync, spawn } from 'child_process';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { AccessToken } from 'livekit-server-sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));

const {
  LIVEKIT_URL,
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET,
  SERVER_PORT = '3001',
} = process.env;

if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
  console.error(
    '✗  Missing LIVEKIT_URL, LIVEKIT_API_KEY, or LIVEKIT_API_SECRET in backend/.env',
  );
  process.exit(1);
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

/** roomName → { proc: ChildProcess } */
const rooms = new Map();

// ── helpers ────────────────────────────────────────────────────────

function findPython() {
  for (const candidate of [
    join(__dirname, '.venv', 'bin', 'python'),
    join(__dirname, '.venv', 'bin', 'python3'),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return 'python3';
}

async function mintToken(identity, name, roomName) {
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
    name,
    ttl: '24h',
  });
  at.addGrant({ roomJoin: true, room: roomName });
  return at.toJwt();
}

function agentsPayload() {
  const py = findPython();
  const out = execFileSync(
    py,
    [
      '-c',
      'import json; from config import agents_for_api; print(json.dumps(agents_for_api()))',
    ],
    { cwd: __dirname, encoding: 'utf8', env: process.env },
  );
  return JSON.parse(out.trim());
}

function spawnAgents(roomName, topic) {
  const python = findPython();
  const script = join(__dirname, 'multi_agent.py');

  const proc = spawn(python, [script], {
    cwd: __dirname,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ROOM_NAME: roomName,
      TOPIC: topic,
    },
  });

  proc.stdout.on('data', (d) => process.stdout.write(`[${roomName}] ${d}`));
  proc.stderr.on('data', (d) => process.stderr.write(`[${roomName}] ${d}`));
  proc.on('exit', (code, signal) => {
    console.log(`[${roomName}] agents exited (code=${code} signal=${signal})`);
    rooms.delete(roomName);
  });

  return proc;
}

// ── routes ─────────────────────────────────────────────────────────

app.post('/create-room', async (req, res) => {
  const topic = String(req.body?.topic ?? '').trim();
  if (!topic) return res.status(400).json({ error: 'topic is required' });

  const roomName = `agora-${crypto.randomBytes(4).toString('hex')}`;
  const identity = `human-${crypto.randomBytes(3).toString('hex')}`;

  try {
    const token = await mintToken(identity, 'You', roomName);
    const proc = spawnAgents(roomName, topic);
    rooms.set(roomName, { proc });
    console.log(`[${roomName}] created — topic: "${topic}"`);
    res.json({
      roomName,
      token,
      wsUrl: LIVEKIT_URL,
      livekitUrl: LIVEKIT_URL,
      agents: agentsPayload(),
    });
  } catch (err) {
    console.error('create-room error:', err);
    res.status(500).json({ error: String(err) });
  }
});

app.post('/update-topic', (req, res) => {
  const roomName = String(req.body?.roomName ?? '').trim();
  const newTopic = String(req.body?.newTopic ?? '').trim();
  if (!roomName || !newTopic) {
    return res.status(400).json({ error: 'roomName and newTopic are required' });
  }
  const room = rooms.get(roomName);
  if (!room) return res.status(404).json({ error: 'room not found' });
  try {
    if (!room.proc.stdin?.writable) {
      return res.status(500).json({ error: 'agent stdin not available' });
    }
    room.proc.stdin.write(
      `${JSON.stringify({ cmd: 'set_topic', topic: newTopic })}\n`,
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('update-topic error:', err);
    res.status(500).json({ error: String(err) });
  }
});

app.delete('/room/:roomName', (req, res) => {
  const { roomName } = req.params;
  const room = rooms.get(roomName);
  if (!room) return res.status(404).json({ error: 'room not found' });

  room.proc.kill('SIGTERM');
  rooms.delete(roomName);
  console.log(`[${roomName}] deleted by client`);
  res.json({ ok: true });
});

// ── process cleanup ────────────────────────────────────────────────

function cleanupAll() {
  for (const [name, { proc }] of rooms) {
    console.log(`Stopping agents for room ${name}…`);
    proc.kill('SIGTERM');
  }
  rooms.clear();
}

process.on('SIGINT', () => { cleanupAll(); process.exit(0); });
process.on('SIGTERM', () => { cleanupAll(); process.exit(0); });

// ── start ──────────────────────────────────────────────────────────

app.listen(Number(SERVER_PORT), () => {
  console.log(`Agora API server listening on http://localhost:${SERVER_PORT}`);
});
