import { describe, it, expect, vi, beforeEach } from 'vitest'
import type Stripe from 'stripe'

// E-2 · Model C — job postings on an included allowance plus paid overflow, and
// the newly-enforced events cap. `[Decision — founder, 2026-08-21]`, superseding
// the Model A decision of 2026-08-17.
//
// Three things under test:
//   1. The rules module (`lib/stripe/jobPostings.ts`) — quota arithmetic,
//      grandfathering, and paid-purchase lookup. Pure enough to test directly.
//   2. The included-posting grant — the $0 row Model C writes into the same
//      ledger a purchase writes to, which is what makes one lifecycle work.
//   3. The Stripe fulfilment handler — including duplicate delivery, which is
//      the case that decides whether a redelivered webhook double-charges the
//      ledger or republishes a listing a moderator has already handled.

const h = vi.hoisted(() => {
  const transitionToPendingReview = vi.fn(async () => ({ success: true as const }))
  const writeSystemAuditLog = vi.fn(async () => {})
  return { transitionToPendingReview, writeSystemAuditLog }
})

vi.mock('@/lib/listings/submitForReview', () => ({
  transitionToPendingReview: h.transitionToPendingReview,
}))
vi.mock('@/lib/audit/system', () => ({ writeSystemAuditLog: h.writeSystemAuditLog }))
vi.mock('@/lib/email/resend', () => ({ sendEmail: vi.fn(async () => {}) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: vi.fn() }))

import {
  eventQuotaFor,
  grantIncludedJobPosting,
  hasPaidJobPosting,
  jobEntitlementKey,
  jobPostingExpiryFrom,
  jobPostingPriceId,
  jobQuotaFor,
  ownerPlanTier,
  EVENT_LIMIT_ENFORCED_FROM,
  JOB_LIMIT_ENFORCED_FROM,
  JOB_POSTING_DURATION_DAYS,
} from '@/lib/stripe/jobPostings'
import { handleCheckoutSessionCompleted } from '@/lib/services/billing/webhookHandlers'

// ── Fake Supabase ────────────────────────────────────────────────────────────
// Records every write so the tests can assert on what actually reached the
// database, and lets each test pin the rows a given table returns.

type Row = Record<string, unknown>

function makeClient(tables: Record<string, Row[]>) {
  // `opts` is recorded because the entitlement path's whole idempotency story is
  // in the upsert options, not in the row: without `onConflict:
  // 'entitlement_key'` a double-submit writes a second free posting.
  const writes: { table: string; op: string; row: Row; opts?: Row }[] = []

  const client = {
    from(table: string) {
      const filters: Row = {}
      let gteCreatedAt: string | null = null

      const rows = () => {
        let out = tables[table] ?? []
        for (const [k, v] of Object.entries(filters)) {
          if (Array.isArray(v)) out = out.filter((r) => v.includes(r[k] as string))
          else out = out.filter((r) => r[k] === v)
        }
        if (gteCreatedAt) {
          out = out.filter((r) => String(r.created_at) >= gteCreatedAt!)
        }
        return out
      }

      // The builder is awaitable at any point in the chain and always resolves
      // to both `data` and `count`, so the same fake serves a plain select and a
      // `select(..., { count: 'exact', head: true })`.
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: (col: string, val: unknown) => {
          filters[col] = val
          return builder
        },
        in: (col: string, vals: unknown[]) => {
          filters[col] = vals
          return builder
        },
        is: () => builder,
        gte: (_col: string, val: string) => {
          gteCreatedAt = val
          return builder
        },
        maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
        upsert: async (row: Row, opts?: Row) => {
          writes.push({ table, op: 'upsert', row, opts })
          return { error: null }
        },
        insert: async (row: Row) => {
          writes.push({ table, op: 'insert', row })
          return { error: null }
        },
        update: async (row: Row) => {
          writes.push({ table, op: 'update', row })
          return { error: null }
        },
        then: (res: (v: { data: Row[]; count: number; error: null }) => unknown) =>
          res({ data: rows(), count: rows().length, error: null }),
      }
      return builder
    },
  }

  return { client: client as never, writes }
}

const AFTER_CUTOFF = '2026-09-01T00:00:00.000Z'
const BEFORE_CUTOFF = '2026-01-01T00:00:00.000Z'

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.STRIPE_JOB_POSTING_PRICE_ID
})

