import { describe, it, expect, vi, afterEach } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  loadOpenClaims,
  resolvePostingReadiness,
  type OwnedPageRow,
  type PostingReadiness,
} from '@/lib/jobs/postingReadiness'
import { PostingChecklist } from '@/components/jobs/PostingChecklist'
import { PostJobCard } from '@/components/dashboard/PostJobCard'
import { StepRole } from '@/components/jobs/post/StepRole'
import { EMPTY_POST_JOB } from '@/lib/validations/postJob'

// Ticket 156: /add-job and the dashboard card name the step a user is on before
// they can post a job. Who may post is unchanged (an owned, published page).

const page = (status: string, over: Partial<OwnedPageRow> = {}): OwnedPageRow => ({
  id: `p-${status}`,
  name: `Page ${status}`,
  status,
  entity_type: 'business',
  ...over,
})

describe('resolvePostingReadiness', () => {
  it('is none with no pages and no claims', () => {
    expect(resolvePostingReadiness([], [])).toEqual({ state: 'none' })
  })

  it('is live with any published business page', () => {
    expect(resolvePostingReadiness([page('draft'), page('published')], [{ listings: { name: 'C' } }])).toEqual({
      state: 'live',
    })
  })

  it('ignores event and job pages', () => {
    expect(resolvePostingReadiness([page('published', { entity_type: 'event' })], [])).toEqual({ state: 'none' })
    expect(resolvePostingReadiness([page('published', { entity_type: 'job' })], [])).toEqual({ state: 'none' })
  })

  it('puts a pending page ahead of an open claim and a draft', () => {
    expect(resolvePostingReadiness([page('draft'), page('pending')], [{ listings: { name: 'Claimed Cafe' } }])).toEqual({
      state: 'review',
      name: 'Page pending',
    })
  })

  it('puts an open claim ahead of a draft', () => {
    expect(resolvePostingReadiness([page('draft')], [{ listings: [{ name: 'Claimed Cafe' }] }])).toEqual({
      state: 'review',
      name: 'Claimed Cafe',
    })
  })

  it('names a claim whose listing could not be read', () => {
    expect(resolvePostingReadiness([], [{ listings: null }])).toEqual({ state: 'review', name: 'Your claim' })
  })

  it('is draft with only a draft page', () => {
    expect(resolvePostingReadiness([page('draft')], [])).toEqual({
      state: 'draft',
      pageId: 'p-draft',
      pageName: 'Page draft',
    })
  })
})

describe('loadOpenClaims', () => {
  const client = (result: { data: unknown; error: unknown }) => {
    const calls: Record<string, unknown[]> = {}
    const builder = {
      select: (...a: unknown[]) => ((calls.select = a), builder),
      eq: (...a: unknown[]) => ((calls.eq = a), builder),
      in: (...a: unknown[]) => ((calls.in = a), builder),
      order: async () => result,
    }
    return { calls, supabase: { from: (t: string) => ((calls.from = [t]), builder) } }
  }

  it('reads the user\'s open claims', async () => {
    const { calls, supabase } = client({ data: [{ listings: { name: 'A' } }], error: null })
    const rows = await loadOpenClaims(supabase as never, 'u1')
    expect(rows).toEqual([{ listings: { name: 'A' } }])
    expect(calls.from).toEqual(['claims'])
    expect(calls.eq).toEqual(['claimant_user_id', 'u1'])
    expect(calls.in).toEqual(['status', ['pending', 'under_review']])
  })

  it('treats a failed read as no claims', async () => {
    const { supabase } = client({ data: null, error: { message: 'boom' } })
    expect(await loadOpenClaims(supabase as never, 'u1')).toEqual([])
  })
})

const html = (r: Exclude<PostingReadiness, { state: 'live' }>) =>
  renderToStaticMarkup(createElement(PostingChecklist, { readiness: r }))

