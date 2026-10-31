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
    // Low effort, no thinking, frozen tools, and a cache mark on the last message.
    expect(params[0]).toMatchObject({ thinking: { type: 'disabled' }, output_config: { effort: 'low' } })
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
    const five: Step = () =>
      msg(
        Array.from({ length: 5 }, (_, i) => ({ type: 'tool_use', id: `t${i}`, name: 'find_place', input: { place: 'Atlanta' } })),
        'tool_use'
      )
    const { call, params } = scripted([five, say('Atlanta is covered.')])
    await setup().run(call)
    const results = params[1]!.messages.at(-1)!.content as Anthropic.ToolResultBlockParam[]
    expect(results).toHaveLength(5)
    expect(results.slice(0, 4).every((r) => !r.is_error)).toBe(true)
    expect(results[4]!.is_error).toBe(true)
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

  it('does not retry once text has streamed', async () => {
    const step: Step = (_p, onText) => {
      onText('Looking now ')
      throw new CueCallError('bad_json')
    }
    const { call, params } = scripted([step, say('unused')])
    const out = await setup().run(call)
    expect(params).toHaveLength(1)
    expect(out.stop).toBe('bad_json')
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

  it('puts a space between text written in different calls', async () => {
    const { call } = scripted([
      (_p, onText) => {
        onText('Let me look.')
        return msg(
          [
            { type: 'text', text: 'Let me look.' },
            { type: 'tool_use', id: 'x', name: 'find_place', input: { place: 'Atlanta' } },
          ],
          'tool_use'
        )
      },
      say('Atlanta is covered.'),
    ])
    const t = setup()
    const out = await t.run(call)
    expect(streamedText(t.events)).toBe('Let me look. Atlanta is covered.')
    expect(out.text).toBe('Let me look. Atlanta is covered.')
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

  it('says not listed yet when nothing comes back', async () => {
    const t = setup({ deps: deps({ search: vi.fn(async () => []) }) })
    const out = await t.run(createMockCueCall({ cities: CITIES }))
    expect(out.text).toMatch(/not on The BLACQList yet/)
    expect(out.cards).toEqual([])
  })

  it('asks what and where when there are no words to search', async () => {
    const t = setup({}, 'atlanta')
    const out = await t.run(createMockCueCall({ cities: CITIES }))
    expect(out.text).toBe('What are you looking for, and in which city?')
    expect(t.ctx.deps.search).not.toHaveBeenCalled()
  })
})
