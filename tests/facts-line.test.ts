import { beforeEach, describe, expect, it, vi } from 'vitest'

// Ticket 189: the facts line goes live. Pinned here:
//   * the year and price rules match the column CHECKs (1800 to this year; $ to $$$$);
//   * the owner's save stores each fact, blank as null, and refuses bad values;
//   * creator, event and job pages have no facts line to save.

const LISTING_ID = '0b6f5c7e-1d2a-4c3b-9e8f-7a6b5c4d3e2f'

const h = vi.hoisted(() => {
  const state = {
    listing: null as Record<string, unknown> | null,
  }
  const upserts: Record<string, unknown>[] = []

  function makeClient() {
    return {
      from() {
        const builder = {
          select: () => builder,
          eq: () => builder,
          is: () => builder,
          maybeSingle: async () => ({ data: state.listing, error: null }),
          upsert: async (row: Record<string, unknown>) => {
            upserts.push(row)
            return { error: null }
          },
          update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
        }
        return builder
      },
    }
  }

  return {
    state,
    upserts,
    createClient: vi.fn(async () => makeClient()),
    getOwnerSession: vi.fn(async () => ({ user: { id: 'u1' } })),
  }
})

vi.mock('@/lib/supabase/server', () => ({ createClient: h.createClient }))
vi.mock('@/lib/dashboard/guard', () => ({ getOwnerSession: h.getOwnerSession }))
vi.mock('@/lib/dashboard/revalidateEditors', () => ({ revalidateOwnerEditors: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/listings/geocode', () => ({ geocodeAddress: vi.fn(async () => null) }))
vi.mock('@/lib/ai/markUsed', () => ({ markSuggestionUsed: vi.fn() }))

import { factsFor, isFoundedYear, isPriceRange } from '@/lib/listings/facts'
import { updateListingContentAction } from '@/lib/actions/dashboard/updateListingContent'

function form(fields: Record<string, string>): FormData {
  const fd = new FormData()
  fd.set('listing_id', LISTING_ID)
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

describe('facts rules', () => {
  const now = new Date('2026-11-15T12:00:00Z')

  it('takes a whole year from 1800 to this year', () => {
    expect(isFoundedYear(1800, now)).toBe(true)
    expect(isFoundedYear(2026, now)).toBe(true)
    expect(isFoundedYear(1799, now)).toBe(false)
    expect(isFoundedYear(2027, now)).toBe(false)
    expect(isFoundedYear(2014.5, now)).toBe(false)
    expect(isFoundedYear('2014', now)).toBe(false)
  })

  it('takes the four price bands only', () => {
    for (const p of ['$', '$$', '$$$', '$$$$']) expect(isPriceRange(p)).toBe(true)
    for (const p of ['', '$$$$$', 'cheap', null]) expect(isPriceRange(p)).toBe(false)
  })

  it('shows only the facts the owner filled', () => {
    expect(
      factsFor({ founded_year: 2014, price_range: '$$', accepts_reservations: false }).map(
        (f) => f.label
      )
    ).toEqual(['Est. 2014', '$$', 'Walk-Ins Only'])
    expect(factsFor({ founded_year: null, price_range: null, accepts_reservations: null })).toEqual(
      []
    )
  })
})

describe('saving the facts line', () => {
  beforeEach(() => {
    h.upserts.length = 0
    h.state.listing = {
      id: LISTING_ID,
      slug: 'x',
      status: 'draft',
      entity_type: 'business',
      tier: 'free',
      cities: null,
    }
  })

  it('stores each fact', async () => {
    const result = await updateListingContentAction(
      null,
      form({ founded_year: '2014', price_range: '$$', accepts_reservations: 'true' })
    )
    expect(result).toMatchObject({ success: true })
    expect(h.upserts[0]).toMatchObject({
      listing_id: LISTING_ID,
      founded_year: 2014,
      price_range: '$$',
      accepts_reservations: true,
    })
  })

  it('stores blanks as null', async () => {
    await updateListingContentAction(
      null,
      form({ founded_year: '', price_range: '', accepts_reservations: '' })
    )
    expect(h.upserts[0]).toMatchObject({
      founded_year: null,
      price_range: null,
      accepts_reservations: null,
    })
  })

  it('stores Walk-Ins Only as false', async () => {
    await updateListingContentAction(null, form({ accepts_reservations: 'false' }))
    expect(h.upserts[0]).toMatchObject({ accepts_reservations: false })
  })

  it('refuses a year out of range or not a year', async () => {
    for (const year of ['1799', String(new Date().getFullYear() + 1), '20x4', '14']) {
      const result = await updateListingContentAction(null, form({ founded_year: year }))
      expect(result, year).toHaveProperty('error')
    }
    expect(h.upserts).toHaveLength(0)
  })

  it('refuses a price band outside $ to $$$$', async () => {
    const result = await updateListingContentAction(null, form({ price_range: '$$$$$' }))
    expect(result).toHaveProperty('error')
    expect(h.upserts).toHaveLength(0)
  })

  it('refuses facts on a creator page', async () => {
    h.state.listing = { ...h.state.listing!, entity_type: 'creator' }
    const result = await updateListingContentAction(null, form({ price_range: '$$' }))
    expect(result).toHaveProperty('error')
    expect(h.upserts).toHaveLength(0)
  })
})
