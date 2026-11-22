// POST /api/cue (ticket 169): the guards, the stream and the audit row.
// The agent loop is real and runs on the mock model; the database is faked.

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CueToolDeps } from '@/lib/ai/cue/tools'
import type { CueEvent } from '@/lib/ai/cue/stream'

import { deps, entity, ID } from './fixtures/cue'

const h = vi.hoisted(() => ({
  flag: true,
  killSwitch: false,
  provider: 'mock' as 'mock' | 'anthropic',
  rateAllowed: true,
  denied: new Set<string>(),
  modelFails: false,
  analytics: [] as Array<Record<string, unknown>>,
  withinCeiling: true,
  used: 0,
  listsFail: false,
  insertFails: false,
  inserts: [] as Array<Record<string, unknown>>,
  updates: [] as Array<Record<string, unknown>>,
  deps: null as CueToolDeps | null,
}))

vi.mock('@/lib/env', () => ({
  isFeatureEnabled: (name: string) => (name === 'aiAssistant' ? h.flag : false),
}))
vi.mock('@/lib/ai/provider', () => ({
  aiKillSwitchOn: () => h.killSwitch,
  resolveProvider: () =>
    h.provider === 'anthropic'
      ? { provider: 'anthropic', model: 'claude-test-fast' }
      : { provider: 'mock', model: 'mock-v1' },
}))
vi.mock('@/lib/security/rate-limit', () => ({
  getClientIp: (headers: Headers) => headers.get('x-forwarded-for') ?? 'unknown',
  checkRateLimit: async ({ bucket }: { bucket: string }) => h.rateAllowed && !h.denied.has(bucket),
}))
vi.mock('@/lib/ai/spend', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ai/spend')>()),
  withinMonthlyCeiling: async () => h.withinCeiling,
  monthlyCeilingUsd: () => 10,
  countAgentAttemptsThisMonth: async () => h.used,
}))
vi.mock('@/lib/ai/cue/mock', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/ai/cue/mock')>()
  return {
    ...real,
    createMockCueCall: (args: Parameters<typeof real.createMockCueCall>[0]) => {
      const call = real.createMockCueCall(args)
      return (async (...rest: Parameters<typeof call>) => {
        if (h.modelFails) throw new Error('model down')
        return call(...rest)
      }) as typeof call
    },
  }
})
vi.mock('@/lib/ai/cue/data', async () => {
  const { NO_PAGE } = await import('@/lib/assistant/page')
  const { CATEGORIES, CITIES, ID } = await import('./fixtures/cue')
  return {
    get cueDeps() {
      return h.deps
    },
    loadLists: async () => (h.listsFail ? null : { categories: CATEGORIES, cities: CITIES }),
    listingNames: async () => [
      { id: ID(1), name: 'Business 1' },
      { id: ID(2), name: 'Business 2' },
      { id: ID(9), name: 'Business 9' },
    ],
    loadPage: async () => NO_PAGE,
  }
})
// The quick answer calls queryListings itself (ticket 257); it answers from
// the same fake search Cue's tool uses.
vi.mock('@/lib/listings/query', () => ({
  // A keyword search counts as the understood form, as the founder's
  // question is on the real database.
  queryListings: async (p: { q?: string }) => ({
    entities: await h.deps!.search(p as never),
    ...(p.q ? { understood: { mode: 'search' as const, words: [] } } : {}),
  }),
}))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        if (table === 'analytics_events') {
          h.analytics.push(row)
          return Promise.resolve({ error: null })
        }
        h.inserts.push(row)
        return {
          select: () => ({
            single: async () =>
              h.insertFails
                ? { data: null, error: { message: 'down' } }
                : { data: { id: 'req-1' }, error: null },
          }),
        }
      },
      update: (row: Record<string, unknown>) => {
        h.updates.push(row)
        return { eq: async () => ({ error: null }) }
      },
    }),
  }),
}))

import { POST } from '@/app/api/cue/route'

function ask(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost:3000/api/cue', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      host: 'localhost:3000',
      'x-forwarded-for': '203.0.113.9',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

async function events(res: Response): Promise<CueEvent[]> {
  const text = await res.text()
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as CueEvent)
}

function onlyFallback(list: CueEvent[]) {
  expect(list).toHaveLength(1)
  const first = list[0]
  expect(first?.type).toBe('fallback')
  return first as Extract<CueEvent, { type: 'fallback' }>
}

beforeEach(() => {
  h.flag = true
  h.killSwitch = false
  h.provider = 'mock'
  h.rateAllowed = true
  h.denied = new Set()
  h.modelFails = false
  h.analytics = []
  h.withinCeiling = true
  h.used = 0
  h.listsFail = false
  h.insertFails = false
  h.inserts = []
  h.updates = []
  h.deps = deps({ search: vi.fn(async () => [entity(1), entity(2)]) })
})

