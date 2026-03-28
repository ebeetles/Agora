import { motion } from 'framer-motion'
import { useState } from 'react'

const EASE_OUT = [0, 0, 0.2, 1]

const EXAMPLE_TOPICS = [
  'Should I start a company',
  'Is social media making us lonelier',
  'What makes a great leader',
  'Does art need to be difficult',
  'Is remote work the future',
]

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function EntryScreen({ onStart, loading, error, onRetry }) {
  const [topic, setTopic] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const t = topic.trim()
    if (!t || loading) return
    onStart(t)
  }


  function focusTopic() {
    scrollToId('start-room')
    requestAnimationFrame(() => {
      document.getElementById('topic-input')?.focus()
    })
  }

  return (
    <motion.div
      className="min-h-dvh w-full"
      style={{ backgroundColor: '#0A0A0A' }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: 'easeInOut' }}
    >
      <header className="flex w-full items-center justify-between px-8 pt-8">
        <span
          className="text-white"
          style={{
            fontFamily: 'var(--font-serif), Georgia, serif',
            fontSize: 16,
            fontWeight: 500,
          }}
        >
          Agora
        </span>
        <nav className="flex items-center gap-8">
          <button
            type="button"
            onClick={() => scrollToId('how-it-works')}
            className="cursor-pointer border-0 bg-transparent p-0 text-[12px] text-[#666] transition-colors duration-200 hover:text-white"
            style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif' }}
          >
            How it works
          </button>
          <button
            type="button"
            onClick={focusTopic}
            className="cursor-pointer border-0 bg-transparent p-0 text-[12px] text-[#666] transition-colors duration-200 hover:text-white"
            style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif' }}
          >
            Start a Room
          </button>
        </nav>
      </header>

      <div className="mx-auto w-full max-w-[680px] px-8 pb-24">
        <section id="start-room" className="scroll-mt-8 pt-[120px]">
          <motion.h1
            className="mx-auto max-w-[min(100%,36rem)] text-center text-white"
            style={{
              fontFamily: 'var(--font-serif), Georgia, serif',
              fontSize: 'clamp(2rem, 6vw, 3.5rem)',
              lineHeight: 1.15,
              fontWeight: 500,
            }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
          >
            Every question deserves more than one answer.
          </motion.h1>

          <motion.p
            className="mx-auto mt-8 max-w-[480px] text-center"
            style={{
              fontFamily: 'var(--font-sans), system-ui, sans-serif',
              fontSize: 18,
              lineHeight: 1.6,
              color: '#888',
            }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.15 }}
          >
            Agora creates a live discussion room with AI voices that think differently,
            disagree genuinely, and respond to you in real time.
          </motion.p>

          <motion.form
            onSubmit={handleSubmit}
            className="mx-auto mt-12 flex w-full max-w-[520px] flex-col items-center gap-6"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.3 }}
          >
            <input
              id="topic-input"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="what do you want to talk about"
              disabled={loading}
              className="w-full border-0 border-b bg-transparent pb-2.5 text-center text-white placeholder:text-[#555] focus:outline-none disabled:opacity-50"
              style={{
                borderColor: '#333',
                borderBottomWidth: 1,
                fontFamily: 'var(--font-sans), system-ui, sans-serif',
                fontSize: 18,
                maxWidth: 520,
              }}
            />

            <motion.button
              type="submit"
              disabled={!topic.trim() || loading}
              className="w-full cursor-pointer border bg-transparent py-3 transition-colors duration-200 hover:bg-white hover:text-[#0A0A0A] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-white"
              style={{
                borderWidth: 0.5,
                borderColor: 'rgba(255,255,255,0.85)',
                fontFamily: 'var(--font-sans), system-ui, sans-serif',
                fontSize: 15,
                fontWeight: 500,
                color: '#fff',
              }}
              animate={loading ? { opacity: [0.55, 1, 0.55] } : { opacity: 1 }}
              transition={
                loading
                  ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }
                  : undefined
              }
            >
              {loading ? 'Configuring...' : 'Continue'}
            </motion.button>
          </motion.form>

          {error ? (
            <div className="mx-auto mt-10 flex max-w-[520px] flex-col items-center gap-4 text-center">
              <p
                className="text-sm font-light text-[#888]"
                style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif' }}
              >
                {error}
              </p>
              <button
                type="button"
                onClick={onRetry}
                className="border-0 bg-transparent text-xs uppercase tracking-widest text-[#666] transition-colors hover:text-white"
                style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif' }}
              >
                Retry
              </button>
            </div>
          ) : null}
        </section>

        <section
          id="how-it-works"
          className="mt-[140px] grid scroll-mt-12 grid-cols-1 gap-12 md:grid-cols-3 md:gap-[48px]"
        >
          {[
            {
              n: '01',
              title: 'Set the topic',
              body: 'Type anything — a decision, a question, a debate. Agora does the rest.',
            },
            {
              n: '02',
              title: 'Meet your room',
              body: 'A cast of distinct AI voices is assembled specifically for your topic.',
            },
            {
              n: '03',
              title: 'Join the conversation',
              body: 'Speak or type. The room responds to you like real people would.',
            },
          ].map((step, i) => (
            <motion.div
              key={step.n}
              className="flex flex-col items-center text-center"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.55,
                ease: EASE_OUT,
                delay: 0.5 + i * 0.1,
              }}
            >
              <span
                className="mb-4"
                style={{
                  fontFamily: 'var(--font-serif), Georgia, serif',
                  fontSize: 13,
                  color: '#333',
                }}
              >
                {step.n}
              </span>
              <h2
                className="mb-3 text-white"
                style={{
                  fontFamily: 'var(--font-serif), Georgia, serif',
                  fontSize: 16,
                  fontWeight: 600,
                }}
              >
                {step.title}
              </h2>
              <p
                style={{
                  fontFamily: 'var(--font-sans), system-ui, sans-serif',
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: '#666',
                }}
              >
                {step.body}
              </p>
            </motion.div>
          ))}
        </section>

        <motion.section
          className="mt-[100px] flex flex-col items-center"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.85 }}
        >
          <p
            className="mb-6 text-center uppercase"
            style={{
              fontFamily: 'var(--font-sans), system-ui, sans-serif',
              fontSize: 11,
              letterSpacing: '2px',
              color: '#444',
            }}
          >
            Try one of these
          </p>
          <div className="flex max-w-full flex-wrap justify-center gap-3">
            {EXAMPLE_TOPICS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTopic(t)}
                className="cursor-pointer rounded-full border-[0.5px] border-[#2a2a2a] bg-transparent px-4 py-2 text-[12px] text-[#888] transition-colors duration-200 hover:border-[#555] hover:text-white"
                style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif' }}
              >
                {t}
              </button>
            ))}
          </div>
        </motion.section>

        <motion.footer
          className="mt-[80px] text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45, ease: EASE_OUT, delay: 1 }}
        >
          <p
            style={{
              fontFamily: 'var(--font-sans), system-ui, sans-serif',
              fontSize: 11,
              color: '#333',
            }}
          >
            Made with Anthropic Claude.
          </p>
        </motion.footer>
      </div>
    </motion.div>
  )
}
