import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'

// ─── SVG Portrait faces ──────────────────────────────────────────────────────
// Editorial line-art style. Each face is drawn to match the agent's personality.

function EdgeFace() {
  // Angular features, raised left brow, direct skeptical gaze, corners slightly down
  return (
    <svg viewBox="0 0 90 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      {/* Face — angular jaw, defined cheekbones */}
      <path
        d="M45 9 C57 9 67 20 67 35 L65 61 C64 72 58 82 51 87 L45 91 39 87 C32 82 26 72 25 61 L23 35 C23 20 33 9 45 9Z"
        fill="rgba(240,210,185,0.042)" stroke="#484848" strokeWidth="0.85"
      />
      {/* Left brow — raised arch (skeptical) */}
      <path d="M27 37 C30 32 35 31 40 33" stroke="#5a5a5a" strokeWidth="1.15" strokeLinecap="round" fill="none" />
      {/* Right brow — more level, slightly lower */}
      <path d="M50 33 C56 31 61 33 65 37" stroke="#5a5a5a" strokeWidth="1.1" strokeLinecap="round" fill="none" />
      {/* Left eye — slightly narrowed, direct gaze */}
      <path d="M28 43 Q34 39.5 40 43" stroke="#535353" strokeWidth="0.95" strokeLinecap="round" fill="none" />
      <path d="M28 43 Q34 46 40 43" stroke="#535353" strokeWidth="0.95" strokeLinecap="round" fill="none" />
      <circle cx="34" cy="43" r="1.9" fill="#3a3a3a" />
      <circle cx="34.7" cy="42.3" r="0.6" fill="#5a5a5a" />
      {/* Right eye */}
      <path d="M50 43 Q56 39.5 62 43" stroke="#535353" strokeWidth="0.95" strokeLinecap="round" fill="none" />
      <path d="M50 43 Q56 46 62 43" stroke="#535353" strokeWidth="0.95" strokeLinecap="round" fill="none" />
      <circle cx="56" cy="43" r="1.9" fill="#3a3a3a" />
      <circle cx="56.7" cy="42.3" r="0.6" fill="#5a5a5a" />
      {/* Nose — angular, clean strokes */}
      <path d="M44 50 L42 60 L39 61" stroke="#484848" strokeWidth="0.8" strokeLinecap="round" fill="none" />
      <path d="M46 50 L48 60 L51 61" stroke="#484848" strokeWidth="0.8" strokeLinecap="round" fill="none" />
      {/* Mouth — skeptical, corners drop slightly */}
      <path d="M37 71 C40 70 43 71 45 71 C47 71 50 70 53 71" stroke="#525252" strokeWidth="0.95" strokeLinecap="round" fill="none" />
      <path d="M37 71 L36 73" stroke="#525252" strokeWidth="0.8" strokeLinecap="round" />
      <path d="M53 71 L54 73" stroke="#525252" strokeWidth="0.8" strokeLinecap="round" />
      {/* Neck suggestion */}
      <path d="M40 90 L39 98" stroke="#3e3e3e" strokeWidth="0.7" strokeLinecap="round" />
      <path d="M50 90 L51 98" stroke="#3e3e3e" strokeWidth="0.7" strokeLinecap="round" />
    </svg>
  )
}