// ── The price is configuration, never a constant ─────────────────────────────

describe('jobPostingPriceId', () => {
  it('is null until the Stripe product exists, so checkout fails closed', () => {
    expect(jobPostingPriceId()).toBeNull()
  })

  it('reads the configured price and trims it', () => {
    process.env.STRIPE_JOB_POSTING_PRICE_ID = '  price_abc123  '
    expect(jobPostingPriceId()).toBe('price_abc123')
  })

  it('treats a blank value as unset rather than as an empty price id', () => {
    process.env.STRIPE_JOB_POSTING_PRICE_ID = '   '
    expect(jobPostingPriceId()).toBeNull()
  })
})

describe('jobPostingExpiryFrom', () => {
  it('adds exactly the documented window', () => {
    const paidAt = new Date('2026-08-17T12:00:00.000Z')
    const expiry = new Date(jobPostingExpiryFrom(paidAt))
    const days = (expiry.getTime() - paidAt.getTime()) / 86_400_000
    expect(days).toBe(JOB_POSTING_DURATION_DAYS)
  })
})

// ── Owner tier ───────────────────────────────────────────────────────────────

describe('ownerPlanTier', () => {
  it('is free when the owner has no listings', async () => {
    const { client } = makeClient({ listings: [] })
    expect(await ownerPlanTier(client, 'u1')).toBe('free')
  })

  it('takes the highest tier the owner holds, not the first or the last', async () => {
    const { client } = makeClient({
      listings: [
        { owner_user_id: 'u1', tier: 'free' },
        { owner_user_id: 'u1', tier: 'growth' },
        { owner_user_id: 'u1', tier: 'starter' },
      ],
    })
    expect(await ownerPlanTier(client, 'u1')).toBe('growth')
  })

  it('treats a null tier as free rather than crashing', async () => {
    const { client } = makeClient({ listings: [{ owner_user_id: 'u1', tier: null }] })
    expect(await ownerPlanTier(client, 'u1')).toBe('free')
  })

  it('ignores an unrecognized tier string instead of ranking it above premium', async () => {
    const { client } = makeClient({
      listings: [
        { owner_user_id: 'u1', tier: 'enterprise' },
        { owner_user_id: 'u1', tier: 'starter' },
      ],
    })
    expect(await ownerPlanTier(client, 'u1')).toBe('starter')
  })
})

// ── The events cap ───────────────────────────────────────────────────────────

describe('eventQuotaFor', () => {
  it('blocks a free owner immediately — free includes zero events', async () => {
    const { client } = makeClient({ listings: [{ owner_user_id: 'u1', tier: 'free' }] })
    const quota = await eventQuotaFor(client, 'u1')
    expect(quota.limit).toBe(0)
    expect(quota.atLimit).toBe(true)
  })

  it('gives a growth owner their three events', async () => {
    const { client } = makeClient({
      listings: [
        { owner_user_id: 'u1', tier: 'growth' },
        {
          owner_user_id: 'u1',
          tier: 'free',
          entity_type: 'event',
          status: 'published',
          created_at: AFTER_CUTOFF,
        },
      ],
    })
    const quota = await eventQuotaFor(client, 'u1')
    expect(quota.tier).toBe('growth')
    expect(quota.limit).toBe(3)
    expect(quota.used).toBe(1)
    expect(quota.atLimit).toBe(false)
  })

  it('stops a growth owner at the third countable event', async () => {
    const events = [1, 2, 3].map(() => ({
      owner_user_id: 'u1',
      tier: 'free',
      entity_type: 'event',
      status: 'published',
      created_at: AFTER_CUTOFF,
    }))
    const { client } = makeClient({
      listings: [{ owner_user_id: 'u1', tier: 'growth' }, ...events],
    })
    const quota = await eventQuotaFor(client, 'u1')
    expect(quota.used).toBe(3)
    expect(quota.atLimit).toBe(true)
  })

  it('grandfathers pre-cutoff events — they neither block nor consume allowance', async () => {
    const old = [1, 2, 3, 4, 5].map(() => ({
      owner_user_id: 'u1',
      tier: 'free',
      entity_type: 'event',
      status: 'published',
      created_at: BEFORE_CUTOFF,
    }))
    const { client } = makeClient({
      listings: [{ owner_user_id: 'u1', tier: 'growth' }, ...old],
    })
    const quota = await eventQuotaFor(client, 'u1')
    expect(quota.used).toBe(0)
    expect(quota.atLimit).toBe(false)
  })

  it('never blocks a premium owner — unlimited short-circuits the count', async () => {
    const { client } = makeClient({ listings: [{ owner_user_id: 'u1', tier: 'premium' }] })
    const quota = await eventQuotaFor(client, 'u1')
    expect(quota.limit).toBeNull()
    expect(quota.atLimit).toBe(false)
  })

  it('uses the documented cutoff instant', () => {
    expect(EVENT_LIMIT_ENFORCED_FROM).toBe('2026-08-17T00:00:00.000Z')
  })
})

