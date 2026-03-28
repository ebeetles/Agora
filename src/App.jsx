import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useState } from 'react'
import { EntryScreen } from './components/EntryScreen'
import { PreviewScreen } from './components/PreviewScreen'
import { Room } from './components/Room'

function ConfiguringScreen({ topic }) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        width: '100%',
        backgroundColor: '#0A0A0A',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <p
        style={{
          color: '#555',
          fontFamily: 'var(--font-sans), system-ui, sans-serif',
          fontSize: 13,
          textTransform: 'uppercase',
          letterSpacing: '2px',
          margin: 0,
          textAlign: 'center',
          maxWidth: 480,
          padding: '0 24px',
        }}
      >
        {topic}
      </p>

      <div
        style={{
          marginTop: 24,
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        {[0, 1, 2].map((i) => (
          <PulsingDot key={i} delay={i * 0.2} />
        ))}
      </div>

      <p
        style={{
          marginTop: 16,
          color: '#444',
          fontFamily: 'var(--font-sans), system-ui, sans-serif',
          fontSize: 12,
          margin: '16px 0 0',
        }}
      >
        Assembling your room
      </p>
    </div>
  )
}

function PulsingDot({ delay }) {
  return (
    <motion.div
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        backgroundColor: '#333',
      }}
      animate={{ backgroundColor: ['#333', '#666', '#333'] }}
      transition={{
        duration: 0.8,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  )
}

export default function App() {
  const [phase, setPhase] = useState('entry')
  const [loading, setLoading] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [error, setError] = useState(null)
  const [session, setSession] = useState(null)
  const [pendingTopic, setPendingTopic] = useState('')
  const [roomConfig, setRoomConfig] = useState(null)

  const configureRoom = useCallback(async (topic) => {
    setError(null)
    setLoading(true)
    setPendingTopic(topic)
    setPhase('configuring')
    try {
      const res = await fetch('/api/configure-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Request failed (${res.status})`)
      }
      const config = await res.json()
      setRoomConfig(config)
      setPhase('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not configure room')
      setPhase('entry')
    } finally {
      setLoading(false)
    }
  }, [])

  const regenerate = useCallback(() => {
    if (pendingTopic) configureRoom(pendingTopic)
  }, [pendingTopic, configureRoom])

  const launchRoom = useCallback(async (topic, agents) => {
    setError(null)
    setLaunching(true)
    try {
      const res = await fetch('/api/create-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, agents }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Request failed (${res.status})`)
      }
      const data = await res.json()
      setSession({
        roomName: data.roomName,
        token: data.token,
        wsUrl: data.wsUrl || data.livekitUrl,
        topic: topic.trim(),
        agents: data.agents || [],
      })
      setPhase('room')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start room')
    } finally {
      setLaunching(false)
    }
  }, [])

  const leaveRoom = useCallback(async () => {
    if (session?.roomName) {
      try {
        await fetch(`/api/room/${session.roomName}`, { method: 'DELETE' })
      } catch {
        /* ignore */
      }
    }
    setSession(null)
    setRoomConfig(null)
    setPendingTopic('')
    setPhase('entry')
    setError(null)
  }, [session])

  const handleConnectionLost = useCallback(() => {
    setError('Connection lost')
    setSession(null)
    setPhase('entry')
  }, [])

  return (
    <>
      <AnimatePresence mode="wait">
        {phase === 'entry' ? (
          <EntryScreen
            key="entry"
            onStart={configureRoom}
            loading={loading}
            error={error}
            onRetry={() => setError(null)}
          />
        ) : null}
      </AnimatePresence>

      {phase === 'configuring' ? (
        <ConfiguringScreen topic={pendingTopic} />
      ) : null}

      {phase === 'preview' && roomConfig ? (
        <PreviewScreen
          topic={pendingTopic}
          config={roomConfig}
          onRegenerate={regenerate}
          onLaunch={launchRoom}
          launching={launching}
        />
      ) : null}

      {phase === 'room' && session ? (
        <Room
          session={session}
          onLeave={leaveRoom}
          onConnectionLost={handleConnectionLost}
        />
      ) : null}
    </>
  )
}
