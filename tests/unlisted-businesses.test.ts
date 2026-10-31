// =============================================================================
// Ticket 168: businesses shoppers buy from that are not on The BLACQList yet
// =============================================================================
// The normalizer as the grouping uses it, the grouping itself (counts, order,
// the name shown, and no shopper data out), the invite and email copy, and
// the admin-only guards on the list page and the add-flow prefill. The page is
// an async server component, so vitest (node, no jsdom) reads its source.
// =============================================================================

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { normalizeBusinessName } from '@/lib/spend/business-name'
import {
  BUSINESS_INVITE_ADDRESS,
  BUSINESS_INVITE_STOP_LINE,
  BUSINESS_INVITE_SUBJECT,
  UNLISTED_INVITE_LINE,
  addListingHref,
  businessInviteBody,
  formatShortDate,
  groupKey,
  groupUnlistedReceipts,
  inviteMessage,
} from '@/lib/spend/unlisted'

const REPO_ROOT = path.resolve(__dirname, '..')
const read = (rel: string) => readFileSync(path.join(REPO_ROOT, rel), 'utf8')

describe('normalizeBusinessName for grouping', () => {
  it.each([
    ['The Sweet Spot Bakery, LLC', 'sweet spot bakery'],
    ['SWEET SPOT BAKERY', 'sweet spot bakery'],
    ['sweet-spot bakery #2', 'sweet spot bakery'],
    ['Sweet Spot Bakery Store 0031', 'sweet spot bakery'],
    ['Café Olé', 'cafe ole'],
    ['Sun & Moon Market', 'sun and moon market'],
    ["Mama's Kitchen", 'mamas kitchen'],
    ['   ', ''],
  ])('%j -> %j', (raw, expected) => {
    expect(normalizeBusinessName(raw)).toBe(expected)
  })
})

describe('groupUnlistedReceipts', () => {
  const rows = [
    { raw_business_name: 'Sweet Spot Bakery', created_at: '2026-10-20T10:00:00Z' },
    { raw_business_name: 'SWEET SPOT BAKERY', created_at: '2026-10-29T10:00:00Z' },
    { raw_business_name: 'The Sweet Spot Bakery, LLC', created_at: '2026-10-25T10:00:00Z' },
    { raw_business_name: 'Corner Shop', created_at: '2026-10-30T10:00:00Z' },
    { raw_business_name: 'corner shop #4', created_at: '2026-10-01T10:00:00Z' },
    { raw_business_name: 'Night Market', created_at: '2026-10-31T09:00:00Z' },
    { raw_business_name: '', created_at: '2026-10-31T10:00:00Z' },
    { raw_business_name: null, created_at: '2026-10-31T11:00:00Z' },
    { raw_business_name: '   ', created_at: '2026-10-31T12:00:00Z' },
  ]

  it('groups spellings of one business and counts them', () => {
    const groups = groupUnlistedReceipts(rows)
    const sweet = groups.find((g) => g.normalizedName === 'sweet spot bakery')
    expect(sweet?.count).toBe(3)
    expect(sweet?.lastSeen).toBe('2026-10-29T10:00:00Z')
    expect(groups.find((g) => g.normalizedName === 'corner shop')?.count).toBe(2)
  })

  it('skips blank names', () => {
    const groups = groupUnlistedReceipts(rows)
    expect(groups.map((g) => g.normalizedName)).toEqual([
      'sweet spot bakery',
      'corner shop',
      'night market',
    ])
  })

  it('sorts by count, then by the most recent receipt', () => {
    const groups = groupUnlistedReceipts([
      { raw_business_name: 'Older', created_at: '2026-10-01T00:00:00Z' },
      { raw_business_name: 'Newer', created_at: '2026-10-02T00:00:00Z' },
      { raw_business_name: 'Busy', created_at: '2026-09-01T00:00:00Z' },
      { raw_business_name: 'Busy', created_at: '2026-09-02T00:00:00Z' },
    ])
    expect(groups.map((g) => g.displayName)).toEqual(['Busy', 'Newer', 'Older'])
  })

  it('shows the spelling used most, and the latest one on a tie', () => {
    const tie = groupUnlistedReceipts(rows).find((g) => g.normalizedName === 'corner shop')
    expect(tie?.displayName).toBe('Corner Shop')

    const most = groupUnlistedReceipts([
      { raw_business_name: 'KIM’S DELI', created_at: '2026-10-30T00:00:00Z' },
      { raw_business_name: "Kim's Deli", created_at: '2026-10-01T00:00:00Z' },
      { raw_business_name: "Kim's Deli", created_at: '2026-10-02T00:00:00Z' },
    ])
    expect(most).toHaveLength(1)
    expect(most[0]?.displayName).toBe("Kim's Deli")
  })

  it('collapses extra spaces in the name shown', () => {
    const [g] = groupUnlistedReceipts([
      { raw_business_name: '  Night   Market ', created_at: '2026-10-01T00:00:00Z' },
    ])
    expect(g?.displayName).toBe('Night Market')
  })

  it('has no city yet and keys on name plus an empty city', () => {
    const [g] = groupUnlistedReceipts([
      { raw_business_name: 'Night Market', created_at: '2026-10-01T00:00:00Z' },
    ])
    expect(g?.city).toBeNull()
    expect(g?.key).toBe(groupKey('night market', null))
    expect(groupKey('night market', 'Atlanta')).toBe('night market|Atlanta')
  })

  it('carries names, counts and dates only, never shopper data', () => {
    const withExtras = rows.map((r) => ({ ...r, user_id: 'u-1', amount_cents: 1200, id: 'r-1' }))
    for (const g of groupUnlistedReceipts(withExtras)) {
      expect(Object.keys(g).sort()).toEqual(
        ['city', 'count', 'displayName', 'key', 'lastSeen', 'normalizedName'].sort()
      )
      expect(JSON.stringify(g)).not.toMatch(/u-1|1200|r-1/)
    }
  })

  it('returns nothing for no rows', () => {
    expect(groupUnlistedReceipts([])).toEqual([])
  })
})