// ── Paid-posting lookup ──────────────────────────────────────────────────────

describe('hasPaidJobPosting', () => {
  it('is false with no purchase row', async () => {
    const { client } = makeClient({ job_posting_purchases: [] })
    expect(await hasPaidJobPosting(client, 'l1')).toBe(false)
  })

  it('is true for an unexpired paid purchase', async () => {
    const { client } = makeClient({
      job_posting_purchases: [
        {
          listing_id: 'l1',
          status: 'paid',
          expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        },
      ],
    })
    expect(await hasPaidJobPosting(client, 'l1')).toBe(true)
  })

  it('is false once the window has closed', async () => {
    const { client } = makeClient({
      job_posting_purchases: [
        {
          listing_id: 'l1',
          status: 'paid',
          expires_at: new Date(Date.now() - 86_400_000).toISOString(),
        },
      ],
    })
    expect(await hasPaidJobPosting(client, 'l1')).toBe(false)
  })

  it('ignores a refunded purchase — the filter is on status, not existence', async () => {
    const { client } = makeClient({
      job_posting_purchases: [{ listing_id: 'l1', status: 'refunded', expires_at: null }],
    })
    expect(await hasPaidJobPosting(client, 'l1')).toBe(false)
  })
})

// ── The included-job allowance ───────────────────────────────────────────────
// Model C's arithmetic. The three properties that decide whether an owner is
// charged correctly: only entitlement rows count, only open windows count, and
// the tier read is the owner's highest — never the job listing's own `free`.

const OPEN = () => new Date(Date.now() + 86_400_000).toISOString()
const CLOSED = () => new Date(Date.now() - 86_400_000).toISOString()

function entitlement(over: Row = {}): Row {
  return {
    purchased_by: 'u1',
    status: 'paid',
    source: 'entitlement',
    expires_at: OPEN(),
    ...over,
  }
}

