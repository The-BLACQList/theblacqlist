import { describe, it, expect, vi, beforeEach } from 'vitest'

// submitReflectionAction — the Tester Tour's only reflection write path
// (tester-tour-spec.md §6), tested against a service-client double that records
// every operation it is handed.
//
// Two things here are worth more than the rest combined:
//
//   1. THE COPY SPLIT. `{ ok: false }` (a read failed) and
//      `{ ok: true, value: false }` (verified absence) must return DIFFERENT
//      strings and must never swap. Swapping them tells a tester who already
//      saved a listing to go save a listing — the exact failure lib/tour/verify.ts
//      exists to prevent, and a swap is a one-character edit away at all times.
//   2. THE SWEEP IS BEST-EFFORT. The reflection is already written by the time
//      the completion sweep runs, so a sweep that fails must still report
//      success. A test that only ever exercises the happy sweep would let a
//      future refactor hoist the sweep's failure into the caller's face.
//
// lib/tour/verify.ts is only PARTIALLY mocked: `verifyReflectionEvidence` is a
// double, but TOUR_STEP_COPY is the real table. The copy assertions below
// therefore compare against the strings that actually ship.

const h = vi.hoisted(() => {
  interface UpsertCall {
    table: string
    payload: Record<string, unknown>
    options: Record<string, unknown> | undefined
  }
  interface Filter {
    kind: 'eq' | 'is' | 'in'
    col: string
    val: unknown
  }
  interface UpdateCall {
    table: string
    payload: Record<string, unknown>
    filters: Filter[]
  }

  const state = {
    viewer: null as {
      userId: string
      email: string | null
      enrollment: {
        id: string
        listingId: string
        completedAt: string | null
        trialGrantedAt: string | null
      }
    } | null,
    evidence: { ok: true, value: true } as
      | { ok: true; value: boolean }
      | { ok: false; error: string },
    /** Result of the reflection upsert. */
    upsertError: null as { message: string } | null,
    /** Rows the sweep's SELECT returns. */
    completionRows: null as { step_key: string; reflection: string | null }[] | null,
    /** Make the sweep's SELECT throw, to prove the swallow. */
    sweepReadThrows: false,
    /** Make the completion UPDATE throw, to prove the swallow covers it too. */
    sweepWriteThrows: false,
    /** Make createServiceClient itself throw, to prove the outer catch. */
    clientThrows: false,
    upserts: [] as UpsertCall[],
    selects: [] as { table: string; columns: string; filters: Filter[] }[],
    updates: [] as UpdateCall[],
  }

  const resolveTourViewer = vi.fn(async () => state.viewer)
  const verifyReflectionEvidence = vi.fn(async () => state.evidence)
  const revalidatePath = vi.fn()

  const createServiceClient = vi.fn(() => {
    if (state.clientThrows) throw new Error('no service client')
    return {
      from(table: string) {
        const q = {
          op: 'select' as 'select' | 'upsert' | 'update',
          columns: '',
          payload: {} as Record<string, unknown>,
          options: undefined as Record<string, unknown> | undefined,
          filters: [] as Filter[],
          select(columns: string) {
            q.op = 'select'
            q.columns = columns
            return q
          },
          upsert(payload: Record<string, unknown>, options?: Record<string, unknown>) {
            q.op = 'upsert'
            q.payload = payload
            q.options = options
            return q
          },
          update(payload: Record<string, unknown>) {
            q.op = 'update'
            q.payload = payload
            return q
          },
          eq(col: string, val: unknown) {
            q.filters.push({ kind: 'eq', col, val })
            return q
          },
          is(col: string, val: unknown) {
            q.filters.push({ kind: 'is', col, val })
            return q
          },
          in(col: string, val: unknown) {
            q.filters.push({ kind: 'in', col, val })
            return q
          },
          // Every one of these chains is awaited directly, so the builder is
          // thenable and the operation is recorded at await time — the order in
          // state.upserts / state.updates is real execution order.
          then(
            onFulfilled?: (v: { data: unknown; error: unknown }) => unknown,
            onRejected?: (e: unknown) => unknown
          ) {
            return Promise.resolve()
              .then(() => {
                if (q.op === 'upsert') {
                  state.upserts.push({ table, payload: q.payload, options: q.options })
                  return { data: null, error: state.upsertError }
                }
                if (q.op === 'update') {
                  if (state.sweepWriteThrows) throw new Error('update blew up')
                  state.updates.push({ table, payload: q.payload, filters: q.filters })
                  return { data: null, error: null }
                }
                if (state.sweepReadThrows) throw new Error('select blew up')
                state.selects.push({ table, columns: q.columns, filters: q.filters })
                return { data: state.completionRows, error: null }
              })
              .then(onFulfilled, onRejected)
          },
        }
        return q
      },
    }
  })

  return { state, resolveTourViewer, verifyReflectionEvidence, createServiceClient, revalidatePath }
})

