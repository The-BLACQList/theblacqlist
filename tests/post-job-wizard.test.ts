import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StepRole } from '@/components/jobs/post/StepRole'
import { StepPayPlace } from '@/components/jobs/post/StepPayPlace'
import { StepApply } from '@/components/jobs/post/StepApply'
import { StepReview } from '@/components/jobs/post/StepReview'
import { JobPreview } from '@/components/jobs/post/JobPreview'
import { EMPTY_POST_JOB, type PostJobValues } from '@/lib/validations/postJob'
import type { HiringBusiness } from '@/components/jobs/post/types'

const biz: HiringBusiness = { id: 'b1', name: 'Soul Kitchen', logoUrl: null, cityName: 'Austin', stateAbbr: 'TX' }
const set = () => {}
const values: PostJobValues = {
  ...EMPTY_POST_JOB,
  hiringListingId: 'b1',
  name: 'Line Cook',
  tagline: 'Hot line, fast kitchen',
  employmentType: 'full-time',
  salaryMin: '18',
  salaryMax: '22',
  salaryPeriod: 'hour',
  applyEmail: 'a@example.com',
  description: 'Run the grill during dinner service.',
}
const priceLine = { kind: 'included', text: 'Included with your plan.', button: 'Submit for review' } as const

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el)
const all = [
  () => html(createElement(StepRole, { values, errors: {}, set, businesses: [biz], categories: [] })),
  () => html(createElement(StepPayPlace, { values, errors: {}, set, business: biz })),
  () => html(createElement(StepApply, { values, errors: {}, set })),
  () => html(createElement(StepReview, { values, business: biz, categoryName: 'Food', priceLine, onEdit: set })),
  () => html(createElement(JobPreview, { values, business: biz })),
]

describe('post-a-job wizard pieces', () => {
  it('never shows an ownership label', () => {
    for (const r of all) expect(r()).not.toMatch(/Black-owned|Black owned|Ally/i)
  })

  it('shows the pay hint and hides pay for volunteers', () => {
    expect(all[1]!()).toContain('Roles with a pay range get more applicants.')
    const vol = html(
      createElement(StepPayPlace, { values: { ...values, employmentType: 'volunteer' }, errors: {}, set, business: biz })
    )
    expect(vol).toContain('Shown as Unpaid')
    expect(vol).not.toContain('Lowest pay')
  })

  it('hides the place for remote roles', () => {
    const remote = html(
      createElement(StepPayPlace, { values: { ...values, workplaceType: 'remote' }, errors: {}, set, business: biz })
    )
    expect(remote).not.toContain('Austin')
    expect(all[1]!()).toContain('Austin, TX')
  })

  it('tells a user with no business to add one first', () => {
    const out = html(createElement(StepRole, { values, errors: {}, set, businesses: [], categories: [] }))
    expect(out).toContain('You need a published business page first')
    expect(out).toContain('href="/add-business"')
  })

  it('has no default kind of work', () => {
    const out = html(
      createElement(StepRole, { values: { ...values, employmentType: '' }, errors: {}, set, businesses: [biz], categories: [] })
    )
    expect(out).toContain('Choose one')
    expect(out).not.toContain('Select one')
  })

  it('links inline errors with aria-describedby', () => {
    const out = html(createElement(StepApply, { values: { ...values, description: '' }, errors: { description: 'Too short.' }, set }))
    expect(out).toContain('aria-describedby="description-hint description-error"')
    expect(out).toContain('id="description-error"')
  })

  it('puts the required marker on the apply group, not the inputs', () => {
    const out = html(createElement(StepApply, { values, errors: {}, set }))
    expect(out).toContain('<legend')
    expect(out).toContain('name="apply_url"')
    expect(out).not.toMatch(/<input[^>]*\brequired\b/)
  })

  it('review lists an Edit control per section and the price line', () => {
    const out = all[3]!()
    expect(out.match(/>Edit</g)?.length).toBeGreaterThanOrEqual(9)
    expect(out).toContain('Included with your plan.')
  })

  it('preview falls back to a placeholder title', () => {
    const out = html(createElement(JobPreview, { values: EMPTY_POST_JOB, business: null }))
    expect(out).toContain('Your job title')
  })
})
