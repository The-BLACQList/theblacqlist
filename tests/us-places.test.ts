// Ticket 230: the US places list behind onboarding "Your City".

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  buildUsPlaceRows,
  cleanPlaceName,
  fromCsv,
  normalizePlaceSearch,
  splitPlaceQuery,
  toCsv,
} from '@/lib/geo/usPlaces'

describe('cleanPlaceName', () => {
  it('drops the Census kind-of-place words', () => {
    expect(cleanPlaceName('Abbeville city')).toBe('Abbeville')
    expect(cleanPlaceName('Abanda CDP')).toBe('Abanda')
    expect(cleanPlaceName('Lake in the Hills village')).toBe('Lake in the Hills')
    expect(cleanPlaceName('Juneau city and borough')).toBe('Juneau')
    expect(cleanPlaceName('Indianapolis city (balance)')).toBe('Indianapolis')
    expect(cleanPlaceName('Aguas Buenas zona urbana')).toBe('Aguas Buenas')
    expect(cleanPlaceName("Coeur d'Alene city")).toBe("Coeur d'Alene")
  })

  it('uses the common name for consolidated city-counties', () => {
    expect(cleanPlaceName('Nashville-Davidson metropolitan government (balance)', '4752006')).toBe(
      'Nashville'
    )
    expect(cleanPlaceName('Urban Honolulu CDP', '1571550')).toBe('Honolulu')
    expect(cleanPlaceName('Lynchburg, Moore County metropolitan government', '4744382')).toBe(
      'Lynchburg'
    )
  })

  it('keeps a name that is only a suffix word', () => {
    expect(cleanPlaceName('Carson City')).toBe('Carson City')
  })
})

describe('normalizePlaceSearch', () => {
  it('folds case, accents, apostrophes and punctuation', () => {
    expect(normalizePlaceSearch('Cañon City')).toBe('canon city')
    expect(normalizePlaceSearch("Coeur d'Alene")).toBe('coeur dalene')
    expect(normalizePlaceSearch('Winston-Salem')).toBe('winston salem')
    expect(normalizePlaceSearch('  St. Louis ')).toBe('st louis')
  })
})

describe('splitPlaceQuery', () => {
  it('reads a state after a comma', () => {
    expect(splitPlaceQuery('Houston, T')).toMatchObject({ name: 'houston', state: 'T' })
    expect(splitPlaceQuery('Decatur, ga')).toMatchObject({ name: 'decatur', state: 'GA' })
  })

  it('offers a second reading for a state typed without a comma', () => {
    expect(splitPlaceQuery('Austin TX')).toEqual({
      name: 'austin tx',
      state: '',
      altName: 'austin',
      altState: 'TX',
    })
    expect(splitPlaceQuery('deca')).toMatchObject({ altName: '', altState: '' })
  })
})

const GAZ = [
  'USPS\tGEOID\tANSICODE\tNAME\tLSAD\tFUNCSTAT\tALAND\tAWATER\tALAND_SQMI\tAWATER_SQMI\tINTPTLAT\tINTPTLONG                 ',
  'GA\t1322052\t1\tDecatur city\t25\tA\t0\t0\t4.2\t0\t33.772\t-84.297',
  'GA\t1399999\t1\tDecatur CDP\t57\tS\t0\t0\t0\t0\t31.0\t-84.0',
  'AL\t0120104\t1\tDecatur city\t25\tA\t0\t0\t0\t0\t34.57\t-87.0',
  'TX\t4835000\t1\tHouston city\t25\tA\t0\t0\t0\t0\t29.78\t-95.38',
  'XX\tbad\t1\tBroken\t25\tA\t0\t0\t0\t0\t0\t0',
].join('\n')

const EST = [
  'SUMLEV,STATE,COUNTY,PLACE,COUSUB,CONCIT,PRIMGEO_FLAG,FUNCSTAT,NAME,STNAME,POPESTIMATE2023,POPESTIMATE2024',
  '162,13,000,22052,00000,00000,0,A,Decatur city,Georgia,24000,24500',
  '162,48,000,35000,00000,00000,0,A,Houston city,Texas,2300000,2390125',
  '157,13,089,22052,00000,00000,0,A,Decatur city (pt.),Georgia,1,1',
].join('\n')

describe('buildUsPlaceRows', () => {
  const rows = buildUsPlaceRows(GAZ, EST)

  it('labels, normalizes and reads the latest population', () => {
    const decaturGa = rows.find((r) => r.label === 'Decatur, GA')
    expect(decaturGa).toMatchObject({
      geoid: '1322052',
      name: 'Decatur',
      state_code: 'GA',
      population: 24500,
      search: 'decatur',
    })
    expect(rows.find((r) => r.geoid === '0120104')?.population).toBeNull()
    expect(decaturGa?.land_sq_mi).toBe(4.2)
  })

  it('keeps one place per label, preferring the one with people counted', () => {
    expect(rows.filter((r) => r.label === 'Decatur, GA')).toHaveLength(1)
    expect(rows.map((r) => r.geoid)).not.toContain('1399999')
  })

  it('skips malformed rows', () => {
    expect(rows.map((r) => r.state_code)).not.toContain('XX')
    expect(rows).toHaveLength(3)
  })

  it('round-trips through the CSV', () => {
    expect(fromCsv(toCsv(rows))).toEqual(rows)
  })
})

describe('data/geo/us-places.csv', () => {
  const rows = fromCsv(readFileSync(resolve(__dirname, '../data/geo/us-places.csv'), 'utf8'))

  it('covers the country', () => {
    expect(rows.length).toBeGreaterThan(30_000)
    expect(new Set(rows.map((r) => r.state_code)).size).toBeGreaterThanOrEqual(51)
  })

  it('has every label once and every GEOID well formed', () => {
    expect(new Set(rows.map((r) => r.label)).size).toBe(rows.length)
    expect(rows.every((r) => /^\d{7}$/.test(r.geoid))).toBe(true)
  })

  it('finds big cities and small towns alike', () => {
    const labels = new Set(rows.map((r) => r.label))
    for (const l of [
      'Houston, TX',
      'Atlanta, GA',
      'Nashville, TN',
      'Mound Bayou, MS',
      'Honolulu, HI',
    ]) {
      expect(labels).toContain(l)
    }
  })
})
