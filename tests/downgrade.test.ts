import { describe, expect, it } from 'vitest'
import {
  capDescription,
  capList,
  hiddenLine,
  isDowngraded,
  shownLimits,
} from '@/lib/stripe/downgrade'
import { hiddenContent, type HiddenContentInput } from '@/lib/listings/hiddenContent'

// Ticket 105: after a move to a lower plan, content over the new limits is
// hidden on the page, never deleted, and comes back on upgrade.

describe('isDowngraded', () => {
  it('is true only when the plan ranks below the best plan the page has had', () => {
    expect(isDowngraded('starter', 'growth')).toBe(true)
    expect(isDowngraded('free', 'starter')).toBe(true)
    expect(isDowngraded('growth', 'growth')).toBe(false)
    expect(isDowngraded('premium', 'growth')).toBe(false)
  })

  it('never trims a page that has not paid', () => {
    expect(isDowngraded('free', null)).toBe(false)
    expect(isDowngraded(null, null)).toBe(false)
  })
})

describe('shownLimits', () => {
  it('shows everything on the best plan so far', () => {
    expect(shownLimits('starter', 'starter')).toEqual({
      photos: null,
      videos: null,
      faqs: null,
      attributes: null,
      events: null,
      descriptionChars: null,
    })
  })

  it('applies the lower plan limits after a downgrade', () => {
    expect(shownLimits('starter', 'growth')).toEqual({
      photos: 10,
      videos: 1,
      faqs: 5,
      attributes: 10,
      events: 0,
      descriptionChars: null,
    })
    expect(shownLimits('free', 'starter')).toMatchObject({
      photos: 1,
      videos: 0,
      faqs: 0,
      attributes: 3,
      descriptionChars: 300,
    })
  })

  it('lifts every cap again once the page is back on its best plan', () => {
    expect(shownLimits('growth', 'growth').videos).toBeNull()
  })
})

describe('capList', () => {
  it('keeps the first items in display order and hides the rest', () => {
    expect(capList(['a', 'b', 'c', 'd'], 2)).toEqual({ shown: ['a', 'b'], hidden: ['c', 'd'] })
  })

  it('hides nothing at or under the limit, or with no limit', () => {
    expect(capList(['a', 'b'], 2)).toEqual({ shown: ['a', 'b'], hidden: [] })
    expect(capList(['a', 'b'], null)).toEqual({ shown: ['a', 'b'], hidden: [] })
  })

  it('hides everything at a limit of zero', () => {
    expect(capList(['a'], 0)).toEqual({ shown: [], hidden: ['a'] })
  })

  it('does not change the list it was given', () => {
    const items = ['a', 'b', 'c']
    capList(items, 1)
    expect(items).toEqual(['a', 'b', 'c'])
  })
})

describe('capDescription', () => {
  it('leaves short text alone', () => {
    expect(capDescription('Fresh bread daily.', 300)).toBe('Fresh bread daily.')
    expect(capDescription('x'.repeat(500), null)).toBe('x'.repeat(500))
  })

  it('cuts at the last whole word and fits the limit with the ellipsis', () => {
    const out = capDescription('We bake sourdough every single morning', 20)
    expect(out).toBe('We bake sourdough…')
    expect(out.length).toBeLessThanOrEqual(20)
  })

  it('cuts a single long word mid-word rather than showing nothing', () => {
    const out = capDescription('a'.repeat(50), 10)
    expect(out).toBe(`${'a'.repeat(9)}…`)
  })

  it('shows nothing at a limit of zero', () => {
    expect(capDescription('Anything', 0)).toBe('')
  })
})

