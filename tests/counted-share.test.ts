import { describe, expect, it } from 'vitest'

import { buildCountedShare, countedShareMessage } from '@/lib/spend/counted-share'

// Ticket 166, Part C: what the counted screen's Share button sends.

const base = {
  origin: 'https://theblacqlist.com',
  businessName: 'Sweet Auburn Bakery',
  businessPath: '/atlanta/business/sweet-auburn-bakery',
  amountCents: 2450,
}

describe('buildCountedShare', () => {
  it('names an opted-in business and links its page, with no amount by default', () => {
    expect(buildCountedShare({ ...base, businessNameOptIn: true, includeAmount: false })).toEqual({
      text: 'I shopped at Sweet Auburn Bakery and added my receipt to The Collective on The BLACQList.',
      url: 'https://theblacqlist.com/atlanta/business/sweet-auburn-bakery',
    })
  })

  it('adds the amount only when the switch is on', () => {
    const share = buildCountedShare({ ...base, businessNameOptIn: true, includeAmount: true })
    expect(share.text).toBe(
      'I spent $24.50 at Sweet Auburn Bakery and added my receipt to The Collective on The BLACQList.'
    )
  })

  it('never names a business that has not opted in, and links to /flow-map', () => {
    for (const includeAmount of [false, true]) {
      const share = buildCountedShare({ ...base, businessNameOptIn: false, includeAmount })
      expect(share.text).not.toContain('Sweet Auburn')
      expect(share.text).toContain('a local business')
      expect(share.url).toBe('https://theblacqlist.com/flow-map')
    }
  })

  it('keeps the amount out of the not-opted-in text when the switch is off', () => {
    const share = buildCountedShare({ ...base, businessNameOptIn: false, includeAmount: false })
    expect(share.text).toBe(
      'I shopped at a local business and added my receipt to The Collective on The BLACQList.'
    )
    expect(share.text).not.toContain('$')
  })

  it('falls back to /flow-map when an opted-in business has no page path', () => {
    const share = buildCountedShare({
      ...base,
      businessPath: null,
      businessNameOptIn: true,
      includeAmount: false,
    })
    expect(share.url).toBe('https://theblacqlist.com/flow-map')
  })

  it('trims a trailing slash on the origin', () => {
    const share = buildCountedShare({
      ...base,
      origin: 'https://theblacqlist.com/',
      businessNameOptIn: false,
      includeAmount: false,
    })
    expect(share.url).toBe('https://theblacqlist.com/flow-map')
  })

  it('has no em dashes', () => {
    const share = buildCountedShare({ ...base, businessNameOptIn: true, includeAmount: true })
    expect(countedShareMessage(share)).not.toContain('—')
  })
})

describe('countedShareMessage', () => {
  it('joins the text and the link for the clipboard', () => {
    const share = buildCountedShare({ ...base, businessNameOptIn: false, includeAmount: false })
    expect(countedShareMessage(share)).toBe(`${share.text} ${share.url}`)
  })
})
