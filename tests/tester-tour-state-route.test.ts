import { describe, it, expect, vi, beforeEach } from 'vitest'

// GET /api/tour/state — the single source of truth the rail renders from
// (tester-tour-spec.md §6–7).
//
// This route is the reason the rail is allowed to be dumb. Every status on
// screen is decided here, server-side, against evidence a browser cannot forge;
// the client never infers one. So the matrix below IS the tour's behaviour:
//
//   'done'    — finished (gated: substantive reflection; un-gated: witness row)
//   'reflect' — evidence verified, reflection still owed
//   'act'     — verified NO evidence yet
//   'retry'   — an evidence read FAILED
//
// ⚠ 'retry' must never collapse into 'act'. They differ by one boolean and by
// the whole meaning of the message: 'act' says go do the thing, 'retry' says we
// couldn't look and what you did still counts. A tester who saved a listing and
// is told to go save a listing stops trusting the rail, which is the only thing
// the rail has.
//
// lib/tour/verify.ts is PARTIALLY mocked: the two derived reads are doubles,
// TOUR_STEP_COPY is real, so every copy assertion compares shipped strings.

const h = vi.hoisted(() => {
  interface Filter {
    kind: 'eq'
    col: string
    val: unknown
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
    rows: [] as { step_key: string; reflection: string | null }[],
    readError: null as { message: string } | null,
    clientThrows: false,
    saved: { ok: true, value: true } as
      | { ok: true; value: boolean }
      | { ok: false; error: string },
    review: { ok: true, value: true } as
      | { ok: true; value: boolean }
      | { ok: false; error: string },
    selects: [] as { table: string; columns: string; filters: Filter[] }[],
  }

  const resolveTourViewer = vi.fn(async () => state.viewer)
  const verifyListingSaved = vi.fn(async () => state.saved)
  const verifyReviewOrCorrection = vi.fn(async () => state.review)

  const createServiceClient = vi.fn(() => {
    if (state.clientThrows) throw new Error('no service client')
    return {
      from(table: string) {
        const q = {
          columns: '',
          filters: [] as Filter[],
          select(columns: string) {
            q.columns = columns
            return q
          },
          eq(col: string, val: unknown) {
            q.filters.push({ kind: 'eq', col, val })
            return q
          },
          then(
            onFulfilled?: (v: { data: unknown; error: unknown }) => unknown,
            onRejected?: (e: unknown) => unknown
          ) {
            return Promise.resolve()
              .then(() => {
                state.selects.push({ table, columns: q.columns, filters: q.filters })
                return { data: state.readError ? null : state.rows, error: state.readError }
              })
              .then(onFulfilled, onRejected)
          },
        }
        return q
      },
    }
  })

  return { state, resolveTourViewer, verifyListingSaved, verifyReviewOrCorrection, createServiceClient }
})

vi.mock('@/lib/tour/witness', () => ({ resolveTourViewer: h.resolveTourViewer }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: h.createServiceClient }))
vi.mock('@/lib/tour/verify', async () => {
  const actual = await vi.importActual<typeof import('@/lib/tour/verify')>('@/lib/tour/verify')
  return {
    ...actual,
    verifyListingSaved: h.verifyListingSaved,
    verifyReviewOrCorrection: h.verifyReviewOrCorrection,
  }
})

import { GET } from '@/app/api/tour/state/route'
import { TOUR_STEP_COPY } from '@/lib/tour/verify'
import { TOUR_STEPS, REFLECTION_GATED_STEPS, type TourStepKey } from '@/lib/tour/steps'

const GOOD = 'A genuinely substantive reflection about the walk so far.'

interface StepPayload {
  key: TourStepKey
  title: string
  gated: boolean
  status: 'done' | 'reflect' | 'act' | 'retry'
  prompt: string | null
  message: string | null
}

interface TourPayload {
  listingId: string
  completedAt: string | null
  trialGrantedAt: string | null
  canClaim: boolean
  steps: StepPayload[]
}

async function load(): Promise<{ status: number; body: { data?: TourPayload; code?: string } }> {
  const res = await GET()
  return { status: res.status, body: (await res.json()) as { data?: TourPayload; code?: string } }
}

/** The step this route reported, by key. */
async function step(key: TourStepKey): Promise<StepPayload> {
  const { body } = await load()
  const found = body.data?.steps.find((s) => s.key === key)
  if (!found) throw new Error(`no step ${key} in the payload`)
  return found
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
  h.state.rows = []
  h.state.readError = null
  h.state.clientThrows = false
  h.state.saved = { ok: true, value: true }
  h.state.review = { ok: true, value: true }
  h.state.selects = []
})

