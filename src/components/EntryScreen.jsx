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

const STEPS = [
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
    body: 'Speak or type. The room hears you and responds like real people would.',
  },
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

  function handleTopicPill(t) {
    setTopic(t)
    scrollToId('start-room')
    requestAnimationFrame(() => {
      document.getElementById('topic-input')?.focus()
    })
  }

  return (
    <motion.div
      className="relative min-h-dvh w-full overflow-x-hidden"
      style={{ backgroundColor: '#0A0A0A' }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: 'easeInOut' }}
    >
      {/* Grain texture overlay */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          opacity: 0.038,
          pointerEvents: 'none',
          zIndex: 50,
          mixBlendMode: 'overlay',
        }}
      />

      {/* Ambient radial glow behind the hero */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -60,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 900,
          height: 700,
          background:
            'radial-gradient(ellipse at 50% 28%, rgba(255,255,255,0.038) 0%, transparent 62%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Header */}
      <header className="relative z-10 flex w-full items-center justify-between px-8 pt-8">
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
            className="cursor-pointer border-0 bg-transparent p-0 text-[12px] text-[#555] transition-colors duration-200 hover:text-white"
            style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif' }}
          >
            How it works
          </button>
          <button
            type="button"
            onClick={focusTopic}
            className="cursor-pointer border-0 bg-transparent p-0 text-[12px] text-[#555] transition-colors duration-200 hover:text-white"
            style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif' }}
          >
            Start a Room
          </button>
        </nav>
      </header>

      <div className="relative z-10 mx-auto w-full max-w-[680px] px-8 pb-32">
        {/* ── Hero ── */}
        <section id="start-room" className="scroll-mt-8 pt-[96px]">
          {/* Wordmark */}
          <motion.h1
            className="mb-5 text-center text-white"
            style={{
              fontFamily: 'var(--font-serif), Georgia, serif',
              fontSize: 'clamp(2.5rem, 7vw, 4.25rem)',
              fontWeight: 500,
              letterSpacing: '0.06em',
              lineHeight: 1,
            }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: EASE_OUT }}
          >
            Agora
          </motion.h1>

          {/* Eyebrow */}
          <motion.p
            className="mb-10 text-center"
            style={{
              fontFamily: 'var(--font-sans), system-ui, sans-serif',
              fontSize: 11,
              letterSpacing: '2.5px',
              color: '#383838',
              textTransform: 'uppercase',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.55, ease: EASE_OUT, delay: 0.1 }}
          >
            AI Discussion Rooms
          </motion.p>

          {/* Headline */}
          <motion.p
            className="mx-auto max-w-[min(100%,34rem)] text-center text-white"
            style={{
              fontFamily: 'var(--font-serif), Georgia, serif',
              fontSize: 'clamp(1.75rem, 4.5vw, 2.75rem)',
              lineHeight: 1.15,
              fontWeight: 500,
              letterSpacing: '-0.01em',
            }}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: EASE_OUT, delay: 0.2 }}
          >
            Every question deserves more than one answer.
          </motion.p>

          {/* Subheading */}
          <motion.p
            className="mx-auto mt-7 max-w-[420px] text-center"
            style={{
              fontFamily: 'var(--font-sans), system-ui, sans-serif',
              fontSize: 16,
              lineHeight: 1.65,
              color: '#6e6e6e',
              fontWeight: 300,
            }}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: EASE_OUT, delay: 0.3 }}
          >
            A live room of AI voices that think differently, disagree genuinely, and
            respond to you in real time.
          </motion.p>

          {/* Input + CTA */}
          <motion.form
            onSubmit={handleSubmit}
            className="mx-auto mt-12 flex w-full max-w-[480px] flex-col items-center gap-5"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: EASE_OUT, delay: 0.42 }}
          >
            <input
              id="topic-input"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="what do you want to talk about"
              disabled={loading}
              className="w-full border-0 border-b bg-transparent pb-3 text-center text-white placeholder:text-[#3e3e3e] focus:outline-none disabled:opacity-50"
              style={{
                borderColor: '#1f1f1f',
                borderBottomWidth: 1,
                fontFamily: 'var(--font-sans), system-ui, sans-serif',
                fontSize: 17,
              }}
            />

            <motion.button
              type="submit"
              disabled={!topic.trim() || loading}
              className="w-full cursor-pointer border bg-transparent py-3 transition-colors duration-200 hover:bg-white hover:text-[#0A0A0A] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-white"
              style={{
                borderWidth: 0.5,
                borderColor: 'rgba(255,255,255,0.75)',
                fontFamily: 'var(--font-sans), system-ui, sans-serif',
                fontSize: 14,
                fontWeight: 500,
                color: '#fff',
                letterSpacing: '0.025em',
              }}
              animate={loading ? { opacity: [0.45, 1, 0.45] } : { opacity: 1 }}
              transition={
                loading
                  ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }
                  : undefined
              }
            >
              {loading ? 'Configuring…' : 'Continue'}
            </motion.button>

            <p
              style={{
                fontFamily: 'var(--font-sans), system-ui, sans-serif',
                fontSize: 11,
                color: '#2e2e2e',
                margin: 0,
              }}
            >
              No account needed.
            </p>
          </motion.form>

          {/* Error state */}
          {error ? (
            <div className="mx-auto mt-10 flex max-w-[480px] flex-col items-center gap-4 text-center">
              <p
                className="text-sm font-light text-[#777]"
                style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif' }}
              >
                {error}
              </p>
              <button
                type="button"
                onClick={onRetry}
                className="border-0 bg-transparent text-xs uppercase tracking-widest text-[#555] transition-colors hover:text-white"
                style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif' }}
              >
                Retry
              </button>
            </div>
          ) : null}
        </section>

        {/* ── Section divider ── */}
        <div
          style={{
            marginTop: 120,
            height: 1,
            background:
              'linear-gradient(90deg, transparent, #1e1e1e 20%, #1e1e1e 80%, transparent)',
          }}
        />

        {/* ── How it works ── */}
        <section id="how-it-works" className="mt-16 scroll-mt-12">
          <motion.p
            className="mb-12 text-center"
            style={{
              fontFamily: 'var(--font-sans), system-ui, sans-serif',
              fontSize: 11,
              letterSpacing: '2.5px',
              color: '#383838',
              textTransform: 'uppercase',
            }}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
          >
            How it works
          </motion.p>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.n}
                className="flex flex-col items-center p-7 text-center"
                style={{ border: '0.5px solid #191919', borderRadius: 2 }}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, ease: EASE_OUT, delay: i * 0.09 }}
              >
                <span
                  className="mb-5"
                  style={{
                    fontFamily: 'var(--font-serif), Georgia, serif',
                    fontSize: 12,
                    color: '#2c2c2c',
                    fontStyle: 'italic',
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
                    margin: '0 0 12px',
                  }}
                >
                  {step.title}
                </h2>
                <p
                  style={{
                    fontFamily: 'var(--font-sans), system-ui, sans-serif',
                    fontSize: 13,
                    lineHeight: 1.65,
                    color: '#595959',
                    margin: 0,
                  }}
                >
                  {step.body}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── Example topics ── */}
        <motion.section
          className="mt-20 flex flex-col items-center"
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
        >
          <p
            className="mb-6 text-center"
            style={{
              fontFamily: 'var(--font-sans), system-ui, sans-serif',
              fontSize: 11,
              letterSpacing: '2.5px',
              color: '#383838',
              textTransform: 'uppercase',
            }}
          >
            Try one of these
          </p>
          <div className="flex max-w-full flex-wrap justify-center gap-2.5">
            {EXAMPLE_TOPICS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleTopicPill(t)}
                className="cursor-pointer rounded-full border-[0.5px] border-[#1e1e1e] bg-transparent px-4 py-[9px] text-[12px] text-[#666] transition-all duration-200 hover:border-[#3a3a3a] hover:text-white"
                style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif' }}
              >
                {t}
              </button>
            ))}
          </div>
        </motion.section>

        {/* ── Footer ── */}
        <motion.footer
          style={{
            marginTop: 80,
            paddingTop: 24,
            borderTop: '0.5px solid #191919',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-20px' }}
          transition={{ duration: 0.45, ease: EASE_OUT }}
        >
          <span
            style={{
              fontFamily: 'var(--font-serif), Georgia, serif',
              fontSize: 14,
              fontWeight: 500,
              color: '#3a3a3a',
            }}
          >
            Agora
          </span>
          <p
            style={{
              fontFamily: 'var(--font-sans), system-ui, sans-serif',
              fontSize: 11,
              color: '#333',
              margin: 0,
            }}
          >
            Made with Anthropic Claude.
          </p>
        </motion.footer>
      </div>
    </motion.div>
  )
}