describe('hiddenLine', () => {
  it('counts one and many, with the plan limit', () => {
    expect(hiddenLine({ kind: 'photos', hidden: 3, limit: 10 })).toBe(
      '3 photos are hidden on your page. Your plan shows up to 10 photos.'
    )
    expect(hiddenLine({ kind: 'videos', hidden: 1, limit: 1 })).toBe(
      '1 video is hidden on your page. Your plan shows up to 1 video.'
    )
  })

  it('says the plan does not include a kind when its limit is zero', () => {
    expect(hiddenLine({ kind: 'faqs', hidden: 2, limit: 0 })).toBe(
      "2 common questions are hidden on your page. Your plan doesn't include common questions."
    )
  })

  it('names the storefront when products or services are hidden', () => {
    expect(hiddenLine({ kind: 'products', hidden: 3, limit: 0 })).toBe(
      "3 products are hidden on your page. Your plan doesn't include a storefront."
    )
    expect(hiddenLine({ kind: 'services', hidden: 1, limit: 0 })).toBe(
      "1 service is hidden on your page. Your plan doesn't include a storefront."
    )
  })

  it('explains the description is saved in full', () => {
    expect(hiddenLine({ kind: 'description', hidden: 1, limit: 300 })).toBe(
      'Your page shows the first 300 characters of your description. The rest is saved.'
    )
  })

  it('never promises an upgrade (Growth and Premium are not for sale yet)', () => {
    for (const kind of ['photos', 'videos', 'faqs', 'attributes', 'events'] as const) {
      expect(hiddenLine({ kind, hidden: 2, limit: 1 })).not.toMatch(/upgrade/i)
    }
  })
})

function input(over: Partial<HiddenContentInput> = {}): HiddenContentInput {
  return {
    tier: 'starter',
    peakTier: 'growth',
    description: 'Short.',
    media: [],
    videos: [],
    faqs: [],
    attributeGroups: [],
    selectedValueIds: [],
    ...over,
  }
}

const ids = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i + 1}` }))

describe('hiddenContent', () => {
  it('finds nothing hidden on the best plan so far', () => {
    const out = hiddenContent(
      input({
        tier: 'growth',
        videos: ids('v', 3),
        media: ids('m', 20).map((m) => ({ ...m, is_approved: true })),
      })
    )
    expect(out.counts).toEqual([])
    expect(out.hiddenIds.size).toBe(0)
  })

  it('tags the videos past the lower plan limit, in order', () => {
    const out = hiddenContent(input({ videos: ids('v', 3) }))
    expect(out.counts).toEqual([{ kind: 'videos', hidden: 2, limit: 1 }])
    expect([...out.hiddenIds]).toEqual(['v2', 'v3'])
  })

  it('counts approved photos only, so a pending one never pushes a live one out', () => {
    const media = [
      ...ids('m', 10).map((m) => ({ ...m, is_approved: true })),
      { id: 'pending', is_approved: false },
      { id: 'm11', is_approved: true },
    ]
    const out = hiddenContent(input({ media }))
    expect(out.counts).toEqual([{ kind: 'photos', hidden: 1, limit: 10 }])
    expect([...out.hiddenIds]).toEqual(['m11'])
  })

  it('skips unfinished questions, which the page never shows', () => {
    const faqs = [
      ...ids('f', 5).map((f) => ({ ...f, question: 'Q', answer: 'A' })),
      { id: 'blank', question: 'Q', answer: '' },
      { id: 'f6', question: 'Q', answer: 'A' },
    ]
    const out = hiddenContent(input({ faqs }))
    expect(out.counts).toEqual([{ kind: 'faqs', hidden: 1, limit: 5 }])
    expect([...out.hiddenIds]).toEqual(['f6'])
  })

  it('counts filter details outside the creator groups only', () => {
    const out = hiddenContent(
      input({
        tier: 'free',
        peakTier: 'starter',
        attributeGroups: [
          { slug: 'amenities', values: ids('a', 5) },
          { slug: 'creator-platforms', values: ids('c', 3) },
        ],
        selectedValueIds: ['a1', 'a2', 'a3', 'a4', 'a5', 'c1', 'c2'],
      })
    )
    expect(out.counts).toContainEqual({ kind: 'attributes', hidden: 2, limit: 3 })
  })

  it('flags a description longer than the lower plan shows', () => {
    const out = hiddenContent(
      input({ tier: 'free', peakTier: 'starter', description: 'x'.repeat(301) })
    )
    expect(out.counts).toContainEqual({ kind: 'description', hidden: 1, limit: 300 })
  })
})
