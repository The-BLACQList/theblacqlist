/**
 * Regression tests for the street-line cleaner that feeds Nominatim.
 *
 * The bug these exist to hold closed: the original pattern alternated a bare
 * `#` against the unit keywords, so it stripped only one of them. Any address
 * written "Suite #01" lost the `#01` and kept the word "Suite" — an address
 * Nominatim returns nothing for. Two of the 41 open unrecoverable geocode
 * failures carry that exact signature, as does Sky's Gourmet Tacos in the
 * Los Angeles seed corpus.
 *
 * Each "strips" case below was confirmed against live Nominatim on 2026-08-14:
 * the raw form returns no result, the cleaned form resolves.
 */
import { describe, expect, it } from 'vitest'

import { __cleanStreetForTest as cleanStreet } from '@/lib/listings/geocode'

describe('cleanStreet', () => {
  describe('strips the whole trailing unit designator', () => {
    it.each([
      // The three real failures. Keyword + hash together was the blind spot.
      ['5303 W Pico Blvd, Suite #01', '5303 W Pico Blvd'],
      ['1245 S Michigan Ave, Unit #325', '1245 S Michigan Ave'],
      // Doubled keyword — an owner-typed "Ste" in front of a form-added "Suite".
      ['50 Ernest W Barrett Pkwy NW Ste Suite 125', '50 Ernest W Barrett Pkwy NW'],
      // The forms that already worked, kept so the fix cannot regress them.
      ['123 Main St Suite 200', '123 Main St'],
      ['123 Main St #4', '123 Main St'],
      ['123 Main St, Ste. 5', '123 Main St'],
      ['123 Main St Apt 4B', '123 Main St'],
      // Ordinal floor after the street, a real Atlanta corpus address.
      ['1230 Peachtree St. NE 19th Fl', '1230 Peachtree St. NE'],
      ['100 Main St, 3rd Floor', '100 Main St'],
      ['1200 Foster St NW Suite 120', '1200 Foster St NW'],
      ['950 Herrington Road, Suite C-114', '950 Herrington Road'],
    ])('%s → %s', (input, expected) => {
      expect(cleanStreet(input)).toBe(expected)
    })
  })

  describe('leaves an address with no unit designator alone', () => {
    it.each([
      // Directionals are the near-miss case: "SE" sits where a unit would.
      ['1231 Marion Barry Ave SE', '1231 Marion Barry Ave SE'],
      ['4311 Degnan Blvd', '4311 Degnan Blvd'],
      ['2341 Marietta Blvd NW', '2341 Marietta Blvd NW'],
      // Unit words inside a street name. These were cut before the fix.
      ['1725 Winchester Rd', '1725 Winchester Rd'],
      ['1942 Amsterdam Ave', '1942 Amsterdam Ave'],
      ['3952 Lancaster Ave', '3952 Lancaster Ave'],
      ['1200 Foster St NW', '1200 Foster St NW'],
      ['400 Unity Ave', '400 Unity Ave'],
    ])('%s', (input, expected) => {
      expect(cleanStreet(input)).toBe(expected)
    })
  })
})
