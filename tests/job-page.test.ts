// =============================================================================
// Ticket 151: the job page as a fact sheet
// =============================================================================

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { EntityJobDetails } from '@/components/entity-page/EntityJobDetails'
import { JobHowToApply } from '@/components/entity-page/job/JobHowToApply'
import { copyToClipboard } from '@/lib/clipboard'
import { buildJobFacts } from '@/lib/listings/jobFacts'
import { formatCloseDate, isRoleClosed } from '@/lib/listings/jobPosting'
import type { EntityPageData, JobDetails } from '@/types'

const NOW = new Date('2026-11-01T12:00:00Z')

const baseJob: JobDetails = {
  description: 'Line one.\nLine two.',
  employment_type: 'full-time',
  workplace_type: 'on-site',
  salary_min: 18,
  salary_max: 22,
  salary_period: 'hour',
  salary_currency: 'USD',
  apply_url: null,
  apply_email: null,
  posted_at: '2026-10-01T00:00:00Z',
  closes_at: '2026-12-05T17:00:00Z',
  cta_type: 'apply',
  cta_url: null,
  hiring: null,
}

const city = { name: 'Austin', slug: 'austin', state_abbr: 'TX' }

function entity(job: Partial<JobDetails>, withCity = true): EntityPageData {
  return {
    name: 'Line Cook',
    city: withCity ? city : null,
    job: { ...baseJob, ...job },
  } as unknown as EntityPageData
}

function html(e: EntityPageData): string {
  return renderToStaticMarkup(createElement(EntityJobDetails, { entity: e, now: NOW }))
}

describe('isRoleClosed', () => {
  it('is false with no date or a bad date', () => {
    expect(isRoleClosed(null, NOW)).toBe(false)
    expect(isRoleClosed('nope', NOW)).toBe(false)
  })
  it('is true only after the instant has passed', () => {
    expect(isRoleClosed('2026-10-31T00:00:00Z', NOW)).toBe(true)
    expect(isRoleClosed('2026-11-02T00:00:00Z', NOW)).toBe(false)
  })
})

describe('formatCloseDate', () => {
  it('uses the Eastern calendar day', () => {
    // 02:00 UTC on Nov 4 is still Nov 3 in New York.
    expect(formatCloseDate('2026-11-04T02:00:00Z')).toBe('Nov 3')
    expect(formatCloseDate('2026-11-04T02:00:00Z', 'long')).toBe('November 3, 2026')
    expect(formatCloseDate('garbage')).toBeNull()
  })
})

describe('buildJobFacts', () => {
  const labels = (rows: { label: string }[]) => rows.map((r) => r.label)

  it('lists Type, Where, Pay, Closes for an on-site paid role', () => {
    const rows = buildJobFacts(baseJob, city, NOW)
    expect(labels(rows)).toEqual(['Type', 'Where', 'Pay', 'Closes'])
    expect(rows[0]!.value).toBe('Full-time, On-site')
    expect(rows[1]!.value).toBe('Austin, TX')
    expect(rows[2]!.value).toBe('$18–$22 an hour')
  })

  it('says Remote once: in Where, not in Type', () => {
    const rows = buildJobFacts({ ...baseJob, workplace_type: 'remote' }, city, NOW)
    expect(rows.find((r) => r.label === 'Type')?.value).toBe('Full-time')
    expect(rows.find((r) => r.label === 'Where')?.value).toBe('Remote')
  })

  it('drops Pay when a paid role has none, and says Unpaid for volunteers', () => {
    const none = buildJobFacts({ ...baseJob, salary_min: null, salary_max: null }, city, NOW)
    expect(labels(none)).not.toContain('Pay')
    const vol = buildJobFacts(
      { ...baseJob, employment_type: 'volunteer', salary_min: null, salary_max: null },
      city,
      NOW
    )
    expect(vol.find((r) => r.label === 'Pay')?.value).toBe('Unpaid')
  })

  it('reads Open until filled with no closing date', () => {
    const rows = buildJobFacts({ ...baseJob, closes_at: null }, city, NOW)
    expect(rows.at(-1)).toEqual({ label: 'Closes', value: 'Open until filled' })
  })

  it('hides Where with no city on an on-site role', () => {
    expect(labels(buildJobFacts(baseJob, null, NOW))).not.toContain('Where')
  })

  it('labels a past date Closed', () => {
    const rows = buildJobFacts({ ...baseJob, closes_at: '2026-10-20T17:00:00Z' }, city, NOW)
    expect(rows.at(-1)?.label).toBe('Closed')
  })
})

