import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// =============================================================================
// Ticket 155: close roles on their closing date, keep the page up.
//
// closeExpiredJobs moves a published job whose closes_at has passed to 'closed'.
// The board, search and every count read status = 'published' only, so the role
// leaves them; the page keeps loading because entityPage and the RLS policies
// let a closed JOB through (and nothing else).
//
// The ledger sweep (unpublishExpiredJobPostings) is covered in
// tests/expiry-sweeps.test.ts, including the ticket 155 cases: it writes
// 'closed', and (option b, 2026-10-31) closes a lapsed role even when its own
// closes_at is later.
// =============================================================================

const h = vi.hoisted(() => ({ writeSystemAuditLog: vi.fn(async () => {}) }))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
  createClient: vi.fn(),
}))
vi.mock('@/lib/audit/system', () => ({ writeSystemAuditLog: h.writeSystemAuditLog }))

import {
  closeExpiredJobs,
  JOB_CLOSE_BATCH_LIMIT,
  unpublishExpiredJobPostings,
} from '@/lib/services/expiry/sweeps'

const DAY_MS = 24 * 60 * 60 * 1_000
const NOW = new Date('2026-11-02T09:00:00.000Z')
const yesterday = new Date(NOW.getTime() - DAY_MS).toISOString()
const tomorrow = new Date(NOW.getTime() + DAY_MS).toISOString()

type Result = { data: unknown[] | null; error: { message: string } | null }
type Call = { table: string; chain: [string, unknown[]][] }

const ok = (data: unknown[]): Result => ({ data, error: null })
const fail = (message: string): Result => ({ data: null, error: { message } })

/** Same recording fake as tests/expiry-sweeps.test.ts. Arrays serve successive calls. */
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

  const callsTo = (table: string) => calls.filter((c) => c.table === table)
  const argsOf = (table: string, method: string, nth = 0): unknown[] | undefined =>
    callsTo(table)[nth]?.chain.find(([m]) => m === method)?.[1]
  const allArgsOf = (table: string, method: string, nth = 0): unknown[][] =>
    (callsTo(table)[nth]?.chain ?? []).filter(([m]) => m === method).map(([, a]) => a)
  const updates = (table: string) =>
    callsTo(table).filter((c) => c.chain.some(([m]) => m === 'update'))

  return { client: { from } as never, calls, argsOf, allArgsOf, updates }
}

beforeEach(() => {
  h.writeSystemAuditLog.mockClear()
})