describe('jobQuotaFor', () => {
  it('gives a free owner no allowance at all — every posting is a purchase', async () => {
    const { client } = makeClient({ listings: [{ owner_user_id: 'u1', tier: 'free' }] })
    const quota = await jobQuotaFor(client, 'u1')
    expect(quota.limit).toBe(0)
    expect(quota.atLimit).toBe(true)
  })

  it('gives a starter owner none either — jobs start at growth', async () => {
    const { client } = makeClient({ listings: [{ owner_user_id: 'u1', tier: 'starter' }] })
    const quota = await jobQuotaFor(client, 'u1')
    expect(quota.tier).toBe('starter')
    expect(quota.limit).toBe(0)
    expect(quota.atLimit).toBe(true)
  })

  it('does not count rows for a zero allowance — the ledger is never read', async () => {
    // Rows that WOULD count at a higher tier. `used` staying 0 is what proves
    // the short-circuit fired rather than the filter happening to match nothing.
    const { client } = makeClient({
      listings: [{ owner_user_id: 'u1', tier: 'free' }],
      job_posting_purchases: [entitlement(), entitlement()],
    })
    expect((await jobQuotaFor(client, 'u1')).used).toBe(0)
  })

  it('gives a growth owner one included posting', async () => {
    const { client } = makeClient({
      listings: [{ owner_user_id: 'u1', tier: 'growth' }],
      job_posting_purchases: [],
    })
    const quota = await jobQuotaFor(client, 'u1')
    expect(quota.tier).toBe('growth')
    expect(quota.limit).toBe(1)
    expect(quota.used).toBe(0)
    expect(quota.atLimit).toBe(false)
  })

  it('gives a premium owner three, and stops at the third', async () => {
    const { client } = makeClient({
      listings: [{ owner_user_id: 'u1', tier: 'premium' }],
      job_posting_purchases: [entitlement(), entitlement(), entitlement()],
    })
    const quota = await jobQuotaFor(client, 'u1')
    expect(quota.limit).toBe(3)
    expect(quota.used).toBe(3)
    expect(quota.atLimit).toBe(true)
  })

  it('reads the owner tier, not the job listing tier — a job is created free', async () => {
    // The `[Assumption]` in ownerPlanTier, asserted: if the job's own row won,
    // this growth owner would come back with a limit of 0 and the entitlement
    // the pricing page sells would be unreachable.
    const { client } = makeClient({
      listings: [
        { owner_user_id: 'u1', tier: 'growth' },
        { owner_user_id: 'u1', tier: 'free', entity_type: 'job' },
      ],
    })
    expect((await jobQuotaFor(client, 'u1')).limit).toBe(1)
  })

  it('refills the slot once the window closes — the allowance is rolling, not lifetime', async () => {
    const { client } = makeClient({
      listings: [{ owner_user_id: 'u1', tier: 'growth' }],
      job_posting_purchases: [entitlement({ expires_at: CLOSED() })],
    })
    const quota = await jobQuotaFor(client, 'u1')
    expect(quota.used).toBe(0)
    expect(quota.atLimit).toBe(false)
  })

  it('treats a null expiry as still open, so it cannot disagree with hasPaidJobPosting', async () => {
    const { client } = makeClient({
      listings: [{ owner_user_id: 'u1', tier: 'growth' }],
      job_posting_purchases: [entitlement({ expires_at: null })],
    })
    expect((await jobQuotaFor(client, 'u1')).used).toBe(1)
  })

  it('never spends the allowance on a posting the owner bought', async () => {
    const { client } = makeClient({
      listings: [{ owner_user_id: 'u1', tier: 'growth' }],
      job_posting_purchases: [
        entitlement({ source: 'stripe' }),
        entitlement({ source: 'stripe' }),
      ],
    })
    const quota = await jobQuotaFor(client, 'u1')
    expect(quota.used).toBe(0)
    expect(quota.atLimit).toBe(false)
  })

  it('ignores a refunded entitlement row', async () => {
    const { client } = makeClient({
      listings: [{ owner_user_id: 'u1', tier: 'growth' }],
      job_posting_purchases: [entitlement({ status: 'refunded' })],
    })
    expect((await jobQuotaFor(client, 'u1')).used).toBe(0)
  })

  it("does not count another owner's entitlement", async () => {
    const { client } = makeClient({
      listings: [{ owner_user_id: 'u1', tier: 'growth' }],
      job_posting_purchases: [entitlement({ purchased_by: 'u2' })],
    })
    expect((await jobQuotaFor(client, 'u1')).used).toBe(0)
  })

  it('uses the documented cutoff instant', () => {
    expect(JOB_LIMIT_ENFORCED_FROM).toBe('2026-08-21T00:00:00.000Z')
  })
})

// ── Spending an included posting ─────────────────────────────────────────────

describe('jobEntitlementKey', () => {
  it('collides for the same listing on the same UTC day — a double-submit is one grant', () => {
    const a = jobEntitlementKey('l1', new Date('2026-08-21T00:00:01.000Z'))
    const b = jobEntitlementKey('l1', new Date('2026-08-21T23:59:59.000Z'))
    expect(a).toBe(b)
    expect(a).toBe('l1:2026-08-21')
  })

  it('differs 30 days later, so a genuine renewal is not blocked', () => {
    const first = new Date('2026-08-21T12:00:00.000Z')
    const renewal = new Date(first.getTime() + JOB_POSTING_DURATION_DAYS * 86_400_000)
    expect(jobEntitlementKey('l1', renewal)).not.toBe(jobEntitlementKey('l1', first))
  })

  it('differs per listing on the same day', () => {
    const at = new Date('2026-08-21T12:00:00.000Z')
    expect(jobEntitlementKey('l1', at)).not.toBe(jobEntitlementKey('l2', at))
  })
})

