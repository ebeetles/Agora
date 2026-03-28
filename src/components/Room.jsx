import {
  LiveKitRoom,
  RoomAudioRenderer,
  useIsSpeaking,
  useLocalParticipant,
  useRoomContext,
} from '@livekit/components-react'
import { RoomEvent } from 'livekit-client'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { layoutAgentPresences } from '../lib/layoutAgents'
import { useDiscussionState } from '../hooks/useDiscussionState'
import { AgentPresence } from './AgentPresence'
import { TopicObject } from './TopicObject'

// ─── Icons ───────────────────────────────────────────────────────────────────

function MicOnIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" />
    </svg>
  )
}

function MicOffIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3 3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
    </svg>
  )
}

function ChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

// ─── User presence (distinct from agent cards: compact tile + voice rings) ───

const USER_AVATAR_SIZE = 56
const USER_VOICE_GLOW = '0 0 22px rgba(95, 200, 210, 0.45)'

function UserSilhouetteIcon({ muted }) {
  const stroke = muted ? '#6a6a6a' : '#353535'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.25" stroke={stroke} strokeWidth="1.4" />
      <path
        d="M5.5 19.5v-.4c0-2.35 1.9-4.25 4.25-4.25h4.5c2.35 0 4.25 1.9 4.25 4.25v.4"
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

function UserAvatar({ micOn, localParticipant }) {
  const isSpeaking = useIsSpeaking(localParticipant)
  const voiceActive = micOn && isSpeaking
  const r = 16

  return (
    <div
      className="relative flex items-center justify-center"
      style={{
        width: USER_AVATAR_SIZE + 16,
        height: USER_AVATAR_SIZE + 16,
      }}
    >
      {voiceActive ? (
        <>
          <motion.span
            className="pointer-events-none absolute"
            style={{
              width: USER_AVATAR_SIZE,
              height: USER_AVATAR_SIZE,
              borderRadius: r,
              border: '2px solid rgba(120, 215, 225, 0.65)',
              left: '50%',
              top: '50%',
              marginLeft: -USER_AVATAR_SIZE / 2,
              marginTop: -USER_AVATAR_SIZE / 2,
            }}
            initial={{ scale: 1, opacity: 0.65 }}
            animate={{ scale: 1.42, opacity: 0 }}
            transition={{ duration: 0.95, repeat: Infinity, ease: 'easeOut' }}
          />
          <motion.span
            className="pointer-events-none absolute"
            style={{
              width: USER_AVATAR_SIZE,
              height: USER_AVATAR_SIZE,
              borderRadius: r,
              border: '1.5px solid rgba(140, 220, 230, 0.4)',
              left: '50%',
              top: '50%',
              marginLeft: -USER_AVATAR_SIZE / 2,
              marginTop: -USER_AVATAR_SIZE / 2,
            }}
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.42, opacity: 0 }}
            transition={{ duration: 0.95, repeat: Infinity, ease: 'easeOut', delay: 0.4 }}
          />
        </>
      ) : null}

      <motion.div
        className="relative flex items-center justify-center"
        style={{
          width: USER_AVATAR_SIZE,
          height: USER_AVATAR_SIZE,
          borderRadius: r,
          background: micOn
            ? 'linear-gradient(155deg, #efefef 0%, #d6d6d6 55%, #cacaca 100%)'
            : 'linear-gradient(155deg, #3d3d3d 0%, #2c2c2c 100%)',
          border: '1px solid',
          borderColor: micOn ? '#1f1f1f' : '#0d0d0d',
        }}
        animate={
          voiceActive
            ? {
                boxShadow: [
                  USER_VOICE_GLOW,
                  '0 0 28px rgba(95, 200, 210, 0.65)',
                  USER_VOICE_GLOW,
                ],
              }
            : {
                boxShadow: micOn
                  ? 'inset 0 1px 0 rgba(255,255,255,0.35), 0 3px 10px rgba(0,0,0,0.4)'
                  : 'inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.55)',
              }
        }
        transition={
          voiceActive
            ? { duration: 0.55, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.25 }
        }
      >
        <UserSilhouetteIcon muted={!micOn} />
      </motion.div>
    </div>
  )
}

// ─── User caption above the You avatar ───────────────────────────────────────

