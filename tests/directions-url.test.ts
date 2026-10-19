// =============================================================================
// lib/listings/directions.ts: directionsUrl
// =============================================================================
// Directions open with the business name and address, not coordinates
// (founder ask, 2026-10-19). Coordinates stay only as the no-address fallback.
// =============================================================================

import { describe, it, expect } from 'vitest'

import { contactKind } from '@/lib/analytics/contactTap'
import { directionsUrl } from '@/lib/listings/directions'

const BASE = 'https://www.google.com/maps/dir/?api=1&destination='
const destination = (url: string | null) =>
  url ? decodeURIComponent(url.slice(BASE.length)) : null

describe('directionsUrl', () => {
  it('sends the name and full address in directions mode', () => {
    const url = directionsUrl({
      name: 'Sweet Auburn Bakery',
      street: '123 Auburn Ave NE',
      city: 'Atlanta',
      state: 'GA',
      zip: '30303',
      lat: 33.75,
      lng: -84.38,
    })
    expect(url?.startsWith(BASE)).toBe(true)
    expect(destination(url)).toBe('Sweet Auburn Bakery, 123 Auburn Ave NE, Atlanta, GA 30303')
  })

  it('encodes characters that would break the link', () => {
    const url = directionsUrl({ name: 'Mo & Co #2', street: '1 Main St', city: 'Detroit' })
    const query = url!.slice(BASE.length)
    expect(query).not.toMatch(/[ &#]/)
    expect(destination(url)).toBe('Mo & Co #2, 1 Main St, Detroit')
  })

  it('drops missing city, state or zip cleanly', () => {
    expect(destination(directionsUrl({ name: 'Shop', street: '9 Elm St', zip: '60601' }))).toBe(
      'Shop, 9 Elm St, 60601'
    )
    expect(destination(directionsUrl({ name: 'Shop', street: '9 Elm St', state: 'IL' }))).toBe(
      'Shop, 9 Elm St, IL'
    )
  })

  it('falls back to coordinates when there is no street', () => {
    const url = directionsUrl({ name: 'Pop-up', street: '  ', city: 'Atlanta', lat: 33.75, lng: -84.38 })
    expect(destination(url)).toBe('33.75,-84.38')
  })

  it('returns null with no street and no coordinates', () => {
    expect(directionsUrl({ name: 'Online only', city: 'Atlanta' })).toBeNull()
  })

  it('still counts as a directions tap for the Featured score', () => {
    const url = directionsUrl({ name: 'Shop', street: '9 Elm St' })
    expect(contactKind(url!)).toBe('directions')
  })
})
