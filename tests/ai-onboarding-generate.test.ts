// =============================================================================
// generate() for the /add-business drafts (ticket 128)
// =============================================================================
// Drives the real generate() with the provider call, the spending check and
// the Supabase client mocked. Checks the order of writes, the caps (which fail
// closed), the kill switch, and that no suggestion row is ever written.
// Nothing here reaches a database, the network or a model.
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/** Every database step and provider call, in order. */
const log: string[] = []
const inserts: Array<{ table: string; payload: Record<string, unknown> }> = []
const updates: Array<Record<string, unknown>> = []
const counts = { page: 0 as number | null, day: 0 as number | null, error: false, throws: false }
const ceiling = { ok: true }
const answer = { text: '' }

vi.mock('@/lib/ai/anthropic', () => {
  class ProviderCallError extends Error {
    constructor(
      readonly code: string,
      readonly usage: unknown = null
    ) {
      super(code)
    }
  }
  return {
    ProviderCallError,
    callAnthropic: vi.fn(async ({ prompt }: { prompt: string }) => {
      log.push(`callAnthropic:${prompt.length}`)
      return { text: answer.text, inputTokens: 10, outputTokens: 10 }
    }),
  }
})

vi.mock('@/lib/ai/spend', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ai/spend')>()),
  withinMonthlyCeiling: async () => ceiling.ok,
}))

function fakeClient() {
  return {
    from: (table: string) => {
      let op: 'select' | 'insert' | 'update' = 'select'
      const eqs: string[] = []
      const builder: Record<string, unknown> = {}
      const chain = () => builder
      for (const m of ['select', 'gte', 'is', 'neq', 'single', 'maybeSingle']) builder[m] = chain
      builder.eq = (col: string) => (eqs.push(col), builder)
      builder.insert = (payload: Record<string, unknown>) => {
        op = 'insert'
        inserts.push({ table, payload })
        log.push(`insert:${table}`)
        return builder
      }
      builder.update = (payload: Record<string, unknown>) => {
        op = 'update'
        updates.push(payload)
        log.push(`update:${table}:${String(payload.status)}`)
        return builder
      }
      builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
        if (op === 'insert') return resolve({ data: { id: 'row-1' }, error: null })
        if (op === 'update') return resolve({ error: null })
        const scope = eqs.includes('listing_id') ? 'page' : 'day'
        log.push(`count:${scope}`)
        if (counts.throws) return reject(new Error('network down'))
        if (counts.error) return resolve({ count: null, error: { message: 'boom' } })
        return resolve({ count: counts[scope], error: null })
      }
      return builder
    },
  }
}

vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => fakeClient() }))

import { callAnthropic } from '@/lib/ai/anthropic'
import {
  ONBOARDING_DRAFTS_PER_DAY,
  ONBOARDING_DRAFTS_PER_PAGE,
  generate,
  type OnboardingGenerateInput,
} from '@/lib/ai/provider'
import { MAX_PROMPT_CHARS } from '@/lib/ai/spend'

const CONTEXT = {
  businessName: 'Fresh Fade Barbershop',
  cityName: 'Atlanta',
  ownerWords: 'Andre Mills cuts clean fades and beard trims. Call 404-555-0188.',
  importedAbout: null,
  candidates: [
    { id: '11111111-1111-4111-8111-111111111111', name: 'Barber Shops' },
    { id: '22222222-2222-4222-8222-222222222222', name: 'Hair Salons' },
  ],
  groups: [{ id: '33333333-3333-4333-8333-333333333333', name: 'Beauty & Personal Care' }],
}

const INPUT: OnboardingGenerateInput = {
  kind: 'onboarding',
  listingId: '44444444-4444-4444-8444-444444444444',
  triggeredBy: '55555555-5555-4555-8555-555555555555',
  context: CONTEXT,
  ownerNames: ['Andre Mills'],
  request: { style: 'fresh', focus: 'all' },
}

