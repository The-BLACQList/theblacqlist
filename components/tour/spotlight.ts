// The only file in the Tester Tour that touches the DOM directly, and the only
// one that touches DOM it does not own — the Save button belongs to
// SaveButton.tsx, the results grid to DiscoveryGrid.tsx.
//
// ⚠ THE CONTRACT: nothing in this file may throw. The rail mounts in the ROOT
// layout, so an uncaught error here is not a missing spotlight — it is a 500 on
// the public marketplace for a visitor who has never heard of the tour. Every
// function returns early on a null and every mutation is inside a try/catch.
// Same contract, for the same reason, as `resolveTourViewer` in lib/tour/witness.ts.
//
// Kept deliberately thin (~a hundred lines of mechanism, no decisions). The
// DECISIONS live in lib/tour/targets.ts, which is pure and therefore testable —
// vitest runs in a node environment with no jsdom, so nothing in this file can
// be unit-tested at all. If logic can move up into `planSpotlight`, it must.

const SPOTLIGHT_CLASS = 'blacq-tour-spotlight'
const PENDING_KEY = 'blacq-tour-pending-spotlight'
/** A spotlight intent that survived a hard navigation goes stale fast. */
const PENDING_TTL_MS = 30_000

/** Elements we gave a tabIndex to, so cleanup can take it back. */
let borrowedTabIndex: Element | null = null
let spotlit: Element | null = null
/** The element whose inline scroll-margin-top we set, and what it was before. */
let marginedEl: HTMLElement | null = null
let marginBefore = ''

/** Below `md` (48rem) the floating rail panel covers the lower screen. */
const NARROW_QUERY = '(width < 48rem)'

/**
 * The first VISIBLE element matching any selector, tried in list order.
 *
 * Both halves matter:
 *
 *   * Visibility. A listing page renders up to three Save buttons — the hero
 *     one plus the mobile and desktop quick-action bars — and the quick-action
 *     bar renders BEFORE the hero in document order while being
 *     `translate-y-full` / `opacity-0 pointer-events-none`. A bare
 *     `querySelector` reliably returns an invisible button.
 *   * List order, not document order. `querySelectorAll` with a comma-joined
 *     selector resolves in DOCUMENT order, which is wrong for step 5: the
 *     correction trigger renders above the reviews section, so a joined
 *     selector would always skip `#review-body`.
 */
export function resolveVisibleTarget(selectors: readonly string[]): HTMLElement | null {
  if (typeof document === 'undefined') return null
  for (const selector of selectors) {
    try {
      const matches = document.querySelectorAll<HTMLElement>(selector)
      for (const el of matches) {
        if (isVisible(el)) return el
      }
    } catch {
      // A malformed selector must not take the page down with it.
    }
  }
  return null
}

function isVisible(el: HTMLElement): boolean {
  try {
    if (el.getClientRects().length === 0) return false
    const style = getComputedStyle(el)
    return style.visibility !== 'hidden' && style.opacity !== '0'
  } catch {
    return false
  }
}

/**
 * Ring the element, move focus to it, and scroll it into view.
 *
 * Moving DOM focus IS the accessible spotlight. A ring that clears on a timer
 * leaves a screen-reader user with nothing at all, and taking focus is
 * legitimate here because it directly follows the tester clicking the step row.
 *
 * Order and options are both load-bearing:
 *   * `focus({preventScroll:true})` FIRST — an unguarded `focus()` scrolls
 *     instantly and fights the smooth scroll that follows.
 *   * `block:'center'` on wide screens. On a phone the expanded rail panel
 *     (up to 70vh, nearly full width) covers the middle and bottom of the
 *     screen, so a centred target lands under it. There we align to the top
 *     instead, with a temporary `scroll-margin-top` of 5rem so the fixed
 *     `h-14` site header does not cover the target either.
 */
export function applySpotlight(el: HTMLElement | null, reduceMotion: boolean): void {
  if (el === null) return
  clearSpotlight()
  try {
    if (!isFocusable(el)) {
      el.setAttribute('tabindex', '-1')
      borrowedTabIndex = el
    }
    el.focus({ preventScroll: true })
    const narrow = isNarrow()
    if (narrow) {
      marginedEl = el
      marginBefore = el.style.scrollMarginTop
      el.style.scrollMarginTop = '5rem'
    }
    el.scrollIntoView({
      block: narrow ? 'start' : 'center',
      behavior: reduceMotion ? 'auto' : 'smooth',
    })
    el.classList.add(SPOTLIGHT_CLASS)
    spotlit = el
  } catch {
    // Mid-flight unmount, a detached node, a browser that dislikes an option
    // bag — none of it is worth a page error.
  }
}

/** Remove the ring and hand back any tabIndex we borrowed. */
export function clearSpotlight(): void {
  try {
    if (spotlit !== null) {
      spotlit.classList.remove(SPOTLIGHT_CLASS)
      spotlit = null
    }
    if (borrowedTabIndex !== null) {
      borrowedTabIndex.removeAttribute('tabindex')
      borrowedTabIndex = null
    }
    if (marginedEl !== null) {
      marginedEl.style.scrollMarginTop = marginBefore
      marginedEl = null
    }
  } catch {
    spotlit = null
    borrowedTabIndex = null
    marginedEl = null
  }
}

function isNarrow(): boolean {
  try {
    return window.matchMedia(NARROW_QUERY).matches
  } catch {
    return false
  }
}

function isFocusable(el: HTMLElement): boolean {
  if (el.tabIndex >= 0) return true
  return ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)
}

/**
 * Park a spotlight intent across a hard navigation.
 *
 * `sessionStorage`, not `localStorage`: a pending spotlight leaking into a
 * second tab and firing on an unrelated page is a genuinely confusing bug. The
 * TTL stops a stale intent firing on a page load half an hour later.
 */
export function setPendingSpotlight(step: string): void {
  try {
    sessionStorage.setItem(
      PENDING_KEY,
      JSON.stringify({ step, expiresAt: Date.now() + PENDING_TTL_MS })
    )
  } catch {
    // Safari private mode throws on access, not just on write.
  }
}

/** Read and consume a parked intent. Returns null when absent or stale. */
export function takePendingSpotlight(): string | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY)
    if (raw === null) return null
    sessionStorage.removeItem(PENDING_KEY)
    const parsed = JSON.parse(raw) as { step?: unknown; expiresAt?: unknown }
    if (typeof parsed.step !== 'string' || typeof parsed.expiresAt !== 'number') return null
    if (Date.now() > parsed.expiresAt) return null
    return parsed.step
  } catch {
    return null
  }
}

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}
