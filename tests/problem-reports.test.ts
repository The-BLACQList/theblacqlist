// Report a problem button + /admin/feedback: source contracts (2026-09-21).
//
// Item 1 of the pre-invite list asked for tester responses to land "somewhere
// that is immediately actionable". Reflections were already there (see
// admin-tester-reflections.test.ts); this is the second half, a one-textarea
// report from any signed-in page into a service-role-only table with a status
// queue the founder works from the admin sidebar.
//
// Everything here is a server component, a server action, or a migration, so
// vitest (node, no jsdom) reads the source rather than rendering. Each guard
// names the line that must survive a refactor.

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const REPO_ROOT = path.resolve(__dirname, '..')
const read = (rel: string) => readFileSync(path.join(REPO_ROOT, rel), 'utf8')

const MIGRATION = 'supabase/migrations/20260921000000_problem_reports.sql'
const ACTION = 'lib/actions/feedback/submitProblemReport.ts'
const ADMIN_ACTION = 'lib/actions/admin/updateProblemReport.ts'
const MOUNT = 'components/feedback/ReportProblemMount.tsx'
const BUTTON = 'components/feedback/ReportProblemButton.tsx'
const LAYOUT = 'app/layout.tsx'
const ADMIN_PAGE = 'app/admin/feedback/page.tsx'
const ADMIN_ACTIONS_UI = 'components/admin/ProblemReportActions.tsx'
const SIDEBAR = 'components/admin/AdminSidebar.tsx'
const COUNTS = 'lib/admin/pendingCounts.ts'
const BADGE = 'components/admin/AdminStatusBadge.tsx'
const TYPES = 'lib/supabase/types.ts'
const RATE_LIMIT = 'lib/security/rate-limit.ts'

describe(MIGRATION, () => {
  const sql = read(MIGRATION)

  it('creates problem_reports with the body length CHECK', () => {
    expect(sql).toMatch(/create table (if not exists )?(public\.)?problem_reports/i)
    expect(sql).toMatch(/char_length\(body\) between 10 and 1000/i)
  })

  it('constrains status to the four queue states', () => {
    expect(sql).toMatch(/status in \('new', ?'triaged', ?'fixed', ?'dismissed'\)/i)
  })

  it('keeps the reporter link but survives account deletion', () => {
    expect(sql).toMatch(/references auth\.users ?\(id\) on delete set null/i)
  })

  it('enables RLS with no client policies (service role only)', () => {
    expect(sql).toMatch(/alter table (public\.)?problem_reports enable row level security/i)
    expect(sql).not.toMatch(/create policy/i)
  })

  it('indexes the admin queue read (status, created_at desc)', () => {
    expect(sql).toMatch(/\(status, created_at desc\)/i)
  })

  it('carries a DOWN plan in the header', () => {
    expect(sql).toMatch(/DOWN PLAN/)
    expect(sql).toMatch(/drop table (if exists )?(public\.)?problem_reports/i)
  })
})

describe(ACTION, () => {
  const src = read(ACTION)

  it('is a server action that refuses anonymous reports', () => {
    expect(src.startsWith("'use server'")).toBe(true)
    expect(src).toContain('auth.getUser()')
    expect(src).toContain("'Sign in to send a report.'")
  })

  it('rate limits per user on its own bucket', () => {
    expect(src).toContain('checkRateLimit')
    expect(src).toContain("bucket: 'problem_report'")
    expect(src).toMatch(/identifier: user\.id/)
  })

  it('strips the query string from page_path before storing it', () => {
    expect(src).toMatch(/split\('\?'\)\[0\]/)
  })

  it('writes through the service client (the table has no client policies)', () => {
    expect(src).toContain('createServiceClient()')
    expect(src).toContain(".from('problem_reports')")
  })
})

describe(RATE_LIMIT, () => {
  it('knows the problem_report bucket', () => {
    expect(read(RATE_LIMIT)).toMatch(/'problem_report'/)
  })
})

