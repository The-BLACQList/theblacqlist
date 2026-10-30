/**
 * Cue's jump to a section of the page (ticket 148).
 *
 * Scrolling is the one thing Cue does on its own: it never leaves the page,
 * changes filters or fills anything in. The section gets a short gold ring so
 * the eye lands on it. With reduced motion there is no smooth scroll and no
 * ring, only focus.
 */

// Amber reads on both the dark and the light page grounds (3:1 or better).
const RING = ['outline-3', 'outline-offset-4', 'outline-amber'] as const
const RING_MS = 2000

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

/** The first of `ids` that is on this page, or null. */
export function findSection(ids: readonly string[]): HTMLElement | null {
  if (typeof document === 'undefined') return null
  for (const id of ids) {
    const el = document.getElementById(id)
    if (el) return el
  }
  return null
}

/**
 * Jumps to the first section of `ids` on this page. Returns false when none is
 * there, so Cue never claims a jump it didn't make.
 */
export function jumpToSection(ids: readonly string[]): boolean {
  const el = findSection(ids)
  if (!el) return false
  const reduce = reducedMotion()

  // Focus without a second jump, so screen readers land where the eye does.
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1')
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  el.focus({ preventScroll: true })

  if (!reduce) {
    el.classList.add(...RING)
    window.setTimeout(() => el.classList.remove(...RING), RING_MS)
  }
  return true
}
