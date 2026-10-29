// Ticket 142: the zero-result search log. What a row keeps, what is dropped,
// and when it fires. Founder 2026-10-20: anonymous, zero results only, 90 days.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  afterTasks: [] as Array<() => Promise<void>>,
  inserts: [] as Array<{ table: string; row: Record<string, unknown> }>,
  insertError: null as Error | null,
}))

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (task: () => Promise<void>) => {
    h.afterTasks.push(task)
  },
}))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: (_col: string, slug: string) => ({
          maybeSingle: async () => ({ data: slug === 'atlanta-ga' ? { id: 'city-atl' } : null }),
        }),
      }),
      insert: async (row: Record<string, unknown>) => {
        if (h.insertError) throw h.insertError
        h.inserts.push({ table, row })
        return { error: null }
      },
    }),
  }),
}))

const { loggableQuery, shouldLogZeroResult, logZeroResultSearch, MAX_LOGGED_QUERY_LENGTH } =
  await import('@/lib/search/zeroResultLog')

async function runAfterTasks() {
  for (const task of h.afterTasks.splice(0)) await task()
}

beforeEach(() => {
  h.afterTasks = []
  h.inserts = []
  h.insertError = null
})

describe('loggableQuery', () => {
  it('collapses spaces and trims', () => {
    expect(loggableQuery('  vegan    bakery \n')).toBe('vegan bakery')
  })

  it('caps the query at 200 characters', () => {
    const long = 'a'.repeat(500)
    expect(loggableQuery(long)).toHaveLength(MAX_LOGGED_QUERY_LENGTH)
  })

  it('drops empty queries', () => {
    expect(loggableQuery('')).toBeNull()
    expect(loggableQuery('   ')).toBeNull()
    expect(loggableQuery(null)).toBeNull()
    expect(loggableQuery(undefined)).toBeNull()
  })

  it('drops a query that looks like an email address', () => {
    expect(loggableQuery('me@example.com')).toBeNull()
    expect(loggableQuery('call jane.doe@mail.co about catering')).toBeNull()
  })

  it('drops a query that looks like a phone number', () => {
    expect(loggableQuery('404-555-0123')).toBeNull()
    expect(loggableQuery('(404) 555 0123')).toBeNull()
    expect(loggableQuery('+1 404 555 0123')).toBeNull()
  })

  it('keeps a ZIP and a street number', () => {
    expect(loggableQuery('30030')).toBe('30030')
    expect(loggableQuery('barber 30030')).toBe('barber 30030')
    expect(loggableQuery('1234 peachtree')).toBe('1234 peachtree')
  })
})

describe('shouldLogZeroResult', () => {
  const zero = { query: 'zzqxv', resultCount: 0 }

  it('logs a zero-result first page', () => {
    expect(shouldLogZeroResult(zero)).toBe(true)
    expect(shouldLogZeroResult({ ...zero, page: 1 })).toBe(true)
  })

  it('skips a search with results', () => {
    expect(shouldLogZeroResult({ ...zero, resultCount: 3 })).toBe(false)
  })

  it('skips later pages', () => {
    expect(shouldLogZeroResult({ ...zero, page: 2 })).toBe(false)
  })

  it('skips a search where a filter could not run', () => {
    expect(shouldLogZeroResult({ ...zero, degraded: true })).toBe(false)
  })

  it('skips a search with no words', () => {
    expect(shouldLogZeroResult({ ...zero, query: '' })).toBe(false)
  })

  it('skips an email or phone number', () => {
    expect(shouldLogZeroResult({ ...zero, query: 'me@example.com' })).toBe(false)
    expect(shouldLogZeroResult({ ...zero, query: '404 555 0123' })).toBe(false)
  })
})

describe('logZeroResultSearch', () => {
  it('writes one anonymous search_events row after the response', async () => {
    logZeroResultSearch({
      query: '  vegan   soul food ',
      resultCount: 0,
      cityId: 'city-chi',
      categorySlug: 'food-dining',
    })
    expect(h.inserts).toHaveLength(0) // nothing before after() runs

    await runAfterTasks()
    expect(h.inserts).toEqual([
      {
        table: 'search_events',
        row: {
          query: 'vegan soul food',
          result_count: 0,
          city_id: 'city-chi',
          filters: { category: 'food-dining' },
        },
      },
    ])
  })

  it('never stores a user id, an IP or coordinates', async () => {
    logZeroResultSearch({ query: 'zzqxv', resultCount: 0 })
    await runAfterTasks()
    const keys = Object.keys(h.inserts[0]!.row).sort()
    expect(keys).toEqual(['city_id', 'filters', 'query', 'result_count'])
  })

  it('resolves a city slug from the page to its id', async () => {
    logZeroResultSearch({ query: 'zzqxv', resultCount: 0, citySlug: 'atlanta-ga' })
    await runAfterTasks()
    expect(h.inserts[0]!.row.city_id).toBe('city-atl')
  })

  it('stores a null city for an unknown slug, and empty filters with no category', async () => {
    logZeroResultSearch({ query: 'zzqxv', resultCount: 0, citySlug: 'nowhere' })
    await runAfterTasks()
    expect(h.inserts[0]!.row).toMatchObject({ city_id: null, filters: {} })
  })

  it('schedules nothing for a search with results', () => {
    logZeroResultSearch({ query: 'bakery', resultCount: 12 })
    expect(h.afterTasks).toHaveLength(0)
  })

  it('schedules nothing for an email address', () => {
    logZeroResultSearch({ query: 'me@example.com', resultCount: 0 })
    expect(h.afterTasks).toHaveLength(0)
  })

  it('swallows a failed insert', async () => {
    h.insertError = new Error('db down')
    logZeroResultSearch({ query: 'zzqxv', resultCount: 0 })
    await expect(runAfterTasks()).resolves.toBeUndefined()
  })
})
