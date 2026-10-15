/**
 * The Census fallback corrects street names loosely, so a match only counts
 * when it lands in the state we gave and in the same ZIP or city. These hold
 * that check so a typo can never drop a pin in another town.
 */
import { describe, expect, it } from 'vitest'

import { __censusMatchIsTrustedForTest as trusted } from '@/lib/listings/geocode'

const match = (city: string, state: string, zip: string) => ({
  coordinates: { x: -90, y: 35 },
  addressComponents: { city, state, zip },
})

describe('censusMatchIsTrusted', () => {
  it('accepts a corrected street in the same ZIP', () => {
    // Real case: "3386 Bowden Ave" came back as "3386 BOWEN AVE, MEMPHIS, TN, 38122".
    expect(
      trusted(
        { address: '3386 Bowden Ave', city: 'Memphis', state: 'TN', zip: '38122' },
        match('MEMPHIS', 'TN', '38122')
      )
    ).toBe(true)
  })

  it('accepts a same-city match when the ZIP was left empty', () => {
    expect(
      trusted(
        { address: '1 Main St', city: 'Houston', state: 'TX', zip: null },
        match('HOUSTON', 'TX', '77018')
      )
    ).toBe(true)
  })

  it('accepts a ZIP+4 input against a five-digit match', () => {
    expect(
      trusted(
        { address: '1 Main St', city: 'Acton', state: 'CA', zip: '93510-1234' },
        match('ACTON', 'CA', '93510')
      )
    ).toBe(true)
  })

  it('rejects a match in another state', () => {
    expect(
      trusted(
        { address: '1 Main St', city: 'Memphis', state: 'TN', zip: '38122' },
        match('MEMPHIS', 'AR', '38122')
      )
    ).toBe(false)
  })

  it('rejects a match in another ZIP and city', () => {
    expect(
      trusted(
        { address: '1 Main St', city: 'Memphis', state: 'TN', zip: '38122' },
        match('JACKSON', 'TN', '38301')
      )
    ).toBe(false)
  })

  it('rejects when no state was given', () => {
    expect(
      trusted(
        { address: '1 Main St', city: 'Memphis', state: null, zip: '38122' },
        match('MEMPHIS', 'TN', '38122')
      )
    ).toBe(false)
  })
})