describe('GET /api/tour/state — the door', () => {
  it('404s when the viewer does not resolve, reading nothing', async () => {
    h.state.viewer = null
    const { status, body } = await load()
    expect(status).toBe(404)
    expect(body.code).toBe('NOT_FOUND')
    // Flag off, signed out and not enrolled collapse into one answer on
    // purpose — this route's existence is itself gated.
    expect(h.createServiceClient).not.toHaveBeenCalled()
    expect(h.verifyListingSaved).not.toHaveBeenCalled()
    expect(h.verifyReviewOrCorrection).not.toHaveBeenCalled()
  })

  it('reads only this enrollment’s completion rows', async () => {
    await load()
    const read = h.state.selects[0]!
    expect(read.table).toBe('tour_step_completions')
    expect(read.columns).toBe('step_key, reflection')
    expect(read.filters).toContainEqual({ kind: 'eq', col: 'enrollment_id', val: 'enr-1' })
  })
})

describe('GET /api/tour/state — a failed completions read', () => {
  it('500s and leaks no per-step verdicts', async () => {
    h.state.readError = { message: 'connection reset' }
    const { status, body } = await load()
    expect(status).toBe(500)
    expect(body.code).toBe('SERVER_ERROR')
    // Failing the completions read means we know nothing about ANY step. Six
    // confident 'act' rows would be six lies; one rail-level retry is honest.
    expect(body.data).toBeUndefined()
  })

  it('500s when the service client cannot be built', async () => {
    h.state.clientThrows = true
    const { status, body } = await load()
    expect(status).toBe(500)
    expect(body.data).toBeUndefined()
  })
})

describe('GET /api/tour/state — the envelope', () => {
  it('returns the six steps in rail order inside a data envelope', async () => {
    const { status, body } = await load()
    expect(status).toBe(200)
    expect(body.data?.listingId).toBe('l1')
    expect(body.data?.steps.map((s) => s.key)).toEqual([...TOUR_STEPS])
  })

  it('marks exactly the four reflection-gated steps as gated, each with a prompt', async () => {
    const { body } = await load()
    for (const s of body.data!.steps) {
      const gated = (REFLECTION_GATED_STEPS as readonly string[]).includes(s.key)
      expect(s.gated).toBe(gated)
      expect(s.prompt === null).toBe(!gated)
      expect(s.title).toBe(TOUR_STEP_COPY[s.key].title)
    }
  })

  it.each([
    ['unfinished tour', null, null, false],
    ['finished, nothing claimed', '2026-09-01T00:00:00Z', null, true],
    ['finished and already claimed', '2026-09-01T00:00:00Z', '2026-09-02T00:00:00Z', false],
  ])('canClaim for %s', async (_label, completedAt, trialGrantedAt, expected) => {
    h.state.viewer!.enrollment.completedAt = completedAt as string | null
    h.state.viewer!.enrollment.trialGrantedAt = trialGrantedAt as string | null
    const { body } = await load()
    expect(body.data?.canClaim).toBe(expected)
    expect(body.data?.completedAt).toBe(completedAt)
    expect(body.data?.trialGrantedAt).toBe(trialGrantedAt)
  })
})

describe('GET /api/tour/state — search_ran (its witness row is its evidence)', () => {
  it('act, with action copy, when there is no row', async () => {
    const s = await step('search_ran')
    expect(s.status).toBe('act')
    expect(s.message).toBe(TOUR_STEP_COPY.search_ran.action)
  })

  it('reflect, with no message, when the row exists but carries no text', async () => {
    h.state.rows = [{ step_key: 'search_ran', reflection: null }]
    const s = await step('search_ran')
    expect(s.status).toBe('reflect')
    expect(s.message).toBeNull()
    expect(s.prompt).toBe(TOUR_STEP_COPY.search_ran.prompt)
  })

  it('still reflect when the text is below the substantive floor', async () => {
    h.state.rows = [{ step_key: 'search_ran', reflection: 'ok' }]
    expect((await step('search_ran')).status).toBe('reflect')
  })

  it('done once the text is substantive', async () => {
    h.state.rows = [{ step_key: 'search_ran', reflection: GOOD }]
    const s = await step('search_ran')
    expect(s.status).toBe('done')
    expect(s.message).toBeNull()
  })
})

describe('GET /api/tour/state — the un-gated progress ticks', () => {
  it.each(['listing_opened', 'collection_browsed'] as const)(
    '%s: act with no row, done with one — the row is the whole step',
    async (key) => {
      expect((await step(key)).status).toBe('act')
      // No reflection, and none is ever asked for: the witness row alone
      // finishes these two.
      h.state.rows = [{ step_key: key, reflection: null }]
      const s = await step(key)
      expect(s.status).toBe('done')
      expect(s.gated).toBe(false)
      expect(s.prompt).toBeNull()
    }
  )
})