describe('grantIncludedJobPosting', () => {
  const grantedAt = new Date('2026-08-21T12:00:00.000Z')

  // Every case below reads the write the grant made. Pulling it through here
  // rather than indexing at each site asserts the thing worth asserting anyway:
  // a grant writes exactly ONE row. Two would mean an owner burned two slots
  // for one posting. (It also satisfies noUncheckedIndexedAccess without
  // scattering non-null assertions, which would suppress that check silently.)
  function soleWrite(writes: { table: string; op: string; row: Row; opts?: Row }[]) {
    expect(writes).toHaveLength(1)
    const write = writes[0]
    if (!write) throw new Error('grantIncludedJobPosting recorded no write')
    return write
  }

  it('writes a $0 row the rest of the system reads as a paid posting', async () => {
    const { client, writes } = makeClient({ job_posting_purchases: [] })

    const result = await grantIncludedJobPosting(client, {
      listingId: 'l1',
      userId: 'u1',
      now: grantedAt,
    })

    expect(result).toEqual({ ok: true })
    const write = soleWrite(writes)
    expect(write.table).toBe('job_posting_purchases')
    const { row } = write
    expect(row.status).toBe('paid')
    expect(row.amount_cents).toBe(0)
    expect(row.source).toBe('entitlement')
    expect(row.listing_id).toBe('l1')
    expect(row.purchased_by).toBe('u1')
  })

  it('leaves the Stripe columns alone — the CHECK constraint forbids blurring the paths', async () => {
    const { client, writes } = makeClient({ job_posting_purchases: [] })
    await grantIncludedJobPosting(client, { listingId: 'l1', userId: 'u1', now: grantedAt })
    const { row } = soleWrite(writes)
    expect(row.stripe_checkout_session_id).toBeUndefined()
    expect(row.entitlement_key).toBe('l1:2026-08-21')
  })

  it('stamps the same 30-day window a purchase gets, so the sweep needs no special case', async () => {
    const { client, writes } = makeClient({ job_posting_purchases: [] })
    await grantIncludedJobPosting(client, { listingId: 'l1', userId: 'u1', now: grantedAt })
    const { row } = soleWrite(writes)
    expect(row.paid_at).toBe(grantedAt.toISOString())
    const days =
      (new Date(String(row.expires_at)).getTime() - grantedAt.getTime()) / 86_400_000
    expect(days).toBe(JOB_POSTING_DURATION_DAYS)
  })

  it('upserts on the entitlement key so a double-submit grants once', async () => {
    const { client, writes } = makeClient({ job_posting_purchases: [] })
    await grantIncludedJobPosting(client, { listingId: 'l1', userId: 'u1', now: grantedAt })
    const write = soleWrite(writes)
    expect(write.op).toBe('upsert')
    expect(write.opts).toEqual({ onConflict: 'entitlement_key', ignoreDuplicates: true })
  })

  it('returns a failure instead of throwing, so the caller can refuse to charge', async () => {
    // The whole point of the result type: on a write failure the ladder must
    // surface a retry, never fall through to checkout and bill someone for a
    // posting they were entitled to for free.
    const failing = {
      from: () => ({
        upsert: async () => ({ error: { message: 'insert or update violates policy' } }),
      }),
    } as never

    const result = await grantIncludedJobPosting(failing, { listingId: 'l1', userId: 'u1' })

    expect(result.ok).toBe(false)
    expect(result).toMatchObject({ error: expect.stringContaining('violates policy') })
  })
})

// ── Fulfilment ───────────────────────────────────────────────────────────────

function session(over: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return {
    id: 'cs_test_1',
    payment_status: 'paid',
    amount_total: 4900,
    currency: 'usd',
    payment_intent: 'pi_test_1',
    metadata: { purpose: 'job_posting', listing_id: 'l1', user_id: 'u1' },
    ...over,
  } as Stripe.Checkout.Session
}

const draftListing = { id: 'l1', owner_user_id: 'u1', status: 'draft' }

