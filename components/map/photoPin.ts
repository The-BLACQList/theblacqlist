import { listingPhoto } from '@/lib/map/rankListings'
import { resolveRemoteImage } from '@/lib/listings/coverImage'
import type { MapListing } from '@/lib/map/types'

export interface PinSpec {
  listing: MapListing
  /** null for a selected listing that is not one of the numbered top picks. */
  number: number | null
  selected: boolean
}

/** Changes whenever the element has to be rebuilt rather than re-classed. */
export function pinKey({ listing, number, selected }: PinSpec): string {
  return `${listing.id}:${number ?? 0}:${selected ? 1 : 0}`
}

/**
 * Build the DOM for one numbered pin.
 *
 * MapLibre owns the root element's transform, so the root is a zero-size
 * anchor and the focusable button is centered on it (see `.blacq-pin` in
 * globals.css). Photo pins show the image with a number badge; listings with no
 * usable photo fall back to a numbered ink circle. Selection is shown by size,
 * a gold ring and a name pill, never by color alone.
 */
export function buildPinElement(spec: PinSpec, onSelect: (listing: MapListing) => void): HTMLElement {
  const { listing, number, selected } = spec
  const photo = resolveRemoteImage(listingPhoto(listing))

  const root = document.createElement('div')
  root.className = 'blacq-pin'
  if (selected) root.classList.add('blacq-pin-selected')
  if (!photo) root.classList.add('blacq-pin-nophoto')
  root.style.zIndex = selected ? '5' : '1'
  // MapLibre would otherwise label every marker "Map marker".
  root.setAttribute('role', 'group')
  root.setAttribute('aria-label', listing.name)

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'blacq-pin-btn'
  button.setAttribute('aria-label', number ? `${listing.name}, number ${number}` : listing.name)
  button.setAttribute('aria-pressed', String(selected))

  const mark = number ? String(number) : (listing.name.trim()[0] ?? '').toUpperCase()
  const disc = document.createElement('span')
  disc.className = 'blacq-pin-disc'
  if (photo) {
    const img = document.createElement('img')
    img.src = photo.src
    img.alt = ''
    img.decoding = 'async'
    img.addEventListener('error', () => {
      img.remove()
      root.classList.add('blacq-pin-nophoto')
      disc.prepend(document.createTextNode(mark))
    })
    disc.appendChild(img)
  } else {
    disc.appendChild(document.createTextNode(mark))
  }
  if (number) {
    const badge = document.createElement('span')
    badge.className = 'blacq-pin-badge'
    badge.setAttribute('aria-hidden', 'true')
    badge.textContent = String(number)
    disc.appendChild(badge)
  }
  button.appendChild(disc)

  if (selected) {
    const name = document.createElement('span')
    name.className = 'blacq-pin-name'
    name.textContent = listing.name
    button.appendChild(name)
  }

  button.addEventListener('click', (event) => {
    // Marker clicks bubble to the canvas container and would fire a map
    // `click`, which deselects the pin this one is selecting.
    event.stopPropagation()
    onSelect(listing)
  })
  root.appendChild(button)
  return root
}
