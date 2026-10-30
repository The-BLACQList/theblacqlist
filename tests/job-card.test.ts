// =============================================================================
// Ticket 149: the job card, business first
// =============================================================================
// vitest runs in node, so the card is rendered to static markup and read as text.
// =============================================================================

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { JobCard, JobCardSkeleton } from '@/components/jobs/JobCard'
import { formatJobPay, formatSalary } from '@/lib/listings/jobPosting'
import { attachJobCardData } from '@/lib/listings/jobCardQuery'
import { buildJobPlace, toJobCardData } from '@/lib/listings/jobCard'
import type { DiscoveryEntity, JobCardData, JobCardDetails } from '@/types'

const EN_DASH = '–'
const EM_DASH = '—'

describe('formatJobPay', () => {
  it('writes a range with an en dash and the period phrase', () => {
    expect(formatJobPay('full-time', 18, 22, 'hour')).toBe(`$18${EN_DASH}$22 an hour`)
    expect(formatJobPay('full-time', 65000, 80000, 'year')).toBe(`$65,000${EN_DASH}$80,000 a year`)
  })

  it('writes a single figure when min equals max', () => {
    expect(formatJobPay('part-time', 20, 20, 'hour')).toBe('$20 an hour')
  })

  it('handles one open bound', () => {
    expect(formatJobPay('contract', 20, null, 'hour')).toBe('From $20 an hour')
    expect(formatJobPay('contract', null, 90000, 'year')).toBe('Up to $90,000 a year')
  })

  it('returns null with no pay on a paid role', () => {
    expect(formatJobPay('full-time', null, null, null)).toBeNull()
  })

  it('says Unpaid for volunteer, even with no pay set', () => {
    expect(formatJobPay('volunteer', null, null, null)).toBe('Unpaid')
  })

  it.each([
    ['hour', 'an hour'],
    ['day', 'a day'],
    ['week', 'a week'],
    ['month', 'a month'],
    ['year', 'a year'],
  ])('uses the %s phrase', (period, phrase) => {
    expect(formatJobPay('full-time', 10, 12, period)).toBe(`$10${EN_DASH}$12 ${phrase}`)
  })

  it('never emits an em dash or spaces around the en dash', () => {
    const out = formatJobPay('full-time', 18, 22, 'hour') as string
    expect(out).not.toContain(EM_DASH)
    expect(out).not.toContain(` ${EN_DASH}`)
    expect(out).not.toContain(`${EN_DASH} `)
  })

  it('leaves formatSalary (JSON-LD, job page) unchanged', () => {
    expect(formatSalary(22, 28, 'hour', 'USD')).toBe('$22 – $28/hr')
  })
})

describe('buildJobPlace', () => {
  it('uses city and state', () => {
    expect(buildJobPlace({ name: 'Austin', state_abbr: 'TX' }, 'on-site')).toBe('Austin, TX')
  })
  it('says Remote for remote roles', () => {
    expect(buildJobPlace({ name: 'Austin', state_abbr: 'TX' }, 'remote')).toBe('Remote')
    expect(buildJobPlace(null, 'remote')).toBe('Remote')
  })
  it('is null with neither', () => {
    expect(buildJobPlace(null, 'on-site')).toBeNull()
  })
})

describe('attachJobCardData', () => {
  type Row = { id: string; entity_type: string; job_details?: JobCardDetails | null }
  const job = (): Row => ({ id: 'j1', entity_type: 'job' })

  it('leaves rows unchanged when the job query errors', async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          in: () => Promise.resolve({ data: null, error: { message: 'boom' } }),
        }),
      }),
    }
    const rows = [job()]
    await attachJobCardData(supabase, rows)
    expect(rows[0]?.job_details).toBeUndefined()
  })

  it('leaves rows unchanged when the client throws', async () => {
    const supabase = {
      from: () => {
        throw new Error('network')
      },
    }
    const rows = [job()]
    await expect(attachJobCardData(supabase, rows)).resolves.toBeUndefined()
    expect(rows[0]?.job_details).toBeUndefined()
  })

  it('keeps pay and dates when only the business query fails', async () => {
    const supabase = {
      from: (table: string) => ({
        select: () => ({
          in: () =>
            table === 'listing_details_job'
              ? Promise.resolve({
                  data: [
                    {
                      listing_id: 'j1',
                      employment_type: 'full-time',
                      workplace_type: 'remote',
                      salary_min: '18',
                      salary_max: '22',
                      salary_period: 'hour',
                      closes_at: '2026-11-15T12:00:00Z',
                      hiring_listing_id: 'b1',
                    },
                  ],
                  error: null,
                })
              : Promise.reject(new Error('down')),
        }),
      }),
    }
    const rows = [job()]
    await attachJobCardData(supabase, rows)
    expect(rows[0]?.job_details?.salaryMin).toBe(18)
    expect(rows[0]?.job_details?.businessName).toBeNull()
  })
})