const GOOD = JSON.stringify({
  category: { pick: 'C1' },
  tagline: 'Clean fades and beard trims in Atlanta.',
  about:
    'Fresh Fade Barbershop gives clean fades, line ups and beard trims for the whole family. Walk in or book ahead, and leave looking sharp every time you visit.',
  searchTitle: 'Fresh Fade Barbershop, Atlanta barber',
  searchDescription: 'Clean fades, line ups and beard trims for the whole family in Atlanta.',
})

function paidPath() {
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
  vi.stubEnv('AI_MONTHLY_CEILING_USD', '10')
}

beforeEach(() => {
  log.length = 0
  inserts.length = 0
  updates.length = 0
  Object.assign(counts, { page: 0, day: 0, error: false, throws: false })
  ceiling.ok = true
  answer.text = GOOD
  vi.mocked(callAnthropic).mockClear()
  vi.stubEnv('ANTHROPIC_API_KEY', '')
  vi.stubEnv('AI_MONTHLY_CEILING_USD', '')
  vi.stubEnv('AI_KILL_SWITCH', '')
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('generate() onboarding: mock path', () => {
  it('returns all five drafts from the mock with no key set', async () => {
    const result = await generate(INPUT)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.provider).toBe('mock')
    expect(result.drafts.category).toMatchObject({ kind: 'existing', name: 'Barber Shops' })
    for (const key of ['tagline', 'about', 'searchTitle', 'searchDescription'] as const) {
      expect(result.drafts[key].length).toBeGreaterThan(0)
    }
    expect(callAnthropic).not.toHaveBeenCalled()
  })

  it('writes the audit row and closes it, and never writes a suggestion row', async () => {
    await generate(INPUT)
    expect(inserts.map((i) => i.table)).toEqual(['ai_generation_requests'])
    expect(inserts[0]?.payload).toMatchObject({
      agent_type: 'onboarding_drafts',
      prompt_version: 'ONBOARDING_DRAFTS@1',
      status: 'pending',
      provider: 'mock',
      listing_id: INPUT.listingId,
      created_by: INPUT.triggeredBy,
    })
    expect(log).not.toContain('insert:ai_suggestions')
    expect(log.at(-1)).toBe('update:ai_generation_requests:completed')
  })

  it('stores no prompt or answer text on the audit row', async () => {
    await generate(INPUT)
    const written = JSON.stringify([...inserts.map((i) => i.payload), ...updates])
    expect(written).not.toContain('fades')
    expect(written).not.toContain('Barber')
  })
})

describe('generate() onboarding: paid path (provider mocked)', () => {
  it('writes the audit row before the provider is called', async () => {
    paidPath()
    const result = await generate(INPUT)
    expect(result.ok && result.provider).toBe('anthropic')
    const audit = log.indexOf('insert:ai_generation_requests')
    const call = log.findIndex((l) => l.startsWith('callAnthropic'))
    expect(audit).toBeGreaterThanOrEqual(0)
    expect(call).toBeGreaterThan(audit)
    expect(log).not.toContain('insert:ai_suggestions')
  })

  it('sends a prompt with no phone and no owner name', async () => {
    paidPath()
    let sent = ''
    vi.mocked(callAnthropic).mockImplementationOnce(async ({ prompt }) => {
      sent = prompt
      return { text: GOOD, inputTokens: 1, outputTokens: 1 }
    })
    await generate(INPUT)
    expect(sent).not.toContain('555-0188')
    expect(sent).not.toContain('Mills')
    expect(sent).not.toContain('Andre')
    expect(sent).toContain('Fresh Fade Barbershop')
    expect(sent).not.toContain('{{')
  })

  it('a code that was not offered is rejected and the row closes as failed', async () => {
    paidPath()
    answer.text = GOOD.replace('"C1"', '"C7"')
    const result = await generate(INPUT)
    expect(result).toEqual({ ok: false, code: 'rejected', reason: 'not_a_candidate' })
    expect(updates.at(-1)).toMatchObject({ status: 'failed', error_message: 'output_rejected:not_a_candidate' })
  })

  it('an answer that is not JSON is rejected', async () => {
    paidPath()
    answer.text = 'Sure! Here are some ideas for your barbershop.'
    expect(await generate(INPUT)).toEqual({ ok: false, code: 'rejected', reason: 'invalid_shape' })
  })

  it('an answer with an email is rejected', async () => {
    paidPath()
    answer.text = GOOD.replace('Clean fades and beard trims in Atlanta.', 'Book at fades@example.com')
    expect(await generate(INPUT)).toEqual({ ok: false, code: 'rejected', reason: 'contains_email' })
  })

  it('pauses with no row when the monthly ceiling is reached', async () => {
    paidPath()
    ceiling.ok = false
    expect(await generate(INPUT)).toEqual({ ok: false, code: 'paused' })
    expect(inserts).toHaveLength(0)
    expect(callAnthropic).not.toHaveBeenCalled()
  })

  // Every category name in seed.sql is 37 characters or fewer, so 40 is a fair
  // worst case for the full lists the prompt can carry.
  it('keeps the longest allowed input under the prompt ceiling', async () => {
    paidPath()
    const long = 'Clean fades and beard trims for the whole family. '.repeat(40)
    await generate({
      ...INPUT,
      context: {
        ...CONTEXT,
        businessName: 'B'.repeat(300),
        cityName: 'C'.repeat(200),
        ownerWords: long,
        importedAbout: long,
        candidates: Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, name: 'N'.repeat(40) })),
        groups: Array.from({ length: 40 }, (_, i) => ({ id: `g${i}`, name: 'G'.repeat(40) })),
      },
    })
    const call = log.find((l) => l.startsWith('callAnthropic'))
    expect(call).toBeDefined()
    expect(Number(call?.split(':')[1])).toBeLessThanOrEqual(MAX_PROMPT_CHARS)
  })
})

