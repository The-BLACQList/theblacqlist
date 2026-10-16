// =============================================================================
// requestOnboardingDraftsAction (ticket 128): the flag, ownership, fallbacks
// =============================================================================
// The session, the request client, the owner-name loader and generate() are
// mocked. Checks that a flag that is off makes no call, that only the owner of
// a new draft gets drafts, that Free owners are allowed, and that every refusal
// comes back as simple drafts with one plain line.
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

const flags = { aiOnboarding: true }
const session = { user: { id: '55555555-5555-4555-8555-555555555555', email: 'owner@example.test' } as
  | { id: string; email: string }
  | null }
const listing = {
  row: null as Record<string, unknown> | null,
}
const categoryRows = {
  rows: [
    { id: '11111111-1111-4111-8111-111111111111', name: 'Barber Shops', slug: 'barber-shops', parent_id: '33333333-3333-4333-8333-333333333333' },
    { id: '33333333-3333-4333-8333-333333333333', name: 'Beauty & Personal Care', slug: 'beauty', parent_id: null },
  ] as Array<Record<string, unknown>>,
}
const ownerNames = { result: { ok: true, names: ['Andre Mills'] } as { ok: true; names: string[] } | { ok: false } }
const listingFilters: Array<[string, unknown]> = []

vi.mock('@/lib/env', () => ({
  isFeatureEnabled: (name: string) => (name === 'aiOnboarding' ? flags.aiOnboarding : false),
}))
vi.mock('@/lib/dashboard/guard', () => ({ getOwnerSession: async () => (session.user ? { user: session.user } : null) }))
vi.mock('@/lib/dashboard/revalidateEditors', () => ({ revalidateOwnerEditors: vi.fn() }))
vi.mock('@/lib/ai/ownerName', () => ({ loadOwnerNames: async () => ownerNames.result }))
vi.mock('@/lib/ai/provider', () => ({ generate: vi.fn() }))

function requestClient() {
  return {
    from: (table: string) => {
      const builder: Record<string, unknown> = {}
      const chain = () => builder
      for (const m of ['select', 'is', 'order']) builder[m] = chain
      builder.eq = (col: string, value: unknown) => {
        if (table === 'listings') listingFilters.push([col, value])
        return builder
      }
      builder.maybeSingle = async () => {
        // Mirrors the real query: the row only comes back for its owner.
        const owner = listingFilters.find(([c]) => c === 'owner_user_id')?.[1]
        const row = listing.row && listing.row.owner_user_id === owner ? listing.row : null
        return { data: row, error: null }
      }
      builder.then = (resolve: (v: unknown) => unknown) => resolve({ data: categoryRows.rows, error: null })
      return builder
    },
  }
}
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => requestClient() }))

import { generate, type OnboardingGenerateInput, type OnboardingGenerateResult } from '@/lib/ai/provider'
import { requestOnboardingDraftsAction } from '@/lib/actions/ai/onboardingDrafts'
import { DAY_LIMIT_LINE, FALLBACK_LINE, PAGE_LIMIT_LINE } from '@/lib/ai/onboarding'

// generate() is overloaded; the action only uses the onboarding overload.
const generateMock = vi.mocked(
  generate as unknown as (input: OnboardingGenerateInput) => Promise<OnboardingGenerateResult>
)

const LISTING_ID = '44444444-4444-4444-8444-444444444444'
const REQUEST = { listingId: LISTING_ID, style: 'fresh', focus: 'all', aboutFromSite: false } as const

const DRAFTS = {
  category: { kind: 'existing' as const, categoryId: '11111111-1111-4111-8111-111111111111', name: 'Barber Shops' },
  tagline: 'Clean fades in Atlanta.',
  about: 'x'.repeat(120),
  searchTitle: 'Fresh Fade Barbershop',
  searchDescription: 'Clean fades and beard trims for the whole family in Atlanta.',
}

function draftRow(patch: Record<string, unknown> = {}) {
  return {
    id: LISTING_ID,
    name: 'Fresh Fade Barbershop',
    status: 'draft',
    entity_type: 'business',
    category_id: null,
    owner_user_id: session.user?.id,
    cities: { name: 'Atlanta', states: { code: 'GA' } },
    listing_details_business: { description: 'Clean fades and beard trims.', city_text: null, state: null },
    ...patch,
  }
}

beforeEach(() => {
  flags.aiOnboarding = true
  session.user = { id: '55555555-5555-4555-8555-555555555555', email: 'owner@example.test' }
  listing.row = draftRow()
  ownerNames.result = { ok: true, names: ['Andre Mills'] }
  listingFilters.length = 0
  generateMock.mockReset()
  generateMock.mockResolvedValue({ ok: true, drafts: DRAFTS, provider: 'mock' })
})