vi.mock('@/lib/tour/witness', () => ({ resolveTourViewer: h.resolveTourViewer }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: h.createServiceClient }))
vi.mock('next/cache', () => ({ revalidatePath: h.revalidatePath, revalidateTag: vi.fn() }))
// Partial on purpose — see the header. TOUR_STEP_COPY stays real.
vi.mock('@/lib/tour/verify', async () => {
  const actual = await vi.importActual<typeof import('@/lib/tour/verify')>('@/lib/tour/verify')
  return { ...actual, verifyReflectionEvidence: h.verifyReflectionEvidence }
})

import { submitReflectionAction } from '@/lib/actions/tour/submitReflection'
import { TOUR_STEP_COPY } from '@/lib/tour/verify'
import { REFLECTION_GATED_STEPS, REFLECTION_MIN_LENGTH } from '@/lib/tour/steps'

const NOT_AVAILABLE = 'The tour isn’t available for this account.'
const SAVE_FAILED = 'Couldn’t save your reflection just now. Try again in a moment.'
const GOOD = 'The results were closer to what I expected than I thought they would be.'

function form(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) fd.set(key, value)
  return fd
}

/** Every gated step reflected substantively — the sweep's completion case. */
function allFourReflected() {
  return REFLECTION_GATED_STEPS.map((step) => ({ step_key: step, reflection: GOOD }))
}

function errorOf(state: Awaited<ReturnType<typeof submitReflectionAction>>): string | null {
  return state !== null && 'error' in state ? state.error : null
}

beforeEach(() => {
  vi.clearAllMocks()
  h.state.viewer = {
    userId: 'u1',
    email: 'tester@example.com',
    enrollment: {
      id: 'enr-1',
      listingId: 'l1',
      completedAt: null,
      trialGrantedAt: null,
    },
  }
  h.state.evidence = { ok: true, value: true }
  h.state.upsertError = null
  h.state.completionRows = []
  h.state.sweepReadThrows = false
  h.state.sweepWriteThrows = false
  h.state.clientThrows = false
  h.state.upserts = []
  h.state.selects = []
  h.state.updates = []
})

describe('submitReflectionAction — gates before anything is written', () => {
  it('refuses with one generic string when the viewer does not resolve', async () => {
    h.state.viewer = null
    const result = await submitReflectionAction(null, form({ step: 'search_ran', reflection: GOOD }))
    expect(errorOf(result)).toBe(NOT_AVAILABLE)
    // Flag off / signed out / not enrolled are deliberately indistinguishable:
    // the rail never renders for any of them, so a caller here is poking the
    // action directly and is owed nothing more specific.
    expect(h.createServiceClient).not.toHaveBeenCalled()
    expect(h.verifyReflectionEvidence).not.toHaveBeenCalled()
  })

  it('rejects a missing step field', async () => {
    const result = await submitReflectionAction(null, form({ reflection: GOOD }))
    expect(errorOf(result)).toBe('That step doesn’t take a written reflection.')
    expect(h.state.upserts).toHaveLength(0)
  })

  it('rejects an unknown step key', async () => {
    const result = await submitReflectionAction(
      null,
      form({ step: 'not_a_step', reflection: GOOD })
    )
    expect(errorOf(result)).toBe('That step doesn’t take a written reflection.')
    expect(h.state.upserts).toHaveLength(0)
  })

  it.each(['listing_opened', 'collection_browsed'])(
    'rejects %s — a real step that is not reflection-gated',
    async (step) => {
      // The filter is REFLECTION_GATED_STEPS, not "is this a known step". Those
      // two rows are written by page-render witnesses only; a form post must
      // never be able to mint one.
      const result = await submitReflectionAction(null, form({ step, reflection: GOOD }))
      expect(errorOf(result)).toBe('That step doesn’t take a written reflection.')
      expect(h.state.upserts).toHaveLength(0)
    }
  )

  it('rejects a missing reflection field', async () => {
    const result = await submitReflectionAction(null, form({ step: 'search_ran' }))
    expect(errorOf(result)).toBe('Write your reflection before submitting.')
  })

  it('rejects whitespace-only text before the length check', async () => {
    const result = await submitReflectionAction(
      null,
      form({ step: 'search_ran', reflection: '        ' })
    )
    expect(errorOf(result)).toBe('Write your reflection before submitting.')
  })

  it('rejects text that is short once trimmed, quoting the advertised minimum', async () => {
    const short = `  ${'a'.repeat(REFLECTION_MIN_LENGTH - 1)}  `
    const result = await submitReflectionAction(
      null,
      form({ step: 'search_ran', reflection: short })
    )
    expect(errorOf(result)).toBe(
      `A few more words — reflections need at least ${REFLECTION_MIN_LENGTH} characters.`
    )
    expect(h.state.upserts).toHaveLength(0)
  })

  it('accepts text that only clears the minimum after trimming, and stores it trimmed', async () => {
    // The DB CHECK compares btrim'd text. If this layer measured the untrimmed
    // string the three enforcement points would disagree and the insert would
    // fail at the database with an opaque error.
    const exact = 'a'.repeat(REFLECTION_MIN_LENGTH)
    const result = await submitReflectionAction(
      null,
      form({ step: 'search_ran', reflection: `   ${exact}   ` })
    )
    expect(result).toEqual({ success: true })
    expect(h.state.upserts[0]!.payload.reflection).toBe(exact)
  })
})

