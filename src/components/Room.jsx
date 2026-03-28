import {
  LiveKitRoom,
  RoomAudioRenderer,
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

  const [offsetTransition, setOffsetTransition] = useState({
    type: 'tween',
    duration: 2,
    ease: 'easeInOut',
  })
  const prevPulseRef = useRef(0)

  useEffect(() => {
    if (topicPulseKey > prevPulseRef.current) {
      prevPulseRef.current = topicPulseKey
      setOffsetTransition({ type: 'tween', duration: 1.5, ease: 'easeInOut' })
      const t = window.setTimeout(() => {
        setOffsetTransition({ type: 'tween', duration: 2, ease: 'easeInOut' })
      }, 1600)
      return () => clearTimeout(t)
    }
  }, [topicPulseKey])

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

  // Left-percent of the currently-speaking agent, used for directional reaction tilt
  const speakerLeftPct = useMemo(() => {
    const idx = agents.findIndex((a) => getAgentSlice(a.name).isSpeaking)
    if (idx < 0) return null
    return (layouts[idx] || layouts[layouts.length - 1]).leftPct
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
            offsetTransition={offsetTransition}
            speakerLeftPct={speakerLeftPct}
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
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              backgroundColor: '#e0e0e0',
              border: '0.5px solid #333',
            }}
          />
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
