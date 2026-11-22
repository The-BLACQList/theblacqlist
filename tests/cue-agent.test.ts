// =============================================================================
// Cue's loop (ticket 169)
// =============================================================================
// A scripted model drives the loop: stop reasons, tool errors, the call cap,
// the one retry, the size cap, and the reply check. The mock provider runs end
// to end too, since Preview and CI use it.
// =============================================================================

import type Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it, vi } from 'vitest'

import {
  CUE_INPUT_CHAR_CAP,
  CUE_MAX_CALLS,
  CueCallError,
  runCue,
  searchModel,
  type CueModelCall,
} from '@/lib/ai/cue/agent'
import { SWAP_WITH_CARDS } from '@/lib/ai/cue/guard'
import { createMockCueCall } from '@/lib/ai/cue/mock'
import { buildCueMessages, cueSystem } from '@/lib/ai/cue/prompt'
import type { CueEvent } from '@/lib/ai/cue/stream'
import type { CueToolContext } from '@/lib/ai/cue/tools'
import { NO_PAGE } from '@/lib/assistant/page'

import { CATEGORIES, CITIES, ctx as makeCtx, deps, entity, ID } from './fixtures/cue'

type Step = (params: Anthropic.MessageStreamParams, onText: (d: string) => void) => Anthropic.Message

function msg(content: unknown[], stop: Anthropic.StopReason, usage: Partial<Anthropic.Usage> = {}): Anthropic.Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'test',
    content,
    stop_reason: stop,
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: null, cache_read_input_tokens: null, ...usage },
  } as unknown as Anthropic.Message
}

const say = (text: string, stop: Anthropic.StopReason = 'end_turn'): Step => (_p, onText) => {
  onText(text)
  return msg([{ type: 'text', text }], stop)
}
let toolN = 0
const use = (name: string, input: unknown): Step => () =>
  msg([{ type: 'tool_use', id: `toolu_${++toolN}`, name, input }], 'tool_use')

function scripted(steps: Array<Step | Error>): { call: CueModelCall; params: Anthropic.MessageStreamParams[] } {
  const params: Anthropic.MessageStreamParams[] = []
  let i = 0
  const call: CueModelCall = async (p, onText) => {
    params.push(p)
    const step = steps[Math.min(i++, steps.length - 1)]!
    if (step instanceof Error) throw step
    return step(p, onText)
  }
  return { call, params }
}

const FOUND = [entity(1, { name: 'Peach Law Group' }), entity(2, { name: 'Midtown Legal' }), entity(3), entity(4)]

function setup(over: Partial<CueToolContext> = {}, message = 'lawyer in atlanta') {
  const ctx = makeCtx({ deps: deps({ search: vi.fn(async () => FOUND) }), ...over })
  const events: CueEvent[] = []
  return {
    ctx,
    events,
    run: (call: CueModelCall, extra: { messages?: Anthropic.MessageParam[]; signal?: AbortSignal } = {}) =>
      runCue({
        call,
        model: 'test',
        system: cueSystem(CATEGORIES, CITIES),
        messages:
          extra.messages ??
          buildCueMessages({ history: [], message, page: NO_PAGE, nearShared: false, priorCards: [] }),
        ctx,
        names: [
          { id: ID(1), name: 'Peach Law Group' },
          { id: ID(99), name: 'Unreturned Bakery Co' },
        ],
        emit: (e) => events.push(e),
        signal: extra.signal ?? new AbortController().signal,
      }),
  }
}

const streamedText = (events: CueEvent[]) =>
  events.flatMap((e) => (e.type === 'text' ? [e.text] : [])).join('')

