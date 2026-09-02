// =============================================================================
// Tester Tour — evidence verification (M4.3)
// =============================================================================
// The tour hands out a 30-day Starter subscription. Everything standing
// between a stranger and a free plan is `lib/tour/verify.ts`, so these tests
// are written against the two ways that file could fail:
//
//   1. It counts something forgeable. `analytics_events` is written by the
//      browser — anyone with devtools can POST a perfect `search_performed`.
//      Reading it as evidence would make the whole tour theatre. The doubles
//      below therefore make `from('analytics_events')` THROW: if any verify
//      function ever touches it, the result flips to `{ ok: false }` and these
//      tests go red. A passing suite is a proof of absence, not an opinion.
//
//   2. It reports a failed read as an absence. `no_evidence` tells a tester
//      "go do this thing"; if a dropped connection produced that verdict, the
//      product would tell someone who already reviewed a business to go review
//      one. Every read failure must surface as `{ ok: false }` so the caller
//      can render the retry copy instead — which is why the copy assertions at
//      the bottom prove `retry` and `action` can never be confused.
//
// Not re-asserted here: the SQL `step_key` CHECK list matching `TOUR_STEPS`,
// and the 20-character reflection floor. Both already have assertions at
// tests/tester-tour-trial.test.ts:255-281, against the migration source.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const TESTER = 'tester-user-id'
const ENROLLMENT = 'enrollment-id'

type Filter = { kind: 'eq' | 'in' | 'is'; col: string; val: unknown }
type Row = Record<string, unknown>

const h = vi.hoisted(() => {
  interface Filter {
    kind: 'eq' | 'in' | 'is'
    col: string
    val: unknown
  }
  type Row = Record<string, unknown>

  const state = {
    /** Rows the fake database holds, keyed by table. */
    tables: {} as Record<string, Row[]>,
    /** Tables whose read resolves with a Postgres-style error object. */
    failing: new Set<string>(),
    /**
     * 'trap' throws the moment anything touches `analytics_events` — the
     * structural proof that no verify path reads it. 'readable' lets a test
     * seed it with a forgery and watch it count for nothing.
     */
    analytics: 'trap' as 'trap' | 'readable',
    /** Every query that actually resolved, for filter-shape assertions. */
    queries: [] as { table: string; columns: string; filters: Filter[] }[],
  }

  function matches(row: Row, filters: Filter[]) {
    return filters.every((f) =>
      f.kind === 'in' ? (f.val as unknown[]).includes(row[f.col]) : row[f.col] === f.val
    )
  }

  const createServiceClient = vi.fn(() => ({
    from(table: string) {
      if (table === 'analytics_events' && state.analytics === 'trap') {
        throw new Error('analytics_events is client-writable and is not evidence')
      }

      const q = {
        columns: '',
        head: false,
        filters: [] as Filter[],
        select(columns: string, opts?: { count?: string; head?: boolean }) {
          q.columns = columns
          q.head = opts?.head === true
          return q
        },
        eq(col: string, val: unknown) {
          q.filters.push({ kind: 'eq', col, val })
          return q
        },
        in(col: string, val: unknown[]) {
          q.filters.push({ kind: 'in', col, val })
          return q
        },
        is(col: string, val: unknown) {
          q.filters.push({ kind: 'is', col, val })
          return q
        },
        // Thenable, so `await client.from(x).select(y).eq(z)` resolves without
        // a terminal call — the same shape tests/tester-tour-claim.test.ts uses.
        then(onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
          state.queries.push({ table, columns: q.columns, filters: q.filters })
          if (state.failing.has(table)) {
            return Promise.resolve({
              data: null,
              count: null,
              error: { message: `${table} read failed` },
            }).then(onFulfilled, onRejected)
          }
          const rows = (state.tables[table] ?? []).filter((r) => matches(r, q.filters))
          return Promise.resolve(
            q.head
              ? { data: null, count: rows.length, error: null }
              : { data: rows, count: rows.length, error: null }
          ).then(onFulfilled, onRejected)
        },
      }
      return q
    },
  }))

  return { state, createServiceClient }
})

vi.mock('@/lib/supabase/server', () => ({ createServiceClient: h.createServiceClient }))

import { REFLECTION_GATED_STEPS, TOUR_STEPS } from '@/lib/tour/steps'
import {
  TOUR_STEP_COPY,
  verifyListingSaved,
  verifyPriorReflections,
  verifyReflectionEvidence,
  verifyReviewOrCorrection,
  verifyWitnessRow,
} from '@/lib/tour/verify'

