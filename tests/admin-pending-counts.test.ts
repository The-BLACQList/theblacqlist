// Admin pending-work signals: source contracts (F-2, 2026-09-19).
//
// The founder walked the tester path with their own test business sitting in
// the queue and saw nothing on the admin dashboard or the side menu that said
// so. The count already existed on the overview; it was one figure among five
// and appeared nowhere else. The fix is one shared helper, a priority alert
// on the overview, count pills in the sidebar, and revalidation from the
// actions that change the numbers.
//
// The helper, the layout and the page are async server components behind
// `requireAdmin()` and the service client, so vitest (node, no jsdom) cannot
// render them. These tests read the source instead and pin the four places a
// regression would be silent: the count drifting from the queue page's own
// filter, the page growing back its own inline query, the pill rendering a
// "0", and an approve/reject leaving the pill stale.

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const REPO_ROOT = path.resolve(__dirname, '..')
const read = (rel: string) => readFileSync(path.join(REPO_ROOT, rel), 'utf8')

const HELPER = 'lib/admin/pendingCounts.ts'
const LAYOUT = 'app/admin/layout.tsx'
const PAGE = 'app/admin/page.tsx'
const SIDEBAR = 'components/admin/AdminSidebar.tsx'
const ALERT = 'components/admin/AdminPendingAlert.tsx'

// Every action that moves a row out of one of the counted "pending" states.
const REVALIDATING_ACTIONS = [
  'lib/actions/admin/approveEntity.ts',
  'lib/actions/admin/rejectEntity.ts',
  'lib/actions/admin/approveClaim.ts',
  'lib/actions/admin/rejectClaim.ts',
  'lib/actions/admin/moderateReview.ts',
]

describe('lib/admin/pendingCounts.ts', () => {
  const src = read(HELPER)

  it('is server-only and uses the service client', () => {
    expect(src).toMatch(/^import 'server-only'/m)
    expect(src).toContain('createServiceClient()')
  })

  it('counts pending listings the way /admin/entities lists them (no soft-deleted rows)', () => {
    // The queue page applies `.is('deleted_at', null)`; a count that skips it
    // can say "3" above a page that shows two.
    const listingsQuery = src.slice(src.indexOf(".from('listings')"), src.indexOf(".from('claims')"))
    expect(listingsQuery).toContain(".eq('status', 'pending')")
    expect(listingsQuery).toContain(".is('deleted_at', null)")
  })

  it('uses head-only counts so no rows travel', () => {
    const selects = src.match(/\.select\('id', \{ count: 'exact', head: true \}\)/g) ?? []
    expect(selects.length).toBeGreaterThanOrEqual(6)
    expect(src).not.toMatch(/\.select\('\*'/)
  })

  it('reads community reviews at the status /admin/reviews calls Pending', () => {
    expect(src).toContain(".from('reviews')")
    expect(src).toContain(".eq('status', 'intake')")
  })

  it('maps every count onto a sidebar href that exists in NAV_ITEMS', () => {
    const sidebar = read(SIDEBAR)
    const mapping = src.slice(src.indexOf('export function toSidebarCounts'))
    const hrefs = [...mapping.matchAll(/'(\/admin\/[a-z-]+)':/g)].map((m) => m[1])
    expect(hrefs.length).toBeGreaterThanOrEqual(2)
    for (const href of hrefs) {
      expect(sidebar, `${href} is not a NAV_ITEMS href`).toContain(`href: '${href}'`)
    }
  })
})

describe('app/admin/layout.tsx', () => {
  const src = read(LAYOUT)

  it('fetches the counts once and hands them to the sidebar', () => {
    expect(src).toContain("from '@/lib/admin/pendingCounts'")
    expect(src).toContain('await getPendingCounts()')
    expect(src).toMatch(/<AdminSidebar[^>]*counts=\{toSidebarCounts\(/)
  })
})

describe('app/admin/page.tsx', () => {
  const src = read(PAGE)

  it('no longer owns an inline pending-listings query', () => {
    // If this comes back the overview and the sidebar can disagree again.
    expect(src).not.toContain(".from('listings')")
    expect(src).not.toContain(".eq('status', 'pending'),")
    expect(src).toContain('getPendingCounts()')
  })

  it('renders the priority alert above the stat grid', () => {
    const alertAt = src.indexOf('<AdminPendingAlert')
    const gridAt = src.indexOf('{/* Stat cards */}')
    expect(alertAt).toBeGreaterThan(-1)
    expect(gridAt).toBeGreaterThan(-1)
    expect(alertAt).toBeLessThan(gridAt)
    expect(src).toMatch(/<AdminPendingAlert count=\{pending\.entities\}/)
  })
})

describe('components/admin/AdminPendingAlert.tsx', () => {
  const src = read(ALERT)

  it('renders nothing at zero (no empty alert panel)', () => {
    expect(src).toMatch(/if \(count <= 0\) return null/)
  })

  it('links straight to the pending queue', () => {
    expect(src).toContain('href="/admin/entities?status=pending"')
  })

  it('carries no em dash in its copy', () => {
    const withoutComments = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(withoutComments).not.toContain('—')
  })
})

describe('components/admin/AdminSidebar.tsx', () => {
  const src = read(SIDEBAR)

  it('takes counts as an optional prop keyed by href', () => {
    expect(src).toMatch(/counts\?: Record<string, number>/)
    expect(src).toMatch(/counts\?\.\[href\]/)
  })

  it('renders the pill only above zero, with an accessible label', () => {
    const pill = src.slice(src.indexOf('{pending > 0 && ('), src.indexOf('</Link>'))
    expect(pill.length).toBeGreaterThan(0)
    expect(pill).toContain('aria-label={`${pending} pending`}')
    expect(pill).toContain('data-testid={`admin-nav-count-')
  })
})

describe('admin actions revalidate the admin layout', () => {
  for (const rel of REVALIDATING_ACTIONS) {
    it(`${rel} calls revalidatePath('/admin', 'layout')`, () => {
      const src = read(rel)
      expect(src).toContain("import { revalidatePath } from 'next/cache'")
      expect(src).toContain("revalidatePath('/admin', 'layout')")
    })
  }
})