describe('runCue', () => {
  it('searches, shows, then streams a grounded reply', async () => {
    const { call, params } = scripted([
      use('search_listings', { words: ['lawyer'], category: 'law-legal-services', city: 'atlanta' }),
      use('show_businesses', { ids: [ID(1), ID(2)] }),
      say('Peach Law Group and Midtown Legal both handle family law.'),
    ])
    const t = setup()
    const out = await t.run(call)
    expect(out.stop).toBe('end')
    expect(out.calls).toBe(3)
    expect(out.swapped).toBe(false)
    expect(out.cards.map((c) => c.id)).toEqual([ID(1), ID(2)])
    expect(out.text).toBe('Peach Law Group and Midtown Legal both handle family law.')
    expect(streamedText(t.events)).toBe(out.text)
    expect(t.events.filter((e) => e.type === 'status').map((e) => e.type === 'status' && e.text)[0]).toMatch(/Atlanta/)
    // Medium effort (ticket 256), no thinking, frozen tools, and a cache mark on the last message.
    expect(params[0]).toMatchObject({ thinking: { type: 'disabled' }, output_config: { effort: 'medium' } })
    const lastBlocks = params[2]!.messages.at(-1)!.content as Array<{ cache_control?: unknown }>
    expect(lastBlocks.at(-1)!.cache_control).toEqual({ type: 'ephemeral' })
    expect(out.usage).toEqual({ inputTokens: 30, outputTokens: 15, cacheReadTokens: 0 })
  })

  it('sends a bad tool input back as an error result the model can fix', async () => {
    const { call, params } = scripted([use('show_businesses', { ids: ['not-a-uuid'] }), say('Which city?')])
    const out = await setup().run(call)
    expect(out.stop).toBe('end')
    const results = params[1]!.messages.at(-1)!.content as Anthropic.ToolResultBlockParam[]
    expect(results[0]).toMatchObject({ type: 'tool_result', is_error: true })
  })

  it('answers extra tools in one call with an error, all in one message', async () => {
    const seven: Step = () =>
      msg(
        Array.from({ length: 7 }, (_, i) => ({ type: 'tool_use', id: `t${i}`, name: 'find_place', input: { place: 'Atlanta' } })),
        'tool_use'
      )
    const { call, params } = scripted([seven, say('Atlanta is covered.')])
    await setup().run(call)
    const results = params[1]!.messages.at(-1)!.content as Anthropic.ToolResultBlockParam[]
    expect(results).toHaveLength(7)
    expect(results.slice(0, 6).every((r) => !r.is_error)).toBe(true)
    expect(results[6]!.is_error).toBe(true)
  })

  it('drops the text of a refusal', async () => {
    const out = await setup().run(scripted([say('I will not help with that.', 'refusal')]).call)
    expect(out.stop).toBe('refusal')
    expect(out.text).toBe('')
    expect(out.cards).toEqual([])
  })

  it('cuts a reply that hit the token cap to its last sentence and shows what it found', async () => {
    const { call } = scripted([
      use('search_listings', { words: ['lawyer'], city: 'atlanta' }),
      say('Here are some firms. The first one is open on Sund', 'max_tokens'),
    ])
    const out = await setup().run(call)
    expect(out.stop).toBe('truncated')
    expect(out.text).toBe('Here are some firms.')
    expect(out.cards.map((c) => c.id)).toEqual([ID(1), ID(2), ID(3)])
  })

  it(`stops after ${CUE_MAX_CALLS} calls with the cards found so far`, async () => {
    const { call, params } = scripted([use('search_listings', { words: ['lawyer'], city: 'atlanta' })])
    const out = await setup().run(call)
    expect(params).toHaveLength(CUE_MAX_CALLS)
    expect(out.stop).toBe('cap')
    expect(out.cards).toHaveLength(3)
    expect(out.text).toBe(SWAP_WITH_CARDS)
  })

  it('retries a broken tool input once when nothing was shown yet', async () => {
    const { call, params } = scripted([new CueCallError('bad_json'), say('Which city are you in?')])
    const out = await setup().run(call)
    expect(params).toHaveLength(2)
    expect(out).toMatchObject({ stop: 'end', text: 'Which city are you in?' })
  })

  it('does not retry twice', async () => {
    const { call, params } = scripted([new CueCallError('bad_json'), new CueCallError('bad_json')])
    const out = await setup().run(call)
    expect(params).toHaveLength(2)
    expect(out.stop).toBe('bad_json')
    expect(out.text).toBe('')
  })

  // Ticket 261: a call's text is held until the call ends, so nothing from a
  // failed call was shown and the one retry is always safe.
  it('retries a broken call once even after it wrote text, and shows none of it', async () => {
    const step: Step = (_p, onText) => {
      onText('Looking now ')
      throw new CueCallError('bad_json')
    }
    const { call, params } = scripted([step, say('Which city are you in?')])
    const t = setup()
    const out = await t.run(call)
    expect(params).toHaveLength(2)
    expect(out).toMatchObject({ stop: 'end', text: 'Which city are you in?' })
    expect(streamedText(t.events)).toBe('Which city are you in?')
  })

  it('stops on a provider error', async () => {
    const out = await setup().run(scripted([new CueCallError('provider_error')]).call)
    expect(out).toMatchObject({ stop: 'provider_error', text: '', cards: [] })
  })

  it('stops on a data failure without guessing', async () => {
    const t = setup({ deps: deps({ search: vi.fn(async () => Promise.reject(new Error('CUE_LOAD_FAILED'))) }) })
    const out = await t.run(scripted([use('search_listings', { words: ['lawyer'] }), say('unused')]).call)
    expect(out.stop).toBe('data_error')
    expect(out.text).toBe('')
  })

  it('refuses to send a conversation over the size cap', async () => {
    const { call, params } = scripted([say('unused')])
    const big = 'x'.repeat(CUE_INPUT_CHAR_CAP)
    const out = await setup().run(call, { messages: [{ role: 'user', content: big }] })
    expect(params).toHaveLength(0)
    expect(out.stop).toBe('too_long')
  })

  it('stops before calling when the visitor already left', async () => {
    const ac = new AbortController()
    ac.abort()
    const { call, params } = scripted([say('unused')])
    const out = await setup().run(call, { signal: ac.signal })
    expect(params).toHaveLength(0)
    expect(out.stop).toBe('aborted')
  })

  it('swaps a reply that names a listed business no tool returned', async () => {
    const { call } = scripted([
      use('search_listings', { words: ['lawyer'], city: 'atlanta' }),
      use('show_businesses', { ids: [ID(1)] }),
      say('Peach Law Group is great, or try Unreturned Bakery Co.'),
    ])
    const out = await setup().run(call)
    expect(out.swapped).toBe(true)
    expect(out.text).toBe(SWAP_WITH_CARDS)
    expect(out.cards).toHaveLength(1)
  })

  // Ticket 261: text written next to a lookup is a working note, not the answer.
  const withTool = (text: string, name: string, input: unknown): Step => (_p, onText) => {
    onText(text)
    return msg(
      [
        { type: 'text', text },
        { type: 'tool_use', id: `toolu_${++toolN}`, name, input },
      ],
      'tool_use'
    )
  }

  it('hides a working note written next to a lookup', async () => {
    const { call } = scripted([withTool('Let me look.', 'find_place', { place: 'Atlanta' }), say('Atlanta is covered.')])
    const t = setup()
    const out = await t.run(call)
    expect(streamedText(t.events)).toBe('Atlanta is covered.')
    expect(out.text).toBe('Atlanta is covered.')
  })

  it('hides "Dropping the owner wording" next to a search (the founder\'s case)', async () => {
    const { call } = scripted([
      withTool('Dropping the owner wording.', 'search_listings', { words: ['lawyer'], city: 'atlanta' }),
      use('show_businesses', { ids: [ID(1)] }),
      say('Peach Law Group handles family law.'),
    ])
    const t = setup()
    const out = await t.run(call)
    expect(out.text).toBe('Peach Law Group handles family law.')
    expect(streamedText(t.events)).toBe('Peach Law Group handles family law.')
    expect(JSON.stringify(t.events)).not.toMatch(/owner wording/)
  })

  it('keeps text written next to show_businesses and puts a space before the next call', async () => {
    const { call } = scripted([
      use('search_listings', { words: ['lawyer'], city: 'atlanta' }),
      withTool('Here are two firms.', 'show_businesses', { ids: [ID(1), ID(2)] }),
      say('Both handle family law.'),
    ])
    const t = setup()
    const out = await t.run(call)
    expect(out.text).toBe('Here are two firms. Both handle family law.')
    expect(streamedText(t.events)).toBe(out.text)
  })

  it('uses the last working note when the final call writes nothing', async () => {
    const { call } = scripted([
      withTool('Atlanta is covered.', 'find_place', { place: 'Atlanta' }),
      () => msg([], 'end_turn'),
    ])
    const t = setup()
    const out = await t.run(call)
    expect(out.text).toBe('Atlanta is covered.')
    expect(streamedText(t.events)).toBe(out.text)
  })

  it('counts cache reads and writes as input', async () => {
    const { call } = scripted([
      () => msg([{ type: 'text', text: 'Hi.' }], 'end_turn', { cache_creation_input_tokens: 100, cache_read_input_tokens: 900 }),
    ])
    const out = await setup().run(call)
    expect(out.usage).toEqual({ inputTokens: 1010, outputTokens: 5, cacheReadTokens: 900 })
  })
})