function SageFace() {
  // Rounder softer face, level brows, downward contemplative gaze, neutral mouth
  return (
    <svg viewBox="0 0 90 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      {/* Face — full oval, softer jaw */}
      <path
        d="M45 11 C58 11 67 23 67 38 L66 62 C65 74 58 84 50 88 L45 91 40 88 C32 84 25 74 24 62 L23 38 C23 23 32 11 45 11Z"
        fill="rgba(240,210,185,0.042)" stroke="#484848" strokeWidth="0.85"
      />
      {/* Left brow — soft, gently inward */}
      <path d="M28 38 C32 36 36 36 40 37" stroke="#585858" strokeWidth="1.05" strokeLinecap="round" fill="none" />
      {/* Right brow — matching, level */}
      <path d="M50 37 C54 36 58 36 62 38" stroke="#585858" strokeWidth="1.05" strokeLinecap="round" fill="none" />
      {/* Left eye — iris sits lower (downward gaze) */}
      <path d="M29 44 Q35 41 41 44" stroke="#535353" strokeWidth="0.9" strokeLinecap="round" fill="none" />
      <path d="M29 44 Q35 48 41 44" stroke="#535353" strokeWidth="0.9" strokeLinecap="round" fill="none" />
      <circle cx="35" cy="45" r="2.1" fill="#3a3a3a" />
      <circle cx="35.7" cy="44.4" r="0.65" fill="#5a5a5a" />
      {/* Right eye */}
      <path d="M49 44 Q55 41 61 44" stroke="#535353" strokeWidth="0.9" strokeLinecap="round" fill="none" />
      <path d="M49 44 Q55 48 61 44" stroke="#535353" strokeWidth="0.9" strokeLinecap="round" fill="none" />
      <circle cx="55" cy="45" r="2.1" fill="#3a3a3a" />
      <circle cx="55.7" cy="44.4" r="0.65" fill="#5a5a5a" />
      {/* Nose — rounded, gentle curve */}
      <path d="M45 50 C44.5 54 43 57 41 59 C43 62 47 62 49 59 C47 57 45.5 54 45 50" stroke="#484848" strokeWidth="0.75" fill="rgba(240,210,185,0.025)" strokeLinecap="round" />
      {/* Mouth — gently neutral, barely a hint of upturn */}
      <path d="M38 72 C41 72 43 73 45 73 C47 73 49 72 52 72" stroke="#525252" strokeWidth="0.9" strokeLinecap="round" fill="none" />
      {/* Neck */}
      <path d="M40 90 L39 98" stroke="#3e3e3e" strokeWidth="0.7" strokeLinecap="round" />
      <path d="M50 90 L51 98" stroke="#3e3e3e" strokeWidth="0.7" strokeLinecap="round" />
    </svg>
  )
}

function SparkFace() {
  // Wider open face, both brows raised, upward gaze, clear smile
  return (
    <svg viewBox="0 0 90 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      {/* Face — slightly wider, open, rounded at jaw */}
      <path
        d="M45 10 C59 10 69 21 69 36 L68 59 C67 71 60 81 51 86 L45 90 39 86 C30 81 23 71 22 59 L21 36 C21 21 31 10 45 10Z"
        fill="rgba(240,210,185,0.042)" stroke="#484848" strokeWidth="0.85"
      />
      {/* Left brow — raised high, arched expressively */}
      <path d="M25 38 C29 32 35 31 40 34" stroke="#5a5a5a" strokeWidth="1.15" strokeLinecap="round" fill="none" />
      {/* Right brow — raised matching */}
      <path d="M50 34 C55 31 61 32 65 38" stroke="#5a5a5a" strokeWidth="1.15" strokeLinecap="round" fill="none" />
      {/* Left eye — open wide, pupil higher (upward gaze) */}
      <path d="M25 44 Q32 40 39 44" stroke="#535353" strokeWidth="0.95" strokeLinecap="round" fill="none" />
      <path d="M25 44 Q32 49 39 44" stroke="#535353" strokeWidth="0.95" strokeLinecap="round" fill="none" />
      <circle cx="32" cy="43" r="2.2" fill="#3a3a3a" />
      <circle cx="32.8" cy="42.2" r="0.65" fill="#5a5a5a" />
      {/* Right eye */}
      <path d="M51 44 Q58 40 65 44" stroke="#535353" strokeWidth="0.95" strokeLinecap="round" fill="none" />
      <path d="M51 44 Q58 49 65 44" stroke="#535353" strokeWidth="0.95" strokeLinecap="round" fill="none" />
      <circle cx="58" cy="43" r="2.2" fill="#3a3a3a" />
      <circle cx="58.8" cy="42.2" r="0.65" fill="#5a5a5a" />
      {/* Nose — simple, open */}
      <path d="M45 50 L43 60 L41 61" stroke="#484848" strokeWidth="0.8" strokeLinecap="round" fill="none" />
      <path d="M45 50 L47 60 L49 61" stroke="#484848" strokeWidth="0.8" strokeLinecap="round" fill="none" />
      {/* Mouth — clear smile, corners lift */}
      <path d="M36 71 C39 75 42 76 45 76 C48 76 51 75 54 71" stroke="#525252" strokeWidth="0.95" strokeLinecap="round" fill="none" />
      <path d="M36 71 L35.5 69" stroke="#525252" strokeWidth="0.8" strokeLinecap="round" />
      <path d="M54 71 L54.5 69" stroke="#525252" strokeWidth="0.8" strokeLinecap="round" />
      {/* Neck */}
      <path d="M40 89 L39 98" stroke="#3e3e3e" strokeWidth="0.7" strokeLinecap="round" />
      <path d="M50 89 L51 98" stroke="#3e3e3e" strokeWidth="0.7" strokeLinecap="round" />
    </svg>
  )
}