describe('closeExpiredJobs', () => {
  it('closes a published job whose closing date has passed, with one audit row', async () => {
    const fake = makeFakeClient({
      listings: [ok([{ id: 'j1' }]), ok([{ id: 'j1' }])],
      listing_details_job: ok([{ listing_id: 'j1', closes_at: yesterday }]),
    })

    const result = await closeExpiredJobs(fake.client, NOW)

    expect(result).toEqual({ due: 1, closed: 1, failed: 0 })
    expect(fake.argsOf('listings', 'update', 1)).toEqual([{ status: 'closed' }])
    expect(fake.argsOf('listings', 'eq', 1)).toEqual(['id', 'j1'])
    expect(h.writeSystemAuditLog).toHaveBeenCalledTimes(1)
    expect(h.writeSystemAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: null,
        action: 'job_closed',
        targetTable: 'listings',
        targetId: 'j1',
        beforeState: { status: 'published' },
        afterState: { status: 'closed', reason: 'closes_at passed', closes_at: yesterday },
      })
    )
  })

  it('reads only live jobs, and asks the database for past closing dates only', async () => {
    const fake = makeFakeClient({
      listings: ok([{ id: 'j1' }]),
      listing_details_job: ok([]),
    })

    await closeExpiredJobs(fake.client, NOW)

    expect(fake.allArgsOf('listings', 'eq', 0)).toEqual([
      ['entity_type', 'job'],
      ['status', 'published'],
    ])
    expect(fake.argsOf('listings', 'is', 0)).toEqual(['deleted_at', null])
    expect(fake.argsOf('listing_details_job', 'lt')).toEqual(['closes_at', NOW.toISOString()])
  })

  it('does not touch a job that closes tomorrow', async () => {
    // Even if the database returned it, the date is re-checked in code.
    const fake = makeFakeClient({
      listings: ok([{ id: 'j1' }]),
      listing_details_job: ok([{ listing_id: 'j1', closes_at: tomorrow }]),
    })

    const result = await closeExpiredJobs(fake.client, NOW)

    expect(result).toEqual({ due: 0, closed: 0, failed: 0 })
    expect(fake.updates('listings')).toHaveLength(0)
    expect(h.writeSystemAuditLog).not.toHaveBeenCalled()
  })

  it('does not touch a job with no closing date', async () => {
    const fake = makeFakeClient({
      listings: ok([{ id: 'j1' }]),
      listing_details_job: ok([{ listing_id: 'j1', closes_at: null }]),
    })

    const result = await closeExpiredJobs(fake.client, NOW)

    expect(result).toEqual({ due: 0, closed: 0, failed: 0 })
    expect(fake.updates('listings')).toHaveLength(0)
  })

  it('every write re-states job, published and not deleted', async () => {
    const fake = makeFakeClient({
      listings: [ok([{ id: 'j1' }]), ok([{ id: 'j1' }])],
      listing_details_job: ok([{ listing_id: 'j1', closes_at: yesterday }]),
    })

    await closeExpiredJobs(fake.client, NOW)

    expect(fake.allArgsOf('listings', 'eq', 1)).toEqual([
      ['id', 'j1'],
      ['entity_type', 'job'],
      ['status', 'published'],
    ])
    expect(fake.argsOf('listings', 'is', 1)).toEqual(['deleted_at', null])
  })

  it('is idempotent: a second run finds nothing, writes nothing and logs 0', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    // After the first run the job is 'closed', so the published read is empty.
    const fake = makeFakeClient({ listings: ok([]) })

    const result = await closeExpiredJobs(fake.client, NOW)

    expect(result).toEqual({ due: 0, closed: 0, failed: 0 })
    expect(fake.updates('listings')).toHaveLength(0)
    expect(h.writeSystemAuditLog).not.toHaveBeenCalled()
    expect(info).toHaveBeenCalledWith(expect.stringContaining('closed 0'))
    info.mockRestore()
  })

  it('writes no audit row when the update matched nothing (someone moved it first)', async () => {
    const fake = makeFakeClient({
      listings: [ok([{ id: 'j1' }]), ok([])],
      listing_details_job: ok([{ listing_id: 'j1', closes_at: yesterday }]),
    })

    const result = await closeExpiredJobs(fake.client, NOW)

    expect(result).toEqual({ due: 1, closed: 0, failed: 0 })
    expect(h.writeSystemAuditLog).not.toHaveBeenCalled()
  })

  it('keeps going when one row fails, and counts the failure', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fake = makeFakeClient({
      listings: [ok([{ id: 'j1' }, { id: 'j2' }]), fail('deadlock detected'), ok([{ id: 'j2' }])],
      listing_details_job: ok([
        { listing_id: 'j1', closes_at: new Date(NOW.getTime() - 2 * DAY_MS).toISOString() },
        { listing_id: 'j2', closes_at: yesterday },
      ]),
    })

    const result = await closeExpiredJobs(fake.client, NOW)

    expect(result).toEqual({ due: 2, closed: 1, failed: 1 })
    expect(h.writeSystemAuditLog).toHaveBeenCalledTimes(1)
    expect(h.writeSystemAuditLog).toHaveBeenCalledWith(expect.objectContaining({ targetId: 'j2' }))
    err.mockRestore()
  })

  it('throws when the published jobs cannot be read', async () => {
    const fake = makeFakeClient({ listings: fail('permission denied') })
    await expect(closeExpiredJobs(fake.client, NOW)).rejects.toThrow(/permission denied/)
  })

  it('throws when the closing dates cannot be read', async () => {
    const fake = makeFakeClient({
      listings: ok([{ id: 'j1' }]),
      listing_details_job: fail('statement timeout'),
    })
    await expect(closeExpiredJobs(fake.client, NOW)).rejects.toThrow(/statement timeout/)
    expect(fake.updates('listings')).toHaveLength(0)
  })

  it('closes at most JOB_CLOSE_BATCH_LIMIT in one run, oldest first', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const n = JOB_CLOSE_BATCH_LIMIT + 3
    const ids = Array.from({ length: n }, (_, i) => `j${i}`)
    // j0 closed longest ago.
    const dates = ids.map((id, i) => ({
      listing_id: id,
      closes_at: new Date(NOW.getTime() - (n - i) * 60_000).toISOString(),
    }))
    const fake = makeFakeClient({
      listings: [ok(ids.map((id) => ({ id }))), ...ids.map((id) => ok([{ id }]))],
      // Ids are read in chunks; serve every date on the first chunk.
      listing_details_job: [ok(dates.slice().reverse())],
    })

    const result = await closeExpiredJobs(fake.client, NOW)

    expect(result.due).toBe(n)
    expect(result.closed).toBe(JOB_CLOSE_BATCH_LIMIT)
    expect(fake.updates('listings')).toHaveLength(JOB_CLOSE_BATCH_LIMIT)
    expect(fake.argsOf('listings', 'eq', 1)).toEqual(['id', 'j0'])
    info.mockRestore()
  })
})

