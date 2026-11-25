import { framePadding } from '@/lib/map/framePadding'

/** framePadding from what is on the screen now: the bar and sheet over the map box. */
export function phonePadding(box: HTMLElement | null) {
  const rect = box?.getBoundingClientRect()
  if (!box || !rect) return framePadding({ boxHeight: window.innerHeight, bar: 0, sheet: 0 })
  const bar = box.querySelector('[data-map-phonebar]')?.getBoundingClientRect()
  const sheet = box.querySelector('[data-map-sheet]')?.getBoundingClientRect()
  return framePadding({
    boxHeight: rect.height,
    bar: bar ? bar.bottom - rect.top : 0,
    sheet: sheet ? rect.bottom - sheet.top : 0,
  })
}