describe(MOUNT, () => {
  const src = read(MOUNT)

  it('renders nothing for a signed-out viewer', () => {
    expect(src).toContain('if (!user) return null')
  })

  it('never throws out of the root layout', () => {
    expect(src).toMatch(/catch \{\s*return false/)
  })
})

describe(BUTTON, () => {
  const src = read(BUTTON)

  it('hides on the same routes as the tour rail', () => {
    expect(src).toContain("import { isHiddenPath } from '@/lib/tour/routes'")
    expect(src).toContain('if (isHiddenPath(pathname)) return null')
  })

  it('sits bottom-left so it never overlaps the rail pill at bottom-right', () => {
    expect(src).toContain('fixed bottom-4 left-4 z-40')
  })

  it('keeps the textarea controlled so a validation error does not wipe the text', () => {
    expect(src).toMatch(/value=\{text\}/)
    expect(src).toMatch(/onChange=\{\(e\) => setText\(e\.target\.value\)\}/)
  })

  it('announces errors and moves focus to the confirmation', () => {
    expect(src).toContain('role="alert"')
    expect(src).toContain('role="status"')
    expect(src).toContain('Thanks. We read every one of these.')
  })

  it('meets the 44px target on the trigger and the submit', () => {
    const triggers = src.match(/min-h-11/g) ?? []
    expect(triggers.length).toBeGreaterThanOrEqual(2)
  })
})

describe(LAYOUT, () => {
  it('mounts the button in a Suspense boundary next to the rail', () => {
    const src = read(LAYOUT)
    expect(src).toContain('<ReportProblemMount />')
    const idx = src.indexOf('<ReportProblemMount />')
    expect(src.slice(0, idx)).toMatch(/<Suspense fallback=\{null\}>\s*$/)
  })
})

describe(ADMIN_PAGE, () => {
  const src = read(ADMIN_PAGE)

  it('is admin-only and reads through the service client', () => {
    expect(src).toContain('await requireAdmin()')
    expect(src).toContain('createServiceClient()')
  })

  it('filters by status, newest first', () => {
    expect(src).toContain(".eq('status', status)")
    expect(src).toContain(".order('created_at', { ascending: false })")
  })

  it('offers all four status tabs', () => {
    for (const s of ['new', 'triaged', 'fixed', 'dismissed']) {
      expect(src).toContain(`value: '${s}'`)
    }
  })

  it('renders the action row per report', () => {
    expect(src).toContain('<ProblemReportActions')
  })
})

describe(ADMIN_ACTION, () => {
  const src = read(ADMIN_ACTION)

  it('requires an admin session and audits the transition', () => {
    expect(src).toContain('getAdminSession()')
    expect(src).toContain("action: 'update_problem_report'")
    expect(src).toContain("targetTable: 'problem_reports'")
  })

  it('refreshes the sidebar count with the page', () => {
    expect(src).toContain("revalidatePath('/admin', 'layout')")
  })

  it('does not erase a stored PR ref when the field is left blank', () => {
    expect(src).toContain('prRefRaw || report.pr_ref')
  })
})

describe(ADMIN_ACTIONS_UI, () => {
  it('keeps the PR ref input inside the Mark fixed form', () => {
    const src = read(ADMIN_ACTIONS_UI)
    const fixForm = src.slice(src.indexOf('<form action={fixDispatch}'))
    const closing = fixForm.indexOf('</form>')
    expect(fixForm.slice(0, closing)).toContain('name="pr_ref"')
  })
})

describe('admin navigation and counts', () => {
  it('lists Feedback in the sidebar', () => {
    expect(read(SIDEBAR)).toContain("href: '/admin/feedback'")
  })

  it('counts new reports into the Feedback pill', () => {
    const src = read(COUNTS)
    expect(src).toContain(".from('problem_reports')")
    expect(src).toContain(".eq('status', 'new')")
    expect(src).toContain("'/admin/feedback': counts.feedback")
  })

  it('has badge colours for every problem_reports status', () => {
    const src = read(BADGE)
    for (const s of ['new', 'triaged', 'fixed', 'dismissed']) {
      expect(src).toMatch(new RegExp(`^\\s*${s}: \\{`, 'm'))
    }
  })
})

describe(TYPES, () => {
  it('includes problem_reports (regenerated after the staging apply)', () => {
    expect(read(TYPES)).toContain('problem_reports: {')
  })
})

describe('house style', () => {
  it('uses no em dashes in user-facing copy', () => {
    for (const rel of [BUTTON, ADMIN_PAGE, ADMIN_ACTIONS_UI, ACTION, ADMIN_ACTION]) {
      expect(read(rel), rel).not.toContain('—')
    }
  })
})
