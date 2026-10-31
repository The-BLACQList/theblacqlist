// =============================================================================
// Cue, the site assistant (tickets 148 and 169): the pure pieces
// =============================================================================
// Near words, the page parser and its action allow-list, the examples and the
// chat store's follow-up helpers. The chat loop lives in tests/cue-agent.test.ts.
// =============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CueReply } from '@/lib/ai/assistant-limits'
import { EXAMPLE_ASKS, pickExample, pickExamples } from '@/lib/assistant/examples'
import { wantsNearMe } from '@/lib/assistant/near'
import {
  businessPage,
  discoverPage,
  httpsHref,
  NO_PAGE,
  parsePagePath,
  pricingPage,
  resolvePageActions,
  staticPage,
  telHref,
  type BusinessPageFacts,
} from '@/lib/assistant/page'
import {
  addTurn,
  ASSISTANT_STORAGE_KEY,
  cardsFor,
  getAssistantState,
  lastWasNear,
  resetAssistantStoreForTests,
} from '@/lib/assistant/store'

// ─── Near words ──────────────────────────────────────────────────────────────

describe('near words', () => {
  it('hears near me in the ways people type it', () => {
    for (const text of [
      'a dentist near by?',
      'a barber nearby',
      'find me a barber close by',
      'anything around here',
      'tacos near here',
      'plumbers in my area',
      'the closest bakery',
      'braids near me',
    ]) {
      expect(wantsNearMe(text), text).toBe(true)
    }
  })

  it('does not hear it in a plain city ask', () => {
    for (const text of ['braids in Atlanta', 'a cafe near downtown Detroit', 'close the chat']) {
      expect(wantsNearMe(text), text).toBe(false)
    }
  })
})


// ─── Pages ───────────────────────────────────────────────────────────────────

describe('parsePagePath', () => {
  it('reads each kind of page', () => {
    expect(parsePagePath('/detroit/business/mamas-kitchen')).toEqual({
      kind: 'business',
      citySlug: 'detroit',
      entityType: 'business',
      listingSlug: 'mamas-kitchen',
    })
    expect(parsePagePath('/discover?category=soul-food&city=detroit&open_now=1')).toMatchObject({
      kind: 'discover',
      path: '/discover',
      category: 'soul-food',
      city: 'detroit',
      openNow: true,
    })
    expect(parsePagePath('/discover/atlanta')).toMatchObject({ kind: 'discover', city: 'atlanta', openNow: false })
    expect(parsePagePath('/pricing')).toEqual({ kind: 'pricing', path: '/pricing' })
    expect(parsePagePath('/guides/date-night')).toEqual({ kind: 'story', section: 'guides', slug: 'date-night' })
    expect(parsePagePath('/about/')).toEqual({ kind: 'other', path: '/about' })
  })

  it('refuses anything that is not a plain path here', () => {
    for (const raw of ['', 'pricing', '//evil.example/x', '/\\evil', 'https://evil.example/pricing']) {
      expect(parsePagePath(raw), raw).toBeNull()
    }
    expect(parsePagePath(null)).toBeNull()
    // A business route never comes from a top route or an unknown type.
    expect(parsePagePath('/pricing/business/x')?.kind).not.toBe('business')
    expect(parsePagePath('/detroit/spaceship/x')?.kind).toBe('other')
    // A slug with odd characters is not trusted.
    expect(parsePagePath('/discover?category=<script>')).toMatchObject({ category: null })
  })
})

const MAMAS: BusinessPageFacts = {
  id: 'l-1',
  name: "Mama's Kitchen",
  entityType: 'business',
  claimed: false,
  avgRating: 4.75,
  reviewCount: 12,
  categoryName: 'Soul Food',
  cityName: 'Detroit',
  stateCode: 'MI',
  street: '1 Main St',
  zip: '48201',
  phone: '(313) 555-0101',
  website: 'https://mamas.example',
  hasHours: true,
  lat: 42.33,
  lng: -83.05,
}

