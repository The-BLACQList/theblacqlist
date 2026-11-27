import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildShellGroups,
  pageIdFromPath,
  pageInitials,
  pickPageId,
  type ShellCounts,
  type ShellFlags,
} from '@/lib/account/shellNav'
import {
  activeGroupSlug,
  activeHref,
  allItems,
  parseOpenSlugs,
  pillText,
  railTotal,
} from '@/lib/nav/rail'

const REPO_ROOT = path.resolve(__dirname, '..')

const counts: ShellCounts = {
  saved: 4,
  reviews: 2,
  claims: 1,
  claimsPending: 1,
  receipts: 0,
  messagesUnread: 3,
  receiptsToVerify: 2,
}
const flags: ShellFlags = { ownerReceipts: true, posts: true, bookings: true, collectiveSoon: true }

const labels = (groups: ReturnType<typeof buildShellGroups>, slug: string) =>
  groups.find((g) => g.slug === slug)?.items.map((i) => i.label) ?? []

describe('buildShellGroups', () => {
  it('gives members You and Account only, with Messages under You', () => {
    const groups = buildShellGroups({ isOwner: false, isAdmin: false, pageId: null, counts, flags })
    expect(groups.map((g) => g.slug)).toEqual(['you', 'account'])
    expect(labels(groups, 'you')).toContain('Messages')
    expect(labels(groups, 'account')).toEqual(['Settings'])
  })

  it('puts You first, then the business, then its tools by job', () => {
    const groups = buildShellGroups({ isOwner: true, isAdmin: false, pageId: 'p1', counts, flags })
    expect(groups.map((g) => g.slug)).toEqual([
      'you',
      'business',
      'offer',
      'show',
      'trust',
      'account',
    ])
    expect(groups.map((g) => g.label)).not.toContain('Page Tools')
    expect(labels(groups, 'offer')).toEqual([
      'Products',
      'Services',
      'Offerings',
      'Events',
      'Bookings',
    ])
    expect(labels(groups, 'show')).toEqual([
      'Photos and Media',
      'Happening Now',
      'Highlights',
      'Team',
    ])
    expect(labels(groups, 'trust')).toEqual([
      'Special Hours',
      'Locations',
      'Get Verified',
      'Credentials',
      'Documents',
      'Receipts to Review',
    ])
    expect(labels(groups, 'business')).toEqual([
      'Home',
      'Edit Page',
      'Insights',
      'Messages',
      'Plan',
    ])
    expect(labels(groups, 'you')).not.toContain('Messages')
    const business = groups.find((g) => g.slug === 'business')!.items
    expect(business.find((i) => i.label === 'Insights')?.href).toBe('/dashboard/pages/p1/analytics')
    expect(business.find((i) => i.label === 'Messages')?.badge).toBe(3)
    const trust = groups.find((g) => g.slug === 'trust')!.items
    expect(trust.find((i) => i.label === 'Receipts to Review')?.badge).toBe(2)
    const show = groups.find((g) => g.slug === 'show')!.items
    expect(show.find((i) => i.label === 'Team')?.href).toBe('/dashboard/pages/p1/team')
  })

  it('hides flagged tools when their flags are off', () => {
    const off = { ...flags, ownerReceipts: false, posts: false, bookings: false }
    const groups = buildShellGroups({
      isOwner: true,
      isAdmin: false,
      pageId: 'p1',
      counts,
      flags: off,
    })
    const all = allItems(groups).map((i) => i.label)
    expect(all).not.toContain('Receipts to Review')
    expect(all).not.toContain('Happening Now')
    expect(all).not.toContain('Bookings')
  })

  it('keeps Home and Plan for an owner whose pages could not be read', () => {
    const groups = buildShellGroups({ isOwner: true, isAdmin: false, pageId: null, counts, flags })
    expect(groups.map((g) => g.slug)).toEqual(['you', 'business', 'account'])
    expect(labels(groups, 'business')).toEqual(['Home', 'Messages', 'Plan'])
  })

  it('hides Messages when messaging is off', () => {
    const quiet = { ...counts, messagesUnread: undefined }
    const groups = buildShellGroups({
      isOwner: false,
      isAdmin: false,
      pageId: null,
      counts: quiet,
      flags,
    })
    expect(allItems(groups).map((i) => i.label)).not.toContain('Messages')
  })

  it('shows Admin to admins only', () => {
    const admin = buildShellGroups({ isOwner: false, isAdmin: true, pageId: null, counts, flags })
    expect(labels(admin, 'account')).toEqual(['Settings', 'Admin'])
  })

  it('lists every address once', () => {
    const groups = buildShellGroups({ isOwner: true, isAdmin: true, pageId: 'p1', counts, flags })
    const hrefs = allItems(groups).map((i) => i.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })
})

describe('page choice', () => {
  const pages = [
    { id: 'p1', name: 'Dana’s Kitchen', tier: 'growth' },
    { id: 'p2', name: 'Second Shop', tier: null },
  ]

  it('reads the page id from a page address', () => {
    expect(pageIdFromPath('/dashboard/pages/p2/edit')).toBe('p2')
    expect(pageIdFromPath('/dashboard/pages/new')).toBeNull()
    expect(pageIdFromPath('/dashboard')).toBeNull()
  })

  it('prefers the address, then the cookie, then the newest page', () => {
    expect(pickPageId('/dashboard/pages/p2/team', pages, 'p1')).toBe('p2')
    expect(pickPageId('/dashboard', pages, 'p2')).toBe('p2')
    expect(pickPageId('/dashboard', pages, null)).toBe('p1')
  })

  it('ignores ids the owner does not own', () => {
    expect(pickPageId('/dashboard/pages/someone-else/edit', pages, 'nope')).toBe('p1')
    expect(pickPageId('/dashboard', [], 'p1')).toBeNull()
  })

  it('makes two-letter initials', () => {
    expect(pageInitials('Dana’s Kitchen')).toBe('DK')
    expect(pageInitials('Solo')).toBe('S')
    expect(pageInitials('!!!')).toBe('B')
  })
})

describe('the shared rail helpers', () => {
  const groups = buildShellGroups({ isOwner: true, isAdmin: false, pageId: 'p1', counts, flags })

  it('marks the longest matching item, and exact items only on themselves', () => {
    const items = allItems(groups)
    expect(activeHref('/dashboard/pages/p1/team', items)).toBe('/dashboard/pages/p1/team')
    expect(activeHref('/dashboard/messages/abc', items)).toBe('/dashboard/messages')
    expect(activeHref('/dashboard/pages', items)).toBeNull()
    expect(activeHref('/account', items)).toBe('/account')
    expect(activeHref('/account/saved', items)).toBe('/account/saved')
  })

  it('opens the group holding the current page', () => {
    expect(activeGroupSlug('/dashboard/pages/p1/documents', groups)).toBe('trust')
    expect(activeGroupSlug('/dashboard/products', groups)).toBe('offer')
    expect(activeGroupSlug('/account/claims', groups)).toBe('you')
  })

  it('totals waiting badges, not plain counts', () => {
    // Messages 3 + Receipts to Review 2 + Claims pending 1.
    expect(railTotal(groups)).toBe(6)
    expect(pillText(120)).toBe('99+')
  })

  it('keeps only known group slugs from storage', () => {
    expect(parseOpenSlugs('["you","nope"]', ['you', 'business'], ['business'])).toEqual(['you'])
    expect(parseOpenSlugs('not json', ['you'], ['you'])).toEqual(['you'])
    expect(parseOpenSlugs(null, ['you'], ['you'])).toEqual(['you'])
  })
})

describe('signed-in shell source', () => {
  const files = [
    'lib/account/shellNav.ts',
    'components/account/SignedInShell.tsx',
    'components/account/PageSwitcher.tsx',
  ].map((f) => readFileSync(path.join(REPO_ROOT, f), 'utf8'))

  it('uses the shared rail with account test ids, under the gold mark', () => {
    expect(files[1]).toContain('<RailTitle>')
    expect(files[1]).not.toMatch(/BLACQ<span/)
    expect(files[1]).toContain('<NavRail')
    expect(files[1]).toContain('testIdPrefix="account-nav"')
  })

  it('carries no em dash in its copy', () => {
    for (const src of files) {
      const withoutComments = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
      expect(withoutComments).not.toContain('—')
    }
  })

  it('both layouts render the one shell', () => {
    for (const layout of ['app/account/layout.tsx', 'app/dashboard/layout.tsx']) {
      const src = readFileSync(path.join(REPO_ROOT, layout), 'utf8')
      expect(src).toContain('<SignedInFrame')
      expect(src).toContain('loadShellData')
    }
  })
})
