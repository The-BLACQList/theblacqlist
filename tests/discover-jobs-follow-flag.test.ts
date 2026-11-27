// =============================================================================
// Discover, search and Cue follow the jobs switch (ticket 291)
// =============================================================================
// Founder 2026-11-27: "I changed my mind for the final time. We'll take jobs
// off altogether." With FEATURE_JOBS_OPEN off, /jobs and /add-job are already
// covered (ticket 122) and the plan lines drop jobs (ticket 289). This guards
// the rest: the Jobs type on /discover, `?type=job`, and job rows mixed into
// results or Cue's answers.
//
// Non-vacuity: the source checks and the `type=job` check fail on main before
// this ticket (no showJobs prop, no jobsOpen read, `type=job` resolved).
// =============================================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { hasUnresolved, resolveFacetParams } from '@/lib/listings/facets'

// `job` is an exact entity_type, not a mapped type, so no query runs here.
const stub = {} as unknown as Parameters<typeof resolveFacetParams>[0]

function read(file: string): string {
  return readFileSync(path.resolve(process.cwd(), file), 'utf8')
}

afterEach(() => vi.unstubAllEnvs())

describe('?type=job while jobs are closed', () => {
  it('comes back unresolved (empty results), not as job listings', async () => {
    vi.stubEnv('FEATURE_JOBS_OPEN', 'false')
    const { unresolved } = await resolveFacetParams(stub, { type: 'job' })
    expect(unresolved.type).toBe('job')
    expect(hasUnresolved(unresolved)).toBe(true)
  })

  it('resolves as before while jobs are open', async () => {
    vi.stubEnv('FEATURE_JOBS_OPEN', 'true')
    const { params, unresolved } = await resolveFacetParams(stub, { type: 'job' })
    expect(unresolved.type).toBeUndefined()
    expect(hasUnresolved(unresolved)).toBe(false)
    expect(params.p_entity_type).toBe('job')
  })

  it('leaves every other type alone while jobs are closed', async () => {
    vi.stubEnv('FEATURE_JOBS_OPEN', 'false')
    const { unresolved } = await resolveFacetParams(stub, { type: 'event' })
    expect(hasUnresolved(unresolved)).toBe(false)
  })

  it('/api/search names the closed type in its 400', () => {
    expect(read('lib/services/search.ts')).toContain("fields.type = 'Jobs are not open yet.'")
  })
})

describe('the Jobs type on /discover', () => {
  it('the sidebar hides Jobs unless told jobs are open (closed by default)', () => {
    const src = read('components/discovery/FacetSidebar.tsx')
    expect(src).toContain('showJobs = false')
    expect(src).toContain(
      "showJobs ? ENTITY_TYPES : ENTITY_TYPES.filter(({ value }) => value !== 'job')"
    )
  })

  it('both Discover pages pass the switch to the sidebar and the phone sheet', () => {
    for (const file of [
      'app/(public)/discover/(index)/page.tsx',
      'app/(public)/discover/[citySlug]/page.tsx',
    ]) {
      const n = read(file).match(/showJobs=\{isFeatureEnabled\('jobsOpen'\)\}/g)?.length ?? 0
      expect(n, file).toBe(2)
    }
  })
})

describe('job rows never reach a result list while jobs are closed', () => {
  it('Discover results and sponsored slots drop jobs', () => {
    const src = read('lib/listings/query.ts')
    expect(src).toContain("const jobsOpen = isFeatureEnabled('jobsOpen')")
    expect(src).toContain("e.entity_type !== 'job'")
    expect(src).toContain("!jobsOpen && raw.entity_type === 'job'")
  })

  it('the plain browse paths exclude jobs in the query', () => {
    expect(read('lib/listings/facets.ts')).toContain(".neq('entity_type', 'job')")
    expect(read('lib/services/search.ts')).toContain(".neq('entity_type', 'job')")
  })

  it('Cue (search, meaning search, details) skips jobs', () => {
    const src = read('lib/ai/cue/data.ts')
    expect(src).toContain("!jobsOpen && raw.entity_type === 'job'")
    expect(src).toContain("raw.entity_type === 'job' && !isFeatureEnabled('jobsOpen')")
  })
})
