import { pinImage } from '@/lib/map/rankListings'
import { resolveRemoteImage } from '@/lib/listings/coverImage'
import type { MapListing } from '@/lib/map/types'

export interface PinSpec {
  listing: MapListing
  selected: boolean
  /**
   * Show the name pill under the selected pin. Phones only: on desktop the
   * preview card beside the pin already names the business.
   */
  named: boolean
}

/** Changes whenever the element has to be rebuilt rather than re-classed. */
export function pinKey({ listing, selected, named }: PinSpec): string {
  return `${listing.id}:${selected ? 1 : 0}:${named ? 1 : 0}:${listing.logoPin ? 1 : 0}`
}

/** Up to two initials, for a pin with no logo or photo. */
export function pinInitials(name: string): string {
  // Only words that start with a letter or digit count, so a name like
  // "Demo — Sample & Co." gives "DS", not "D—".
  return name
    .trim()
    .split(/\s+/)
    .filter((w) => /^[\p{L}\p{N}]/u.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}

export interface PinHandlers {
  onSelect: (listing: MapListing) => void
  /** Pointer over the pin, so the matching card can light up. */
  onHover: (id: string | null) => void
}

/** The teardrop outline (option B of the map pin workshop), tip at (22, 54). */
export const PIN_PATH = 'M22 53C17 45 2 34 2 21a20 20 0 0 1 40 0c0 13-15 24-20 32z'
const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * Build the DOM for one claimed-page pin (ticket 266, founder 2026-11-21: the
 * teardrop with a white circle from option B of the map pin workshop, with the
 * circle a bit larger; ticket 244's name pill and Calm Map rules stay: no
 * numbers and no trust marks on the map).
 *
 * - Logo pin (claimed, Starter and up): gold teardrop with a white circle
 *   holding the logo, never cropped; else the cover photo; else initials.
 * - Plain pin (claimed, Free): smaller ink teardrop with one initial. No photo,
 *   no logo.
 *
 * The teardrop's tip is the listing coordinate. MapLibre owns the root
 * element's transform, so the root is a zero-size anchor and the button sits
 * above it (see `.blacq-pin` in globals.css). Selection shows by size and the
 * edge color, never by color alone. Verified and Certified live on the card
 * and the preview, not on the pin.
 */
export function buildPinElement(spec: PinSpec, handlers: PinHandlers): HTMLElement {
  const { listing, selected, named } = spec
  const paid = listing.logoPin
  const raw = pinImage(listing)
  const image = raw ? resolveRemoteImage(raw.src) : null

  const root = document.createElement('div')
  root.className = `blacq-pin ${paid ? 'blacq-pin-paid' : 'blacq-pin-plain'}`
  if (selected) root.classList.add('blacq-pin-selected')
  // MapLibre would otherwise label every marker "Map marker".
  root.setAttribute('role', 'group')
  root.setAttribute('aria-label', listing.name)

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'blacq-pin-btn'
  button.setAttribute('aria-label', listing.name)
  button.setAttribute('aria-pressed', String(selected))

  const body = document.createElement('span')
  body.className = 'blacq-pin-body'

  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('class', 'blacq-pin-shape')
  svg.setAttribute('viewBox', '0 0 44 54')
  svg.setAttribute('aria-hidden', 'true')
  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('d', PIN_PATH)
  svg.appendChild(path)
  body.appendChild(svg)

  const initials = pinInitials(listing.name)
  const face = document.createElement('span')
  face.className = paid ? 'blacq-pin-disc' : 'blacq-pin-initial'

  if (paid && image && raw) {
    const img = document.createElement('img')
    img.src = image.src
    img.alt = ''
    img.decoding = 'async'
    img.className = raw.kind === 'logo' ? 'blacq-pin-logo' : 'blacq-pin-photo'
    img.addEventListener('error', () => {
      img.remove()
      face.textContent = initials
    })
    face.appendChild(img)
  } else {
    face.textContent = paid ? initials : initials.slice(0, 1)
  }

  body.appendChild(face)
  button.appendChild(body)

  if (selected && named) {
    const name = document.createElement('span')
    name.className = 'blacq-pin-name'
    name.textContent = listing.name
    button.appendChild(name)
  }

  button.addEventListener('click', (event) => {
    // Marker clicks bubble to the canvas container and would fire a map
    // `click`, which deselects the pin this one is selecting.
    event.stopPropagation()
    handlers.onSelect(listing)
  })
  button.addEventListener('mouseenter', () => handlers.onHover(listing.id))
  button.addEventListener('mouseleave', () => handlers.onHover(null))
  root.appendChild(button)
  return root
}
