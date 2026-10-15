// =============================================================================
// Writing help inside Edit content (ticket 138): the per-field state machine,
// the allowance arithmetic, the blocked-button copy and the open-suggestion
// picker. All pure; nothing here reaches a database or a model.
// =============================================================================

import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => ({}) }))

import {
  CLOSING_NOTE,
  WRITE_BUTTON,
  fieldHelpReducer,
  initialFieldHelp,
  usedSuggestionId,
  writeBlockedReason,
  type FieldHelp,
  type Suggestion,
} from '@/lib/ai/writingHelp'
import { allowanceFrom } from '@/lib/ai/allowance'
import { pickOpenSuggestions } from '@/lib/ai/openSuggestions'
import { RATE_LIMIT_PER_LISTING_24H } from '@/lib/ai/provider'

const s1: Suggestion = { id: 's1', text: 'Suggested text', sample: false }

function shown(value = 'Mine'): FieldHelp {
  return fieldHelpReducer(fieldHelpReducer(initialFieldHelp(value), { type: 'request' }), {
    type: 'received',
    suggestion: s1,
  })
}

describe('fieldHelpReducer', () => {
  it('starts idle, or shows an open suggestion from earlier', () => {
    expect(initialFieldHelp('x').card).toEqual({ kind: 'idle' })
    expect(initialFieldHelp('x', s1).card).toEqual({ kind: 'shown', suggestion: s1 })
  })

  it('goes idle → loading → shown without touching the field', () => {
    const state = shown('Mine')
    expect(state.value).toBe('Mine')
    expect(state.card).toEqual({ kind: 'shown', suggestion: s1 })
  })

  it('Use this fills the field and remembers the owner text', () => {
    const used = fieldHelpReducer(shown('Mine'), { type: 'use' })
    expect(used.value).toBe('Suggested text')
    expect(used.card).toEqual({ kind: 'used', suggestion: s1, previous: 'Mine' })
    expect(usedSuggestionId(used)).toBe('s1')
  })

  it('Put mine back restores the exact earlier text and shows the card again', () => {
    const used = fieldHelpReducer(shown('Mine'), { type: 'use' })
    const edited = fieldHelpReducer(used, { type: 'edit', value: 'Suggested text, changed' })
    const back = fieldHelpReducer(edited, { type: 'putBack' })
    expect(back.value).toBe('Mine')
    expect(back.card).toEqual({ kind: 'shown', suggestion: s1 })
    expect(usedSuggestionId(back)).toBeNull()
  })

  it('keeps the id through edits, so a reworded suggestion still counts as used', () => {
    const used = fieldHelpReducer(shown(), { type: 'use' })
    const edited = fieldHelpReducer(used, { type: 'edit', value: 'Reworded' })
    expect(usedSuggestionId(edited)).toBe('s1')
  })

  it('ignores a new request while a used suggestion waits for Save', () => {
    const used = fieldHelpReducer(shown(), { type: 'use' })
    expect(fieldHelpReducer(used, { type: 'request' })).toBe(used)
  })

  it('ignores a second request while one is loading', () => {
    const loading = fieldHelpReducer(initialFieldHelp(''), { type: 'request' })
    expect(fieldHelpReducer(loading, { type: 'request' })).toBe(loading)
  })

  it('Not this asks why, and answering leaves the field unchanged', () => {
    const why = fieldHelpReducer(shown('Mine'), { type: 'notThis' })
    expect(why.card).toEqual({ kind: 'whyNot', suggestion: s1 })
    const done = fieldHelpReducer(why, { type: 'rejected' })
    expect(done.card).toEqual({ kind: 'dismissed' })
    expect(done.value).toBe('Mine')
  })

  it('a save only marks a used card as saved', () => {
    const used = fieldHelpReducer(shown(), { type: 'use' })
    expect(fieldHelpReducer(used, { type: 'saved' }).card).toEqual({ kind: 'saved' })
    const plain = shown()
    expect(fieldHelpReducer(plain, { type: 'saved' })).toBe(plain)
  })

  it('a limit failure is a note, not an error', () => {
    const state = fieldHelpReducer(initialFieldHelp(''), {
      type: 'failed',
      message: 'No drafts left this month.',
      limit: true,
    })
    expect(state.card).toEqual({ kind: 'error', message: 'No drafts left this month.', limit: true })
  })
})

