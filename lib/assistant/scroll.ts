/**
 * Cue's jump to a section of the page (ticket 148).
 *
 * Scrolling is the one thing Cue does on its own: it never leaves the page,
 * changes filters or fills anything in. The section gets a short amber ring so
 * the eye lands on it. With reduced motion the scroll is instant; the ring
 * still shows, since it doesn't move.
 *
 * A jump the visitor asked for (a button) moves focus too. Cue's own jump
 * after a reply leaves focus where it was, so typing isn't interrupted.
 */

// Amber reads on both the dark and the light page grounds (3:1 or better).
const RING = ['outline-2', 'outline-offset-2', 'outline-amber'] as const
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
export function jumpToSection(ids: readonly string[], { focus = true }: { focus?: boolean } = {}): boolean {
  const el = findSection(ids)
  if (!el) return false

  el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' })

  if (focus) {
    // Focus without a second jump, so screen readers land where the eye does.
    // A tabindex we add goes again on blur, so Tab doesn't stop there later.
    if (!el.hasAttribute('tabindex')) {
      el.setAttribute('tabindex', '-1')
      el.addEventListener('blur', () => el.removeAttribute('tabindex'), { once: true })
    }
    el.focus({ preventScroll: true })
  }

  // Take off only what we put on, so a section's own outline stays.
  const added = RING.filter((c) => !el.classList.contains(c))
  el.classList.add(...added)
  window.setTimeout(() => el.classList.remove(...added), RING_MS)
  return true
}