describe('the mock provider', () => {
  it('searches the city named, shows three, and says so', async () => {
    const t = setup()
    const out = await t.run(createMockCueCall({ cities: CITIES }))
    expect(out.stop).toBe('end')
    expect(out.calls).toBe(3)
    expect(out.cards).toHaveLength(3)
    expect(out.text).toBe('Here are 3 places that match.')
    expect(t.ctx.deps.search).toHaveBeenCalledWith(expect.objectContaining({ city: 'atlanta' }))
  })

  it('says nothing matches yet, and offers Suggest a Business, when nothing comes back', async () => {
    const t = setup({ deps: deps({ search: vi.fn(async () => []) }) })
    const out = await t.run(createMockCueCall({ cities: CITIES }))
    expect(out.text).toMatch(/Nothing matches that on The BLACQList yet/)
    expect(out.cards).toEqual([])
    expect(out.actions).toContainEqual({ kind: 'link', href: '/add-business', label: 'Suggest a Business' })
  })

  it('shows close matches from the nearest category when the words match nothing (ticket 256)', async () => {
    const search = vi.fn(async (p: { q?: string; category?: string }) =>
      p.q ? [] : [entity(7), entity(8)]
    )
    const t = setup({ deps: deps({ search }) })
    const out = await t.run(createMockCueCall({ cities: CITIES }))
    expect(out.cards.map((c) => c.id)).toEqual([ID(7), ID(8)])
    expect(out.text).toMatch(/^Nothing matches exactly yet\. These are close matches from /)
    // Close matches are not exact: Suggest a Business is still offered.
    expect(out.actions).toContainEqual({ kind: 'link', href: '/add-business', label: 'Suggest a Business' })
  })

  it('asks what and where when there are no words to search', async () => {
    const t = setup({}, 'atlanta')
    const out = await t.run(createMockCueCall({ cities: CITIES }))
    expect(out.text).toBe('What are you looking for, and in which city?')
    expect(t.ctx.deps.search).not.toHaveBeenCalled()
  })
})

describe('searchModel (ticket 256)', () => {
  const base = 'claude-haiku-5-5'
  it('keeps the base model when no override is set', () => {
    expect(searchModel(base, {})).toBe(base)
  })
  it('uses a valid override outside production', () => {
    expect(searchModel(base, { CUE_SEARCH_MODEL: 'claude-sonnet-5-5', VERCEL_ENV: 'preview' })).toBe('claude-sonnet-5-5')
  })
  it('ignores the override in production, where spend is priced for Haiku', () => {
    expect(searchModel(base, { CUE_SEARCH_MODEL: 'claude-sonnet-5-5', VERCEL_ENV: 'production' })).toBe(base)
  })
  it('ignores an override that is not a Claude model id', () => {
    expect(searchModel(base, { CUE_SEARCH_MODEL: 'gpt-4; rm -rf' })).toBe(base)
  })
})