describe('copyToClipboard', () => {
  it('reports copied on success', async () => {
    let got = ''
    const r = await copyToClipboard('a@b.co', { writeText: async (t) => void (got = t) })
    expect(r).toBe('copied')
    expect(got).toBe('a@b.co')
  })
  it('reports failed when the clipboard refuses', async () => {
    const r = await copyToClipboard('a@b.co', {
      writeText: async () => {
        throw new Error('denied')
      },
    })
    expect(r).toBe('failed')
  })
  it('reports failed with no clipboard at all', async () => {
    expect(await copyToClipboard('a@b.co', undefined)).toBe('failed')
  })
})

describe('job page markup', () => {
  it('email only: shows the text and a Copy button, no Apply link', () => {
    const out = html(entity({ apply_email: 'jobs@example.com' }))
    expect(out).toContain('jobs@example.com')
    expect(out).toContain('Copy email')
    expect(out).not.toContain('target="_blank"')
  })

  it('link only: Apply opens in a new tab, no Copy button', () => {
    const out = html(entity({ apply_url: 'https://example.com/apply' }))
    expect(out).toContain('rel="noopener noreferrer"')
    expect(out).toContain('Apply')
    expect(out).not.toContain('Copy email')
  })

  it('both: link first, then email', () => {
    const out = html(entity({ apply_url: 'https://example.com/a', apply_email: 'a@b.co' }))
    expect(out.indexOf('https://example.com/a')).toBeLessThan(out.indexOf('Copy email'))
  })

  it('neither: says contact details are missing and has no bar', () => {
    const out = html(entity({}))
    expect(out).toContain('Contact details missing')
    expect(out).not.toContain('fixed inset-x-0')
  })

  it('has a mobile apply bar when open', () => {
    expect(html(entity({ apply_email: 'a@b.co' }))).toContain('fixed inset-x-0')
  })

  it('closed: banner shows, no apply actions, no bar', () => {
    const out = html(
      entity({ closes_at: '2026-10-20T17:00:00Z', apply_email: 'a@b.co', apply_url: 'https://x.co' })
    )
    expect(out).toContain('Applications closed on October 20, 2026')
    expect(out).not.toContain('Copy email')
    expect(out).not.toContain('How to apply')
    expect(out).not.toContain('fixed inset-x-0')
  })

  it('breadcrumb links Jobs and the city, and the fact sheet is a dl', () => {
    const out = html(entity({}))
    expect(out).toContain('aria-label="Breadcrumb"')
    expect(out).toContain('href="/jobs"')
    expect(out).toContain('href="/jobs?where=austin"')
    expect(out).toContain('aria-current="page"')
    expect(out).toContain('<dl')
  })

  it('renders the business block only with a hiring business, and no em dashes', () => {
    const none = html(entity({}))
    expect(none).not.toContain('About the business')
    const withBiz = html(
      entity({
        hiring: { name: 'Acme Cafe', url: '/austin/business/acme', logoUrl: null, tagline: 'Good food', cityName: 'Austin' },
      })
    )
    expect(withBiz).toContain('About the business')
    expect(withBiz).toContain('href="/austin/business/acme"')
    expect(withBiz).not.toContain('—')
  })

  it('JobHowToApply renders email in a selectable element', () => {
    const out = renderToStaticMarkup(
      createElement(JobHowToApply, { applyUrl: null, applyEmail: 'x@y.co' })
    )
    expect(out).toContain('id="job-apply-email"')
  })
})
