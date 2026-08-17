import { describe, it, expect, vi, beforeEach } from 'vitest'

// =============================================================================
// The two scheduled expiry sweeps.
//
// These close two debts that were previously stated in source rather than
// implemented: `lib/ai/review.ts` expired suggestions only when someone opened
// one, and `lib/stripe/jobPostings.ts` never unpublished a job when its paid
// window closed.
//
// The two sweeps get very different amounts of test weight here, and that is
// deliberate. The suggestion sweep cannot change what any owner is allowed to
// do — the on-access check in `review.ts` already refuses an over-age `pending`
// row — so its failure mode is cosmetic. The job sweep takes a live listing off
// the site, so most of this file is about the ways it could unpublish something
// it should not have.
//
// Three of those ways get their own test because each is a real shape in the
// data, not a hypothetical:
//   · a job posted before E-2 existed, which has no purchase row at all
//   · a renewal, which the schema stores as a SECOND purchase row
//   · a paid row with a null `expires_at`
//
// NON-VACUITY. This is all-new code, so "stash lib/ and re-run" proves nothing
// (the import would fail). Instead the implementation was mutated five ways and
// each mutation was confirmed to turn a specific test red — 16/16 green on the
// real code, and never fewer than one failure on a wrong one
// `[Measured — vitest, 2026-08-17]`:
//
//   M1  renewal rule inverted, so any expired row lapses the listing
//       → 'spares a listing whose purchase was renewed'                  (1 red)
//   M2  the empty-candidate early return removed
//       → 'never touches a job that was never paid for', plus the renewal
//         and null-expiry guards                                         (3 red)
//   M3  `.eq('status','published')` dropped from the UPDATE
//       → 'constrains the update to currently-published, non-deleted jobs' (1 red)
//   M4  `unpublished` reported from the candidate list, not the UPDATE result
//       → 'separates lapsed from actually-unpublished'                   (1 red)
//   M5  a null `expires_at` read as expired
//       → 'treats a null expiry as an open window'                       (1 red)
// =============================================================================

const h = vi.hoisted(() => ({ writeSystemAuditLog: vi.fn(async () => {}) }))

// `sweeps.ts` imports SUGGESTION_EXPIRY_DAYS from `lib/ai/review.ts`, which
// imports the Supabase server module at load time. Stubbed so the import graph
// resolves under `environment: 'node'` with no Next request context.
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
  createClient: vi.fn(),
}))
vi.mock('@/lib/audit/system', () => ({ writeSystemAuditLog: h.writeSystemAuditLog }))

import { SUGGESTION_EXPIRY_DAYS } from '@/lib/ai/review'
import { expireStaleSuggestions, unpublishExpiredJobPostings } from '@/lib/services/expiry/sweeps'

const DAY_MS = 24 * 60 * 60 * 1_000
const NOW = new Date('2026-08-17T08:00:00.000Z')

type Result = { data: unknown[] | null; error: { message: string } | null }
type Call = { table: string; chain: [string, unknown[]][] }

const ok = (data: unknown[]): Result => ({ data, error: null })
const fail = (message: string): Result => ({ data: null, error: { message } })

/**
 * A recording fake. Every chained call is captured with its arguments, and the
 * builder is thenable so `await supabase.from(t).update(...)...select('id')`
 * resolves. Results are keyed by table; pass an array to serve successive calls
 * to the same table.
 */
