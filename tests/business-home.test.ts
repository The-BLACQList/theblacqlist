import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  dailySeries,
  formatCount,
  needsYouItems,
  pageChecklist,
  sparkPoints,
  statusLabel,
} from '@/lib/dashboard/home'

const REPO_ROOT = path.resolve(__dirname, '..')
const read = (f: string) => readFileSync(path.join(REPO_ROOT, f), 'utf8')

const base = {
  pageId: 'p1',
  reviewsToAnswer: 0,
  publicUrl: '/atlanta/business/danas-kitchen',
  status: 'published',
}

describe('needsYouItems', () => {
  it('is empty when nothing is waiting', () => {
    expect(needsYouItems({ ...base, messagesUnread: 0, receiptsToVerify: 0 })).toEqual([])
    expect(needsYouItems(base)).toEqual([])
  })

  it('lists review, messages, reviews and receipts in that order', () => {
    const items = needsYouItems({
      ...base,
      status: 'pending',
      messagesUnread: 3,
      reviewsToAnswer: 1,
      receiptsToVerify: 2,
    })
    expect(items.map((i) => i.key)).toEqual(['review', 'messages', 'reviews', 'receipts'])
    expect(items[0]!.href).toBe('/dashboard/pages/p1/edit')
    expect(items[1]!.detail).toBe('3 messages waiting for a reply.')
    expect(items[2]!.href).toBe('/atlanta/business/danas-kitchen#reviews-heading')
    expect(items[2]!.detail).toBe('1 review has no reply yet.')
    expect(items[3]!.detail).toBe('2 customers are waiting for you to confirm a purchase.')
  })

  it('skips review replies when the page has no public address', () => {
    expect(needsYouItems({ ...base, reviewsToAnswer: 2, publicUrl: null })).toEqual([])
  })

  it('uses Title Case labels', () => {
    const labels = needsYouItems({
      ...base,
      status: 'pending',
      messagesUnread: 1,
      reviewsToAnswer: 1,
      receiptsToVerify: 1,
    }).map((i) => i.label)
    expect(labels).toEqual([
      'Your Page Is in Review',
      'Answer Messages',
      'Reply to Reviews',
      'Verify Receipts',
    ])
  })
})

describe('pageChecklist', () => {
  it('keeps cover first and reports each step', () => {
    const items = pageChecklist({
      cover: false,
      tagline: true,
      description: true,
      contact: false,
      cta: true,
      seoTitle: true,
    })
    expect(items[0]!.label).toBe('Add a Cover Photo')
    expect(items.filter((i) => i.done)).toHaveLength(4)
    expect(items.find((i) => !i.done)!.key).toBe('cover')
  })
})

describe('home formatting', () => {
  it('names statuses in Title Case', () => {
    expect(statusLabel('published')).toBe('Live')
    expect(statusLabel('pending')).toBe('In Review')
    expect(statusLabel(null)).toBe('Draft')
    expect(statusLabel('needs_changes')).toBe('Needs Changes')
  })

  it('formats counts', () => {
    expect(formatCount(0)).toBe('0')
    expect(formatCount(1234)).toBe('1,234')
    expect(formatCount(12_345)).toBe('12.3K')
    expect(formatCount(123_456)).toBe('123K')
  })

  it('fills missing days with zero, oldest first, ending today', () => {
    const now = new Date('2026-11-21T15:00:00Z')
    const s = dailySeries(
      [
        { snapshot_date: '2026-11-19', page_views: 5, cta_clicks: 1, saves: null },
        { snapshot_date: '2026-11-21', page_views: 2, cta_clicks: 0, saves: 1 },
      ],
      3,
      now
    )
    expect(s.views).toEqual([5, 0, 2])
    expect(s.taps).toEqual([1, 0, 0])
    expect(s.saves).toEqual([0, 0, 1])
  })

  it('draws no line when every day is zero', () => {
    expect(sparkPoints([0, 0, 0])).toBeNull()
    expect(sparkPoints([4])).toBeNull()
    expect(sparkPoints([0, 2])).toBe('0.00,30.00 100.00,2.00')
  })
})

describe('Business Home source', () => {
  const page = read('app/dashboard/page.tsx')
  const snapshot = read('components/dashboard/home/Snapshot.tsx')

  it('reads analytics only for plans that include them', () => {
    expect(page).toContain("const hasNumbers = canAccess(listing.tier, 'analytics')")
    expect(page).toMatch(/hasNumbers \? loadHomeSnapshot\(/)
    expect(page).not.toContain("from('analytics_events')")
  })

  it('shows Free pages a locked preview with no figures in it', () => {
    const locked = snapshot.slice(snapshot.indexOf('export function LockedSnapshot'))
    const text = locked
      .replace(/className="[^"]*"/g, '')
      .replace(/style=\{[^}]*\}\}/g, '')
      .replace(/\{[^}]*\}/g, '')
      .match(/>([^<>]+)</g)
      ?.join(' ')
    expect(text).toBeTruthy()
    expect(text).not.toMatch(/\d/)
    expect(locked).toContain('href="/dashboard/upgrade"')
  })

  it('picks the same page as the menu, newest first', () => {
    expect(page).toContain('pickPageId(')
    expect(page).toContain('PAGE_COOKIE')
    expect(page).toContain(".order('created_at', { ascending: false })")
  })

  it('shares the period counts with Insights', () => {
    expect(read('lib/dashboard/homeData.ts')).toContain('pagePeriodCounts(')
    expect(read('app/dashboard/pages/[entityId]/analytics/page.tsx')).toContain('pagePeriodCounts(')
  })

  it('says The BLACQList, never drafts, and no em dashes', () => {
    const files = [
      'app/dashboard/page.tsx',
      'lib/dashboard/home.ts',
      ...[
        'BusinessHeader',
        'NeedsYou',
        'Snapshot',
        'FinishYourPage',
        'QuickActions',
        'WriteWithAi',
      ].map((c) => `components/dashboard/home/${c}.tsx`),
    ]
    for (const f of files) {
      const code = read(f)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
      expect(code, f).not.toContain('—')
      expect(code, f).not.toMatch(/\bdrafts\b/i)
      expect(code, f).not.toMatch(/(?<!The )BLACQList/)
    }
  })
})
