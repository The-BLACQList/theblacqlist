// Where the light, the ring and the caption go (ticket 280). Pure geometry, so
// it can be tested without a browser.

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export interface LightBox extends Box {
  r: number
}

export type CaptionMode = 'bar' | 'sheet' | 'side-left' | 'collective'

/** The phone sheet also serves narrow tablets and short windows. */
export function captionMode(
  want: 'bar' | 'side-left' | 'collective',
  width: number,
  height: number,
  isAnswer: boolean
): CaptionMode {
  if (width <= 900 || height < 600) return 'sheet'
  if (want === 'collective' && height < 800) return 'sheet'
  if (isAnswer && height < 714) return 'sheet'
  return want
}

/**
 * Enough map above the card to light (DR-023). Two edges, so a window resting on
 * one doesn't blink.
 */
export function mapRoom(room: number, was: boolean): boolean {
  return room >= (was ? 44 : 52)
}

export function inflate(box: Box, by: number): Box {
  return { x: box.x - by, y: box.y - by, w: box.w + by * 2, h: box.h + by * 2 }
}

export function union(boxes: readonly Box[]): Box | null {
  if (boxes.length === 0) return null
  const x = Math.min(...boxes.map((b) => b.x))
  const y = Math.min(...boxes.map((b) => b.y))
  const right = Math.max(...boxes.map((b) => b.x + b.w))
  const bottom = Math.max(...boxes.map((b) => b.y + b.h))
  return { x, y, w: right - x, h: bottom - y }
}

/** The part of a box inside the clear area, or null when none of it shows. */
export function clip(box: Box, area: Box): Box | null {
  const x = Math.max(box.x, area.x)
  const y = Math.max(box.y, area.y)
  const right = Math.min(box.x + box.w, area.x + area.w)
  const bottom = Math.min(box.y + box.h, area.y + area.h)
  if (right - x < 1 || bottom - y < 1) return null
  return { x, y, w: right - x, h: bottom - y }
}

/** A rounded rectangle as an SVG path. A corner cut by the clear area is square. */
export function lightPath(full: LightBox, area: Box): string {
  const c = clip(full, area)
  if (!c) return ''
  const cutLeft = c.x > full.x + 0.5
  const cutTop = c.y > full.y + 0.5
  const cutRight = c.x + c.w < full.x + full.w - 0.5
  const cutBottom = c.y + c.h < full.y + full.h - 0.5
  const max = Math.min(full.r, c.w / 2, c.h / 2)
  const tl = cutLeft || cutTop ? 0 : max
  const tr = cutRight || cutTop ? 0 : max
  const br = cutRight || cutBottom ? 0 : max
  const bl = cutLeft || cutBottom ? 0 : max
  const { x, y, w, h } = c
  return [
    `M${x + tl} ${y}`,
    `H${x + w - tr}`,
    `A${tr} ${tr} 0 0 1 ${x + w} ${y + tr}`,
    `V${y + h - br}`,
    `A${br} ${br} 0 0 1 ${x + w - br} ${y + h}`,
    `H${x + bl}`,
    `A${bl} ${bl} 0 0 1 ${x} ${y + h - bl}`,
    `V${y + tl}`,
    `A${tl} ${tl} 0 0 1 ${x + tl} ${y}`,
    'Z',
  ].join('')
}

/**
 * How far to scroll so the target starts at least `top` under the header and
 * ends 12px above the caption. A taller target is lit from its top.
 */
export function scrollFor(input: {
  target: Box
  scrollY: number
  headerBottom: number
  captionTop: number
  top?: number
}): number {
  const { target, scrollY, headerBottom, captionTop } = input
  const start = headerBottom + (input.top ?? 10)
  const end = captionTop - 12
  if (input.top !== undefined) return scrollY + target.y - start
  if (target.y >= start && target.y + target.h <= end) return scrollY
  if (target.h > end - start) return scrollY + target.y - start
  if (target.y < start) return scrollY + target.y - start
  return scrollY + (target.y + target.h - end)
}