describe('POST /api/cue', () => {
  it('streams a grounded reply with cards, then closes the audit row', async () => {
    const res = await POST(ask({ message: 'lawyer in atlanta' }))
    expect(res.headers.get('content-type')).toContain('application/x-ndjson')
    expect(res.headers.get('cache-control')).toBe('no-store')

    const list = await events(res)
    const types = list.map((e) => e.type)
    expect(types).toContain('status')
    expect(types).toContain('text')
    expect(types.at(-1)).toBe('done')

    const cards = list.find((e) => e.type === 'cards') as Extract<CueEvent, { type: 'cards' }>
    expect(cards.cards.map((c) => c.id)).toEqual([ID(1), ID(2)])
    const done = list.at(-1) as Extract<CueEvent, { type: 'done' }>
    expect(done.text).toBe('Here are 2 places that match.')

    expect(h.inserts).toHaveLength(1)
    expect(h.inserts[0]).toMatchObject({
      agent_type: 'visitor_assistant',
      prompt_version: 'CUE_CHAT@4',
      status: 'pending',
    })
    expect(h.updates).toEqual([
      { status: 'completed', error_message: null, request_tokens: 0, response_tokens: 0 },
    ])
  })

  it('stores nothing the visitor typed', async () => {
    await events(
      await POST(
        ask({ message: 'lawyer in atlanta', history: [{ role: 'user', text: 'my secret' }] })
      )
    )
    const audit = JSON.stringify([h.inserts, h.updates])
    expect(audit).not.toContain('lawyer')
    expect(audit).not.toContain('secret')
  })

  it('answers honestly with no cards when nothing matches', async () => {
    h.deps = deps()
    const list = await events(await POST(ask({ message: 'lawyer in atlanta' })))
    expect(list.some((e) => e.type === 'cards')).toBe(false)
    const done = list.at(-1) as Extract<CueEvent, { type: 'done' }>
    expect(done.type).toBe('done')
    expect(done.text).toMatch(/Nothing matches that on The BLACQList yet/)
    // Searched and found nothing: Suggest a Business (ticket 256).
    expect(list).toContainEqual({
      type: 'actions',
      actions: [{ kind: 'link', href: '/add-business', label: 'Suggest a Business' }],
    })
  })

  it.each([
    ['the flag is off', () => (h.flag = false), 'error'],
    ['the kill switch is on', () => (h.killSwitch = true), 'error'],
    ['the rate limit is hit', () => (h.rateAllowed = false), 'limited'],
    ['the lists fail to load', () => (h.listsFail = true), 'error'],
    ['the audit row fails', () => (h.insertFails = true), 'error'],
  ])('falls back to search when %s', async (_name, arrange, reason) => {
    arrange()
    const fb = onlyFallback(await events(await POST(ask({ message: 'lawyer in atlanta' }))))
    expect(fb.reason).toBe(reason)
    expect(fb.href).toContain('lawyer')
  })

  it.each([
    ['the monthly ceiling is reached', () => (h.withinCeiling = false)],
    ['the visitor share is used up', () => (h.used = 1_000_000)],
  ])('paid calls fall back as limited when %s, with no audit row', async (_name, arrange) => {
    h.provider = 'anthropic'
    arrange()
    const fb = onlyFallback(await events(await POST(ask({ message: 'lawyer in atlanta' }))))
    expect(fb.reason).toBe('limited')
    expect(h.inserts).toHaveLength(0)
  })

  it('refuses another site', async () => {
    const fb = onlyFallback(
      await events(await POST(ask({ message: 'hi' }, { origin: 'https://evil.example' })))
    )
    expect(fb.reason).toBe('error')
    expect(h.inserts).toHaveLength(0)
  })

  it('accepts its own origin', async () => {
    const list = await events(
      await POST(ask({ message: 'lawyer in atlanta' }, { origin: 'http://localhost:3000' }))
    )
    expect(list.at(-1)?.type).toBe('done')
  })

  it.each([
    [
      'a non-JSON content type',
      ask('message=hi', { 'content-type': 'application/x-www-form-urlencoded' }),
    ],
    ['a body that is not JSON', ask('{not json')],
    ['an unknown field', ask({ message: 'hi', admin: true })],
    ['an empty message', ask({ message: '   ' })],
    ['a message over 200 characters', ask({ message: 'a'.repeat(201) })],
  ])('rejects %s', async (_name, request) => {
    onlyFallback(await events(await POST(request)))
    expect(h.inserts).toHaveLength(0)
  })

  it('accepts history, prior cards, a page and Near me', async () => {
    const list = await events(
      await POST(
        ask({
          message: 'what about houston?',
          history: [
            { role: 'user', text: 'lawyer in atlanta' },
            { role: 'assistant', text: 'Here are 2 places that match.' },
          ],
          cards: [{ id: ID(1), name: 'Business 1' }],
          page: '/discover',
          near: { lat: 33.7491234, lng: -84.3881234 },
        })
      )
    )
    expect(list.at(-1)?.type).toBe('done')
  })
})

