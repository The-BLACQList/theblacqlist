// Ticket 251: the admin side menu in groups. The config is plain data, so the
// rules the founder asked for are checked here directly: every admin page is
// in the menu exactly once, in the group they named, the group holding the
// current page is found for detail pages too, and a closed group's number is
// the sum of what is waiting inside it.

import { readdirSync, existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  ADMIN_NAV_GROUPS,
  ADMIN_OVERVIEW,
  DEFAULT_OPEN_GROUPS,
  groupCount,
  groupForPath,
  isUnder,
  parseOpenGroups,
  totalCount,
} from '@/lib/admin/navGroups'

const REPO_ROOT = path.resolve(__dirname, '..')
const ADMIN_DIR = path.join(REPO_ROOT, 'app/admin')

const allHrefs = [
  ADMIN_OVERVIEW.href,
  ...ADMIN_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href)),
]

describe('ADMIN_NAV_GROUPS', () => {
  it('uses the founder’s groups, in order', () => {
    expect(ADMIN_NAV_GROUPS.map((g) => g.label)).toEqual([
      'To Review',
      'Pages & Content',
      'People',
      'Insights',
      'Tools',
    ])
  })

  it('puts each page in the group the founder named', () => {
    const byGroup = Object.fromEntries(
      ADMIN_NAV_GROUPS.map((g) => [g.label, g.items.map((i) => i.label)])
    )
    expect(byGroup).toEqual({
      'To Review': [
        'Claims',
        'Verification',
        'Reviews',
        'Reports',
        'Category Requests',
        'Receipts',
        'Feedback',
      ],
      'Pages & Content': [
        'Entities',
        'Collections',
        'Guides',
        'BLACQLight',
        'Sponsored',
        'Marketplace',
      ],
      People: ['Users', 'Testers'],
      Insights: ['Analytics', 'AI Tools'],
      Tools: ['Email Preview'],
    })
  })

  it('lists every href once (19 with the overview)', () => {
    expect(allHrefs).toHaveLength(19)
    expect(new Set(allHrefs).size).toBe(allHrefs.length)
  })

  it('lists every admin page that exists, and nothing that does not', () => {
    const routes = readdirSync(ADMIN_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(path.join(ADMIN_DIR, d.name, 'page.tsx')))
      .map((d) => `/admin/${d.name}`)
    expect([...allHrefs].filter((h) => h !== '/admin').sort()).toEqual(routes.sort())
  })

  it('has unique slugs', () => {
    const slugs = ADMIN_NAV_GROUPS.map((g) => g.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('opens To Review on a first visit', () => {
    expect(DEFAULT_OPEN_GROUPS).toEqual(['to-review'])
  })
})

describe('groupForPath', () => {
  it('finds the group for a list page and a detail page', () => {
    expect(groupForPath('/admin/claims')?.slug).toBe('to-review')
    expect(groupForPath('/admin/claims/abc-123')?.slug).toBe('to-review')
    expect(groupForPath('/admin/entities/42/edit')?.slug).toBe('pages-content')
    expect(groupForPath('/admin/testers')?.slug).toBe('people')
    expect(groupForPath('/admin/email-preview')?.slug).toBe('tools')
  })

  it('returns null on the overview and unknown pages', () => {
    expect(groupForPath('/admin')).toBeNull()
    expect(groupForPath('/admin/nothing-here')).toBeNull()
  })

  it('does not match a page that only shares a prefix', () => {
    // /admin/reviews must not light up /admin/review-something, and vice versa.
    expect(isUnder('/admin/reviewsx', '/admin/reviews')).toBe(false)
    expect(isUnder('/admin/reviews/1', '/admin/reviews')).toBe(true)
  })
})

describe('groupCount / totalCount', () => {
  const counts = {
    '/admin/claims': 3,
    '/admin/verification': 1,
    '/admin/reviews': 6,
    '/admin/reports': 2,
    '/admin/receipts': 5,
    '/admin/feedback': 1,
    '/admin/category-requests': 0,
    '/admin/entities': 4,
    '/admin/testers': 2,
  }
  const group = (slug: string) => ADMIN_NAV_GROUPS.find((g) => g.slug === slug)!

  it('sums the items in a group', () => {
    expect(groupCount(group('to-review'), counts)).toBe(18)
    expect(groupCount(group('pages-content'), counts)).toBe(4)
    expect(groupCount(group('people'), counts)).toBe(2)
    expect(groupCount(group('insights'), counts)).toBe(0)
  })

  it('treats missing counts as zero', () => {
    expect(groupCount(group('to-review'), undefined)).toBe(0)
    expect(totalCount(undefined)).toBe(0)
  })

  it('totals every group for the phone Menu button', () => {
    expect(totalCount(counts)).toBe(24)
  })
})

describe('parseOpenGroups', () => {
  it('falls back to the defaults when nothing is saved or it is unreadable', () => {
    expect(parseOpenGroups(null)).toEqual(DEFAULT_OPEN_GROUPS)
    expect(parseOpenGroups('collapsed')).toEqual(DEFAULT_OPEN_GROUPS)
    expect(parseOpenGroups('{"a":1}')).toEqual(DEFAULT_OPEN_GROUPS)
  })

  it('keeps known slugs only, including an empty choice', () => {
    expect(parseOpenGroups('["people","bogus",3]')).toEqual(['people'])
    expect(parseOpenGroups('[]')).toEqual([])
  })
})

describe('components/admin/AdminSidebar.tsx', () => {
  const src = readFileSync(path.join(REPO_ROOT, 'components/admin/AdminSidebar.tsx'), 'utf8')

  it('renders from the shared config, with group test ids and aria-expanded', () => {
    expect(src).toContain("from '@/lib/admin/navGroups'")
    expect(src).toContain('data-testid={`admin-nav-group-${group.slug}`}')
    expect(src).toContain('aria-expanded={isOpen}')
  })

  it('keeps the active group open', () => {
    expect(src).toMatch(/const isOpen = isActive \|\| openGroups\.includes\(group\.slug\)/)
  })

  it('shows a closed group’s total only when closed and above zero', () => {
    expect(src).toContain('{!isOpen && total > 0 && (')
  })

  it('has a phone Menu button that opens a drawer and closes it on route change', () => {
    expect(src).toContain('md:hidden')
    expect(src).toContain('<Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>')
    expect(src).toContain('setDrawerOpen(false)')
    expect(src).toContain('aria-label="Close Menu"')
  })

  it('carries no em dash in its copy', () => {
    const withoutComments = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(withoutComments).not.toContain('—')
  })
})
