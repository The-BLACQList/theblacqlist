// =============================================================================
// Ticket 154: where Jobs shows up (home tile, dashboard card, business page)
// =============================================================================
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { TheAvenues } from '@/components/home/TheAvenues'
import { PostJobCard } from '@/components/dashboard/PostJobCard'
import { NowHiringView } from '@/components/entity-page/EntityNowHiring'
import {
  avenuesEyebrow,
  jobsTileLabel,
  postJobQuotaLine,
  seeAllRolesLabel,
  withJobsCount,
} from '@/lib/listings/jobEntryPoints'
import { getOpenRolesForBusiness } from '@/lib/listings/jobs'
import { buildJobsUrl, hasJobFilters, parseJobFilters } from '@/lib/validations/jobs'
import type { DiscoveryEntity } from '@/types'

const BASE = { brick: 5, products: 4, professionals: 3, creatives: 2, events: 1 }
const BIZ = '8f14e45f-ceea-467f-a0e6-1d6b5a1c3b21'

afterEach(() => vi.unstubAllEnvs())

describe('jobsTileLabel', () => {
  it('reads plainly for none, one and many', () => {
    expect(jobsTileLabel(0)).toBe('No open roles yet')
    expect(jobsTileLabel(1)).toBe('1 open role')
    expect(jobsTileLabel(4)).toBe('4 open roles')
    expect(jobsTileLabel(1200)).toBe('1,200 open roles')
  })
  it('promises no number when the count failed', () => {
    expect(jobsTileLabel(null)).toBe('Find your next role')
  })
})

describe('withJobsCount', () => {
  it('adds jobs only when Jobs is open', () => {
    expect('jobs' in withJobsCount(BASE, false, 4)).toBe(false)
    expect(withJobsCount(BASE, true, 4).jobs).toBe(4)
    expect(withJobsCount(BASE, true, null).jobs).toBeNull()
  })
})

describe('home tile', () => {
  it('shows five avenues and no Jobs link with the flag off', () => {
    const html = renderToStaticMarkup(createElement(TheAvenues, { counts: BASE }))
    expect(html).toContain('One index, five avenues')
    expect(html).not.toContain('href="/jobs"')
  })
  it('shows six avenues and a Jobs link with the count when on', () => {
    const html = renderToStaticMarkup(
      createElement(TheAvenues, { counts: withJobsCount(BASE, true, 4) })
    )
    expect(html).toContain('One index, six avenues')
    expect(html).toContain('href="/jobs"')
    expect(html).toContain('4 open roles')
    expect(html).not.toContain('Coming soon')
    expect(html.toLowerCase()).not.toContain('black-owned')
  })
  it('still links to the board at zero', () => {
    const html = renderToStaticMarkup(
      createElement(TheAvenues, { counts: withJobsCount(BASE, true, 0) })
    )
    expect(html).toContain('No open roles yet')
    expect(html).toContain('href="/jobs"')
  })
  it('names the eyebrow by tile count', () => {
    expect(avenuesEyebrow(5)).toBe('One index, five avenues')
    expect(avenuesEyebrow(6)).toBe('One index, six avenues')
  })
})

describe('postJobQuotaLine', () => {
  it('counts what is left for an included plan', () => {
    expect(postJobQuotaLine({ limit: 1, used: 0 })).toBe('1 of 1 included postings left')
    expect(postJobQuotaLine({ limit: 1, used: 1 })).toBe('0 of 1 included postings left')
    expect(postJobQuotaLine({ limit: 3, used: 5 })).toBe('0 of 3 included postings left')
  })
  it('names the price when nothing is included', () => {
    expect(postJobQuotaLine({ limit: 0, used: 0 })).toBe('Each role is $9.99 for 30 days')
  })
  it('drops the count when the read failed', () => {
    expect(postJobQuotaLine(null)).toBeNull()
  })
})

