// =============================================================================
// The support post's privacy rules (ticket 183)
// =============================================================================
// Pinned here:
//   * only a business on The BLACQList gets a post, always named, linking to
//     its page; an unmatched receipt has no post and redirects;
//   * only an approved receipt is "verified";
//   * a receipt off the map never claims The Collective;
//   * someone else's receipt is a 404, a needs-a-fix receipt redirects;
//   * the post carries no amount (the type has none to carry).
// =============================================================================

import { describe, expect, it } from 'vitest'

import {
  buildSupportPost,
  supportDateLabel,
  supportScreen,
  supportShareHref,
  supportStage,
  type SupportReceipt,
} from '@/lib/share/supportCard'

const ORIGIN = 'https://theblacqlist.com/'

function receipt(over: Partial<SupportReceipt> = {}): SupportReceipt {
  return {
    user_id: 'u1',
    status: 'pending_review',
    purchase_date: '2026-11-03',
    listing_id: 'l1',
    aggregate_opt_out: false,
    listings: {
      name: "Mama's Kitchen",
      slug: 'mamas-kitchen',
      entity_type: 'business',
      cities: { name: 'Atlanta', state_abbr: 'GA', slug: 'atlanta' },
    },
    ...over,
  }
}

describe('supportStage', () => {
  it('maps status to stage', () => {
    expect(supportStage('pending_review')).toBe('supported')
    expect(supportStage('approved')).toBe('verified')
    expect(supportStage('rejected')).toBeNull()
    expect(supportStage('anything')).toBeNull()
  })
})

describe('supportScreen', () => {
  it('shows the owner a pending or approved receipt', () => {
    expect(supportScreen({ readFailed: false, receipt: receipt(), viewerId: 'u1' })).toBe('show')
    expect(
      supportScreen({ readFailed: false, receipt: receipt({ status: 'approved' }), viewerId: 'u1' })
    ).toBe('show')
  })
  it("404s someone else's receipt and a missing one", () => {
    expect(supportScreen({ readFailed: false, receipt: receipt(), viewerId: 'u2' })).toBe(
      'not_found'
    )
    expect(supportScreen({ readFailed: false, receipt: null, viewerId: 'u1' })).toBe('not_found')
  })
  it('redirects a needs-a-fix receipt, errors on a failed read', () => {
    expect(
      supportScreen({ readFailed: false, receipt: receipt({ status: 'rejected' }), viewerId: 'u1' })
    ).toBe('redirect')
    expect(supportScreen({ readFailed: true, receipt: null, viewerId: 'u1' })).toBe('error')
  })
  it('redirects a receipt for a business that is not on The BLACQList', () => {
    for (const status of ['pending_review', 'approved']) {
      expect(
        supportScreen({
          readFailed: false,
          receipt: receipt({ status, listing_id: null, listings: null }),
          viewerId: 'u1',
        })
      ).toBe('redirect')
    }
  })
})

describe('supportDateLabel', () => {
  it('formats a calendar date without shifting it', () => {
    expect(supportDateLabel('2026-11-03')).toBe('Nov 3, 2026')
    expect(supportDateLabel('2026-01-31')).toBe('Jan 31, 2026')
  })
  it('returns null for junk', () => {
    expect(supportDateLabel(null)).toBeNull()
    expect(supportDateLabel('11/03/2026')).toBeNull()
    expect(supportDateLabel('2026-13-01')).toBeNull()
  })
})

describe('buildSupportPost', () => {
  it('names the business and links to its page', () => {
    const post = buildSupportPost({ origin: ORIGIN, receipt: receipt() })!
    expect(post.businessLabel).toBe("Mama's Kitchen")
    expect(post.cityLabel).toBe('Atlanta, GA')
    expect(post.dateLabel).toBe('Nov 3, 2026')
    expect(post.url).toBe('https://theblacqlist.com/atlanta/business/mamas-kitchen')
    expect(post.caption).toContain("I supported Mama's Kitchen")
    expect(post.caption).not.toContain('Verified')
  })

  it('has no post for a business that is not on The BLACQList', () => {
    for (const status of ['pending_review', 'approved']) {
      expect(
        buildSupportPost({
          origin: ORIGIN,
          receipt: receipt({ status, listing_id: null, listings: null }),
        })
      ).toBeNull()
    }
  })

  it('has no post when the listing read came back empty', () => {
    expect(buildSupportPost({ origin: ORIGIN, receipt: receipt({ listings: null }) })).toBeNull()
  })

  it('says verified only once approved', () => {
    const post = buildSupportPost({ origin: ORIGIN, receipt: receipt({ status: 'approved' }) })!
    expect(post.stage).toBe('verified')
    expect(post.caption).toContain('Verified by The BLACQList')
  })

  it('has no post for a needs-a-fix receipt', () => {
    expect(
      buildSupportPost({ origin: ORIGIN, receipt: receipt({ status: 'rejected' }) })
    ).toBeNull()
  })

  it("doesn't claim The Collective for a receipt kept out of the totals", () => {
    const post = buildSupportPost({
      origin: ORIGIN,
      receipt: receipt({ aggregate_opt_out: true }),
    })!
    expect(post.collective).toBe(false)
    expect(post.businessLabel).toBe("Mama's Kitchen")
  })

  it('uses the online segment for a business with no city', () => {
    const r = receipt()
    r.listings!.cities = null
    const post = buildSupportPost({ origin: ORIGIN, receipt: r })!
    expect(post.url).toBe('https://theblacqlist.com/online/business/mamas-kitchen')
    expect(post.cityLabel).toBeNull()
  })

  it('never carries a dollar sign', () => {
    for (const status of ['pending_review', 'approved']) {
      const post = buildSupportPost({ origin: ORIGIN, receipt: receipt({ status }) })!
      expect(JSON.stringify(post)).not.toMatch(/\$/)
    }
  })
})

describe('supportShareHref', () => {
  it('marks a fresh upload', () => {
    expect(supportShareHref('abc')).toBe('/account/receipts/abc/share')
    expect(supportShareHref('abc', { isNew: true })).toBe('/account/receipts/abc/share?new=1')
  })
})
