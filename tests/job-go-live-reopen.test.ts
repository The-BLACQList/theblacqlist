import { describe, it, expect, vi, afterEach } from 'vitest'

// =============================================================================
// Ticket 155: the two small helpers around a job's closing date.
//
//   applyJobGoLiveDefaults  - at approval, a job with no closing date gets
//                             go-live + 30 days, and on first publish the paid
//                             window restarts from go-live.
//   reopenCoverage /        - an owner who moves a closed role's date into the
//   reopenClosedJob           future gets it back only if a posting window
//                             covers the new date; the move is closed -> published
//                             and nothing else.
// =============================================================================

import { applyJobGoLiveDefaults } from '@/lib/services/listings/jobGoLive'
import {
  reopenClosedJob,
  reopenCoverage,
  REOPEN_NEEDS_NEW_POSTING,
} from '@/lib/services/listings/reopenClosedJob'
import { JOB_POSTING_DURATION_DAYS } from '@/lib/stripe/jobPostings'

type Result = { data: unknown[] | null; error: { message: string } | null }
type Call = { table: string; chain: [string, unknown[]][] }

const ok = (data: unknown[]): Result => ({ data, error: null })
const fail = (message: string): Result => ({ data: null, error: { message } })

/** Recording fake. Results are per table; an array serves successive calls. */
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
    for (const method of ['select', 'update', 'eq', 'lt', 'in', 'is', 'order', 'limit']) {
      builder[method] = (...args: unknown[]) => {
        chain.push([method, args])
        return builder
      }
    }
    return builder
  }

  const callsTo = (table: string) => calls.filter((c) => c.table === table)
  const argsOf = (table: string, method: string, nth = 0): unknown[] | undefined =>
    callsTo(table)[nth]?.chain.find(([m]) => m === method)?.[1]
  const allArgsOf = (table: string, method: string, nth = 0): unknown[][] =>
    (callsTo(table)[nth]?.chain ?? []).filter(([m]) => m === method).map(([, a]) => a)

  return { client: { from } as never, calls, callsTo, argsOf, allArgsOf }
}

const APPROVED_AT = new Date('2026-11-02T15:00:00.000Z')
const WINDOW_END = new Date(
  APPROVED_AT.getTime() + JOB_POSTING_DURATION_DAYS * 24 * 60 * 60 * 1_000
).toISOString()

afterEach(() => {
  vi.restoreAllMocks()
})

