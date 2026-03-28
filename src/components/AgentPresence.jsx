import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'

// ─── Visual personality maps ──────────────────────────────────────────────────

const WEIGHT_MAP = {
  ultralight: 100,
  light: 300,
  regular: 400,
  bold: 700,
  heavy: 900,
}

const ENERGY_MAP = {
  still:    { breathDuration: 5,   scaleMin: 0.995, barDuration: 1.2 },
  slow:     { breathDuration: 3.5, scaleMin: 0.97,  barDuration: 0.9 },
  moderate: { breathDuration: 2.5, scaleMin: 0.96,  barDuration: 0.65 },
  lively:   { breathDuration: 1.8, scaleMin: 0.94,  barDuration: 0.45 },
}

const PRESENCE_WIDTH = { contained: 115, balanced: 130, expansive: 148 }
const TEMP_BG        = { cool: '#161820', warm: '#1a1816', neutral: '#181818' }

// Drift transition — shared by all agents, matches spec (2s ease-in-out)
const DRIFT_TRANSITION = { type: 'tween', duration: 2, ease: 'easeInOut' }

// ─── Agent card ───────────────────────────────────────────────────────────────

function AgentCard({ agent, isSpeaking, isThinking, reactBump, reactDirection }) {
  const vp = agent.visualPersonality || {}
  const {
    weight      = 'regular',
    energy      = 'moderate',
    presence    = 'balanced',
    temperature = 'neutral',
  } = vp

  const primaryColor   = agent.color         || '#7A9E87'
  const secondaryColor = agent.secondaryColor || primaryColor

  const fontWeight = WEIGHT_MAP[weight]        || 400
  const energyVars = ENERGY_MAP[energy]        || ENERGY_MAP.moderate
  const cardWidth  = PRESENCE_WIDTH[presence]  || 130
  const bgColor    = TEMP_BG[temperature]      || '#181818'

  const { breathDuration, scaleMin, barDuration } = energyVars

  const isItalic      = presence === 'expansive'
  const letterSpacing = presence === 'contained' ? '-2px' : 'normal'
  const initialLetter = (agent.name || 'A')[0].toUpperCase()

  // ── Card motion ──────────────────────────────────────────────────────
  let cardAnimate, cardTransition
  if (reactBump) {
    const tiltDeg  = reactDirection === 'right' ? 2 : -2
    cardAnimate    = { rotate: tiltDeg, scale: 1 }
    cardTransition = {
      rotate: { duration: 0.15, ease: 'easeOut' },
      scale:  { duration: 0.15 },
    }
  } else if (isSpeaking || isThinking) {
    cardAnimate    = { rotate: 0, scale: 1 }
    cardTransition = {
      rotate: { duration: 0.4, ease: 'easeOut' },
      scale:  { duration: 0.3 },
    }
  } else {
    cardAnimate    = { rotate: 0, scale: [scaleMin, 1.0, scaleMin] }
    cardTransition = {
      rotate: { duration: 0.4, ease: 'easeOut' },
      scale:  { duration: breathDuration, repeat: Infinity, ease: 'easeInOut' },
    }
  }

  // ── Accent bar + letter states ───────────────────────────────────────
  const accentOpacity    = isThinking ? 0.3 : isSpeaking ? 1.0 : 0.65
  const letterAnimate    = isThinking ? { opacity: [0.4, 1.0, 0.4] } : { opacity: 1 }
  const letterTransition = isThinking
    ? { duration: breathDuration, repeat: Infinity, ease: 'easeInOut' }
    : { duration: 0.3 }

  return (
    <motion.div
      style={{
        position: 'relative',
        width: cardWidth,
        height: 150,
        backgroundColor: bgColor,
        borderRadius: 20,
        border: '0.5px solid #2a2a2a',
        overflow: 'hidden',
        flexShrink: 0,
      }}
      animate={cardAnimate}
      transition={cardTransition}
    >
      {/* ── Top accent gradient bar ── */}
      <motion.div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})`,
          overflow: 'hidden',
          borderRadius: '20px 20px 0 0',
        }}
        animate={{ opacity: accentOpacity }}
        transition={{ duration: 0.4 }}
      >
        <AnimatePresence>
          {isSpeaking && (
            <motion.div
              key="shimmer"
              style={{
                position: 'absolute',
                top: 0,
                width: '50%',
                height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)',
              }}
              initial={{ left: '-50%' }}
              animate={{ left: '150%' }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear', repeatType: 'loop' }}
            />
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Initial letter — centered at 45% down ── */}
      {/* Container spans top 90% of card; flex centers letter at 45% of card */}
      <motion.div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '90%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
        animate={letterAnimate}
        transition={letterTransition}
      >
        <span
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: 54,
            fontWeight,
            color: primaryColor,
            fontStyle: isItalic ? 'italic' : 'normal',
            letterSpacing,
            lineHeight: 1,
          }}
        >
          {initialLetter}
        </span>
      </motion.div>

      {/* ── Soundwave — above name, visible while speaking ── */}
      <AnimatePresence>
        {isSpeaking && !isThinking && (
          <motion.div
            key="wave"
            style={{
              position: 'absolute',
              bottom: 30,
              left: 0,
              right: 0,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              gap: 3,
              height: 14,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {[[3, 14, 3], [8, 3, 14], [14, 8, 3]].map((heights, i) => (
              <motion.div
                key={i}
                style={{ width: 3, borderRadius: 1.5, backgroundColor: primaryColor }}
                animate={{ height: heights.map((h) => `${h}px`) }}
                transition={{
                  duration: barDuration,
                  repeat: Infinity,
                  delay: i * 0.12,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Agent name ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: 13,
          fontWeight: 400,
          color: '#ffffff',
          pointerEvents: 'none',
          lineHeight: 1,
        }}
      >
        {agent.name}
      </div>

      {/* ── Disposition ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 4,
          left: '5%',
          right: '5%',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 10,
          fontStyle: 'italic',
          color: '#777',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          lineHeight: 1,
        }}
      >
        {agent.personality}
      </div>
    </motion.div>
  )
}

// ─── Agent presence ───────────────────────────────────────────────────────────

export function AgentPresence({
  agent,
  layout,
  slice,
  entryIndex,
  speakerLayout,   // still used for reaction-tilt direction
}) {
  const { leftPct, topPct } = layout

  const streamingText = useMemo(
    () => slice.captionWords.join(''),
    [slice.captionWords],
  )

  const [holdText, setHoldText]       = useState('')
  const [captionVisible, setCaptionVisible] = useState(false)
  const [reactBump, setReactBump]     = useState(false)
  const endTickRef = useRef(0)

  useEffect(() => {
    const tick = slice.captionEndTick || 0
    if (tick !== endTickRef.current && slice.lastCaptionFull) {
      endTickRef.current = tick
      setHoldText(slice.lastCaptionFull)
      setCaptionVisible(true)
      const tHold  = window.setTimeout(() => setCaptionVisible(false), 2000)
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
    const t = window.setTimeout(() => setReactBump(false), 400)
    return () => clearTimeout(t)
  }, [slice.reactTick])

  // ── Tilt direction for react bump ───────────────────────────────────
  const reactDirection = useMemo(() => {
    if (!reactBump || !speakerLayout) return null
    return speakerLayout.leftPct < leftPct ? 'left' : 'right'
  }, [reactBump, speakerLayout, leftPct])

  const words = streamingText
    ? streamingText.match(/\S+\s*/g) || []
    : holdText
      ? [holdText]
      : []

  return (
    <motion.div
      style={{
        position: 'absolute',
        left: `${leftPct}%`,
        top: `${topPct}%`,
        // Center the anchor point on the base position
        translateX: '-50%',
        translateY: '-50%',
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, x: slice.offset.x, y: slice.offset.y }}
      transition={{
        opacity: { delay: entryIndex * 0.3, duration: 0.35 },
        x: DRIFT_TRANSITION,
        y: DRIFT_TRANSITION,
      }}
    >
      {/*
        Relative wrapper sized exactly to the card so that the caption
        can use `position: absolute, top: 100%` without ever affecting
        the card's own dimensions or layout position.
      */}
      <div style={{ position: 'relative' }}>
        <AgentCard
          agent={agent}
          isSpeaking={slice.isSpeaking}
          isThinking={slice.isThinking}
          reactBump={reactBump}
          reactDirection={reactDirection}
        />

        {/* ── Caption — floats below card, never reflows the card ── */}
        <motion.div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 200,
            textAlign: 'center',
            lineHeight: 1.5,
            pointerEvents: 'none',
            zIndex: 10,
          }}
          animate={{ opacity: captionVisible ? 1 : 0 }}
          transition={{ duration: 0.5 }}
        >
          <AnimatePresence mode="popLayout">
            {words.map((w, i) => (
              <motion.span
                key={`${slice.captionEndTick}-${i}-${w}`}
                style={{
                  display: 'inline',
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.8)',
                }}
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