describe('allowanceFrom', () => {
  it('counts down from the plan allowance', () => {
    const a = allowanceFrom({ quota: 10, used: 3, oldestCountedAt: null, dailyUsed: 0 })
    expect(a).toMatchObject({ limit: 10, left: 7, resetsOn: null, dailyHit: false })
  })

  it('gives a reset date 30 days after the oldest counted draft when used up', () => {
    const a = allowanceFrom({
      quota: 10,
      used: 10,
      oldestCountedAt: '2026-10-01T12:00:00.000Z',
      dailyUsed: 0,
    })
    expect(a.left).toBe(0)
    expect(a.resetsOn).toBe('2026-10-31T12:00:00.000Z')
  })

  it('shows used up when the counter could not be read', () => {
    const a = allowanceFrom({
      quota: 10,
      used: Number.POSITIVE_INFINITY,
      oldestCountedAt: null,
      dailyUsed: 0,
    })
    expect(a.left).toBe(0)
  })

  it('flags the daily limit at the provider number', () => {
    const a = allowanceFrom({
      quota: 100,
      used: 0,
      oldestCountedAt: null,
      dailyUsed: RATE_LIMIT_PER_LISTING_24H,
    })
    expect(a.dailyHit).toBe(true)
    expect(a.perDay).toBe(RATE_LIMIT_PER_LISTING_24H)
  })

  it('has no monthly count for a plan with no cap', () => {
    const a = allowanceFrom({ quota: null, used: 0, oldestCountedAt: null, dailyUsed: 0 })
    expect(a).toMatchObject({ limit: null, left: null })
  })
})

describe('writeBlockedReason', () => {
  const ready = allowanceFrom({ quota: 10, used: 2, oldestCountedAt: null, dailyUsed: 0 })

  it('is null when the buttons can be used, or the help is off or locked', () => {
    expect(writeBlockedReason(ready)).toBeNull()
    expect(writeBlockedReason({ state: 'off' })).toBeNull()
    expect(writeBlockedReason({ state: 'locked' })).toBeNull()
  })

  it('names the reset date when the month is used up', () => {
    const out = allowanceFrom({
      quota: 10,
      used: 10,
      oldestCountedAt: '2026-10-04T00:00:00.000Z',
      dailyUsed: 0,
    })
    expect(writeBlockedReason(out)).toBe('No drafts left this month. More on November 3.')
  })

  it('names the daily limit and what is left this month', () => {
    const day = allowanceFrom({ quota: 10, used: 4, oldestCountedAt: null, dailyUsed: 10 })
    expect(writeBlockedReason(day)).toBe(
      `That's ${RATE_LIMIT_PER_LISTING_24H} drafts for this page today. You can ask again tomorrow. You still have 6 left this month.`
    )
  })
})

describe('copy', () => {
  it('uses the agreed button and no AI label or em dash', () => {
    expect(WRITE_BUTTON.listing_description).toBe('Write one for me')
    const all = [...Object.values(WRITE_BUTTON), CLOSING_NOTE].join(' ')
    expect(all).not.toMatch(/\bAI\b/)
    expect(all).not.toContain('—')
  })
})

describe('pickOpenSuggestions', () => {
  it('keeps the newest open suggestion per field and labels samples', () => {
    const picked = pickOpenSuggestions([
      { id: 'n1', agent_type: 'seo_coach_title', suggestion_text: 'Newest', metadata: { provider: 'mock' } },
      { id: 'o1', agent_type: 'seo_coach_title', suggestion_text: 'Older', metadata: null },
      { id: 'd1', agent_type: 'listing_description', suggestion_text: 'About', metadata: { provider: 'anthropic' } },
    ])
    expect(picked.seo_coach_title).toEqual({ id: 'n1', text: 'Newest', sample: true })
    expect(picked.listing_description).toEqual({ id: 'd1', text: 'About', sample: false })
  })

  it('leaves out the analytics summary and empty text', () => {
    const picked = pickOpenSuggestions([
      { id: 'a1', agent_type: 'analytics_explainer', suggestion_text: 'Numbers', metadata: null },
      { id: 'e1', agent_type: 'seo_coach_description', suggestion_text: '  ', metadata: null },
    ])
    expect(picked).toEqual({})
  })
})
