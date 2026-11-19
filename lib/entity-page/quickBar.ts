// When the listing page's quick action bars show (ticket 232).
//
// Both bars watch the hero's main button (#hero-cta).
// - The phone bar (bottom) shows whenever that button is off screen, above or
//   below, so the main action is always one tap away (DR-003).
// - The tablet/desktop bar (top) shows only once the button has scrolled up
//   past the top edge. It used to share the phone rule, so when a tall hero
//   pushed the button below the fold it faded in over the hero on first load.

export type CtaEntry = {
  isIntersecting: boolean
  boundingClientRect: { top: number }
}

export function quickBarVisibility(entry: CtaEntry): { bottom: boolean; top: boolean } {
  const offScreen = !entry.isIntersecting
  return { bottom: offScreen, top: offScreen && entry.boundingClientRect.top < 0 }
}