function makeFakeClient(results: Record<string, Result | Result[]>) {
  const calls: Call[] = []

  function from(table: string) {
    const chain: [string, unknown[]][] = []
    calls.push({ table, chain })

    const resolve = (): Result => {
      const entry = results[table]
      if (Array.isArray(entry)) return entry.shift() ?? ok([])
      return entry ?? ok([])
    }

    const builder: Record<string, unknown> = {
      then: (onFulfilled: (r: Result) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve(resolve()).then(onFulfilled, onRejected),
    }
    for (const method of ['select', 'update', 'eq', 'lt', 'in', 'is']) {
      builder[method] = (...args: unknown[]) => {
        chain.push([method, args])
        return builder
      }
    }
    return builder
  }

  const argsOf = (table: string, method: string, nth = 0): unknown[] | undefined => {
    const call = calls.filter((c) => c.table === table)[nth]
    return call?.chain.find(([m]) => m === method)?.[1]
  }

  const allArgsOf = (table: string, method: string, nth = 0): unknown[][] =>
    (calls.filter((c) => c.table === table)[nth]?.chain ?? [])
      .filter(([m]) => m === method)
      .map(([, a]) => a)

  return {
    client: { from } as never,
    calls,
    argsOf,
    allArgsOf,
    tablesTouched: () => calls.map((c) => c.table),
  }
}

beforeEach(() => {
  h.writeSystemAuditLog.mockClear()
})

// ─────────────────────────────────────────────────────────────────────────────
describe('expireStaleSuggestions', () => {
  it('writes `expired` over pending rows older than the window', async () => {
    const fake = makeFakeClient({ ai_suggestions: ok([{ id: 's1' }, { id: 's2' }]) })

    const result = await expireStaleSuggestions(fake.client, NOW)

    expect(fake.argsOf('ai_suggestions', 'update')).toEqual([{ status: 'expired' }])
    expect(fake.argsOf('ai_suggestions', 'eq')).toEqual(['status', 'pending'])
    expect(result.expired).toBe(2)
  })

  it('derives the cutoff from SUGGESTION_EXPIRY_DAYS, not a second copy of "7"', async () => {
    const fake = makeFakeClient({ ai_suggestions: ok([]) })

    const result = await expireStaleSuggestions(fake.client, NOW)

    const expected = new Date(NOW.getTime() - SUGGESTION_EXPIRY_DAYS * DAY_MS).toISOString()
    expect(fake.argsOf('ai_suggestions', 'lt')).toEqual(['created_at', expected])
    // Returned so a cron log can record the boundary the run actually used.
    expect(result.cutoff).toBe(expected)
  })

  it('reports what the database changed, not what it intended', async () => {
    const fake = makeFakeClient({ ai_suggestions: ok([{ id: 's1' }]) })

    expect((await expireStaleSuggestions(fake.client, NOW)).expired).toBe(1)
  })

  it('throws on a write error rather than reporting zero rows swept', async () => {
    const fake = makeFakeClient({ ai_suggestions: fail('permission denied') })

    // A failed sweep and an empty sweep both produce 0. Only one is fine.
    await expect(expireStaleSuggestions(fake.client, NOW)).rejects.toThrow(/permission denied/)
  })

  // Guard, passes in both directions: nothing stale must be quiet, not an error.
  it('reports zero without throwing when nothing is stale', async () => {
    const fake = makeFakeClient({ ai_suggestions: ok([]) })

    await expect(expireStaleSuggestions(fake.client, NOW)).resolves.toMatchObject({ expired: 0 })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('unpublishExpiredJobPostings', () => {
  const expired = new Date(NOW.getTime() - DAY_MS).toISOString()
  const live = new Date(NOW.getTime() + DAY_MS).toISOString()

  it('unpublishes a job whose only paid window has closed', async () => {
    const fake = makeFakeClient({
      job_posting_purchases: ok([{ listing_id: 'l1', expires_at: expired }]),
      listings: ok([{ id: 'l1' }]),
    })

    const result = await unpublishExpiredJobPostings(fake.client, NOW)

    expect(fake.argsOf('listings', 'update')).toEqual([{ status: 'unpublished' }])
    expect(fake.argsOf('listings', 'in')).toEqual(['id', ['l1']])
    expect(result).toEqual({ lapsed: 1, unpublished: 1, renewed: 0 })
  })

  // THE expensive mistake. Jobs posted before E-2 existed were free, and have no
  // purchase row at all. Unpublishing them charges retroactively for something
  // that was given away.
  it('never touches a job that was never paid for', async () => {
    const fake = makeFakeClient({ job_posting_purchases: ok([]), listings: ok([]) })

    const result = await unpublishExpiredJobPostings(fake.client, NOW)

    expect(fake.tablesTouched()).not.toContain('listings')
    expect(result).toEqual({ lapsed: 0, unpublished: 0, renewed: 0 })
  })

  // A renewal is a second purchase row, not an edit of the first — the schema
  // says so and declines a unique constraint on listing_id for that reason.
  it('spares a listing whose purchase was renewed', async () => {
    const fake = makeFakeClient({
      job_posting_purchases: ok([
        { listing_id: 'l1', expires_at: expired },
        { listing_id: 'l1', expires_at: live },
      ]),
      listings: ok([]),
    })

    const result = await unpublishExpiredJobPostings(fake.client, NOW)

    expect(fake.tablesTouched()).not.toContain('listings')
    expect(result).toEqual({ lapsed: 0, unpublished: 0, renewed: 1 })
  })

  it('treats a null expiry as an open window, not an expired one', async () => {
    const fake = makeFakeClient({
      job_posting_purchases: ok([{ listing_id: 'l1', expires_at: null }]),
      listings: ok([]),
    })

    const result = await unpublishExpiredJobPostings(fake.client, NOW)

    expect(fake.tablesTouched()).not.toContain('listings')
    expect(result.lapsed).toBe(0)
  })

  it('reads only paid purchases — pending and refunded rows are not a licence', async () => {
    const fake = makeFakeClient({ job_posting_purchases: ok([]) })

    await unpublishExpiredJobPostings(fake.client, NOW)

    expect(fake.argsOf('job_posting_purchases', 'eq')).toEqual(['status', 'paid'])
  })

  it('constrains the update to currently-published, non-deleted jobs', async () => {
    const fake = makeFakeClient({
      job_posting_purchases: ok([{ listing_id: 'l1', expires_at: expired }]),
      listings: ok([{ id: 'l1' }]),
    })

    await unpublishExpiredJobPostings(fake.client, NOW)

    // Belt on top of braces: even a wrong candidate set cannot unpublish
    // something that is not a live job.
    expect(fake.allArgsOf('listings', 'eq')).toEqual([
      ['entity_type', 'job'],
      ['status', 'published'],
    ])
    expect(fake.argsOf('listings', 'is')).toEqual(['deleted_at', null])
  })

  it('separates lapsed from actually-unpublished when the update matches fewer', async () => {
    // Two lapsed candidates; only one is still `published` when the UPDATE runs.
    const fake = makeFakeClient({
      job_posting_purchases: ok([
        { listing_id: 'l1', expires_at: expired },
        { listing_id: 'l2', expires_at: expired },
      ]),
      listings: ok([{ id: 'l1' }]),
    })

    const result = await unpublishExpiredJobPostings(fake.client, NOW)

    expect(result).toEqual({ lapsed: 2, unpublished: 1, renewed: 0 })
    expect(h.writeSystemAuditLog).toHaveBeenCalledTimes(1)
  })

  it('writes one audit row per listing, keyed by listing id', async () => {
    const fake = makeFakeClient({
      job_posting_purchases: ok([
        { listing_id: 'l1', expires_at: expired },
        { listing_id: 'l2', expires_at: expired },
      ]),
      listings: ok([{ id: 'l1' }, { id: 'l2' }]),
    })

    await unpublishExpiredJobPostings(fake.client, NOW)

    // An owner asking "why did my job disappear" asks about one listing, so the
    // answer has to be findable by that listing's id — not a batch row.
    expect(h.writeSystemAuditLog).toHaveBeenCalledTimes(2)
    expect(h.writeSystemAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'job_posting_expired',
        targetTable: 'listings',
        targetId: 'l1',
        afterState: { status: 'unpublished', reason: 'posting_window_elapsed' },
      })
    )
  })

  it('throws when the purchase ledger cannot be read', async () => {
    const fake = makeFakeClient({ job_posting_purchases: fail('relation does not exist') })

    // This is the shape of running before the E-2 migration is applied. It must
    // surface as a red cron run, not as "0 listings expired".
    await expect(unpublishExpiredJobPostings(fake.client, NOW)).rejects.toThrow(
      /relation does not exist/
    )
  })

  it('throws when the unpublish write fails', async () => {
    const fake = makeFakeClient({
      job_posting_purchases: ok([{ listing_id: 'l1', expires_at: expired }]),
      listings: fail('deadlock detected'),
    })

    await expect(unpublishExpiredJobPostings(fake.client, NOW)).rejects.toThrow(/deadlock detected/)
    expect(h.writeSystemAuditLog).not.toHaveBeenCalled()
  })

  // Guard: a clean run must write no audit noise.
  it('writes no audit rows when nothing lapsed', async () => {
    const fake = makeFakeClient({
      job_posting_purchases: ok([{ listing_id: 'l1', expires_at: live }]),
    })

    await unpublishExpiredJobPostings(fake.client, NOW)

    expect(h.writeSystemAuditLog).not.toHaveBeenCalled()
  })
})