describe('GET /api/tour/state — the two derived steps', () => {
  const cases = [
    { key: 'listing_saved' as const, field: 'saved' as const },
    { key: 'review_or_correction' as const, field: 'review' as const },
  ]

  it.each(cases)('$key: a FAILED read is retry, carrying retry copy', async ({ key, field }) => {
    h.state[field] = { ok: false, error: 'read failed' }
    const s = await step(key)
    expect(s.status).toBe('retry')
    expect(s.message).toBe(TOUR_STEP_COPY[key].retry)
    // ⚠ The whole point. A failed read must never render as "go do it".
    expect(s.message).not.toBe(TOUR_STEP_COPY[key].action)
  })

  it.each(cases)('$key: a VERIFIED ABSENCE is act, carrying action copy', async ({ key, field }) => {
    h.state[field] = { ok: true, value: false }
    const s = await step(key)
    expect(s.status).toBe('act')
    expect(s.message).toBe(TOUR_STEP_COPY[key].action)
    expect(s.message).not.toBe(TOUR_STEP_COPY[key].retry)
  })

  it.each(cases)('$key: evidence found but unwritten is reflect', async ({ key, field }) => {
    h.state[field] = { ok: true, value: true }
    const s = await step(key)
    expect(s.status).toBe('reflect')
    expect(s.message).toBeNull()
  })

  it.each(cases)('$key: a substantive reflection wins over any verdict', async ({ key, field }) => {
    h.state.rows = [{ step_key: key, reflection: GOOD }]
    h.state[field] = { ok: false, error: 'read failed' }
    // The reflection row IS the record. A later read failure must not walk a
    // finished step backwards.
    expect((await step(key)).status).toBe('done')
  })

  it('skips the saves read entirely once listing_saved is reflected', async () => {
    h.state.rows = [{ step_key: 'listing_saved', reflection: GOOD }]
    await load()
    expect(h.verifyListingSaved).not.toHaveBeenCalled()
    // The other read still runs — the skip is per step, not per request.
    expect(h.verifyReviewOrCorrection).toHaveBeenCalledTimes(1)
  })

  it('skips the reviews read entirely once review_or_correction is reflected', async () => {
    h.state.rows = [{ step_key: 'review_or_correction', reflection: GOOD }]
    await load()
    expect(h.verifyReviewOrCorrection).not.toHaveBeenCalled()
    expect(h.verifyListingSaved).toHaveBeenCalledTimes(1)
  })

  it('asks the evidence layer about the viewer, not the enrollment', async () => {
    await load()
    expect(h.verifyListingSaved).toHaveBeenCalledWith('u1')
    expect(h.verifyReviewOrCorrection).toHaveBeenCalledWith('u1')
  })
})

describe('GET /api/tour/state — final_reflection unlocks last', () => {
  const priors = ['search_ran', 'listing_saved', 'review_or_correction'] as const

  it('act, with the "finish the three above" copy, while a prior is unwritten', async () => {
    h.state.rows = priors.slice(0, 2).map((key) => ({ step_key: key, reflection: GOOD }))
    const s = await step('final_reflection')
    expect(s.status).toBe('act')
    expect(s.message).toBe(TOUR_STEP_COPY.final_reflection.action)
  })

  it('reflect once all three written priors carry substantive text', async () => {
    h.state.rows = priors.map((key) => ({ step_key: key, reflection: GOOD }))
    const s = await step('final_reflection')
    expect(s.status).toBe('reflect')
    expect(s.prompt).toBe(TOUR_STEP_COPY.final_reflection.prompt)
  })

  it('does not wait on the two un-gated ticks', async () => {
    // listing_opened and collection_browsed have no rows here. They are
    // progress ticks, not gates — blocking the final reflection on them would
    // contradict REFLECTION_GATED_STEPS.
    h.state.rows = priors.map((key) => ({ step_key: key, reflection: GOOD }))
    expect((await step('final_reflection')).status).toBe('reflect')
  })

  it('is not unlocked by a prior whose text is too short', async () => {
    h.state.rows = [
      { step_key: 'search_ran', reflection: GOOD },
      { step_key: 'listing_saved', reflection: GOOD },
      { step_key: 'review_or_correction', reflection: 'nope' },
    ]
    expect((await step('final_reflection')).status).toBe('act')
  })

  it('done once its own reflection is substantive', async () => {
    h.state.rows = [{ step_key: 'final_reflection', reflection: GOOD }]
    expect((await step('final_reflection')).status).toBe('done')
  })
})