describe('invite and email copy', () => {
  it('shows the shopper line as written', () => {
    expect(UNLISTED_INVITE_LINE).toBe("This business isn't on The BLACQList yet. Invite them.")
  })

  it('builds the share text with an absolute /add-business link', () => {
    expect(inviteMessage('https://theblacqlist.com')).toBe(
      'I shop at your business and would love to see you on The BLACQList. You can add your business here: https://theblacqlist.com/add-business'
    )
  })

  it('builds the email subject, body and footer as approved', () => {
    expect(BUSINESS_INVITE_SUBJECT).toBe('Customers are adding your receipts on The BLACQList')
    expect(businessInviteBody('Sweet Spot Bakery', 'https://theblacqlist.com')).toBe(
      'Shoppers have been adding receipts from Sweet Spot Bakery to The BLACQList. Add your business for free so they can find you: https://theblacqlist.com/add-business'
    )
    expect(BUSINESS_INVITE_ADDRESS).toMatch(/\d+ .+, [A-Z]{2} \d{5}$/)
    expect(BUSINESS_INVITE_STOP_LINE).toBe("Reply STOP and we won't email you again.")
  })

  it('keeps em dashes out of every line', () => {
    const lines = [
      UNLISTED_INVITE_LINE,
      inviteMessage('https://x.test'),
      BUSINESS_INVITE_SUBJECT,
      businessInviteBody('A', 'https://x.test'),
      BUSINESS_INVITE_ADDRESS,
      BUSINESS_INVITE_STOP_LINE,
    ]
    for (const line of lines) expect(line).not.toContain('—')
  })

  it('links "Add as a listing" with the name encoded', () => {
    expect(addListingHref("Kim's Deli & Grill")).toBe(
      "/add-business?name=Kim's%20Deli%20%26%20Grill"
    )
  })

  it('formats dates in UTC so they never shift a day', () => {
    expect(formatShortDate('2026-10-31T23:30:00Z')).toBe('Oct 31, 2026')
    expect(formatShortDate('2026-11-01T00:30:00Z')).toBe('Nov 1, 2026')
    expect(formatShortDate('not a date')).toBe('not a date')
  })
})

describe('admin guard on /admin/receipts/unlisted', () => {
  const src = read('app/admin/receipts/unlisted/page.tsx')

  it('calls requireAdmin() before any read', () => {
    const guard = src.indexOf('await requireAdmin()')
    expect(guard).toBeGreaterThan(-1)
    expect(guard).toBeLessThan(src.indexOf('createServiceClient()'))
    expect(guard).toBeLessThan(src.indexOf(".from('receipt_uploads')"))
  })

  it('reads two receipt columns only, for unmatched receipts', () => {
    expect(src).toContain(".select('raw_business_name, created_at')")
    expect(src).toContain(".is('listing_id', null)")
    expect(src).not.toMatch(/user_id|amount_cents|image_path/)
  })

  it('shows the load error and Try again when a read fails', () => {
    expect(src).toContain('receiptsRead.error || sendsRead.error')
    expect(read('app/admin/receipts/unlisted/UnlistedLoadError.tsx')).toContain(
      `heading="Couldn't load the list."`
    )
  })
})

describe('admin-only name prefill on /add-business', () => {
  const src = read('app/add-business/page.tsx')

  it('fills the name only for admins', () => {
    expect(src).toMatch(/nameParam && \(await getAdminRole\(user\.id\)\) \? nameParam : undefined/)
    expect(src).toContain('prefillName={prefillName}')
  })

  it('lets a saved draft name win over the prefill', () => {
    const qs = read('app/add-business/_components/quick-start/QuickStart.tsx')
    expect(qs).toContain('prefillName && !initial.answers.name.trim()')
  })
})
