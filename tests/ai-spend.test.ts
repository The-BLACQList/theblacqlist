// =============================================================================
// The real provider: the spending ceiling, the call, and the copy rules
// =============================================================================
// The ceiling prices every paid attempt at the most one call can cost, so these
// tests check that the "most" really is a bound: every active template, filled
// with the longest values buildPromptVars allows, fits under MAX_PROMPT_CHARS.
// The SDK is mocked; no test here reaches the network.
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const create = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create }
  },
}))

import { AI_AGENTS } from '@/lib/ai/agents'
import { callAnthropic, maxTokensFor, ProviderCallError, SYSTEM_PROMPT } from '@/lib/ai/anthropic'
import { PROMPT_TEMPLATES } from '@/lib/ai/prompts'
import { buildPromptVars, fillTemplate } from '@/lib/ai/provider'
import {
  MAX_PROMPT_CHARS,
  monthlyCallBudget,
  monthlyCeilingUsd,
  worstCaseUsdAnyAgent,
  worstCaseUsdPerCall,
} from '@/lib/ai/spend'

describe('spending ceiling arithmetic', () => {
  const original = process.env.AI_MONTHLY_CEILING_USD
  afterEach(() => {
    if (original === undefined) delete process.env.AI_MONTHLY_CEILING_USD
    else process.env.AI_MONTHLY_CEILING_USD = original
  })

  it('reads the ceiling only as a positive number', () => {
    process.env.AI_MONTHLY_CEILING_USD = '25'
    expect(monthlyCeilingUsd()).toBe(25)
    for (const bad of ['', '0', '-1', 'abc', 'Infinity']) {
      process.env.AI_MONTHLY_CEILING_USD = bad
      expect(monthlyCeilingUsd()).toBeNull()
    }
    delete process.env.AI_MONTHLY_CEILING_USD
    expect(monthlyCeilingUsd()).toBeNull()
  })

  it('prices the longest agent highest and charges every call at that price', () => {
    const longest = Math.max(...AI_AGENTS.map((a) => a.maxOutputChars))
    expect(worstCaseUsdAnyAgent()).toBe(worstCaseUsdPerCall(longest))
    // A fraction of a cent, even at the bound.
    expect(worstCaseUsdAnyAgent()).toBeLessThan(0.005)
  })

  it('turns $30 a month into thousands of calls, never more than the ceiling allows', () => {
    const calls = monthlyCallBudget(30)
    expect(calls).toBeGreaterThan(5000)
    expect(calls * worstCaseUsdAnyAgent()).toBeLessThanOrEqual(30)
  })

  it('caps output tokens just above each agent’s character limit', () => {
    for (const agent of AI_AGENTS) {
      const cap = maxTokensFor(agent.maxOutputChars)
      expect(cap).toBeGreaterThan(agent.maxOutputChars / 4)
      expect(cap).toBeLessThan(agent.maxOutputChars)
    }
  })
})

describe('prompt length bound', () => {
  it('fits every active template, filled to the limits, under MAX_PROMPT_CHARS', () => {
    const long = 'x'.repeat(5000)
    const vars = buildPromptVars({
      listingName: long,
      categoryName: long,
      cityName: long,
      tagline: long,
      description: long,
      pageViews30d: 999_999_999,
      ctaClicks30d: 999_999_999,
      saves30d: 999_999_999,
      shares30d: 999_999_999,
      pageViews7d: 999_999_999,
    })
    for (const agent of AI_AGENTS) {
      const prompt = fillTemplate(PROMPT_TEMPLATES[agent.templateKey], vars)
      expect(prompt.length, agent.agentType).toBeLessThanOrEqual(MAX_PROMPT_CHARS)
    }
  })
})

describe('ownership wording', () => {
  it('never tells the model the business is Black-owned', () => {
    // Listings are labeled Black-Owned or Ally. A template that asserts one of
    // them puts a false claim on every page with the other label.
    for (const agent of AI_AGENTS) {
      expect(PROMPT_TEMPLATES[agent.templateKey], agent.agentType).not.toMatch(/black[- ]owned/i)
    }
  })

  it('tells the model not to state ownership or identity on its own', () => {
    expect(SYSTEM_PROMPT).toMatch(/who owns the business/)
  })

  it('gives the description writer the owner’s own words to work from', () => {
    expect(PROMPT_TEMPLATES.LISTING_DESCRIPTION).toContain('{{description_excerpt}}')
    expect(PROMPT_TEMPLATES.LISTING_DESCRIPTION).toContain('{{tagline}}')
  })
})

describe('callAnthropic', () => {
  const input = { model: 'claude-haiku-5-5', prompt: 'Write a title.', maxOutputChars: 120 }
  const reply = (over: Record<string, unknown> = {}) => ({
    content: [{ type: 'text', text: 'Third Coast Barbers in Detroit' }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 210, output_tokens: 12 },
    ...over,
  })

  // Braces matter: a function returned from beforeEach runs as teardown, and
  // mockReset() returns the mock itself.
  beforeEach(() => {
    create.mockReset()
  })

  it('sends the system prompt, the cap, and thinking off', async () => {
    create.mockResolvedValue(reply())
    const result = await callAnthropic(input)
    expect(result).toEqual({ text: 'Third Coast Barbers in Detroit', inputTokens: 210, outputTokens: 12 })
    expect(create).toHaveBeenCalledWith({
      model: 'claude-haiku-5-5',
      max_tokens: maxTokensFor(120),
      system: SYSTEM_PROMPT,
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: 'Write a title.' }],
    })
  })

  it('treats a refusal as a failure and keeps the billed tokens', async () => {
    create.mockResolvedValue(reply({ stop_reason: 'refusal' }))
    await expect(callAnthropic(input)).rejects.toMatchObject({
      code: 'provider_refusal',
      usage: { inputTokens: 210, outputTokens: 12 },
    })
  })

  it('treats a cut-off answer as a failure, not a short suggestion', async () => {
    create.mockResolvedValue(reply({ stop_reason: 'max_tokens' }))
    await expect(callAnthropic(input)).rejects.toMatchObject({ code: 'provider_truncated' })
  })

  it('turns an SDK error into a bare code with nothing from the message', async () => {
    create.mockImplementation(async () => {
      throw new Error('upstream said: Write a title.')
    })
    const err = await callAnthropic(input).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ProviderCallError)
    expect((err as ProviderCallError).code).toBe('provider_error')
    expect((err as ProviderCallError).message).toBe('provider_error')
  })
})
