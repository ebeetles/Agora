import { AnimatePresence, motion } from 'framer-motion'

export function TranscriptStrip({ lines }) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 flex h-14 items-center justify-center gap-0 border-t px-4"
      style={{
        backgroundColor: '#0a0a0a',
        borderTopWidth: 0.5,
        borderColor: '#1a1a1a',
      }}
    >
      <div className="flex max-w-full items-center gap-0 overflow-hidden">
        <AnimatePresence initial={false}>
          {lines.map((line, i) => (
            <motion.div
              key={line.id || `${line.name}-${i}`}
              className="flex min-w-0 items-center gap-3 px-3"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              {i > 0 ? (
                <div
                  className="h-6 w-px shrink-0"
                  style={{ backgroundColor: '#222' }}
                />
              ) : null}
              <div className="flex min-w-0 max-w-[180px] flex-col gap-0.5">
                <span className="truncate text-[10px]" style={{ color: line.color }}>
                  {line.name}
                </span>
                <span className="truncate text-[10px] leading-tight text-[#555]">
                  {line.text}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