const FACE_MAP = { Edge: EdgeFace, Sage: SageFace, Spark: SparkFace }

// ─── Sound wave ──────────────────────────────────────────────────────────────

function SoundWave({ color }) {
  const bars = [
    { height: [3, 7, 3], duration: 0.48 },
    { height: [5, 8, 4], duration: 0.56 },
    { height: [3, 6, 3], duration: 0.52 },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 10 }}>
      {bars.map((b, i) => (
        <motion.div
          key={i}
          style={{ width: 4, borderRadius: 2, backgroundColor: color, originY: 1 }}
          animate={{ height: b.height.map((h) => `${h}px`) }}
          transition={{
            duration: b.duration,
            repeat: Infinity,
            delay: i * 0.14,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

// ─── Agent card ──────────────────────────────────────────────────────────────

function AgentCard({ agent, isSpeaking, isThinking, reactBump }) {
  const FaceComponent = FACE_MAP[agent.name] || SageFace

  const borderColor = isThinking
    ? `${agent.color}77`
    : isSpeaking
      ? agent.color
      : '#2a2a2a'

  return (
    <motion.div
      style={{
        width: 90,
        height: 110,
        backgroundColor: '#141414',
        borderRadius: 12,
        border: `${isSpeaking ? '1px' : '0.5px'} ${isThinking ? 'dashed' : 'solid'} ${borderColor}`,
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        flexShrink: 0,
      }}
      animate={{
        rotate: reactBump ? -2 : 0,
        scale:
          reactBump || isSpeaking || isThinking
            ? 1
            : [0.98, 1, 0.98],
      }}
      transition={
        reactBump
          ? { rotate: { duration: 0.3, ease: 'easeOut' }, scale: { duration: 0.2 } }
          : isSpeaking || isThinking
            ? { duration: 0.2 }
            : { scale: { duration: 3, repeat: Infinity, ease: 'easeInOut' }, rotate: { duration: 0.2 } }
      }
    >
      {/* Portrait area */}
      <motion.div
        style={{ width: '100%', height: 90, padding: '6px 4px 0' }}
        animate={isThinking ? { opacity: [0.7, 1, 0.7] } : { opacity: 1 }}
        transition={
          isThinking
            ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.3 }
        }
      >
        <FaceComponent />
      </motion.div>

      {/* Sound wave or spacer */}
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
              transition={{ duration: 0.2 }}
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
      return () => {
        clearTimeout(tHold)
        clearTimeout(tClear)
      }
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
      animate={{
        opacity: 1,
        y: slice.offset.y,
        x: slice.offset.x,
      }}
      transition={{
        opacity: { delay: entryIndex * 0.3, duration: 0.35 },
        y: entryIndex === 0 && slice.offset.y === 0
          ? { delay: entryIndex * 0.3, duration: 0.35, type: 'tween', ease: 'easeOut' }
          : offsetTransition || { type: 'tween', duration: 2, ease: 'easeInOut' },
        x: offsetTransition || { type: 'tween', duration: 2, ease: 'easeInOut' },
      }}
    >
      <AgentCard
        agent={agent}
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
        className="mt-0.5 max-w-[100px] truncate text-center text-[10px] text-[#666]"
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
                className="inline text-[11px] text-white"
                style={{ opacity: 0.85 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.85 }}
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