describe('applyJobGoLiveDefaults', () => {
  it('sets go-live + 30 days only where no closing date was chosen', async () => {
    const fake = makeFakeClient({ listing_details_job: ok([{ listing_id: 'j1' }]) })

    const result = await applyJobGoLiveDefaults(fake.client, {
      listingId: 'j1',
      publishedAt: APPROVED_AT,
      firstPublish: false,
      paidPostingsOn: true,
    })

    expect(fake.argsOf('listing_details_job', 'update')).toEqual([{ closes_at: WINDOW_END }])
    expect(fake.argsOf('listing_details_job', 'eq')).toEqual(['listing_id', 'j1'])
    expect(fake.argsOf('listing_details_job', 'is')).toEqual(['closes_at', null])
    expect(result).toEqual({ closesAtSet: WINDOW_END, ledgerRestamped: false })
  })

  it("keeps the poster's own date (the guarded update matches no row)", async () => {
    const fake = makeFakeClient({ listing_details_job: ok([]) })

    const result = await applyJobGoLiveDefaults(fake.client, {
      listingId: 'j1',
      publishedAt: APPROVED_AT,
      firstPublish: false,
      paidPostingsOn: false,
    })

    expect(result.closesAtSet).toBeNull()
  })

  it('restarts the newest paid window from go-live on the first publish', async () => {
    const fake = makeFakeClient({
      listing_details_job: ok([{ listing_id: 'j1' }]),
      job_posting_purchases: [ok([{ id: 'p2', created_at: '2026-10-30T00:00:00Z' }]), ok([])],
    })

    const result = await applyJobGoLiveDefaults(fake.client, {
      listingId: 'j1',
      publishedAt: APPROVED_AT,
      firstPublish: true,
      paidPostingsOn: true,
    })

    expect(fake.allArgsOf('job_posting_purchases', 'eq', 0)).toEqual([
      ['listing_id', 'j1'],
      ['status', 'paid'],
    ])
    expect(fake.argsOf('job_posting_purchases', 'order', 0)).toEqual([
      'created_at',
      { ascending: false },
    ])
    expect(fake.argsOf('job_posting_purchases', 'limit', 0)).toEqual([1])
    expect(fake.argsOf('job_posting_purchases', 'update', 1)).toEqual([{ expires_at: WINDOW_END }])
    expect(fake.argsOf('job_posting_purchases', 'eq', 1)).toEqual(['id', 'p2'])
    expect(result.ledgerRestamped).toBe(true)
  })

  it('leaves the ledger alone when paid postings are off', async () => {
    const fake = makeFakeClient({ listing_details_job: ok([{ listing_id: 'j1' }]) })

    const result = await applyJobGoLiveDefaults(fake.client, {
      listingId: 'j1',
      publishedAt: APPROVED_AT,
      firstPublish: true,
      paidPostingsOn: false,
    })

    expect(fake.callsTo('job_posting_purchases')).toHaveLength(0)
    expect(result.ledgerRestamped).toBe(false)
  })

  it('leaves the ledger alone on a re-approval (not the first publish)', async () => {
    const fake = makeFakeClient({ listing_details_job: ok([]) })

    await applyJobGoLiveDefaults(fake.client, {
      listingId: 'j1',
      publishedAt: APPROVED_AT,
      firstPublish: false,
      paidPostingsOn: true,
    })

    expect(fake.callsTo('job_posting_purchases')).toHaveLength(0)
  })

  it('is fail-soft: write errors are logged, never thrown', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fake = makeFakeClient({
      listing_details_job: fail('db down'),
      job_posting_purchases: fail('db down'),
    })

    const result = await applyJobGoLiveDefaults(fake.client, {
      listingId: 'j1',
      publishedAt: APPROVED_AT,
      firstPublish: true,
      paidPostingsOn: true,
    })

    expect(result).toEqual({ closesAtSet: null, ledgerRestamped: false })
    expect(err).toHaveBeenCalled()
  })
})

describe('reopen a closed role', () => {
  const newDate = new Date('2026-11-20T04:59:59.999Z')

  it('is covered when paid postings are off', async () => {
    const fake = makeFakeClient({})
    const result = await reopenCoverage(fake.client, {
      listingId: 'j1',
      createdAt: '2026-10-01T00:00:00Z',
      closesAt: newDate,
      paidPostingsOn: false,
    })
    expect(result).toEqual({ ok: true, covered: true })
    expect(fake.calls).toHaveLength(0)
  })

  it('is covered when a paid window runs past the new date', async () => {
    const fake = makeFakeClient({
      job_posting_purchases: ok([{ id: 'p1', expires_at: '2026-11-25T00:00:00Z' }]),
    })
    const result = await reopenCoverage(fake.client, {
      listingId: 'j1',
      createdAt: '2026-10-01T00:00:00Z',
      closesAt: newDate,
      paidPostingsOn: true,
    })
    expect(result).toEqual({ ok: true, covered: true })
  })

  it('is not covered when every paid window ends before the new date', async () => {
    const fake = makeFakeClient({
      job_posting_purchases: ok([{ id: 'p1', expires_at: '2026-11-10T00:00:00Z' }]),
    })
    const result = await reopenCoverage(fake.client, {
      listingId: 'j1',
      createdAt: '2026-10-01T00:00:00Z',
      closesAt: newDate,
      paidPostingsOn: true,
    })
    expect(result).toEqual({ ok: true, covered: false })
    expect(REOPEN_NEEDS_NEW_POSTING).not.toMatch(/—/)
  })

  it('moves closed -> published only, for that owner and that job', async () => {
    const fake = makeFakeClient({ listings: ok([{ id: 'j1' }]) })

    const result = await reopenClosedJob(fake.client, 'j1', 'owner-1')

    expect(result).toEqual({ ok: true, reopened: true })
    expect(fake.argsOf('listings', 'update')).toEqual([{ status: 'published' }])
    expect(fake.allArgsOf('listings', 'eq')).toEqual([
      ['id', 'j1'],
      ['owner_user_id', 'owner-1'],
      ['entity_type', 'job'],
      ['status', 'closed'],
    ])
    expect(fake.argsOf('listings', 'is')).toEqual(['deleted_at', null])
  })
})
