// One support inbox: source contracts (user feedback plan, 2026-11-19).
//
// The founder's decisions: every new Report a Problem submission emails
// support@, replies to site emails reach support@ (booking requests keep the
// requester), and the Contact page lists support@ with public reply times that
// match the plan. Like problem-reports.test.ts this reads source, since the
// pieces are server actions and a server component.

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { SUPPORT_EMAIL } from '@/lib/email/support'

const REPO_ROOT = path.resolve(__dirname, '..')
const read = (rel: string) => readFileSync(path.join(REPO_ROOT, rel), 'utf8')

describe('lib/email/support.ts', () => {
  it('is the one support address', () => {
    expect(SUPPORT_EMAIL).toBe('support@theblacqlist.com')
  })
})

describe('lib/email/resend.ts', () => {
  const src = read('lib/email/resend.ts')

  it('defaults Reply-To to the support inbox instead of noreply', () => {
    expect(src).toContain('replyTo: replyTo ?? SUPPORT_EMAIL')
  })
})

describe('lib/actions/booking/submitBookingRequest.ts', () => {
  it('still sends the business reply straight to the requester', () => {
    expect(read('lib/actions/booking/submitBookingRequest.ts')).toContain(
      'replyTo: request.requester_email'
    )
  })
})

describe('lib/actions/spend/unlistedInvite.ts', () => {
  it('points invite replies (STOP included) at support, not a personal mailbox', () => {
    const src = read('lib/actions/spend/unlistedInvite.ts')
    expect(src).toContain('replyTo: SUPPORT_EMAIL')
    expect(src).not.toContain('admin.user.email')
  })
})

describe('lib/actions/feedback/submitProblemReport.ts', () => {
  const src = read('lib/actions/feedback/submitProblemReport.ts')

  it('emails each new report to support after the row is stored', () => {
    const insert = src.indexOf(".from('problem_reports').insert(")
    const notice = src.indexOf('after(() =>')
    expect(insert).toBeGreaterThan(-1)
    expect(notice).toBeGreaterThan(insert)
    expect(src).toContain('to: SUPPORT_EMAIL')
    expect(src).toContain('ProblemReportNotificationEmail(')
    expect(src).toContain('/admin/feedback')
  })

  it('does not email when the insert failed', () => {
    const failed = src.indexOf("if (error) return { error: 'Failed to send your report.")
    expect(failed).toBeGreaterThan(-1)
    expect(failed).toBeLessThan(src.indexOf('after(() =>'))
  })

  it('keeps control characters out of the subject line', () => {
    expect(src).toContain('subjectPath(pagePath)')
    expect(src).toMatch(/\\u0000-\\u001f\\u007f/)
  })
})

describe('lib/email/templates/problem-report-notification.tsx', () => {
  const src = read('lib/email/templates/problem-report-notification.tsx')

  it('has no em dashes (founder copy rule)', () => {
    expect(src).not.toContain('—')
  })

  it('keeps text at 14px or larger', () => {
    const sizes = [...src.matchAll(/fontSize: '(\d+)px'/g)].map((m) => Number(m[1]))
    expect(sizes.length).toBeGreaterThan(0)
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(14)
  })
})

describe('app/(public)/contact/page.tsx', () => {
  const src = read('app/(public)/contact/page.tsx')

  it('lists support@ for questions and feedback', () => {
    expect(src).toContain("heading: 'Questions and Feedback'")
    expect(src).toContain('email: SUPPORT_EMAIL')
    expect(src).not.toContain('hello@theblacqlist.com')
  })

  it('shows the four public reply times in Title Case', () => {
    expect(src).toContain("{ type: 'Questions and Feedback', time: 'Within 2 Business Days' }")
    expect(src).toContain("{ type: 'Business Claims', time: 'Within 3–5 Business Days' }")
    expect(src).toContain("{ type: 'Press Requests', time: 'Within 2 Business Days' }")
    expect(src).toContain("{ type: 'Privacy Requests', time: 'Within 30 Days' }")
    expect(src).not.toContain('Within 48 hours')
  })
})
