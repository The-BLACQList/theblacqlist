// =============================================================================
// Cue, the site assistant (ticket 148): the pure pieces
// =============================================================================
// Near words, negated places, need names, the opener checks, the page parser
// and its action allow-list, the wording, the examples and the chat store's
// follow-up helpers. The action half lives in tests/ai-assistant.test.ts.
// =============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssistantResponse } from '@/lib/ai/assistant-limits'
import {
  ASSISTANT_OPENER_MAX,
  ASSISTANT_SYSTEM_PROMPT,
  buildAssistantSummary,
  checkOpener,
  cleanNeedName,
  inSentence,
  nearMilesLine,
  positivePlaceText,
  resolvePrevious,
  typedWords,
  type AssistantAllowList,
} from '@/lib/ai/assistant'
import { GUIDE_MAX_PROMPT_CHARS } from '@/lib/ai/guide'
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
  getAssistantState,
  lastWasNear,
  previousFor,
  resetAssistantStoreForTests,
} from '@/lib/assistant/store'

const ALLOW: AssistantAllowList = {
  categories: [
    { id: 'c-food', slug: 'food-dining', name: 'Food & Dining', parentId: null },
    { id: 'c-groc', slug: 'grocery-markets', name: 'Grocery & Markets', parentId: 'c-food' },
    { id: 'c-barber', slug: 'barbershops', name: 'Barbershops', parentId: null },
  ],
  cities: [
    { slug: 'detroit', name: 'Detroit' },
    { slug: 'atlanta', name: 'Atlanta' },
  ],
}

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

// ─── Negated places ──────────────────────────────────────────────────────────

describe('positivePlaceText', () => {
  it('drops a place the visitor turns down', () => {
    expect(positivePlaceText('chicago is not near me')).toBe('')
    expect(positivePlaceText("chicago isn't nearby me")).toBe('')
    expect(positivePlaceText('a dentist, not in Chicago')).toBe('a dentist')
    expect(positivePlaceText("I don't want Chicago")).toBe('I')
  })

  it('keeps everything else', () => {
    expect(positivePlaceText('soul food in Atlanta')).toBe('soul food in Atlanta')
    expect(positivePlaceText('no rush, braids in Atlanta')).toBe('no rush, braids in Atlanta')
    expect(positivePlaceText('not Chicago but Atlanta')).toContain('Atlanta')
  })
})

// ─── Need names ──────────────────────────────────────────────────────────────

describe('cleanNeedName', () => {
  it('takes who-owns-it words out and capitalizes the first letter', () => {
    expect(cleanNeedName('black owned produce')).toBe('Produce')
    expect(cleanNeedName('Black-owned bath products')).toBe('Bath products')
    expect(cleanNeedName('soul food vendors')).toBe('Soul food')
  })

  it('falls back to the category name when nothing is left', () => {
    expect(cleanNeedName('black owned', 'Grocery & Markets')).toBe('Grocery & Markets')
    expect(cleanNeedName('black owned')).toBeNull()
    expect(cleanNeedName('<b>bad</b>', 'Barbershops')).toBe('Barbershops')
  })

  it('keeps a cuisine capitalized inside a sentence', () => {
    expect(inSentence('Thai restaurant')).toBe('Thai restaurant')
    expect(inSentence('Produce')).toBe('produce')
    expect(inSentence('DJ')).toBe('DJ')
  })
})

// ─── Follow-ups ──────────────────────────────────────────────────────────────

describe('resolvePrevious', () => {
  const typed = typedWords('in atlanta', ['How do I find black owned produce?'])

  it('checks the last answer like a new one', () => {
    const out = resolvePrevious(
      [
        { name: 'black owned produce', plan: { category: 'grocery-markets', keywords: ['produce', 'owned'], openNow: false } },
        { name: 'Produce', plan: { category: 'grocery-markets', keywords: [], openNow: false } },
        { name: 'Dentist', plan: { category: 'made-up', keywords: ['dentist'], openNow: true } },
        { name: 'Ghost', plan: { category: 'made-up', keywords: ['spooky'], openNow: false } },
      ],
      ALLOW,
      typed
    )
    expect(out).toEqual([
      { name: 'Produce', category: ALLOW.categories[1], keywords: ['produce'], openNow: false },
      { name: 'Dentist', category: null, keywords: ['dentist'], openNow: true },
    ])
  })
})

// ─── Opener ──────────────────────────────────────────────────────────────────