function UserCaption({ text }) {
  return (
    <AnimatePresence>
      {text ? (
        <motion.div
          key={text}
          className="pointer-events-none absolute w-[220px] text-center"
          style={{ bottom: 'calc(100% + 10px)', left: '50%', transform: 'translateX(-50%)' }}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
        >
          <span className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>
            {text}
          </span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

// ─── Conversation history panel ───────────────────────────────────────────────

function HistoryPanel({ transcript, open, onOpen, onClose }) {
  const listRef = useRef(null)
  const wasNearBottomRef = useRef(true)

  // Track whether user is near bottom during scroll
  const handleScroll = useCallback(() => {
    const el = listRef.current
    if (!el) return
    wasNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 50
  }, [])

  // Auto-scroll on new entries only if user was already near bottom
  useEffect(() => {
    if (!open || !listRef.current) return
    if (wasNearBottomRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [transcript.length, open])

  // Scroll to bottom when panel first opens
  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
      wasNearBottomRef.current = true
    }
  }, [open])

  return (
    <>
      {/* Wrapper positions the tab at the right edge, vertically centered.
          The outer div owns the CSS transform so Framer Motion's x animation
          doesn't conflict with translateY(-50%). */}
      <div
        style={{
          position: 'fixed',
          right: 0,
          top: '50%',
          zIndex: 60,
          pointerEvents: open ? 'none' : 'auto',
        }}
      >
        <AnimatePresence>
          {!open && (
            <motion.button
              key="tab"
              onClick={onOpen}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 56,
                marginTop: -28,
                backgroundColor: '#1c1c1c',
                borderRadius: '8px 0 0 8px',
                border: '1px solid #383838',
                borderRight: 'none',
                color: '#aaa',
                cursor: 'pointer',
              }}
              initial={{ x: 28 }}
              animate={{ x: 0 }}
              exit={{ x: 28 }}
              transition={{ duration: 0.22 }}
              aria-label="Open conversation history"
            >
              <ChevronLeft />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Expanded panel — overlays on top of canvas, does not reflow layout */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            className="fixed z-50 flex flex-col"
            style={{
              right: 0,
              top: 48,       // below the 48px header
              bottom: 0,
              width: 260,
              backgroundColor: 'rgba(10,10,10,0.94)',
              borderLeft: '0.5px solid #1e1e1e',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
            initial={{ x: 260 }}
            animate={{ x: 0 }}
            exit={{ x: 260 }}
            transition={{ type: 'spring', stiffness: 340, damping: 34 }}
          >
            {/* Header */}
            <div
              className="flex shrink-0 items-center justify-between px-3"
              style={{ height: 40, borderBottom: '0.5px solid #1a1a1a' }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: 'white',
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  fontWeight: 400,
                  fontFamily: 'system-ui, sans-serif',
                }}
              >
                Conversation
              </span>
              <button
                onClick={onClose}
                style={{ color: '#444', background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0 }}
                aria-label="Close history panel"
              >
                <ChevronRight />
              </button>
            </div>

            {/* Entries list */}
            <div
              ref={listRef}
              onScroll={handleScroll}
              style={{ flex: 1, overflowY: 'auto', paddingTop: 4, paddingBottom: 16 }}
            >
              {transcript.length === 0 && (
                <p
                  style={{
                    padding: '16px 12px',
                    fontSize: 11,
                    color: '#333',
                    fontFamily: 'system-ui, sans-serif',
                    lineHeight: 1.5,
                  }}
                >
                  The conversation will appear here.
                </p>
              )}
              {transcript.map((entry, i) => (
                <div
                  key={entry.id || `${entry.name}-${i}`}
                  style={{ padding: '10px 12px', borderBottom: '0.5px solid #1a1a1a' }}
                >
                  <p
                    style={{
                      fontSize: 10,
                      color: entry.color || '#888',
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                      marginBottom: 4,
                      fontFamily: 'system-ui, sans-serif',
                      fontWeight: 400,
                    }}
                  >
                    {entry.name}
                  </p>
                  <p
                    style={{
                      fontSize: 12,
                      color: '#ccc',
                      lineHeight: 1.7,
                      margin: 0,
                      fontFamily: 'system-ui, sans-serif',
                      fontWeight: 300,
                    }}
                  >
                    {entry.text}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// ─── Main room canvas ─────────────────────────────────────────────────────────

function RoomCanvas({ session, onLeave }) {
  const room = useRoomContext()
  const { localParticipant } = useLocalParticipant()
  const { agents, roomName, topic: initialTopic } = session

  const { topic, topicPulseKey, transcript, getAgentSlice, addUserEntry } = useDiscussionState(
    room,
    initialTopic,
    agents,
  )

  const [micOn, setMicOn] = useState(true)
  const [textDraft, setTextDraft] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)

  // You avatar caption state
  const [userCaption, setUserCaption] = useState('')
  const captionTimerRef = useRef(null)

  useEffect(() => {
    localParticipant.setMicrophoneEnabled(micOn).catch(() => {})
  }, [micOn, localParticipant])

  const showUserCaption = useCallback((text) => {
    if (!text) return
    setUserCaption(text)
    clearTimeout(captionTimerRef.current)
    captionTimerRef.current = setTimeout(() => setUserCaption(''), 2200)
  }, [])

  // Listen for userCaption events from backend (voice STT) → avatar caption
  useEffect(() => {
    if (!room) return
    const handler = (payload, participant) => {
      if (participant?.sid === room.localParticipant.sid) return
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload))
        if (msg.type === 'userCaption' && typeof msg.text === 'string') {
          showUserCaption(msg.text)
          // Note: useDiscussionState also handles 'userCaption' and adds it to transcript
        }
      } catch {}
    }
    room.on(RoomEvent.DataReceived, handler)
    return () => room.off(RoomEvent.DataReceived, handler)
  }, [room, showUserCaption])

  const layouts = useMemo(() => layoutAgentPresences(agents.length), [agents.length])

  // Full layout of the currently-speaking agent — used for drift direction + reaction tilt
  const speakerLayout = useMemo(() => {
    const idx = agents.findIndex((a) => getAgentSlice(a.name).isSpeaking)
    if (idx < 0) return null
    return layouts[idx] || layouts[layouts.length - 1]
  }, [agents, layouts, getAgentSlice])

  const publishUserText = useCallback(
    async (text) => {
      const t = text.trim()
      if (!t || !localParticipant) return
      const payload = new TextEncoder().encode(
        JSON.stringify({ type: 'userMessage', text: t }),
      )
      await localParticipant.publishData(payload, { reliable: true })
      setTextDraft('')
      showUserCaption(t)
      addUserEntry(t)
    },
    [localParticipant, showUserCaption, addUserEntry],
  )

  return (
    <motion.div
      className="fixed inset-0"
      style={{ backgroundColor: '#0E0E0E' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      {/* ── Header ── */}
      <header
        className="fixed left-0 right-0 top-0 z-40 flex items-center justify-between px-4"
        style={{ height: 48 }}
      >
        <span
          className="text-white"
          style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: 16 }}
        >
          Agora
        </span>
        <p
          className="pointer-events-none max-w-[360px] truncate text-center text-[11px] uppercase text-[#555]"
          style={{ letterSpacing: 3 }}
        >
          {topic}
        </p>
        <button
          type="button"
          onClick={onLeave}
          className="p-2 text-[#555] transition-colors hover:text-white"
          aria-label="Leave room"
        >
          ×
        </button>
      </header>

      {/* ── Room canvas (agents + topic object) ── */}
      {/* Does NOT reflow when history panel opens — panel is an overlay */}
      <div className="absolute inset-0 pt-12" style={{ bottom: 144 }}>
        <TopicObject topic={topic} roomName={roomName} pulseKey={topicPulseKey} />

        {agents.map((agent, i) => (
          <AgentPresence
            key={agent.name}
            agent={agent}
            layout={layouts[i] || layouts[layouts.length - 1]}
            slice={getAgentSlice(agent.name)}
            entryIndex={i}
            speakerLayout={speakerLayout}
          />
        ))}
      </div>

      {/* ── You avatar — floats above the dock ── */}
      <div
        className="fixed left-1/2 -translate-x-1/2 flex flex-col items-center"
        style={{ bottom: 80 }}
      >
        <div className="relative">
          <UserCaption text={userCaption} />
          <UserAvatar micOn={micOn} localParticipant={localParticipant} />
        </div>
        <span
          className="mt-2 text-[11px]"
          style={{ color: 'rgba(255,255,255,0.5)' }}
        >
          You
        </span>
      </div>

      {/* ── Control dock ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-center gap-4 px-5"
        style={{ height: 64, backgroundColor: '#111' }}
      >
        <button
          type="button"
          onClick={() => setMicOn((v) => !v)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors"
          style={{
            border: `1px solid ${micOn ? 'transparent' : '#444'}`,
            backgroundColor: micOn ? '#e8e8e8' : 'transparent',
            color: micOn ? '#111' : '#666',
          }}
          aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}
        >
          {micOn ? <MicOnIcon /> : <MicOffIcon />}
        </button>

        <input
          type="text"
          value={textDraft}
          onChange={(e) => setTextDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') publishUserText(textDraft)
          }}
          placeholder="say something…"
          className="flex-1 bg-transparent text-[12px] text-white placeholder:text-[#3a3a3a] focus:outline-none"
          style={{
            maxWidth: 300,
            borderBottom: '1px solid #272727',
            paddingBottom: 4,
          }}
        />

        <button
          type="button"
          onClick={() => publishUserText(textDraft)}
          disabled={!textDraft.trim()}
          className="shrink-0 text-[13px] text-[#444] transition-colors hover:text-white disabled:pointer-events-none"
          aria-label="Send message"
        >
          ↵
        </button>
      </div>

      {/* ── History panel (overlay, no reflow) ── */}
      <HistoryPanel
        transcript={transcript}
        open={historyOpen}
        onOpen={() => setHistoryOpen(true)}
        onClose={() => setHistoryOpen(false)}
      />
    </motion.div>
  )
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function Room({ session, onLeave, onConnectionLost }) {
  const { token, wsUrl } = session

  return (
    <LiveKitRoom
      serverUrl={wsUrl}
      token={token}
      connect
      audio
      video={false}
      onDisconnected={() => onConnectionLost?.()}
      onError={() => onConnectionLost?.()}
    >
      <RoomAudioRenderer />
      <RoomCanvas session={session} onLeave={onLeave} />
    </LiveKitRoom>
  )
}