describe('page actions', () => {
  it('builds a business page from our row, never from the client', () => {
    const page = businessPage(MAMAS)
    expect(page.facts).toContain("Business page: Mama's Kitchen, Soul Food in Detroit, MI.")
    expect(page.facts).toContain('Rated 4.8 from 12 reviews.')
    expect(page.numbers).toEqual(['4.8', '12'])
    expect(page.names).toEqual(["Mama's Kitchen", 'Soul Food', 'Detroit'])
    expect(page.actions.hours).toEqual({ kind: 'scroll', ids: ['visit'], label: 'their hours' })
    expect(page.actions.call).toEqual({ kind: 'external', href: 'tel:3135550101', label: 'Call them' })
    expect(page.actions.website).toEqual({ kind: 'external', href: 'https://mamas.example/', label: 'Visit their website' })
    expect(page.actions.similar).toEqual({ kind: 'ask', text: 'More soul food in Detroit', label: 'More like this' })
    expect(page.actions.claim).toEqual({ kind: 'link', href: '/claim/l-1', label: 'Claim this page' })
    expect(page.actions.directions?.kind).toBe('external')
  })

  it('offers only safe links', () => {
    expect(telHref('555-01')).toBeNull()
    expect(telHref(null)).toBeNull()
    expect(httpsHref('http://mamas.example')).toBeNull()
    expect(httpsHref('javascript:alert(1)')).toBeNull()
    expect(httpsHref('not a url')).toBeNull()
    const page = businessPage({ ...MAMAS, phone: 'call us', website: 'http://mamas.example', claimed: true, hasHours: false })
    expect(page.actions).not.toHaveProperty('call')
    expect(page.actions).not.toHaveProperty('website')
    expect(page.actions).not.toHaveProperty('claim')
    expect(page.actions).not.toHaveProperty('hours')
  })

  it('says so when a business lists no hours', () => {
    expect(businessPage(MAMAS).facts).not.toContain('No hours listed.')
    expect(businessPage({ ...MAMAS, hasHours: false }).facts).toContain('No hours listed.')
    expect(businessPage({ ...MAMAS, hasHours: false, entityType: 'event' }).facts).not.toContain('No hours listed.')
  })

  it('offers open now on a search page only when it is not already on', () => {
    const ref = parsePagePath('/discover?category=soul-food&page=3')
    if (ref?.kind !== 'discover') throw new Error('expected a discover page')
    expect(discoverPage(ref).actions.open_now).toEqual({
      kind: 'link',
      href: '/discover?category=soul-food&open_now=1',
      label: 'Show only open now',
    })
    const on = parsePagePath('/discover?open_now=1')
    if (on?.kind !== 'discover') throw new Error('expected a discover page')
    expect(discoverPage(on).actions).toEqual({})
  })

  it('jumps to the plans on /pricing and links there from the other plan pages', () => {
    expect(pricingPage({ kind: 'pricing', path: '/pricing' }).actions.plans).toEqual({
      kind: 'scroll',
      ids: ['plans'],
      label: 'the plans',
    })
    expect(pricingPage({ kind: 'pricing', path: '/for-business' }).actions.compare).toMatchObject({ href: '/pricing' })
  })

  it('keeps only the codes the page offers, in the order picked', () => {
    const page = businessPage(MAMAS)
    expect(resolvePageActions(page, ['reviews', 'checkout', 'hours', 'sign_in']).map((a) => a.label)).toEqual([
      'the reviews',
      'their hours',
    ])
    expect(resolvePageActions(NO_PAGE, ['hours'])).toEqual([])
    expect(staticPage({ kind: 'other', path: '/' })).toBe(NO_PAGE)
  })
})


// ─── Examples ────────────────────────────────────────────────────────────────

describe('examples', () => {
  it('has about ten plain asks with no em dashes', () => {
    expect(EXAMPLE_ASKS.length).toBeGreaterThanOrEqual(8)
    for (const ask of EXAMPLE_ASKS) {
      expect(ask).not.toContain('—')
      expect(ask.length).toBeLessThanOrEqual(60)
    }
  })

  it('picks one in range for any random value', () => {
    expect(pickExample(() => 0)).toBe(EXAMPLE_ASKS[0])
    expect(pickExample(() => 0.999999)).toBe(EXAMPLE_ASKS[EXAMPLE_ASKS.length - 1])
    expect(pickExample(() => 1)).toBe(EXAMPLE_ASKS[EXAMPLE_ASKS.length - 1])
    expect(pickExample(() => -1)).toBe(EXAMPLE_ASKS[0])
  })

  it('picks three different ones, wrapping at the end', () => {
    const picks = pickExamples(3, () => 0.95)
    expect(picks).toHaveLength(3)
    expect(new Set(picks).size).toBe(3)
    expect(picks[1]).toBe(EXAMPLE_ASKS[0])
  })
})

// ─── Chat store ──────────────────────────────────────────────────────────────

class MemoryStorage {
  data = new Map<string, string>()
  getItem(k: string) {
    return this.data.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.data.set(k, v)
  }
  removeItem(k: string) {
    this.data.delete(k)
  }
}

function nearAnswer(near: boolean): CueReply {
  return {
    kind: 'reply',
    text: 'Here is a dentist near you.',
    cards: [
      {
        id: 'd1',
        name: 'Bright Smiles',
        href: '/atlanta/business/bright-smiles',
        categoryName: 'Dentists',
        cityLabel: 'Atlanta, GA',
        rating: null,
        reviewCount: 0,
        imageSrc: null,
      },
    ],
    actions: [],
    near,
  }
}

describe('chat store follow-ups', () => {
  let storage: MemoryStorage

  beforeEach(() => {
    storage = new MemoryStorage()
    vi.stubGlobal('window', { sessionStorage: storage })
    resetAssistantStoreForTests()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetAssistantStoreForTests()
  })

  it('sends back the last cards by id and name, and that it was near', () => {
    addTurn('a dentist near by?', nearAnswer(true))
    const { turns } = getAssistantState()
    expect(cardsFor(turns)).toEqual([{ id: 'd1', name: 'Bright Smiles' }])
    expect(lastWasNear(turns)).toBe(true)
  })

  it('forgets near after an answer that was not near, or a fallback', () => {
    addTurn('a dentist near by?', nearAnswer(true))
    addTurn('in atlanta', nearAnswer(false))
    expect(lastWasNear(getAssistantState().turns)).toBe(false)
    addTurn('a dentist near by?', nearAnswer(true))
    addTurn('???', { kind: 'fallback', href: '/search?q=%3F%3F%3F', reason: 'error' })
    expect(lastWasNear(getAssistantState().turns)).toBe(false)
    expect(cardsFor(getAssistantState().turns)).toEqual([])
  })

  it('keeps the near flag but never a position', () => {
    addTurn('a dentist near by?', nearAnswer(true))
    const saved = storage.getItem(ASSISTANT_STORAGE_KEY) ?? ''
    expect(saved).toContain('"near":true')
    expect(saved).not.toMatch(/lat|lng|latitude|longitude/)
  })
})
