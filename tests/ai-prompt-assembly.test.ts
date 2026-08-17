// =============================================================================
// Prompt assembly: what actually reaches a provider
// =============================================================================
// `buildPromptVars` is one half of the privacy surface for AI generation (the
// other is `loadGenerateContext`, which decides what is read from the database).
// Every string a provider would ever see passes through here, so this file
// asserts the negative: the forbidden fields are absent, and a contact detail
// typed into a description does not survive the trip.
//
// The provider-resolution block asserts the same GATE-SPEND property as
// tests/ai-agents.test.ts, one level up: even with a credential present, an
// unresolved model tier means the mock path runs.
// =============================================================================

import { describe, it, expect, afterEach } from 'vitest'
import { fillTemplate, buildPromptVars, resolveProvider } from '@/lib/ai/provider'
import type { GenerateContext } from '@/lib/ai/provider'
import { findAgent } from '@/lib/ai/agents'

const CTX: GenerateContext = {
  listingName: 'Third Coast Barbers',
  categoryName: 'Barbershop',
  cityName: 'Detroit',
  tagline: 'Cuts that hold all week',
  description: 'Call us on (313) 555-0142 or email owner@example.com to book a chair.',
  pageViews30d: 412,
  ctaClicks30d: 38,
  saves30d: 12,
  shares30d: 4,
  pageViews7d: 96,
}

describe('fillTemplate', () => {
  it('substitutes every placeholder it has a value for', () => {
    expect(fillTemplate('Hello {{name}} in {{city}}', { name: 'Ada', city: 'Detroit' })).toBe(
      'Hello Ada in Detroit'
    )
  })

  it('replaces an unknown placeholder with an empty string rather than leaving braces', () => {
    // A prompt containing a literal `{{tagline}}` is worse than one missing the
    // tagline: it tells the model our template did not render.
    expect(fillTemplate('Tagline: {{tagline}}.', {})).toBe('Tagline: .')
  })

  it('substitutes a repeated placeholder everywhere it appears', () => {
    expect(fillTemplate('{{a}} and {{a}}', { a: 'x' })).toBe('x and x')
  })
})

describe('buildPromptVars', () => {
  const vars = buildPromptVars(CTX)

  it('carries the listing basics a prompt needs', () => {
    expect(vars.listing_name).toBe('Third Coast Barbers')
    expect(vars.city_name).toBe('Detroit')
    expect(vars.category_name).toBe('Barbershop')
  })

  it('redacts contact details the owner typed into their own description', () => {
    const joined = Object.values(vars).join(' | ')
    expect(joined).not.toContain('555-0142')
    expect(joined).not.toContain('owner@example.com')
  })

  it('exposes no key that could carry personal data', () => {
    // The allowlist is the GenerateContext type; this is the runtime restatement
    // of it. A field added to the context by accident shows up here.
    const forbidden = [
      'phone',
      'email',
      'address',
      'address_line_1',
      'zip',
      'owner',
      'social_instagram',
      'owner_user_id',
      'user_id',
      'triggered_by',
    ]
    for (const key of forbidden) {
      expect(Object.keys(vars)).not.toContain(key)
    }
  })

  it('stringifies the aggregate counts it was given', () => {
    expect(vars.page_views_30d).toBe('412')
    expect(vars.saves_30d).toBe('12')
  })

  it('renders a null tagline as an empty string, not the word null', () => {
    const vars2 = buildPromptVars({ ...CTX, tagline: null, description: null })
    expect(vars2.tagline).toBe('')
    expect(vars2.description_excerpt).toBe('')
  })
})

describe('resolveProvider', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY

  afterEach(() => {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = originalKey
  })

  it('resolves to the mock provider with no credential present', () => {
    delete process.env.ANTHROPIC_API_KEY
    expect(resolveProvider(findAgent('seo_coach_title')!).provider).toBe('mock')
  })

  it('still resolves to the mock provider when a credential IS present', () => {
    // The credential alone must not start spending. Both halves are required:
    // a resolved MODEL_BY_TIER entry and a key. This is the assertion that would
    // fail first if a model name were filled in without a GATE-SPEND decision.
    process.env.ANTHROPIC_API_KEY = 'sk-not-a-real-key'
    for (const agent of ['seo_coach_title', 'listing_description']) {
      expect(resolveProvider(findAgent(agent)!).provider).toBe('mock')
    }
  })

  it('reports the mock model name so the audit row is attributable', () => {
    delete process.env.ANTHROPIC_API_KEY
    expect(resolveProvider(findAgent('analytics_explainer')!).model).toBe('mock-v1')
  })
})