describe('generate() onboarding: caps fail closed', () => {
  it('refuses the 6th draft for a page', async () => {
    counts.page = ONBOARDING_DRAFTS_PER_PAGE
    expect(await generate(INPUT)).toEqual({ ok: false, code: 'rate_limited', scope: 'page' })
    expect(inserts).toHaveLength(0)
  })

  it('allows the 5th draft for a page', async () => {
    counts.page = ONBOARDING_DRAFTS_PER_PAGE - 1
    expect((await generate(INPUT)).ok).toBe(true)
  })

  it('refuses the 21st draft in a day', async () => {
    counts.day = ONBOARDING_DRAFTS_PER_DAY
    expect(await generate(INPUT)).toEqual({ ok: false, code: 'rate_limited', scope: 'day' })
    expect(inserts).toHaveLength(0)
  })

  it('refuses when the count errors', async () => {
    counts.error = true
    expect(await generate(INPUT)).toEqual({ ok: false, code: 'rate_limited', scope: 'page' })
    expect(inserts).toHaveLength(0)
  })

  it('refuses when the count comes back empty', async () => {
    counts.page = null
    expect(await generate(INPUT)).toEqual({ ok: false, code: 'rate_limited', scope: 'page' })
  })

  it('refuses when the count throws', async () => {
    counts.throws = true
    expect(await generate(INPUT)).toEqual({ ok: false, code: 'rate_limited', scope: 'page' })
    expect(inserts).toHaveLength(0)
  })

  it('the kill switch stops even the mock, before any read or row', async () => {
    vi.stubEnv('AI_KILL_SWITCH', '1')
    expect(await generate(INPUT)).toEqual({ ok: false, code: 'paused' })
    expect(log).toHaveLength(0)
  })

  it.each(['0', 'false', 'off', 'no', ''])('the kill switch set to %j leaves drafts on', async (value) => {
    vi.stubEnv('AI_KILL_SWITCH', value)
    expect((await generate(INPUT)).ok).toBe(true)
  })

  it('a typo in the kill switch stops drafts', async () => {
    vi.stubEnv('AI_KILL_SWITCH', 'ture')
    expect(await generate(INPUT)).toEqual({ ok: false, code: 'paused' })
  })
})