describe('submitReflectionAction — the evidence gate copy split', () => {
  it.each(REFLECTION_GATED_STEPS)(
    '%s: a FAILED read returns retry copy, never action copy',
    async (step) => {
      h.state.evidence = { ok: false, error: 'read failed' }
      const result = await submitReflectionAction(null, form({ step, reflection: GOOD }))
      expect(errorOf(result)).toBe(TOUR_STEP_COPY[step].retry)
      expect(errorOf(result)).not.toBe(TOUR_STEP_COPY[step].action)
      // Their work may already exist — nothing is written and nothing is
      // claimed either way.
      expect(h.state.upserts).toHaveLength(0)
    }
  )

  it.each(REFLECTION_GATED_STEPS)(
    '%s: a VERIFIED ABSENCE returns action copy, never retry copy',
    async (step) => {
      h.state.evidence = { ok: true, value: false }
      const result = await submitReflectionAction(null, form({ step, reflection: GOOD }))
      expect(errorOf(result)).toBe(TOUR_STEP_COPY[step].action)
      expect(errorOf(result)).not.toBe(TOUR_STEP_COPY[step].retry)
      expect(h.state.upserts).toHaveLength(0)
    }
  )

  it('asks the evidence layer about the submitted step, for this viewer', async () => {
    await submitReflectionAction(null, form({ step: 'listing_saved', reflection: GOOD }))
    expect(h.verifyReflectionEvidence).toHaveBeenCalledWith('listing_saved', {
      userId: 'u1',
      enrollmentId: 'enr-1',
    })
  })
})

describe('submitReflectionAction — the write', () => {
  it('upserts the reflection with the pair the DB CHECK requires', async () => {
    const before = Date.now()
    const result = await submitReflectionAction(
      null,
      form({ step: 'listing_saved', reflection: GOOD })
    )
    expect(result).toEqual({ success: true })

    const call = h.state.upserts[0]!
    expect(call.table).toBe('tour_step_completions')
    expect(call.payload).toMatchObject({
      enrollment_id: 'enr-1',
      step_key: 'listing_saved',
      reflection: GOOD,
    })
    // `reflection` and `reflected_at` travel together or the
    // tour_step_completions_reflection_pair CHECK rejects the row.
    const reflectedAt = call.payload.reflected_at
    expect(typeof reflectedAt).toBe('string')
    expect(Date.parse(reflectedAt as string)).toBeGreaterThanOrEqual(before)
  })

  it('UPDATES on conflict — a witness row must gain its text, not be skipped', async () => {
    await submitReflectionAction(null, form({ step: 'search_ran', reflection: GOOD }))
    const call = h.state.upserts[0]!
    expect(call.options).toEqual({ onConflict: 'enrollment_id,step_key' })
    // ⚠ The witness path upserts with ignoreDuplicates so it can never clobber
    // text. This path must do the opposite: a `search_ran` row already exists
    // when its reflection arrives, and attaching the text to it is the job.
    expect(call.options).not.toHaveProperty('ignoreDuplicates')
  })

  it('reports a write failure and never sweeps for completion', async () => {
    h.state.upsertError = { message: 'insert failed' }
    const result = await submitReflectionAction(null, form({ step: 'search_ran', reflection: GOOD }))
    expect(errorOf(result)).toBe(SAVE_FAILED)
    expect(h.state.selects).toHaveLength(0)
    expect(h.state.updates).toHaveLength(0)
  })

  it('reports a save failure when the service client itself cannot be built', async () => {
    h.state.clientThrows = true
    const result = await submitReflectionAction(null, form({ step: 'search_ran', reflection: GOOD }))
    expect(errorOf(result)).toBe(SAVE_FAILED)
  })

  it('does not revalidate any path', async () => {
    // revalidatePath('/', 'layout') would purge the whole site's cache for one
    // tester's keystroke. The rail refetches /api/tour/state instead.
    await submitReflectionAction(null, form({ step: 'search_ran', reflection: GOOD }))
    expect(h.revalidatePath).not.toHaveBeenCalled()
  })
})

