import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

export function TopicObject({ topic, roomName, pulseKey }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(topic)
  const [localPulse, setLocalPulse] = useState(0)

  useEffect(() => {
    setDraft(topic)
  }, [topic])

  useEffect(() => {
    if (pulseKey > 0) setLocalPulse((k) => k + 1)
  }, [pulseKey])

  async function commit() {
    const t = draft.trim()
    setEditing(false)
    if (!t || t === topic) return
    try {
      await fetch('/api/update-topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName, newTopic: t }),
      })
    } catch {
      setDraft(topic)
    }
  }

  return (
    <motion.div
      className="absolute z-20 flex items-center justify-center px-2"
      style={{
        left: '50%',
        top: '44%',
        width: 150,
        height: 36,
        marginLeft: -75,
        marginTop: -18,
        backgroundColor: '#161616',
        borderWidth: 0.5,
        borderColor: '#2a2a2a',
        borderRadius: 8,
      }}
      animate={
        localPulse > 0
          ? { scale: [1, 1.04, 1] }
          : { scale: 1 }
      }
      transition={{ duration: 0.4, ease: 'easeInOut' }}
    >
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') {
              setDraft(topic)
              setEditing(false)
            }
          }}
          className="w-full bg-transparent text-center text-[11px] text-white focus:outline-none"
          style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif' }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="max-w-full truncate px-1 text-[11px] text-white hover:opacity-90"
          style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif' }}
        >
          {topic}
        </button>
      )}
    </motion.div>
  )
}