// ─── The /search strip (ticket 255) ───────────────────────────────────────────

describe('POST /api/cue from the /search strip', () => {
  const FOUNDER = 'How do I switch to Black Owned bathroom products'
  const search = (body: Record<string, unknown> = {}) =>
    ask({ message: FOUNDER, surface: 'search', ...body })

  function basicDone(list: CueEvent[]) {
    const done = list.at(-1) as Extract<CueEvent, { type: 'done' }>
    expect(done.type).toBe('done')
    expect(done.mode).toBe('basic')
    expect(list.some((e) => e.type === 'fallback')).toBe(false)
    return done
  }

  it.each([
    ['the flag is off', () => (h.flag = false), 'flag_off'],
    ['the kill switch is on', () => (h.killSwitch = true), 'kill_switch'],
    ["the visitor's Cue allowance is used up", () => h.denied.add('ai_assistant'), 'limited'],
    ['the lists fail', () => (h.listsFail = true), 'unavailable'],
    ['the audit row fails', () => (h.insertFails = true), 'error'],
  ])('answers from our listings when %s', async (_label, arrange, reason) => {
    arrange()
    const list = await events(await POST(search()))
    const done = basicDone(list)
    expect(done.text).toBe('Here are businesses that match “bathroom”.')
    const cards = list.find((e) => e.type === 'cards') as Extract<CueEvent, { type: 'cards' }>
    expect(cards.cards.map((c) => c.id)).toEqual([ID(1), ID(2)])
    expect(h.analytics).toEqual([
      {
        event_name: 'search_answer_served',
        properties: {
          mode: 'basic',
          reason,
          exact_bucket: '1-2',
          related_used: false,
          related_checked: false,
          related_best: null,
          related_hits: 0,
        },
      },
    ])
  })

  it('answers from our listings when the monthly ceiling is reached', async () => {
    h.provider = 'anthropic'
    h.withinCeiling = false
    basicDone(await events(await POST(search())))
    expect(h.analytics[0]?.properties).toMatchObject({ mode: 'basic', reason: 'ceiling' })
  })

  it('answers from our listings when Cue runs and fails, inside the stream', async () => {
    h.modelFails = true
    const list = await events(await POST(search()))
    basicDone(list)
    expect(h.analytics[0]?.properties).toMatchObject({ mode: 'basic', reason: 'error' })
    // The audit row still records Cue's failure.
    expect(h.updates.at(-1)).toMatchObject({ status: 'failed' })
  })

  it('the chat panel still gets the fallback when Cue fails inside the stream', async () => {
    h.modelFails = true
    const list = await events(await POST(ask({ message: FOUNDER })))
    expect(list.at(-1)?.type).toBe('fallback')
  })

  it('sends the plain fallback only when the quick answer is limited too', async () => {
    h.denied.add('ai_assistant')
    h.denied.add('search_answer')
    expect(onlyFallback(await events(await POST(search()))).reason).toBe('limited')
    expect(h.analytics).toEqual([])
  })

  it("marks Cue's own answer and logs it without the words", async () => {
    const list = await events(await POST(search({ message: 'lawyer in atlanta' })))
    const done = list.at(-1) as Extract<CueEvent, { type: 'done' }>
    expect(done.mode).toBe('ai')
    expect(h.analytics).toEqual([
      {
        event_name: 'search_answer_served',
        properties: {
          mode: 'ai',
          reason: null,
          exact_bucket: null,
          related_used: false,
          related_checked: false,
          related_best: null,
          related_hits: 0,
        },
      },
    ])
    expect(JSON.stringify(h.analytics)).not.toMatch(/lawyer|atlanta|203\.0\.113/i)
  })

  it('never logs what the visitor typed', async () => {
    h.flag = false
    await POST(search())
    expect(JSON.stringify(h.analytics)).not.toMatch(/bathroom|switch|owned|203\.0\.113/i)
  })

  it('leaves the chat panel on the fallback it always had', async () => {
    h.flag = false
    expect(onlyFallback(await events(await POST(ask({ message: FOUNDER })))).reason).toBe('error')
    expect(h.analytics).toEqual([])
  })

  it('refuses a surface it does not know', async () => {
    onlyFallback(await events(await POST(ask({ message: FOUNDER, surface: 'admin' }))))
  })
})
