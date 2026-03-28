/**
 * Percent positions for agent avatars in the upper two thirds.
 * @param {number} n agent count
 * @returns {{ leftPct: number, topPct: number, align: 'left'|'right'|'center' }[]}
 */
export function layoutAgentPresences(n) {
  if (n <= 0) return []
  if (n === 1) {
    return [{ leftPct: 50, topPct: 36, align: 'center' }]
  }
  if (n === 2) {
    return [
      { leftPct: 28, topPct: 32, align: 'left' },
      { leftPct: 72, topPct: 32, align: 'right' },
    ]
  }
  if (n === 3) {
    return [
      { leftPct: 28, topPct: 32, align: 'left' },
      { leftPct: 72, topPct: 32, align: 'right' },
      { leftPct: 50, topPct: 56, align: 'center' },
    ]
  }
  const rows = Math.ceil(n / 2)
  const out = []
  for (let i = 0; i < n; i++) {
    const col = i % 2
    const row = Math.floor(i / 2)
    const leftPct = col === 0 ? 26 : 74
    const topPct = 22 + (row * 70) / Math.max(1, rows)
    const align = col === 0 ? 'left' : 'right'
    out.push({ leftPct, topPct, align })
  }
  return out
}
