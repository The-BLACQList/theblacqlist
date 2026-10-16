import { readFileSync } from 'fs'
import path from 'path'

import { render } from '@react-email/components'
import { describe, expect, it } from 'vitest'

import {
  MIN_NOTICE_DAYS,
  POLICY_UPDATE,
  isPolicyUpdateInEffect,
  livePolicyVersion,
  nextVersionSubtitle,
  noticeWindowIsOpen,
} from '@/lib/legal/policyUpdate'
import {
  PolicyUpdateNoticeEmail,
  policyUpdateNoticeSubject,
} from '@/lib/email/templates/policy-update-notice'

const at = (iso: string) => new Date(iso)

describe('the policy update switch (ticket 139)', () => {
  it('switches at midnight Eastern on November 2, 2026', () => {
    expect(isPolicyUpdateInEffect(at('2026-11-02T04:59:59Z'))).toBe(false)
    expect(isPolicyUpdateInEffect(at('2026-11-02T05:00:00Z'))).toBe(true)
  })

  it('shows the current text before then and the new text after', () => {
    expect(livePolicyVersion(at('2026-10-19T12:00:00Z'))).toBe('current')
    expect(livePolicyVersion(at('2026-11-03T12:00:00Z'))).toBe('next')
  })

  it('says "Takes effect" before the switch and "In effect since" after', () => {
    expect(nextVersionSubtitle(at('2026-10-20T12:00:00Z'))).toBe(
      'Last updated: October 16, 2026 · Takes effect: November 2, 2026'
    )
    expect(nextVersionSubtitle(at('2026-11-02T12:00:00Z'))).toBe(
      'Last updated: October 16, 2026 · In effect since: November 2, 2026'
    )
  })

  it('keeps the send-by day at least 14 calendar days before the effective day', () => {
    // Compare calendar days, so the daylight saving change on November 1 does
    // not shave an hour off and fool the check.
    const day = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))
    const days = (day(POLICY_UPDATE.effectiveAt) - day(POLICY_UPDATE.sendBy)) / 86_400_000
    expect(days).toBeGreaterThanOrEqual(MIN_NOTICE_DAYS)
  })

  it('keeps the notice window open through the end of October 19 Eastern only', () => {
    expect(noticeWindowIsOpen(at('2026-10-16T12:00:00Z'))).toBe(true)
    expect(noticeWindowIsOpen(at('2026-10-20T03:59:59Z'))).toBe(true)
    expect(noticeWindowIsOpen(at('2026-10-20T04:00:00Z'))).toBe(false)
  })
})

describe('the policy update notice email', () => {
  it('names the effective date in the subject', () => {
    expect(policyUpdateNoticeSubject()).toContain(POLICY_UPDATE.effectiveOnLabel)
  })

  it('links all three updated policies', async () => {
    const html = await render(PolicyUpdateNoticeEmail({ siteUrl: 'https://example.test' }))
    expect(html).toContain('href="https://example.test/privacy/upcoming"')
    expect(html).toContain('href="https://example.test/terms/upcoming"')
    expect(html).toContain('href="https://example.test/cookies/upcoming"')
  })

  it('says when it takes effect and that nothing is needed', async () => {
    const html = await render(PolicyUpdateNoticeEmail({}))
    expect(html).toContain(POLICY_UPDATE.effectiveOnLabel)
    expect(html).toContain('need to do anything')
    expect(html).toContain('privacy@theblacqlist.com')
  })
})

describe('the policy notice send script', () => {
  const source = readFileSync(path.resolve(process.cwd(), 'scripts/ops/send-policy-notice.ts'), 'utf8')

  it('never prints an email address', () => {
    const printLines = source.split('\n').filter((l) => /console\.(log|error|warn|info)|fail\(/.test(l))
    for (const line of printLines) expect(line).not.toMatch(/\.email\b|recipient\b|\bto\b:/)
  })

  it('saves user ids, not addresses, to its progress file', () => {
    expect(source).toContain('sentIds.add(recipient.id)')
    expect(source).not.toMatch(/sentIds\.add\([^)]*email/)
  })

  it('is a dry run unless --send and a matching --confirm are given', () => {
    expect(source).toContain("process.argv.includes('--send')")
    expect(source).toContain("argValue('confirm') !== String(remaining.length)")
  })

  it('refuses to send once the notice window has closed', () => {
    expect(source).toContain('noticeWindowIsOpen()')
  })
})
