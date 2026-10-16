// =============================================================================
// generate() sends only redacted text
// =============================================================================
// Drives the real generate() on the paid path with the provider call, the
// spending check and the Supabase client mocked, then checks what would have
// been sent. Nothing here reaches a database or the network.
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const sentPrompts: string[] = []
const updates: Array<Record<string, unknown>> = []

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
      sentPrompts.push(prompt)
      return {
        text: 'A warm neighborhood kitchen serving Sunday dinner every day of the week.',
        inputTokens: 10,
        outputTokens: 10,
      }
    }),
  }
})

vi.mock('@/lib/ai/spend', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ai/spend')>()),
  withinMonthlyCeiling: async () => true,
}))

/** A chainable fake: counters read 0, inserts return a row id, updates succeed. */
function fakeClient() {
  return {
    from: () => {
      let op: 'select' | 'insert' | 'update' = 'select'
      const builder: Record<string, unknown> = {}
      const chain = () => builder
      for (const m of ['select', 'eq', 'gte', 'is', 'single', 'maybeSingle']) builder[m] = chain
      builder.insert = () => ((op = 'insert'), builder)
      builder.update = (payload: Record<string, unknown>) => (updates.push(payload), (op = 'update'), builder)
      builder.then = (resolve: (v: unknown) => unknown) =>
        resolve(
          op === 'insert'
            ? { data: { id: 'row-1' }, error: null }
            : op === 'update'
              ? { error: null }
              : { count: 0, error: null }
        )
      return builder
    },
  }
}

vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => fakeClient() }))

import { findAgent } from '@/lib/ai/agents'
import { generate, type GenerateContext } from '@/lib/ai/provider'

const CONTEXT: GenerateContext = {
  listingName: "Keisha's Kitchen",
  categoryName: 'Restaurant',
  cityName: 'Detroit',
  tagline: 'Keisha Brown cooks Sunday dinner every day',
  description:
    'Visit Keisha Brown at 4800 Woodward Ave, Detroit, MI 48201 or PO Box 12. Call (313) 555-0142. Open 24 hours.',
  pageViews30d: 10,
  ctaClicks30d: 2,
  saves30d: 1,
  shares30d: 0,
  pageViews7d: 3,
}

describe('generate() — what reaches the provider', () => {
  beforeEach(() => {
    sentPrompts.length = 0
    updates.length = 0
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    vi.stubEnv('AI_MONTHLY_CEILING_USD', '10')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('sends the prompt with the address, phone and owner name removed', async () => {
    const agent = findAgent('listing_description')!
    const result = await generate({
      agent,
      listingId: 'listing-1',
      triggeredBy: 'user-1',
      context: CONTEXT,
      monthlyQuota: null,
      ownerNames: ['Keisha Brown'],
    })

    expect(result.ok).toBe(true)
    expect(sentPrompts).toHaveLength(1)
    const prompt = sentPrompts[0]
    for (const leaked of ['Woodward', '4800', '48201', 'PO Box', '555-0142', 'Brown']) {
      expect(prompt).not.toContain(leaked)
    }
    expect(prompt).toContain('[removed]')
    // The business name is never redacted, and ordinary copy survives.
    expect(prompt).toContain("Keisha's Kitchen")
    expect(prompt).toContain('Open 24 hours')
  })

  it('still removes the address when the owner has no name on file', async () => {
    const agent = findAgent('listing_description')!
    await generate({
      agent,
      listingId: 'listing-1',
      triggeredBy: 'user-1',
      context: CONTEXT,
      monthlyQuota: null,
      ownerNames: [],
    })
    expect(sentPrompts).toHaveLength(1)
    expect(sentPrompts[0]).not.toContain('Woodward')
    expect(sentPrompts[0]).toContain('Keisha Brown')
  })

  it('sends nothing and closes the audit row with a fixed code when redaction fails', async () => {
    const agent = findAgent('listing_description')!
    const result = await generate({
      agent,
      listingId: 'listing-1',
      triggeredBy: 'user-1',
      context: CONTEXT,
      monthlyQuota: null,
      // Not a string: makes the name pass throw.
      ownerNames: [{} as unknown as string],
    })
    expect(result).toEqual({ ok: false, code: 'failed' })
    expect(sentPrompts).toHaveLength(0)
    expect(updates).toContainEqual({ status: 'failed', error_message: 'prompt_redaction_failed' })
  })
})