describe('submitReflectionAction — the completion sweep', () => {
  it('stamps the enrollment complete once all four gated steps carry text', async () => {
    h.state.completionRows = allFourReflected()
    const result = await submitReflectionAction(
      null,
      form({ step: 'final_reflection', reflection: GOOD })
    )
    expect(result).toEqual({ success: true })

    const sweep = h.state.selects[0]!
    expect(sweep.table).toBe('tour_step_completions')
    expect(sweep.filters).toContainEqual({ kind: 'eq', col: 'enrollment_id', val: 'enr-1' })
    expect(sweep.filters).toContainEqual({
      kind: 'in',
      col: 'step_key',
      val: [...REFLECTION_GATED_STEPS],
    })

    const update = h.state.updates[0]!
    expect(update.table).toBe('tour_enrollments')
    expect(typeof update.payload.completed_at).toBe('string')
    expect(update.filters).toContainEqual({ kind: 'eq', col: 'id', val: 'enr-1' })
    // ⚠ Write-once. Without `.is('completed_at', null)` a later reflection edit
    // would move the completion timestamp, and the claim route gates the free
    // trial on that stamp.
    expect(update.filters).toContainEqual({ kind: 'is', col: 'completed_at', val: null })
  })

  it('does not stamp when a gated step is still unwritten', async () => {
    h.state.completionRows = allFourReflected().slice(0, 3)
    const result = await submitReflectionAction(null, form({ step: 'search_ran', reflection: GOOD }))
    expect(result).toEqual({ success: true })
    expect(h.state.updates).toHaveLength(0)
  })

  it('does not count a row whose reflection is null or too short', async () => {
    h.state.completionRows = [
      { step_key: 'search_ran', reflection: GOOD },
      { step_key: 'listing_saved', reflection: null },
      { step_key: 'review_or_correction', reflection: 'too short' },
      { step_key: 'final_reflection', reflection: GOOD },
    ]
    await submitReflectionAction(null, form({ step: 'search_ran', reflection: GOOD }))
    expect(h.state.updates).toHaveLength(0)
  })

  it('does not stamp when the sweep read comes back empty', async () => {
    h.state.completionRows = null
    const result = await submitReflectionAction(null, form({ step: 'search_ran', reflection: GOOD }))
    expect(result).toEqual({ success: true })
    expect(h.state.updates).toHaveLength(0)
  })

  it('still reports success when the sweep READ throws', async () => {
    // The reflection is already saved at this point. Reporting failure here
    // would tell the tester to retype text the database already holds.
    h.state.sweepReadThrows = true
    const result = await submitReflectionAction(null, form({ step: 'search_ran', reflection: GOOD }))
    expect(result).toEqual({ success: true })
    expect(h.state.upserts).toHaveLength(1)
  })

  it('still reports success when the completion WRITE throws', async () => {
    h.state.completionRows = allFourReflected()
    h.state.sweepWriteThrows = true
    const result = await submitReflectionAction(
      null,
      form({ step: 'final_reflection', reflection: GOOD })
    )
    expect(result).toEqual({ success: true })
    // Cure by retry: resubmitting any gated step re-runs the sweep, the same
    // contract as a missed witness.
    expect(h.state.updates).toHaveLength(0)
  })

  it('never grants a trial — the stamp is the only thing this action writes', async () => {
    h.state.completionRows = allFourReflected()
    await submitReflectionAction(null, form({ step: 'final_reflection', reflection: GOOD }))
    for (const update of h.state.updates) {
      expect(update.payload).not.toHaveProperty('trial_granted_at')
      expect(update.payload).not.toHaveProperty('stripe_checkout_session_id')
    }
  })
})
