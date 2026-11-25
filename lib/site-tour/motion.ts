// The site tour's timings (Look A). No single move is longer than 700 ms, and
// with reduced motion on every move is an instant cut.

export const MOTION = {
  fast: 120,
  base: 200,
  slow: 320,
  scroll: 600,
  /** The opening title card, before the question. */
  opening: 1600,
  /** A chapter card; reduced motion keeps the hold. */
  chapter: 1000,
  /** The longest a page crossing stays dark. */
  cross: 700,
  /** The Collective: after its own opening, and the cap on waiting for it. */
  collectiveSettle: 200,
  collectiveCap: 8000,
  /** Cue's answer. */
  wait: 12_000,
} as const

/** cubic-bezier(0.16, 1, 0.3, 1), near enough, for the scroll. */
export function easeOut(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)
}

/** Scroll the window in one eased move. Returns a way to stop it. */
export function glideTo(top: number, reduce: boolean, done: () => void): () => void {
  const from = window.scrollY
  const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
  const to = Math.min(Math.max(0, top), max)
  if (reduce || Math.abs(to - from) < 2) {
    window.scrollTo(0, to)
    done()
    return () => {}
  }
  const start = performance.now()
  let frame = requestAnimationFrame(function tick(now) {
    const t = Math.min(1, (now - start) / MOTION.scroll)
    window.scrollTo(0, from + (to - from) * easeOut(t))
    if (t < 1) frame = requestAnimationFrame(tick)
    else done()
  })
  return () => cancelAnimationFrame(frame)
}
