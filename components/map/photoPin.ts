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

/**
 * Build the DOM for one square (ticket 244, founder's picks 2026-11-21: the
 * tile shape of option C with the name treatment of option A, and the Calm Map
 * rules: no numbers and no trust marks on the map).
 *
 * - Logo square (claimed, Starter and up): white, gold border, the logo never
 *   cropped; else the cover photo; else initials.
 * - Plain square (claimed, Free): smaller and ink, with one initial. No photo,
 *   no logo.
 *
 * Both end in a caret whose tip is the listing coordinate. MapLibre owns the
 * root element's transform, so the root is a zero-size anchor and the button
 * sits above it (see `.blacq-pin` in globals.css). Selection shows by size and
 * a gold border, never by color alone. Verified and Certified live on the card
 * and the preview, not on the square.
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

  const tile = document.createElement('span')
  tile.className = 'blacq-pin-tile'
  const initials = pinInitials(listing.name)

  if (paid && image && raw) {
    const img = document.createElement('img')
    img.src = image.src
    img.alt = ''
    img.decoding = 'async'
    img.className = raw.kind === 'logo' ? 'blacq-pin-logo' : 'blacq-pin-photo'
    img.addEventListener('error', () => {
      img.remove()
      tile.textContent = initials
    })
    tile.appendChild(img)
  } else {
    tile.textContent = paid ? initials : initials.slice(0, 1)
  }

  const caret = document.createElement('span')
  caret.className = 'blacq-pin-caret'
  caret.setAttribute('aria-hidden', 'true')

  button.appendChild(tile)
  button.appendChild(caret)

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
