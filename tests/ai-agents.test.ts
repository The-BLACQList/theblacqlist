// =============================================================================
// AI agent registry, mock tier, and the zero-spend guarantee
// =============================================================================
// The registry is the join between three things that used to only agree by
// convention: the prompt template, the `suggestion_type` written to the row, and
// the column an approved suggestion is allowed to overwrite. If any of the three
// drifts, the failure is silent — a suggestion applied to the wrong field, or an
// agent whose prompt does not exist.
//
// The last block is the one that matters most: it asserts that the repo in its
// current state cannot reach a paid provider. That is a GATE-SPEND property, and
// a test is the only thing that will notice if somebody fills in a model name
// while looking at something else.
// =============================================================================

import { describe, it, expect } from 'vitest'
import {
  AI_AGENTS,
  MODEL_BY_TIER,
  MOCK_MODEL,
  findAgent,
  promptVersionOf,
  agentsWithUnroutedTemplates,
} from '@/lib/ai/agents'
import { PROMPT_TEMPLATES } from '@/lib/ai/prompts'
import { mockResponseFor, type MockContext } from '@/lib/ai/mock-responses'
import { validateOutput } from '@/lib/ai/sanitize'

const CTX: MockContext = {
  listingName: 'Third Coast Barbers',
  categoryName: 'Barbershop',
  cityName: 'Detroit',
  tagline: 'Cuts that hold all week',
  descriptionExcerpt: 'A neighborhood shop that has been cutting on Grand River since 2011.',
  pageViews30d: 412,
  ctaClicks30d: 38,
  saves30d: 12,
}

describe('AI_AGENTS registry', () => {
  it('has a unique agentType per agent', () => {
    const types = AI_AGENTS.map((a) => a.agentType)
    expect(new Set(types).size).toBe(types.length)
  })

  it('points every agent at a prompt template that exists', () => {
    for (const agent of AI_AGENTS) {
      expect(Object.keys(PROMPT_TEMPLATES)).toContain(agent.templateKey)
    }
  })

  it('reports no agent whose template routing has drifted', () => {
    expect(agentsWithUnroutedTemplates()).toEqual([])
  })

  it('gives every agent an owner-readable label and blurb', () => {
    for (const agent of AI_AGENTS) {
      expect(agent.label.length).toBeGreaterThan(0)
      expect(agent.blurb.length).toBeGreaterThan(0)
    }
  })

  it('only ever targets the three columns AI copy is allowed to overwrite', () => {
    // Widening this set is a decision, not a refactor: each entry is a live field
    // on a published page that an Apply click replaces outright.
    const allowed = new Set([
      'listings.meta_title',
      'listings.meta_description',
      'listing_details_business.description',
    ])
    for (const agent of AI_AGENTS) {
      if (!agent.applyTarget) continue
      expect(allowed).toContain(`${agent.applyTarget.table}.${agent.applyTarget.column}`)
    }
  })

  it('leaves captions and analytics summaries with no apply target', () => {
    expect(findAgent('social_caption_instagram')?.applyTarget).toBeNull()
    expect(findAgent('analytics_explainer')?.applyTarget).toBeNull()
  })

  it('returns undefined for an unknown agentType instead of a default', () => {
    expect(findAgent('does_not_exist')).toBeUndefined()
    expect(findAgent('')).toBeUndefined()
  })

  it('stamps a prompt version derived from the template key', () => {
    const agent = findAgent('seo_coach_title')
    expect(agent).toBeDefined()
    expect(promptVersionOf(agent!)).toBe('SEO_TITLE@1')
  })
})

describe('mock tier', () => {
  it('returns text for every registered agent', () => {
    for (const agent of AI_AGENTS) {
      expect(mockResponseFor(agent, CTX).trim().length).toBeGreaterThan(0)
    }
  })

  it('produces output every agent’s own validator accepts', () => {
    // A mock that fails validateOutput would make the whole approval flow
    // untestable without a provider, which is the point of the mock tier.
    //
    // The ceiling is read from the registry deliberately. An earlier draft of
    // this file passed `agent.maxChars`, which does not exist — it arrived as
    // `undefined`, `Math.min(undefined, …)` is NaN, and `length > NaN` is
    // always false, so the length check silently did nothing while the test
    // still went green. tsc caught it; vitest could not.
    for (const agent of AI_AGENTS) {
      expect(Number.isFinite(agent.maxOutputChars)).toBe(true)
      const result = validateOutput(mockResponseFor(agent, CTX), agent.maxOutputChars)
      expect(result.ok, `${agent.agentType}: ${JSON.stringify(result)}`).toBe(true)
    }
  })

  it('gives every agent a ceiling its own mock response actually fits under', () => {
    // The pair that the vacuous version above could not distinguish: a mock
    // longer than its agent's ceiling would have passed there and fails here.
    for (const agent of AI_AGENTS) {
      const out = mockResponseFor(agent, CTX)
      expect(out.length, `${agent.agentType} mock is ${out.length} chars`).toBeLessThanOrEqual(
        agent.maxOutputChars
      )
    }
  })

  it('writes copy from the listing’s own values, not a placeholder', () => {
    const agent = findAgent('seo_coach_title')!
    const out = mockResponseFor(agent, CTX)
    expect(out).toContain('Third Coast Barbers')
  })

  it('quotes only the counts it was given in the analytics summary', () => {
    // No fabricated metrics on an owner-facing surface — see
    // .claude/rules/no-fabrication.md. The mock may summarize the numbers it
    // received; it may not invent traffic.
    const agent = findAgent('analytics_explainer')!
    const out = mockResponseFor(agent, CTX)
    expect(out).toContain('412')
    expect(out).not.toContain('1,000')
  })

  it('returns an empty string for an unregistered agent so validation refuses it', () => {
    const invented = { ...findAgent('seo_coach_title')!, agentType: 'invented_agent' }
    expect(mockResponseFor(invented, CTX)).toBe('')
    expect(validateOutput(mockResponseFor(invented, CTX), 320).ok).toBe(false)
  })
})

describe('zero-spend guarantee', () => {
  it('has no model resolved for any tier', () => {
    // `[Decision — GATE-SPEND pending]` Filling either of these in is a spending
    // decision. If this test fails, a per-call price was chosen somewhere.
    for (const tier of Object.keys(MODEL_BY_TIER)) {
      expect(MODEL_BY_TIER[tier as keyof typeof MODEL_BY_TIER]).toBeNull()
    }
  })

  it('names the mock model explicitly so audit rows are attributable', () => {
    expect(MOCK_MODEL).toBe('mock-v1')
  })
})
