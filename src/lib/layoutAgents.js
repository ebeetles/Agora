/**
 * Percent positions for agent avatars in the upper two thirds.
 *
 * Each presence div is ~194px tall (150px card + 12px gap + 32px caption
 * min-height), centered on the topPct point via translateY(-50%).
 * Adjacent rows need their topPct values to differ by at least ~34% so
 * the presence divs don't overlap on a ~576px-tall canvas (768px viewport).
 *
 * @param {number} n agent count
 * @returns {{ leftPct: number, topPct: number, align: 'left'|'right'|'center' }[]}
 */
export function layoutAgentPresences(n) {
  if (n <= 0) return []

  if (n === 1) {
    return [{ leftPct: 50, topPct: 35, align: 'center' }]
  }

  if (n === 2) {
    // Side by side, no vertical overlap possible
    return [
      { leftPct: 27, topPct: 30, align: 'left' },
      { leftPct: 73, topPct: 30, align: 'right' },
    ]
  }

  if (n === 3) {
    // Two in the upper row, one below — rows separated by 45% to avoid overlap
    return [
      { leftPct: 27, topPct: 20, align: 'left' },
      { leftPct: 73, topPct: 20, align: 'right' },
      { leftPct: 50, topPct: 65, align: 'center' },
    ]
  }

  if (n === 4) {
    // Two rows of two — rows separated by 45%
    return [
      { leftPct: 27, topPct: 18, align: 'left' },
      { leftPct: 73, topPct: 18, align: 'right' },
      { leftPct: 27, topPct: 63, align: 'left' },
      { leftPct: 73, topPct: 63, align: 'right' },
    ]
  }

  // Fallback for 5+ agents: spread rows evenly between 18% and 65%
  const rows = Math.ceil(n / 2)
  const out = []
  for (let i = 0; i < n; i++) {
    const col = i % 2
    const row = Math.floor(i / 2)
    const leftPct = col === 0 ? 27 : 73
    const topPct  = rows > 1 ? 18 + (row * 47) / (rows - 1) : 40
    const align   = col === 0 ? 'left' : 'right'
    out.push({ leftPct, topPct, align })
  }
  return out
}