/** Reset to an empty database with the analytics trap armed. */
function reset() {
  h.state.tables = {}
  h.state.failing = new Set()
  h.state.analytics = 'trap'
  h.state.queries = []
}

const queriesOn = (table: string) => h.state.queries.filter((q) => q.table === table)
const filtered = (filters: Filter[], col: string) => filters.filter((f) => f.col === col)

/** Every reflection-gated step, resolved through the one public entry point. */
async function verifyAllGatedSteps() {
  return Promise.all(
    REFLECTION_GATED_STEPS.map(async (step) => ({
      step,
      result: await verifyReflectionEvidence(step, {
        userId: TESTER,
        enrollmentId: ENROLLMENT,
      }),
    }))
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  reset()
})

// ─────────────────────────────────────────────────────────────────────────────
describe('a complete forged analytics_events set proves nothing', () => {
  beforeEach(() => {
    // The best forgery a tester could produce from the browser console: one
    // row per event the tour's six steps correspond to, correctly attributed,
    // correctly named, in the right order. The first-party tables stay empty
    // because none of it actually happened.
    h.state.analytics = 'readable'
    h.state.tables.analytics_events = [
      'page_view',
      'search_performed',
      'filter_applied',
      'collection_viewed',
      'save_toggled',
      'review_submitted',
      'cta_click',
    ].map((event_name) => ({
      event_name,
      user_id: TESTER,
      entity_type: 'listing',
      entity_id: 'some-listing',
    }))
  })

  it('leaves every reflection-gated step at a verified absence of evidence', async () => {
    for (const { step, result } of await verifyAllGatedSteps()) {
      expect(result, `${step} must not be satisfiable from analytics_events`).toEqual({
        ok: true,
        value: false,
      })
    }
  })

  it('never queries analytics_events, even when it is readable and full', async () => {
    await verifyAllGatedSteps()
    expect(h.state.queries.length).toBeGreaterThan(0)
    expect(queriesOn('analytics_events')).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('nothing reads analytics_events', () => {
  it('returns a verified absence — not a read failure — with the table booby-trapped', async () => {
    // The trap is armed (see reset()). A `{ ok: false }` here would mean some
    // verify path touched the table and swallowed the throw; `{ ok: true,
    // value: false }` can only happen if it was never touched at all.
    for (const { step, result } of await verifyAllGatedSteps()) {
      expect(result, `${step} touched analytics_events`).toEqual({ ok: true, value: false })
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('a failed read is read_failed, never no_evidence', () => {
  it('reports a saves failure as a failure', async () => {
    h.state.failing.add('saves')
    expect(await verifyListingSaved(TESTER)).toEqual({
      ok: false,
      error: 'saves read failed',
    })
  })

  it('reports a completions failure as a failure for search_ran', async () => {
    h.state.failing.add('tour_step_completions')
    const result = await verifyWitnessRow(ENROLLMENT, 'search_ran')
    expect(result.ok).toBe(false)
  })

  it('reports a completions failure as a failure for final_reflection', async () => {
    h.state.failing.add('tour_step_completions')
    const result = await verifyPriorReflections(ENROLLMENT)
    expect(result.ok).toBe(false)
  })

  it('reports a failure only when BOTH review reads fail', async () => {
    h.state.failing.add('reviews')
    h.state.failing.add('moderation_queue')
    const result = await verifyReviewOrCorrection(TESTER)
    expect(result.ok).toBe(false)
  })

  it('still counts a correction when the reviews read fails', async () => {
    // Half-blind must not become "no evidence" — but it must not become a
    // retry prompt either when the other half already found proof.
    h.state.failing.add('reviews')
    h.state.tables.moderation_queue = [{ queue_type: 'correction', submitted_by: TESTER }]
    expect(await verifyReviewOrCorrection(TESTER)).toEqual({ ok: true, value: true })
  })

  it('still counts a review when the corrections read fails', async () => {
    h.state.failing.add('moderation_queue')
    h.state.tables.reviews = [{ reviewer_user_id: TESTER, status: 'intake' }]
    expect(await verifyReviewOrCorrection(TESTER)).toEqual({ ok: true, value: true })
  })

  it('reports a thrown client as a failure rather than crashing the caller', async () => {
    h.createServiceClient.mockImplementationOnce(() => {
      throw new Error('service client unavailable')
    })
    expect(await verifyListingSaved(TESTER)).toEqual({
      ok: false,
      error: 'service client unavailable',
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('step copy keeps a failure and an absence apart', () => {
  it('gives every step a retry string distinct from its action string', () => {
    for (const step of TOUR_STEPS) {
      const { action, retry } = TOUR_STEP_COPY[step]
      expect(retry.trim().length, `${step} retry`).toBeGreaterThan(0)
      expect(retry, `${step} retry duplicates its action`).not.toBe(action)
    }
  })

  it('never embeds the action copy inside the retry copy', () => {
    // read_failed renders `retry`. If `retry` quoted `action`, a tester who
    // already did the thing would still be told to go do it — the exact
    // failure this whole module is shaped to prevent.
    for (const step of TOUR_STEPS) {
      const { action, retry } = TOUR_STEP_COPY[step]
      expect(retry, `${step} retry contains its action`).not.toContain(action)
    }
  })

  it('gives every step an action and a title', () => {
    for (const step of TOUR_STEPS) {
      expect(TOUR_STEP_COPY[step].action.trim().length, `${step} action`).toBeGreaterThan(0)
      expect(TOUR_STEP_COPY[step].title.trim().length, `${step} title`).toBeGreaterThan(0)
    }
  })

  it('carries a reflection prompt on exactly the reflection-gated steps', () => {
    for (const step of TOUR_STEPS) {
      const gated = (REFLECTION_GATED_STEPS as readonly string[]).includes(step)
      expect(TOUR_STEP_COPY[step].prompt === null, `${step} prompt`).toBe(!gated)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('a review in any status counts', () => {
  it('counts a review sitting in intake', async () => {
    // RLS forces a newly submitted review to `intake`. A published-only filter
    // would make this step permanently unreachable for every tester.
    h.state.tables.reviews = [{ reviewer_user_id: TESTER, status: 'intake' }]
    expect(await verifyReviewOrCorrection(TESTER)).toEqual({ ok: true, value: true })
  })

  it('sends no status filter to the reviews table', async () => {
    h.state.tables.reviews = [{ reviewer_user_id: TESTER, status: 'intake' }]
    await verifyReviewOrCorrection(TESTER)
    const [query] = queriesOn('reviews')
    expect(query).toBeDefined()
    expect(filtered(query!.filters, 'status')).toEqual([])
    expect(query!.filters).toEqual([{ kind: 'eq', col: 'reviewer_user_id', val: TESTER }])
  })

  it('does not count another tester’s review', async () => {
    h.state.tables.reviews = [{ reviewer_user_id: 'someone-else', status: 'published' }]
    expect(await verifyReviewOrCorrection(TESTER)).toEqual({ ok: true, value: false })
  })

  it('counts an attributed correction but not an unattributed one', async () => {
    h.state.tables.moderation_queue = [
      { queue_type: 'correction', submitted_by: null },
      { queue_type: 'claim', submitted_by: TESTER },
    ]
    expect(await verifyReviewOrCorrection(TESTER)).toEqual({ ok: true, value: false })

    h.state.tables.moderation_queue.push({ queue_type: 'correction', submitted_by: TESTER })
    expect(await verifyReviewOrCorrection(TESTER)).toEqual({ ok: true, value: true })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('listing_saved requires a listing the tester does not own', () => {
  const save = (listings: Row | null) => ({ user_id: TESTER, listing_id: 'l', listings })

  it('does not count a tester saving their own listing', async () => {
    h.state.tables.saves = [save({ owner_user_id: TESTER })]
    expect(await verifyListingSaved(TESTER)).toEqual({ ok: true, value: false })
  })

  it('counts a save of someone else’s listing', async () => {
    h.state.tables.saves = [save({ owner_user_id: 'another-owner' })]
    expect(await verifyListingSaved(TESTER)).toEqual({ ok: true, value: true })
  })

  it('counts a save of an unclaimed listing', async () => {
    // The ownership filter runs in JS precisely for this row: Postgres `neq`
    // excludes NULLs, so a `.neq('listings.owner_user_id', …)` would silently
    // drop every unclaimed listing — the majority of the directory.
    h.state.tables.saves = [save({ owner_user_id: null })]
    expect(await verifyListingSaved(TESTER)).toEqual({ ok: true, value: true })
  })

  it('does not count a save whose listing join came back empty', async () => {
    // Unverifiable ownership errs the same safe direction as the rest of the
    // module: it proves nothing, so it counts for nothing.
    h.state.tables.saves = [save(null)]
    expect(await verifyListingSaved(TESTER)).toEqual({ ok: true, value: false })
  })

  it('scopes the saves read to this tester', async () => {
    await verifyListingSaved(TESTER)
    const [query] = queriesOn('saves')
    expect(query!.filters).toEqual([{ kind: 'eq', col: 'user_id', val: TESTER }])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('final_reflection requires the three earlier written steps', () => {
  const priorSteps = REFLECTION_GATED_STEPS.filter((s) => s !== 'final_reflection')
  const SUBSTANTIVE = 'A reflection that clears the twenty character floor.'

  const completed = (overrides: Record<string, string | null> = {}) =>
    priorSteps.map((step_key) => ({
      enrollment_id: ENROLLMENT,
      step_key,
      reflection: step_key in overrides ? overrides[step_key] : SUBSTANTIVE,
    }))

  it('passes when all three carry substantive text', async () => {
    h.state.tables.tour_step_completions = completed()
    expect(await verifyPriorReflections(ENROLLMENT)).toEqual({ ok: true, value: true })
  })

  it('fails when one reflection is a witness row with no text', async () => {
    h.state.tables.tour_step_completions = completed({ listing_saved: null })
    expect(await verifyPriorReflections(ENROLLMENT)).toEqual({ ok: true, value: false })
  })

  it('fails on a reflection one character under the floor', async () => {
    // Re-checked in JS so the verdict never silently depends on a DB CHECK
    // someone might relax later.
    h.state.tables.tour_step_completions = completed({ search_ran: 'x'.repeat(19) })
    expect(await verifyPriorReflections(ENROLLMENT)).toEqual({ ok: true, value: false })
  })

  it('fails on whitespace padded out to the floor', async () => {
    h.state.tables.tour_step_completions = completed({ search_ran: `  ${' '.repeat(30)}  ` })
    expect(await verifyPriorReflections(ENROLLMENT)).toEqual({ ok: true, value: false })
  })

  it('fails when a step is missing entirely', async () => {
    h.state.tables.tour_step_completions = completed().slice(1)
    expect(await verifyPriorReflections(ENROLLMENT)).toEqual({ ok: true, value: false })
  })

  it('does not require the two un-gated steps', async () => {
    // listing_opened and collection_browsed tick without text; asking them for
    // a reflection would make final_reflection unreachable.
    h.state.tables.tour_step_completions = completed()
    expect(await verifyPriorReflections(ENROLLMENT)).toEqual({ ok: true, value: true })
    const [query] = queriesOn('tour_step_completions')
    expect(filtered(query!.filters, 'step_key')).toEqual([
      { kind: 'in', col: 'step_key', val: priorSteps },
    ])
  })

  it('ignores another enrollment’s completions', async () => {
    h.state.tables.tour_step_completions = completed().map((row) => ({
      ...row,
      enrollment_id: 'someone-elses-enrollment',
    }))
    expect(await verifyPriorReflections(ENROLLMENT)).toEqual({ ok: true, value: false })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('verifyReflectionEvidence routes each step to its own source', () => {
  it('reads the witness row for search_ran and nothing else', async () => {
    h.state.tables.tour_step_completions = [{ enrollment_id: ENROLLMENT, step_key: 'search_ran' }]
    const result = await verifyReflectionEvidence('search_ran', {
      userId: TESTER,
      enrollmentId: ENROLLMENT,
    })
    expect(result).toEqual({ ok: true, value: true })
    expect(new Set(h.state.queries.map((q) => q.table))).toEqual(
      new Set(['tour_step_completions'])
    )
  })

  it('reads saves for listing_saved and nothing else', async () => {
    h.state.tables.saves = [
      { user_id: TESTER, listing_id: 'l', listings: { owner_user_id: 'other' } },
    ]
    const result = await verifyReflectionEvidence('listing_saved', {
      userId: TESTER,
      enrollmentId: ENROLLMENT,
    })
    expect(result).toEqual({ ok: true, value: true })
    expect(new Set(h.state.queries.map((q) => q.table))).toEqual(new Set(['saves']))
  })

  it('reads reviews and the moderation queue for review_or_correction', async () => {
    await verifyReflectionEvidence('review_or_correction', {
      userId: TESTER,
      enrollmentId: ENROLLMENT,
    })
    expect(new Set(h.state.queries.map((q) => q.table))).toEqual(
      new Set(['reviews', 'moderation_queue'])
    )
  })
})
