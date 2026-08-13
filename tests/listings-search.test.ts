// =============================================================================
// GET /api/listings/search — listing typeahead behind receipt entry
// =============================================================================
// This route exists because `createReceiptSubmission` has always read a
// `listing_id` the form never sent, so every receipt in the database has
// `listing_id = null` and the community-spend aggregates that join through it
// cannot populate. The route is the only automatable half of that fix:
// `vitest.config.ts` runs in a node environment with no jsdom or
// @testing-library, so the combobox component itself has no unit coverage and
// is verified by hand on the Preview.
//
// What is pinned here:
//   * anonymous callers get 401, not a directory dump
//   * a sub-2-character query never reaches Postgres
//   * published + not-deleted are actually applied, and the page is capped
//   * ilike wildcards in user input are escaped — "50%" is a literal, not a
//     match-anything pattern (the admin sibling route does not do this)
//   * the PostgREST city embed is flattened at the boundary
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const h = vi.hoisted(() => {
  const state: {
    user: { id: string } | null
    rows: Array<Record<string, unknown>>
    error: { code: string; message: string; details?: string } | null
  } = { user: { id: 'user-1' }, rows: [], error: null }

  /** Every builder method call on the listings query, in order. */
  const calls: unknown[][] = []

  return { state, calls }
})

vi.mock('@/lib/supabase/server', () => {
  function builder() {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'is', 'ilike', 'order']) {
      b[m] = (...args: unknown[]) => {
        h.calls.push([m, ...args])
        return b
      }
    }
    b.limit = (...args: unknown[]) => {
      h.calls.push(['limit', ...args])
      return Promise.resolve({ data: h.state.rows, error: h.state.error })
    }
    return b
  }

  return {
    createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: h.state.user } }) },
      from: () => builder(),
    }),
  }
})

const { GET } = await import('@/app/api/listings/search/route')

/** The route reads request.nextUrl, so give it a real NextRequest shape. */
function req(query: string) {
  return { nextUrl: new URL(`http://localhost/api/listings/search${query}`) } as never
}

/** The value passed to the first recorded call of a builder method. */
function arg(method: string, index = 1): unknown {
  return h.calls.find((c) => c[0] === method)?.[index]
}

beforeEach(() => {
  h.state.user = { id: 'user-1' }
  h.state.rows = []
  h.state.error = null
  h.calls.length = 0
})

describe('auth', () => {
  it('refuses an anonymous caller instead of exposing the directory', async () => {
    h.state.user = null
    const res = await GET(req('?q=bakery'))
    expect(res.status).toBe(401)
    expect((await res.json()).code).toBe('AUTH_REQUIRED')
    expect(h.calls).toHaveLength(0)
  })

  it('answers 200 for a signed-in caller', async () => {
    const res = await GET(req('?q=bakery'))
    expect(res.status).toBe(200)
  })
})

describe('query length', () => {
  it.each(['', '?q=', '?q=a', '?q=%20%20'])('returns nothing without querying for %j', async (qs) => {
    const res = await GET(req(qs))
    expect(await res.json()).toEqual({ data: { listings: [] } })
    expect(h.calls).toHaveLength(0)
  })

  it('queries at two characters', async () => {
    await GET(req('?q=ab'))
    expect(h.calls.length).toBeGreaterThan(0)
  })
})

describe('filters', () => {
  it('restricts to published listings', async () => {
    await GET(req('?q=bakery'))
    expect(h.calls).toContainEqual(['eq', 'status', 'published'])
  })

  it('excludes soft-deleted listings', async () => {
    await GET(req('?q=bakery'))
    expect(h.calls).toContainEqual(['is', 'deleted_at', null])
  })

  it('caps the page at 10', async () => {
    await GET(req('?q=bakery'))
    expect(arg('limit')).toBe(10)
  })

  it('orders by name so the list is stable between keystrokes', async () => {
    await GET(req('?q=bakery'))
    expect(arg('order')).toBe('name')
  })

  it('matches the name as a substring', async () => {
    await GET(req('?q=bakery'))
    expect(arg('ilike', 2)).toBe('%bakery%')
  })

  it('trims the query before matching', async () => {
    await GET(req('?q=%20%20bakery%20%20'))
    expect(arg('ilike', 2)).toBe('%bakery%')
  })
})

describe('ilike wildcards in user input', () => {
  it('escapes % so "50%" is a literal, not a match-anything pattern', async () => {
    await GET(req('?q=50%25%20off'))
    expect(arg('ilike', 2)).toBe('%50\\% off%')
  })

  it('escapes _ so it does not match an arbitrary character', async () => {
    await GET(req('?q=a_b'))
    expect(arg('ilike', 2)).toBe('%a\\_b%')
  })

  it('escapes a backslash so the escape character cannot be injected', async () => {
    await GET(req('?q=a%5Cb'))
    expect(arg('ilike', 2)).toBe('%a\\\\b%')
  })
})

describe('response shape', () => {
  it('flattens the city embed to a plain field', async () => {
    h.state.rows = [{ id: 'l1', name: 'Ada Bakery', slug: 'ada-bakery', cities: { name: 'Chicago' } }]
    const body = await (await GET(req('?q=ada'))).json()
    expect(body).toEqual({
      data: { listings: [{ id: 'l1', name: 'Ada Bakery', slug: 'ada-bakery', cityName: 'Chicago' }] },
    })
  })

  it('tolerates a listing with no city', async () => {
    h.state.rows = [{ id: 'l2', name: 'Nomad Coffee', slug: 'nomad', cities: null }]
    const body = await (await GET(req('?q=nomad'))).json()
    expect(body.data.listings[0].cityName).toBeNull()
  })

  it('reports a query failure instead of answering 200 with an empty list', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    h.state.error = { code: '42P01', message: 'relation "listings" does not exist' }
    const res = await GET(req('?q=bakery'))
    expect(res.status).toBe(500)
    expect((await res.json()).code).toBe('SERVER_ERROR')
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})