describe('checkOpener', () => {
  const allow = { names: ['Detroit', 'Atlanta', 'Produce', "Mama's Kitchen"], numbers: ['4.8', '12'] }

  it('keeps a short plain sentence', () => {
    expect(checkOpener("  Happy to help you plan a party   in Detroit. ", allow)).toBe(
      'Happy to help you plan a party in Detroit.'
    )
    expect(checkOpener("Mama's Kitchen is rated 4.8 from 12 reviews.", allow)).toBe(
      "Mama's Kitchen is rated 4.8 from 12 reviews."
    )
    expect(checkOpener("Sure. I'll look for Black-owned produce in Atlanta.", allow)).not.toBeNull()
  })

  it('drops links, emails and markup', () => {
    for (const text of [
      'Try https://spam.example for more.',
      'Visit www.example.com today.',
      'Email me at a@b.co please.',
      'Check example.com for this.',
      'Here is <b>bold</b>.',
      'Use `code` here.',
    ]) {
      expect(checkOpener(text, allow), text).toBeNull()
    }
  })

  it('drops numbers the page does not show, so never a phone number', () => {
    expect(checkOpener('Call 313 555 0101 now.', allow)).toBeNull()
    expect(checkOpener('They are rated 5.0 here.', allow)).toBeNull()
  })

  it('drops names we do not list', () => {
    expect(checkOpener('I love Houston for this.', allow)).toBeNull()
    expect(checkOpener('Try Starbucks instead.', allow)).toBeNull()
  })

  it('drops claims about results, since it is written before any search', () => {
    for (const text of ['I found three for you.', 'Here are the best ones.', 'These are the top spots.']) {
      expect(checkOpener(text, allow), text).toBeNull()
    }
  })

  it('keeps to the length cap', () => {
    expect(checkOpener('a'.repeat(ASSISTANT_OPENER_MAX), allow)).not.toBeNull()
    expect(checkOpener('a'.repeat(ASSISTANT_OPENER_MAX + 1), allow)).toBeNull()
    expect(checkOpener('', allow)).toBeNull()
    expect(checkOpener(null, allow)).toBeNull()
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

// ─── Wording ─────────────────────────────────────────────────────────────────

describe('Cue wording', () => {
  it('gives the miles when Near me had to go wider', () => {
    expect(nearMilesLine(10, 'Atlanta', 75, 3)).toBe(
      'Nothing within 10 miles of you yet. The closest is in Atlanta, about 75 miles away. Atlanta has 3.'
    )
    expect(nearMilesLine(10, 'Atlanta', 1, 1)).toContain('about 1 mile away')
    expect(nearMilesLine(10, 'Atlanta', null, 2)).toBe(
      'Nothing within 10 miles of you yet. The closest is in Atlanta. Atlanta has 2.'
    )
  })

  it('never says found for an answer from every city', () => {
    const national = buildAssistantSummary([{ status: 'found', total: 2 }], true)
    expect(national).toBe('Cue looked in every city we list: 2 places.')
    expect(buildAssistantSummary([{ status: 'found', total: 2 }, { status: 'none', total: 0 }], true)).not.toMatch(/found/)
  })

  it('uses no em dashes in the fixed lines or the prompt', () => {
    expect(ASSISTANT_SYSTEM_PROMPT).not.toContain('—')
    expect(nearMilesLine(10, 'Atlanta', 75, 3)).not.toContain('—')
  })

  it('keeps the system prompt within the prompt limit', () => {
    expect(ASSISTANT_SYSTEM_PROMPT.length).toBeLessThanOrEqual(GUIDE_MAX_PROMPT_CHARS)
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

function nearAnswer(near: boolean): AssistantResponse {
  return {
    kind: 'answer',
    heading: 'Dentist near you',
    opener: "Let's find you a dentist.",
    notice: null,
    summary: 'Cue found 1 place.',
    needs: [
      { name: 'Dentist', status: 'found', line: '1 place near you', total: 1, top: [], seeAllHref: null, plan: { category: null, keywords: ['dentist'], openNow: false } },
      { name: 'Nothing', status: 'none', line: "We don't have this on The BLACQList yet.", total: 0, top: [], seeAllHref: null, plan: { category: null, keywords: [], openNow: false } },
    ],
    nameMatches: [],
    page: null,
    searchHref: '/search?q=dentist',
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

  it('sends back the last answer plans only, skipping needs with nothing to search', () => {
    addTurn('a dentist near by?', nearAnswer(true))
    const { turns } = getAssistantState()
    expect(previousFor(turns)).toEqual([{ name: 'Dentist', plan: { category: null, keywords: ['dentist'], openNow: false } }])
    expect(lastWasNear(turns)).toBe(true)
  })

  it('forgets near after an answer that was not near, or a fallback', () => {
    addTurn('a dentist near by?', nearAnswer(true))
    addTurn('in atlanta', nearAnswer(false))
    expect(lastWasNear(getAssistantState().turns)).toBe(false)
    addTurn('a dentist near by?', nearAnswer(true))
    addTurn('???', { kind: 'fallback', href: '/search?q=%3F%3F%3F', reason: 'error' })
    expect(lastWasNear(getAssistantState().turns)).toBe(false)
    expect(previousFor(getAssistantState().turns)).toEqual([])
  })

  it('keeps the near flag but never a position', () => {
    addTurn('a dentist near by?', nearAnswer(true))
    const saved = storage.getItem(ASSISTANT_STORAGE_KEY) ?? ''
    expect(saved).toContain('"near":true')
    expect(saved).not.toMatch(/lat|lng|latitude|longitude/)
  })
})