describe('PostingChecklist', () => {
  it('none: step 1 is current, with add and claim links', () => {
    const out = html({ state: 'none' })
    expect(out).toContain('Own a business page')
    expect(out).toContain('Add your business')
    expect(out).toContain('Already listed? Find and claim it')
    expect(out).toContain('href="/add-business"')
    expect(out.match(/aria-current="step"/g)).toHaveLength(1)
    expect(out).not.toContain('Done')
  })

  it('draft: step 1 done, links to finish the page', () => {
    const out = html({ state: 'draft', pageId: 'abc', pageName: 'Sweet Tea Bakery' })
    expect(out).toContain('Done')
    expect(out).toContain('Sweet Tea Bakery is still a draft.')
    expect(out).toContain('href="/dashboard/pages/abc/edit"')
    expect(out).toContain('Finish your page')
  })

  it('review: names the page and the 3 to 5 business days', () => {
    const out = html({ state: 'review', name: 'Sweet Tea Bakery' })
    expect(out).toContain('Sweet Tea Bakery: in review, usually 3 to 5 business days.')
    expect(out).toContain('See your page')
  })

  it('writes every step state as text, not colour alone', () => {
    const out = html({ state: 'draft', pageId: 'abc', pageName: 'X' })
    expect(out).toContain('Done')
    expect(out).toContain('Current step')
    expect(out).toContain('Not yet')
  })

  it('uses no em dashes', () => {
    for (const r of [
      { state: 'none' },
      { state: 'draft', pageId: 'a', pageName: 'X' },
      { state: 'review', name: 'X' },
    ] as const) {
      expect(html(r)).not.toContain('—')
    }
  })
})

describe('PostJobCard with readiness', () => {
  afterEach(() => vi.unstubAllEnvs())
  const card = (readiness: PostingReadiness | null) =>
    renderToStaticMarkup(createElement(PostJobCard, { readiness, quotaLine: '1 of 1 included postings left' }))

  it('stays hidden with Jobs off whatever the step', () => {
    vi.stubEnv('FEATURE_JOBS_OPEN', 'false')
    vi.stubEnv('FEATURE_POSTING_SUBMISSIONS', 'true')
    expect(card({ state: 'none' })).toBe('')
    expect(card({ state: 'live' })).toBe('')
  })

  it('shows the step and a disabled button that says why', () => {
    vi.stubEnv('FEATURE_JOBS_OPEN', 'true')
    vi.stubEnv('FEATURE_POSTING_SUBMISSIONS', 'true')
    const out = card({ state: 'review', name: 'Sweet Tea Bakery' })
    expect(out).toContain('aria-disabled="true"')
    expect(out).toContain('aria-describedby="post-job-reason"')
    expect(out).toContain('Your page needs to be live first.')
    expect(out).toContain('in review, usually 3 to 5 business days')
    expect(out).not.toContain('href="/add-job"')
    expect(out).not.toContain('1 of 1 included postings left')
  })

  it('links to /add-job once a page is live', () => {
    vi.stubEnv('FEATURE_JOBS_OPEN', 'true')
    vi.stubEnv('FEATURE_POSTING_SUBMISSIONS', 'true')
    const out = card({ state: 'live' })
    expect(out).toContain('href="/add-job"')
    expect(out).not.toContain('aria-disabled')
    expect(out).not.toContain('Own a business page')
  })
})

describe('StepRole with readiness', () => {
  const step = (readiness: PostingReadiness | null) =>
    renderToStaticMarkup(
      createElement(StepRole, { values: EMPTY_POST_JOB, errors: {}, set: () => {}, businesses: [], categories: [], readiness })
    )

  it('shows the checklist when the user has no live page', () => {
    const out = step({ state: 'draft', pageId: 'abc', pageName: 'Sweet Tea Bakery' })
    expect(out).toContain('Who can post a job')
    expect(out).toContain('Finish your page')
    expect(out).not.toContain('You need a published business page first')
  })

  it('keeps the plain empty state when readiness is unknown', () => {
    expect(step(null)).toContain('You need a published business page first')
  })
})