describe('requestOnboardingDraftsAction', () => {
  it('makes no call when the flag is off', async () => {
    flags.aiOnboarding = false
    const result = await requestOnboardingDraftsAction(REQUEST)
    expect(result).toMatchObject({ ok: false, code: 'off' })
    expect(generateMock).not.toHaveBeenCalled()
  })

  it('asks a signed-out visitor to sign in, with no call', async () => {
    session.user = null
    expect(await requestOnboardingDraftsAction(REQUEST)).toMatchObject({ ok: false, code: 'auth' })
    expect(generateMock).not.toHaveBeenCalled()
  })

  it('refuses a page the caller does not own', async () => {
    listing.row = draftRow({ owner_user_id: '99999999-9999-4999-8999-999999999999' })
    expect(await requestOnboardingDraftsAction(REQUEST)).toMatchObject({ ok: false, code: 'invalid' })
    expect(generateMock).not.toHaveBeenCalled()
  })

  it.each([
    ['a live page', { status: 'published' }],
    ['a creator page', { entity_type: 'creator' }],
  ])('refuses %s', async (_label, patch) => {
    listing.row = draftRow(patch)
    expect(await requestOnboardingDraftsAction(REQUEST)).toMatchObject({ ok: false, code: 'invalid' })
    expect(generateMock).not.toHaveBeenCalled()
  })

  it.each([
    ['a bad id', { ...REQUEST, listingId: 'not-a-uuid' }],
    ['an unknown style', { ...REQUEST, style: 'louder' }],
    ['an unknown focus', { ...REQUEST, focus: 'price' }],
  ])('refuses %s', async (_label, input) => {
    const result = await requestOnboardingDraftsAction(input as unknown as typeof REQUEST)
    expect(result).toMatchObject({ ok: false, code: 'invalid' })
    expect(generateMock).not.toHaveBeenCalled()
  })

  it('allows a Free owner: no plan is read and the drafts come back', async () => {
    // A brand new draft page has no subscription row at all.
    const result = await requestOnboardingDraftsAction(REQUEST)
    expect(generateMock).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ ok: true, drafts: DRAFTS, fallbackLine: null, capped: false, sample: true })
  })

  it('passes only the allowlisted context, and the owner names only for redaction', async () => {
    await requestOnboardingDraftsAction(REQUEST)
    const input = generateMock.mock.calls[0]?.[0] as unknown as Record<string, unknown>
    expect(input).toMatchObject({ kind: 'onboarding', listingId: LISTING_ID, ownerNames: ['Andre Mills'] })
    expect(Object.keys(input.context as object).sort()).toEqual(
      ['businessName', 'candidates', 'cityName', 'groups', 'importedAbout', 'ownerWords'].sort()
    )
    expect(JSON.stringify(input.context)).not.toContain('owner@example.test')
  })

  it.each([
    ['page', PAGE_LIMIT_LINE],
    ['day', DAY_LIMIT_LINE],
  ] as const)('a %s cap gives simple drafts, its line, and hides Try again', async (scope, line) => {
    generateMock.mockResolvedValue({ ok: false, code: 'rate_limited', scope })
    const result = await requestOnboardingDraftsAction(REQUEST)
    expect(result).toMatchObject({ ok: true, fallbackLine: line, capped: true, sample: false })
    if (result.ok) expect(result.drafts.tagline).toBe('Clean fades and beard trims.')
  })

  it.each([
    { ok: false, code: 'paused' },
    { ok: false, code: 'failed' },
    { ok: false, code: 'rejected', reason: 'not_a_candidate' },
  ] as const)('a refusal ($code) falls back quietly with one line', async (refusal) => {
    generateMock.mockResolvedValue(refusal)
    const result = await requestOnboardingDraftsAction(REQUEST)
    expect(result).toMatchObject({ ok: true, fallbackLine: FALLBACK_LINE, capped: false })
    if (result.ok) {
      expect(result.drafts.category).toMatchObject({ kind: 'existing', name: 'Barber Shops' })
      expect(result.drafts.searchTitle.length).toBeGreaterThan(0)
    }
  })

  it('falls back with no call when the owner name cannot be read', async () => {
    ownerNames.result = { ok: false }
    const result = await requestOnboardingDraftsAction(REQUEST)
    expect(generateMock).not.toHaveBeenCalled()
    expect(result).toMatchObject({ ok: true, fallbackLine: FALLBACK_LINE })
  })

  it('falls back with no call when there are no categories', async () => {
    const saved = categoryRows.rows
    categoryRows.rows = []
    try {
      const result = await requestOnboardingDraftsAction(REQUEST)
      expect(generateMock).not.toHaveBeenCalled()
      expect(result).toMatchObject({ ok: true, fallbackLine: FALLBACK_LINE })
      if (result.ok) expect(result.drafts.category).toBeNull()
    } finally {
      categoryRows.rows = saved
    }
  })
})
