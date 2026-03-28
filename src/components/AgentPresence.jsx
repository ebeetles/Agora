import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'

// ─── Abstract face configs ────────────────────────────────────────────────────
// No face outline — just floating marks. Mouth paths share identical SVG command
// structure (M + C) so Framer Motion can interpolate between them.

// Three abstract face presets — assigned by agent index, not by name
const FACE_CONFIG_LIST = [
  {
    // Preset A: sharp raised arch on one side — skeptical asymmetry
    leftBrow:  'M 23 33 C 26 28 33 27 38 29',
    rightBrow: 'M 52 29 C 57 27 63 28 67 32',
    leftEye:   { cx: 30, cy: 44, r: 5.5, pupilY: 0 },
    rightEye:  { cx: 60, cy: 44, r: 5.5, pupilY: 0 },
    mouth: {
      resting:   'M 33 65 C 38 65 52 65 57 65',
      talkOpen:  'M 33 63 C 38 70 52 70 57 63',
      talkClose: 'M 33 64 C 38 67 52 67 57 64',
    },
  },
  {
    // Preset B: level brows, downward gaze — calm, measured
    leftBrow:  'M 25 35 C 29 32 34 32 38 33',
    rightBrow: 'M 52 33 C 56 32 61 32 65 35',
    leftEye:   { cx: 31, cy: 47, r: 6,   pupilY: 1.5 },
    rightEye:  { cx: 59, cy: 47, r: 6,   pupilY: 1.5 },
    mouth: {
      resting:   'M 34 66 C 38 67 52 67 56 66',
      talkOpen:  'M 34 64 C 38 71 52 71 56 64',
      talkClose: 'M 34 66 C 38 69 52 69 56 66',
    },
  },
  {
    // Preset C: high arched brows, upward gaze — open, energetic
    leftBrow:  'M 20 33 C 24 27 31 26 37 28',
    rightBrow: 'M 53 28 C 59 26 66 27 70 33',
    leftEye:   { cx: 28, cy: 43, r: 6.5, pupilY: -1.5 },
    rightEye:  { cx: 62, cy: 43, r: 6.5, pupilY: -1.5 },
    mouth: {
      resting:   'M 33 68 C 37 72 53 72 57 68',
      talkOpen:  'M 33 64 C 37 73 53 73 57 64',
      talkClose: 'M 33 66 C 37 71 53 71 57 66',
    },
  },
]

// ─── Abstract face SVG ───────────────────────────────────────────────────────

function AbstractFace({ config, isSpeaking }) {
  const { leftBrow, rightBrow, leftEye, rightEye, mouth } = config

  return (
    <svg
      viewBox="0 0 90 90"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 90, display: 'block' }}
    >
      {/* Brows */}
      <path d={leftBrow}  stroke="#5a5a5a" strokeWidth="1.15" strokeLinecap="round" />
      <path d={rightBrow} stroke="#565656" strokeWidth="1.05" strokeLinecap="round" />

      {/* Left eye: filled circle with a lighter pupil highlight */}
      <circle cx={leftEye.cx} cy={leftEye.cy} r={leftEye.r} fill="#444444" />
      <circle
        cx={leftEye.cx + 0.8}
        cy={leftEye.cy + leftEye.pupilY - 0.9}
        r={leftEye.r * 0.38}
        fill="#666"
      />

      {/* Right eye */}
      <circle cx={rightEye.cx} cy={rightEye.cy} r={rightEye.r} fill="#444444" />
      <circle
        cx={rightEye.cx + 0.8}
        cy={rightEye.cy + rightEye.pupilY - 0.9}
        r={rightEye.r * 0.38}
        fill="#666"
      />

      {/* Mouth — morphs while speaking */}
      <motion.path
        d={mouth.resting}
        animate={{
          d: isSpeaking
            ? [mouth.talkOpen, mouth.talkClose, mouth.talkOpen]
            : mouth.resting,
        }}
        transition={{
          d: isSpeaking
            ? { duration: 0.38, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.28, ease: 'easeOut' },
        }}
        stroke="#545454"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

// ─── Sound wave (below portrait) ─────────────────────────────────────────────

function SoundWave({ color }) {
  const bars = [
    { heights: [2, 7, 2], duration: 0.46 },
    { heights: [4, 8, 3], duration: 0.54 },
    { heights: [2, 6, 2], duration: 0.50 },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 10 }}>
      {bars.map((b, i) => (
        <motion.div
          key={i}
          style={{ width: 4, borderRadius: 2, backgroundColor: color }}
          animate={{ height: b.heights.map((h) => `${h}px`) }}
          transition={{ duration: b.duration, repeat: Infinity, delay: i * 0.13, ease: 'easeInOut' }}
        />
      ))}
    </div>
  )
}

// ─── Agent card ───────────────────────────────────────────────────────────────

