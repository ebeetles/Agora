import { motion } from 'framer-motion'
import { useState } from 'react'

export function EntryScreen({ onStart, loading, error, onRetry }) {
  const [topic, setTopic] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const t = topic.trim()
    if (!t || loading) return
    onStart(t)
  }

  return (
    <motion.div
      className="fixed inset-0 flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: '#0E0E0E' }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: 'easeInOut' }}
    >
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-[500px] flex-col items-center gap-12"
      >
        <h1
          className="text-white"
          style={{
            fontFamily: 'var(--font-serif), Georgia, serif',
            fontSize: 32,
            fontWeight: 500,
          }}
        >
          Agora
        </h1>

        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="what do you want to talk about"
          disabled={loading}
          className="w-full border-0 border-b bg-transparent pb-2 text-center text-white placeholder:text-[#555] focus:outline-none disabled:opacity-50"
          style={{
            borderColor: '#333',
            borderBottomWidth: 1,
            fontSize: 24,
            maxWidth: 500,
          }}
        />

        <motion.button
          type="submit"
          disabled={!topic.trim() || loading}
          className="border bg-transparent px-10 py-2.5 text-white transition-colors duration-200 hover:bg-white hover:text-[#0E0E0E] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-white"
          style={{ borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' }}
          animate={loading ? { opacity: [0.55, 1, 0.55] } : { opacity: 1 }}
          transition={
            loading
              ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }
              : undefined
          }
        >
          {loading ? 'Starting...' : 'Start Room'}
        </motion.button>
      </form>

      {error ? (
        <div className="mt-10 flex flex-col items-center gap-4 text-center">
          <p className="text-sm font-light text-[#888]">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="text-xs uppercase tracking-widest text-[#666] hover:text-white"
          >
            Retry
          </button>
        </div>
      ) : null}
    </motion.div>
  )
}