const base: JobCardData = {
  id: 'j1',
  href: '/austin/jobs/barista',
  title: 'Barista',
  businessName: 'Sable Coffee',
  businessLogoUrl: 'https://example.com/logo.png',
  place: 'Remote',
  employmentType: 'full-time',
  workplaceType: 'remote',
  salaryMin: 18,
  salaryMax: 22,
  salaryPeriod: 'hour',
  closesAt: '2026-11-15T17:00:00Z',
}

const render = (job: JobCardData, now = new Date('2026-10-30T12:00:00Z')) =>
  renderToStaticMarkup(createElement(JobCard, { job, now }))

describe('JobCard', () => {
  it('shows business, place, title, chips and the closing date', () => {
    const html = render(base)
    expect(html).toContain('Sable Coffee')
    expect(html).toContain('Barista')
    expect(html).toContain(`$18${EN_DASH}$22 an hour`)
    expect(html).toContain('Full-time')
    expect(html).toContain('Remote')
    expect(html).toContain('Closes Nov 15')
  })

  it('says Remote once on a remote role', () => {
    expect(render(base).match(/Remote/g)).toHaveLength(1)
    expect(render({ ...base, businessName: null, businessLogoUrl: null }).match(/Remote/g)).toHaveLength(1)
  })

  it('keeps the city in the top line for on-site roles', () => {
    const html = render({ ...base, workplaceType: 'on-site', place: 'Austin, TX' })
    expect(html).toContain('Sable Coffee · Austin, TX')
    expect(html).not.toContain('Remote')
  })

  it('uses teal on the kind-of-work chip only', () => {
    const html = render(base)
    expect(html.match(/text-jobs-ink/g)).toHaveLength(1)
    expect(html.match(/border-jobs\/40/g)).toHaveLength(1)
  })

  it('says Unpaid for volunteer and omits the foot with no closing date', () => {
    const html = render({
      ...base,
      employmentType: 'volunteer',
      salaryMin: null,
      salaryMax: null,
      salaryPeriod: null,
      closesAt: null,
    })
    expect(html).toContain('Unpaid')
    expect(html).not.toContain('Closes')
    expect(html).not.toContain('Closed')
  })

  it('renders without a hiring business and without an empty logo box', () => {
    const html = render({
      ...base,
      businessName: null,
      businessLogoUrl: null,
      workplaceType: 'on-site',
      place: 'Austin, TX',
    })
    expect(html).toContain('Austin, TX')
    expect(html).not.toContain('<img')
  })

  it('still renders title and place when the details never arrived', () => {
    const entity = {
      id: 'j2',
      name: 'Moderator',
      slug: 'moderator',
      entity_type: 'job',
      city: { name: 'Austin', slug: 'austin', state_abbr: 'TX' },
    } as unknown as DiscoveryEntity
    const html = render(toJobCardData(entity))
    expect(html).toContain('Moderator')
    expect(html).toContain('Austin, TX')
  })

  it('reads Closed and dims the card when the date has passed', () => {
    const html = render({ ...base, closesAt: '2026-10-01T17:00:00Z' })
    expect(html).toContain('Closed Oct 1')
    expect(html).toContain('opacity-70')
  })

  it('has one link and a decorative logo', () => {
    const html = render(base)
    expect(html.match(/<a /g)).toHaveLength(1)
    expect(html).toContain('alt=""')
  })

  it('never says Black-owned or Ally and has no em dash', () => {
    const html = render(base)
    expect(html).not.toMatch(/black-owned/i)
    expect(html).not.toMatch(/\bally\b/i)
    expect(html).not.toContain(EM_DASH)
  })

  it('has a skeleton', () => {
    expect(renderToStaticMarkup(createElement(JobCardSkeleton))).toContain('aria-hidden')
  })
})