function AgentCard({ agent, agentIndex, isSpeaking, isThinking, reactBump }) {
  const config = FACE_CONFIG_LIST[agentIndex % FACE_CONFIG_LIST.length]

  const borderStyle = isThinking
    ? `0.5px dashed ${agent.color}77`
    : isSpeaking
      ? `1px solid ${agent.color}`
      : '0.5px solid #2a2a2a'

  // Card animation: bob when speaking, slow drift when thinking, breathe when idle
  let cardAnimate, cardTransition
  if (reactBump) {
    cardAnimate   = { rotate: -2, y: 0, scale: 1 }
    cardTransition = { duration: 0.28, ease: 'easeOut' }
  } else if (isSpeaking) {
    cardAnimate   = { rotate: 0, y: [0, -6, 0], scale: 1 }
    cardTransition = {
      y:      { duration: 0.44, repeat: Infinity, ease: 'easeInOut' },
      rotate: { duration: 0.15 },
      scale:  { duration: 0.15 },
    }
  } else if (isThinking) {
    cardAnimate   = { rotate: 0, y: [0, -2, 0], scale: 1 }
    cardTransition = {
      y:      { duration: 1.8, repeat: Infinity, ease: 'easeInOut' },
      rotate: { duration: 0.15 },
      scale:  { duration: 0.15 },
    }
  } else {
    cardAnimate   = { rotate: 0, y: 0, scale: [0.98, 1, 0.98] }
    cardTransition = {
      scale:  { duration: 3, repeat: Infinity, ease: 'easeInOut' },
      rotate: { duration: 0.2 },
      y:      { duration: 0.25 },
    }
  }

  return (
    <motion.div
      style={{
        width: 90,
        height: 110,
        backgroundColor: '#141414',
        borderRadius: 12,
        border: borderStyle,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        flexShrink: 0,
      }}
      animate={cardAnimate}
      transition={cardTransition}
    >
      {/* Portrait — dims while thinking */}
      <motion.div
        style={{ width: '100%' }}
        animate={isThinking ? { opacity: [0.65, 1, 0.65] } : { opacity: 1 }}
        transition={
          isThinking
            ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.3 }
        }
      >
        <AbstractFace config={config} isSpeaking={isSpeaking} />
      </motion.div>

      {/* Sound wave zone */}
      <div
        style={{
          height: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
        }}
      >
        <AnimatePresence>
          {isSpeaking && !isThinking && (
            <motion.div
              key="wave"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <SoundWave color={agent.color} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ─── Full agent presence ──────────────────────────────────────────────────────

export function AgentPresence({
  agent,
  layout,
  slice,
  entryIndex,
  offsetTransition,
}) {
  const { leftPct, topPct, align } = layout

  const streamingText = useMemo(
    () => slice.captionWords.join(''),
    [slice.captionWords],
  )

  const [holdText, setHoldText] = useState('')
  const [captionVisible, setCaptionVisible] = useState(true)
  const [reactBump, setReactBump] = useState(false)
  const endTickRef = useRef(0)

  useEffect(() => {
    const tick = slice.captionEndTick || 0
    if (tick !== endTickRef.current && slice.lastCaptionFull) {
      endTickRef.current = tick
      setHoldText(slice.lastCaptionFull)
      setCaptionVisible(true)
      const tHold = window.setTimeout(() => setCaptionVisible(false), 2000)
      const tClear = window.setTimeout(() => setHoldText(''), 2500)
      return () => { clearTimeout(tHold); clearTimeout(tClear) }
    }
  }, [slice.captionEndTick, slice.lastCaptionFull])

  useEffect(() => {
    if (streamingText.length > 0) {
      setHoldText('')
      setCaptionVisible(true)
    }
  }, [streamingText])

  useEffect(() => {
    if (!slice.reactTick) return
    setReactBump(true)
    const t = window.setTimeout(() => setReactBump(false), 300)
    return () => clearTimeout(t)
  }, [slice.reactTick])

  const captionAlign =
    align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center'

  const words = streamingText
    ? streamingText.match(/\S+\s*/g) || []
    : holdText
      ? [holdText]
      : []

  return (
    <motion.div
      className="absolute flex flex-col items-center"
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        translateX: '-50%',
        translateY: '-50%',
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: slice.offset.y, x: slice.offset.x }}
      transition={{
        opacity: { delay: entryIndex * 0.3, duration: 0.35 },
        y: offsetTransition || { type: 'tween', duration: 2, ease: 'easeInOut' },
        x: offsetTransition || { type: 'tween', duration: 2, ease: 'easeInOut' },
      }}
    >
      <AgentCard
        agent={agent}
        agentIndex={entryIndex}
        isSpeaking={slice.isSpeaking}
        isThinking={slice.isThinking}
        reactBump={reactBump}
      />

      <p
        className="mt-2 text-center text-[12px] text-white"
        style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontWeight: 400 }}
      >
        {agent.name}
      </p>
      <p
        className="mt-0.5 max-w-[100px] truncate text-center text-[10px] text-[#555]"
        title={agent.personality}
      >
        {agent.personality}
      </p>

      {/* Caption */}
      <div
        className={`mt-3 min-h-[2rem] max-w-[200px] ${captionAlign}`}
        style={{ lineHeight: 1.5 }}
      >
        <motion.div
          animate={{ opacity: captionVisible ? 1 : 0 }}
          transition={{ duration: 0.5 }}
        >
          <AnimatePresence mode="popLayout">
            {words.map((w, i) => (
              <motion.span
                key={`${slice.captionEndTick}-${i}-${w}`}
                className="inline text-[11px]"
                style={{ color: 'rgba(255,255,255,0.8)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.04 }}
              >
                {w}
              </motion.span>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  )
}
