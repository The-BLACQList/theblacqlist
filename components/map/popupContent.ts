import { isOpenNow } from '@/lib/listings/openStatus'
import { TIER_LABEL, type MapListing } from '@/lib/map/types'

const DIRECTIONS_ICON =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>'

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

/**
 * The preview card beside the selected pin. Built with DOM APIs and textContent
 * so listing text never reaches innerHTML.
 */
export function buildPopupContent(listing: MapListing): HTMLElement {
  const open = listing.hours ? isOpenNow(listing.hours) : null
  const ownership = listing.ownershipLabel === 'ally' ? 'Ally' : 'Black-Owned'
  const rating =
    listing.avgRating !== null && listing.reviewCount > 0
      ? `${listing.avgRating.toFixed(1)} stars, ${listing.reviewCount} reviews`
      : null

  const root = el('div', 'blacq-popup')
  root.appendChild(el('p', 'blacq-popup-tier', `${ownership} · ${TIER_LABEL[listing.trustTier]}`))
  root.appendChild(el('h2', 'blacq-popup-name', listing.name))
  root.appendChild(
    el('p', 'blacq-popup-meta', [listing.category, open?.label, rating].filter(Boolean).join(' · '))
  )

  const actions = el('div', 'blacq-popup-actions')
  const view = el('a', 'blacq-popup-primary', 'View page')
  view.href = listing.href
  const directions = el('a', 'blacq-popup-secondary')
  directions.href = `https://maps.google.com/?q=${listing.lat},${listing.lng}`
  directions.target = '_blank'
  directions.rel = 'noopener noreferrer'
  directions.setAttribute('aria-label', `Directions to ${listing.name}, opens in a new tab`)
  directions.innerHTML = DIRECTIONS_ICON // constant markup, no listing data
  actions.append(view, directions)
  root.appendChild(actions)
  return root
}
