// Tester reflections surfaced in admin: source contracts (2026-09-21).
//
// The tour already collected reflections (tour_step_completions.reflection,
// twenty-character floor, four gated steps) but /admin/testers never selected
// them, so the founder asked "where do the tester responses end up?" and the
// honest answer was "in a table nobody opens". These tests pin the fix: the
// page selects and renders the text, the sidebar signals recent writing, and
// no reflection path routes through the client-writable analytics table.
//
// The page is an async server component behind requireAdmin() and the service
// client, so vitest (node, no jsdom) reads the source instead of rendering.

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const REPO_ROOT = path.resolve(__dirname, '..')
const read = (rel: string) => readFileSync(path.join(REPO_ROOT, rel), 'utf8')

const PAGE = 'app/admin/testers/page.tsx'
const HELPER = 'lib/admin/pendingCounts.ts'
const SIDEBAR = 'components/admin/AdminSidebar.tsx'

describe('app/admin/testers/page.tsx', () => {
  const src = read(PAGE)

  it('selects the reflection text and timestamp from tour_step_completions', () => {
    const completions = src.slice(src.indexOf(".from('tour_step_completions')"))
    expect(completions).toMatch(
      /\.select\('enrollment_id, step_key, reflection, reflected_at'\)/
    )
  })

  it('renders only rows that carry text (progress ticks have no reflection)', () => {
    expect(src).toContain('if (s.reflection && s.reflected_at)')
  })

  it('orders reflections newest first everywhere they appear', () => {
    expect(src).toContain('b.reflectedAt.localeCompare(a.reflectedAt)')
  })

  it('labels each reflection with the step title and prompt from the tour copy', () => {
    expect(src).toContain("import { TOUR_STEP_COPY } from '@/lib/tour/verify'")
    expect(src).toContain('TOUR_STEP_COPY[entry.step]')
    expect(src).toContain('{copy.title}')
    expect(src).toContain('{copy.prompt}')
  })

  it('offers the flat triage view at ?view=reflections', () => {
    expect(src).toContain('href="/admin/testers?view=reflections"')
    expect(src).toMatch(/params\.view === 'reflections'/)
    expect(src).toContain('function ReflectionsList')
  })

  it('shows the reflection count on every enrollment row', () => {
    expect(src).toContain("'No reflections yet'")
    expect(src).toMatch(/\$\{reflections\.length\} reflection/)
  })

  it('never reads analytics_events for evidence', () => {
    expect(src).not.toContain('analytics_events')
  })

  it('carries no em dash in its rendered copy', () => {
    const withoutComments = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(withoutComments).not.toContain('—')
  })
})

describe('lib/admin/pendingCounts.ts (reflections pill)', () => {
  const src = read(HELPER)

  it('counts recent reflections with text only', () => {
    const q = src.slice(src.indexOf(".from('tour_step_completions')"))
    expect(q).toContain(".not('reflection', 'is', null)")
    expect(q).toContain(".gte('reflected_at', reflectionsSince)")
  })

  it('uses a 7-day window', () => {
    expect(src).toContain('export const REFLECTION_RECENT_DAYS = 7')
  })

  it('maps the count onto the Testers nav item', () => {
    expect(src).toContain("'/admin/testers': counts.reflections")
    expect(read(SIDEBAR)).toContain("href: '/admin/testers'")
  })
})
