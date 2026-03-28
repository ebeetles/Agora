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
import Anthropic from '@anthropic-ai/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));

const {
  LIVEKIT_URL,
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET,
  ANTHROPIC_API_KEY,
  SERVER_PORT = '3001',
} = process.env;

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

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

function spawnAgents(roomName, topic, agentsJson = null) {
  const python = findPython();
  const script = join(__dirname, 'multi_agent.py');

  const env = {
    ...process.env,
    ROOM_NAME: roomName,
    TOPIC: topic,
  };
  if (agentsJson) {
    env.AGENTS_JSON = agentsJson;
  }

  const proc = spawn(python, [script], {
    cwd: __dirname,
    stdio: ['pipe', 'pipe', 'pipe'],
    env,
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

const CONFIGURE_ROOM_SYSTEM_PROMPT = `You are a room configuration agent for Agora, a live voice discussion platform. Your job is to design the ideal cast of agents for a discussion on the given topic.

Analyze the topic carefully. Decide how many agents between 2 and 4 would create the richest most dynamic discussion. Choose perspectives that will create genuine tension and interesting dynamics. Think about what voices are missing from most conversations about this topic. Never create agents who all agree or think similarly.

For each agent output the following fields:
name — a real human first name only. Never a concept label like The Skeptic. Just Marcus, just Lena.
disposition — maximum 5 words describing their essential quality. Sharp and economical.
color — a muted hex color with personality. No bright or saturated colors. Each agent must have a visually distinct color from the others.
systemPrompt — a full detailed second person system prompt written as you are [name]. Include: who they are and what shaped them in 3 sentences. Their core position on this specific topic and why. Exactly how they speak — sentence rhythm, length, whether they use data or stories or questions. How they relate to each other agent in the cast by name. Their blind spots — what they consistently miss or underweight. What makes them more animated, defensive, or curious. End every system prompt with these exact lines: Speak in 2 sentences maximum. You are in a live voice conversation. React to what was just said before making your own point. Never say you are an AI. Never use other agents names more than once per response.

Also output these top level fields:
roomMood — one evocative single word describing the energy of this room.
topicFraming — one sentence reframing the topic to make it maximally interesting for this specific cast of agents.

Respond only in valid JSON. No markdown fences. No explanation. Just the raw JSON object matching this exact schema:
{
  "roomMood": "string",
  "topicFraming": "string",
  "agents": [
    {
      "name": "string",
      "disposition": "string",
      "color": "string",
      "systemPrompt": "string"
    }
  ]
}`;

app.post('/configure-room', async (req, res) => {
  const topic = String(req.body?.topic ?? '').trim();
  if (!topic) return res.status(400).json({ error: 'topic is required' });

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: CONFIGURE_ROOM_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Topic: ${topic}` }],
    });

    let raw = message.content[0].text.trim();
    // Strip markdown code fences if present
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const config = JSON.parse(raw);
    res.json(config);
  } catch (err) {
    console.error('configure-room error:', err);
    res.status(500).json({ error: String(err) });
  }
});

app.post('/create-room', async (req, res) => {
  const topic = String(req.body?.topic ?? '').trim();
  if (!topic) return res.status(400).json({ error: 'topic is required' });

  const customAgents = req.body?.agents;
  const roomName = `agora-${crypto.randomBytes(4).toString('hex')}`;
  const identity = `human-${crypto.randomBytes(3).toString('hex')}`;

  try {
    const token = await mintToken(identity, 'You', roomName);
    const agentsJson = customAgents ? JSON.stringify(customAgents) : null;
    const proc = spawnAgents(roomName, topic, agentsJson);
    rooms.set(roomName, { proc });
    console.log(`[${roomName}] created — topic: "${topic}"`);

    const agentsForFrontend = customAgents
      ? customAgents.map((a) => ({
          name: a.name,
          personality: a.disposition,
          color: a.color,
        }))
      : agentsPayload();

    res.json({
      roomName,
      token,
      wsUrl: LIVEKIT_URL,
      livekitUrl: LIVEKIT_URL,
      agents: agentsForFrontend,
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