describe('ledger sweep (ticket 155 changes)', () => {
  const expired = new Date(NOW.getTime() - DAY_MS).toISOString()

  it('sets closed, not unpublished, when every paid window has lapsed', async () => {
    const fake = makeFakeClient({
      job_posting_purchases: ok([{ listing_id: 'j1', expires_at: expired }]),
      listings: ok([{ id: 'j1' }]),
    })

    const result = await unpublishExpiredJobPostings(fake.client, NOW)

    expect(fake.argsOf('listings', 'update')).toEqual([{ status: 'closed' }])
    expect(result.closed).toBe(1)
  })

  it('closes the role when its paid window ends before its closing date', async () => {
    const fake = makeFakeClient({
      job_posting_purchases: ok([{ listing_id: 'j1', expires_at: expired }]),
      listing_details_job: ok([]),
      listings: ok([{ id: 'j1' }]),
    })

    const result = await unpublishExpiredJobPostings(fake.client, NOW)

    // Whichever comes first (founder, 2026-10-31).
    expect(fake.argsOf('listings', 'update')).toEqual([{ status: 'closed' }])
    expect(result).toMatchObject({ lapsed: 1, closed: 1 })
  })
})

describe('cron route wiring', () => {
  const route = readFileSync(path.resolve(process.cwd(), 'app/api/cron/expiry/route.ts'), 'utf8')

  it('runs closeExpiredJobs outside the paidPostings gate', () => {
    const call = route.indexOf('closeExpiredJobs(supabase')
    expect(call).toBeGreaterThan(-1)

    // The gated block is `if (isFeatureEnabled('paidPostings')) { ... } else { ... }`.
    // The close sweep must come after that whole block ends.
    const gate = route.indexOf("isFeatureEnabled('paidPostings')")
    const skipped = route.indexOf("skipped: 'paidPostings feature flag is off'")
    expect(gate).toBeGreaterThan(-1)
    expect(skipped).toBeGreaterThan(gate)
    expect(call).toBeGreaterThan(skipped)
  })

  it('lists a close failure in the run summary', () => {
    expect(route).toMatch(/failures\.push\('closedJobs'\)/)
  })
})
