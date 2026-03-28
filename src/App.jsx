import { AnimatePresence } from 'framer-motion'
import { useCallback, useState } from 'react'
import { EntryScreen } from './components/EntryScreen'
import { Room } from './components/Room'

export default function App() {
  const [phase, setPhase] = useState('entry')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [session, setSession] = useState(null)

  const startRoom = useCallback(async (topic) => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/create-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
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
      setLoading(false)
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
            onStart={startRoom}
            loading={loading}
            error={error}
            onRetry={() => setError(null)}
          />
        ) : null}
      </AnimatePresence>

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
