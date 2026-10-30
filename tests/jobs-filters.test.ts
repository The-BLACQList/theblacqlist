// =============================================================================
// Ticket 150: Jobs board filters
// =============================================================================
import { describe, expect, it } from 'vitest'

import { buildJobsUrl, hasJobFilters, parseJobFilters, toggleJobType } from '@/lib/validations/jobs'
import { buildJobFilterOptions, getJobFilterOptions } from '@/lib/listings/jobs'

describe('parseJobFilters', () => {
  it('reads where and a single type', () => {
    expect(parseJobFilters({ where: 'remote', type: 'part-time' })).toEqual({
      where: 'remote',
      types: ['part-time'],
      page: 1,
    })
  })

  it('reads a comma list in chip order and drops unknown values', () => {
    const f = parseJobFilters({ type: 'volunteer, nonsense,full-time,full-time,temporary' })
    expect(f.types).toEqual(['full-time', 'volunteer', 'temporary'])
  })

  it('ignores a wholly unknown type instead of failing', () => {
    const f = parseJobFilters({ type: 'nonsense' })
    expect(f.types).toEqual([])
    expect(hasJobFilters(f)).toBe(false)
  })

  it('accepts a city slug and rejects junk in where', () => {
    expect(parseJobFilters({ where: 'atlanta-ga' }).where).toBe('atlanta-ga')
    expect(parseJobFilters({ where: '../etc;drop' }).where).toBeNull()
    expect(parseJobFilters({ where: '' }).where).toBeNull()
  })

  it('takes the first value of a repeated param and a safe page', () => {
    expect(parseJobFilters({ where: ['remote', 'x'], page: 'abc' })).toMatchObject({
      where: 'remote',
      page: 1,
    })
    expect(parseJobFilters({ page: '3' }).page).toBe(3)
  })
})

describe('buildJobsUrl', () => {
  it('writes where before type, as the board links read', () => {
    expect(buildJobsUrl({ where: 'remote', types: ['part-time'] })).toBe(
      '/jobs?where=remote&type=part-time'
    )
  })

  it('goes back to /jobs when nothing is set', () => {
    expect(buildJobsUrl({ where: null, types: [] })).toBe('/jobs')
  })

  it('resets page when a filter changes and only writes it when asked', () => {
    const f = { where: null, types: toggleJobType(['contract'], 'internship') }
    expect(buildJobsUrl(f)).toBe('/jobs?type=contract,internship')
    expect(buildJobsUrl(f, 2)).toBe('/jobs?type=contract,internship&page=2')
  })
})

describe('toggleJobType', () => {
  it('adds and removes', () => {
    expect(toggleJobType([], 'volunteer')).toEqual(['volunteer'])
    expect(toggleJobType(['volunteer'], 'volunteer')).toEqual([])
  })
})

const atl = { name: 'Atlanta', slug: 'atlanta-ga', states: { code: 'GA' } }

describe('buildJobFilterOptions', () => {
  it('lists only cities that have roles, sorted, and Remote only when present', () => {
    const o = buildJobFilterOptions(
      [
        { listing_id: 'a', workplace_type: 'on-site' },
        { listing_id: 'b', workplace_type: 'on-site' },
      ],
      [
        { id: 'a', city_id: 'c1', cities: atl },
        { id: 'b', city_id: 'c1', cities: atl },
        { id: 'x', city_id: null, cities: null },
      ]
    )
    expect(o).toEqual({ hasRemote: false, cities: [{ slug: 'atlanta-ga', label: 'Atlanta, GA' }] })
  })

  it('adds Remote when any open role is remote', () => {
    expect(
      buildJobFilterOptions([{ listing_id: 'a', workplace_type: 'remote' }], []).hasRemote
    ).toBe(true)
  })
})

// A thenable chain: every builder call returns the chain, awaiting resolves the table's rows.
function fakeClient(tables: Record<string, unknown[]>) {
  const calls: string[] = []
  const client = {
    from(table: string) {
      const chain: Record<string, unknown> = {
        then: (res: (v: unknown) => unknown) => res({ data: tables[table] ?? [], error: null }),
      }
      for (const m of ['select', 'or', 'in', 'eq', 'is']) {
        chain[m] = () => {
          calls.push(`${table}.${m}`)
          return chain
        }
      }
      return chain
    },
  }
  return { client, calls }
}

describe('getJobFilterOptions', () => {
  it('drops open roles whose listing is not published', async () => {
    const { client } = fakeClient({
      listing_details_job: [
        { listing_id: 'a', workplace_type: 'remote' },
        { listing_id: 'b', workplace_type: 'on-site' },
      ],
      // b is missing from the published listings
      listings: [{ id: 'b', city_id: 'c1', cities: atl }],
    })
    const o = await getJobFilterOptions(client)
    expect(o.hasRemote).toBe(false)
    expect(o.cities).toHaveLength(1)
  })

  it('returns nothing without reading listings when no role is open', async () => {
    const { client, calls } = fakeClient({ listing_details_job: [] })
    expect(await getJobFilterOptions(client)).toEqual({ hasRemote: false, cities: [] })
    expect(calls.some((c) => c.startsWith('listings'))).toBe(false)
  })
})