describe('handleCheckoutSessionCompleted', () => {
  it('records the purchase and submits the job for review', async () => {
    const { client, writes } = makeClient({
      listings: [draftListing],
      job_posting_purchases: [],
    })

    await handleCheckoutSessionCompleted(client, session())

    const purchase = writes.find((w) => w.table === 'job_posting_purchases')
    expect(purchase).toBeDefined()
    expect(purchase!.row.status).toBe('paid')
    expect(purchase!.row.stripe_checkout_session_id).toBe('cs_test_1')
    expect(purchase!.row.stripe_payment_intent_id).toBe('pi_test_1')
    expect(h.transitionToPendingReview).toHaveBeenCalledWith(client, 'l1', 'u1')
  })

  it('records what Stripe charged, never a hardcoded price', async () => {
    const { client, writes } = makeClient({ listings: [draftListing] })
    await handleCheckoutSessionCompleted(client, session({ amount_total: 12345, currency: 'cad' }))
    const purchase = writes.find((w) => w.table === 'job_posting_purchases')!
    expect(purchase.row.amount_cents).toBe(12345)
    expect(purchase.row.currency).toBe('cad')
  })

  it('stamps an expiry a full window after payment', async () => {
    const { client, writes } = makeClient({ listings: [draftListing] })
    await handleCheckoutSessionCompleted(client, session())
    const purchase = writes.find((w) => w.table === 'job_posting_purchases')!
    const paidAt = new Date(String(purchase.row.paid_at)).getTime()
    const expires = new Date(String(purchase.row.expires_at)).getTime()
    expect((expires - paidAt) / 86_400_000).toBe(JOB_POSTING_DURATION_DAYS)
  })

  it('ignores a subscription checkout — that state belongs to the subscription events', async () => {
    const { client, writes } = makeClient({ listings: [draftListing] })
    await handleCheckoutSessionCompleted(client, session({ metadata: {} }))
    expect(writes).toHaveLength(0)
    expect(h.transitionToPendingReview).not.toHaveBeenCalled()
  })

  it('fulfils nothing while the payment is still unpaid', async () => {
    const { client, writes } = makeClient({ listings: [draftListing] })
    await handleCheckoutSessionCompleted(client, session({ payment_status: 'unpaid' }))
    expect(writes).toHaveLength(0)
    expect(h.transitionToPendingReview).not.toHaveBeenCalled()
  })

  it('throws on missing metadata so the caller returns 500 and Stripe retries', async () => {
    const { client } = makeClient({ listings: [draftListing] })
    await expect(
      handleCheckoutSessionCompleted(client, session({ metadata: { purpose: 'job_posting' } }))
    ).rejects.toThrow(/missing listing_id/)
  })

  // The case that matters most: Stripe redelivers, and two different events can
  // describe the same session.
  it('is safe on duplicate delivery — the purchase upserts and the listing is not re-transitioned', async () => {
    const { client, writes } = makeClient({
      listings: [{ id: 'l1', owner_user_id: 'u1', status: 'pending' }],
    })

    await handleCheckoutSessionCompleted(client, session())

    const purchase = writes.find((w) => w.table === 'job_posting_purchases')!
    expect(purchase.op).toBe('upsert')
    // Already past draft — a redelivery must not drag a moderated listing back.
    expect(h.transitionToPendingReview).not.toHaveBeenCalled()
  })

  it('does not re-publish a listing a moderator has already published', async () => {
    const { client } = makeClient({
      listings: [{ id: 'l1', owner_user_id: 'u1', status: 'published' }],
    })
    await handleCheckoutSessionCompleted(client, session())
    expect(h.transitionToPendingReview).not.toHaveBeenCalled()
  })

  it('will not transition a listing owned by someone else', async () => {
    const { client } = makeClient({
      listings: [{ id: 'l1', owner_user_id: 'someone_else', status: 'draft' }],
    })
    await handleCheckoutSessionCompleted(client, session())
    expect(h.transitionToPendingReview).not.toHaveBeenCalled()
  })

  it('throws if the paid job cannot be submitted, rather than silently stranding it', async () => {
    h.transitionToPendingReview.mockResolvedValueOnce({ error: 'db down' } as never)
    const { client } = makeClient({ listings: [draftListing] })
    await expect(handleCheckoutSessionCompleted(client, session())).rejects.toThrow(
      /could not be submitted for review/
    )
  })

  it('writes an audit trail for the money movement', async () => {
    const { client } = makeClient({ listings: [draftListing] })
    await handleCheckoutSessionCompleted(client, session())
    expect(h.writeSystemAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'job_posting_purchased', targetId: 'l1' })
    )
  })
})