describe('PostJobCard', () => {
  const render = (owner: boolean) =>
    renderToStaticMarkup(
      createElement(PostJobCard, {
        readiness: owner ? { state: 'live' } : null,
        quotaLine: '1 of 1 included postings left',
      })
    )
  it('is invisible with Jobs off or posting off', () => {
    vi.stubEnv('FEATURE_JOBS_OPEN', 'false')
    vi.stubEnv('FEATURE_POSTING_SUBMISSIONS', 'true')
    expect(render(true)).toBe('')
    vi.stubEnv('FEATURE_JOBS_OPEN', 'true')
    vi.stubEnv('FEATURE_POSTING_SUBMISSIONS', 'false')
    expect(render(true)).toBe('')
  })
  it('shows the button and count to an owner when on, nothing without a readiness', () => {
    vi.stubEnv('FEATURE_JOBS_OPEN', 'true')
    vi.stubEnv('FEATURE_POSTING_SUBMISSIONS', 'true')
    const html = render(true)
    expect(html).toContain('href="/add-job"')
    expect(html).toContain('Post a job')
    expect(html).toContain('1 of 1 included postings left')
    expect(render(false)).toBe('')
  })
})

describe('NowHiringView', () => {
  const role = (i: number): DiscoveryEntity =>
    ({
      id: `r${i}`,
      entity_type: 'job',
      name: `Role ${i}`,
      slug: `role-${i}`,
      city: { name: 'Atlanta', slug: 'atlanta-ga', state_abbr: 'GA' },
    }) as unknown as DiscoveryEntity

  it('renders nothing with no roles', () => {
    expect(renderToStaticMarkup(createElement(NowHiringView, { businessId: BIZ, roles: [], total: 0 }))).toBe('')
  })
  it('shows an h2 and the cards, no see-all when all fit', () => {
    const html = renderToStaticMarkup(
      createElement(NowHiringView, { businessId: BIZ, roles: [role(1), role(2)], total: 2 })
    )
    expect(html).toContain('<h2')
    expect(html).toContain('Now hiring')
    expect(html).toContain('Role 1')
    expect(html).toContain('Role 2')
    expect(html).not.toContain('See all')
  })
  it('links to the filtered board when there are more', () => {
    const html = renderToStaticMarkup(
      createElement(NowHiringView, { businessId: BIZ, roles: [role(1), role(2), role(3)], total: 5 })
    )
    expect(html).toContain('See all 5 roles')
    expect(html).toContain(`href="/jobs?business=${BIZ}"`)
    expect(seeAllRolesLabel(5)).toBe('See all 5 roles')
  })
})

describe('business filter on the board', () => {
  it('parses a uuid and drops junk', () => {
    expect(parseJobFilters({ business: BIZ }).business).toBe(BIZ)
    expect('business' in parseJobFilters({ business: 'nope' })).toBe(false)
  })
  it('counts as a filter and round-trips into the URL', () => {
    const f = parseJobFilters({ business: BIZ })
    expect(hasJobFilters(f)).toBe(true)
    expect(buildJobsUrl(f)).toBe(`/jobs?business=${BIZ}`)
  })
})

describe('getOpenRolesForBusiness', () => {
  /** A fake client that records filters and answers per table. */
  function fake(jobRows: Array<{ listing_id: string }>) {
    const calls: Array<[string, string, unknown]> = []
    const make = (table: string): unknown => {
      const chain: Record<string, unknown> = {}
      const record = (name: string) => (...a: unknown[]) => {
        calls.push([table, name, a])
        return chain
      }
      for (const n of ['select', 'or', 'in', 'eq', 'is', 'order', 'range', 'limit']) chain[n] = record(n)
      chain.then = (res: (v: unknown) => unknown) =>
        res(table === 'listing_details_job' ? { data: jobRows, error: null } : { data: [], error: null, count: 0 })
      return chain
    }
    return { client: { from: make }, calls }
  }

  it('asks for this business only, open deadlines only, published jobs only', async () => {
    const { client, calls } = fake([{ listing_id: 'j1' }])
    const res = await getOpenRolesForBusiness(BIZ, 3, client)
    expect(res).toEqual({ entities: [], total: 0 })
    expect(calls).toContainEqual(['listing_details_job', 'eq', ['hiring_listing_id', BIZ]])
    expect(calls.some(([t, n, a]) => t === 'listing_details_job' && n === 'or' && String((a as string[])[0]).includes('closes_at.gt.'))).toBe(true)
    expect(calls).toContainEqual(['listings', 'eq', ['status', 'published']])
    expect(calls).toContainEqual(['listings', 'eq', ['entity_type', 'job']])
    expect(calls).toContainEqual(['listings', 'limit', [3]])
  })
  it('never reads listings when no role is open', async () => {
    const { client, calls } = fake([])
    expect(await getOpenRolesForBusiness(BIZ, 3, client)).toEqual({ entities: [], total: 0 })
    expect(calls.some(([t]) => t === 'listings')).toBe(false)
  })
})
