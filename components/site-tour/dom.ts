// The site tour's hands on the page (ticket 280). The page is not ours, so
// nothing here may throw, and everything done is undone on the way out.

import { resolveVisibleTarget } from '@/components/tour/spotlight'

export const TOUR_ROOT_ID = 'blq-site-tour'

const NOT_CONTENT = new Set(['SCRIPT', 'STYLE', 'LINK', 'TEMPLATE', 'NEXT-ROUTE-ANNOUNCER'])

/** Make the page inert except `keep`, and `off` inside it. Returns the undo. */
export function holdPage(keep: readonly Element[], off: readonly Element[]): () => void {
  const held: Element[] = []
  const hold = (el: Element) => {
    if (el.hasAttribute('inert')) return
    el.setAttribute('inert', '')
    held.push(el)
  }
  const walk = (parent: Element) => {
    for (const child of parent.children) {
      if (child.id === TOUR_ROOT_ID || NOT_CONTENT.has(child.tagName)) continue
      if (keep.includes(child)) continue
      if (keep.some((el) => child.contains(el))) walk(child)
      else hold(child)
    }
  }
  try {
    walk(document.body)
    off.forEach(hold)
  } catch {
    // A page that can still be used is better than one that can't.
  }
  return () => held.forEach((el) => el.removeAttribute('inert'))
}

/** Every visible element for these selectors, in order. */
export function findAll(selectors: readonly string[]): HTMLElement[] {
  return selectors
    .map((selector) => resolveVisibleTarget([selector]))
    .filter((el): el is HTMLElement => el !== null)
}

/** The bottom of the site header, or 0 when the page has none on screen. */
export function headerBottom(): number {
  for (const header of document.querySelectorAll('header')) {
    if (getComputedStyle(header).position !== 'fixed') continue
    return Math.max(0, header.getBoundingClientRect().bottom)
  }
  return 0
}

/** Is the browser on this step's page? Only `view` counts in the query. */
export function onPage(href: string): boolean {
  const want = new URL(href, window.location.origin)
  if (want.pathname !== window.location.pathname) return false
  const view = want.searchParams.get('view')
  return view === null || new URLSearchParams(window.location.search).get('view') === view
}

export function focusQuietly(el: HTMLElement | null): void {
  try {
    el?.focus({ preventScroll: true })
  } catch {
    // Detached mid-flight.
  }
}

/** Where focus goes when the tour closes: what opened it, or the page's heading. */
export function returnFocus(opener: Element | null): void {
  if (opener instanceof HTMLElement && opener.isConnected && opener.getClientRects().length > 0) {
    focusQuietly(opener)
    if (document.activeElement === opener) return
  }
  const heading = document.querySelector<HTMLElement>('main h1, h1')
  if (!heading) return
  if (heading.tabIndex < 0) heading.setAttribute('tabindex', '-1')
  focusQuietly(heading)
}
