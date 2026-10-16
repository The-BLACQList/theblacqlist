import { readFileSync } from 'fs'
import path from 'path'

import { render } from '@react-email/components'
import { describe, expect, it } from 'vitest'

import {
  POLICY_UPDATE,
  isPolicyUpdateInEffect,
  livePolicyVersion,
  nextVersionSubtitle,
} from '@/lib/legal/policyUpdate'
import {
  PolicyUpdateNoticeEmail,
  policyUpdateNoticeSubject,
} from '@/lib/email/templates/policy-update-notice'

const at = (iso: string) => new Date(iso)

describe('the policy update switch (ticket 139)', () => {
  it('took effect at midnight Eastern on October 16, 2026, the day it was posted', () => {
    expect(isPolicyUpdateInEffect(at('2026-10-16T03:59:59Z'))).toBe(false)
    expect(isPolicyUpdateInEffect(at('2026-10-16T04:00:00Z'))).toBe(true)
    expect(POLICY_UPDATE.effectiveOnLabel).toBe(POLICY_UPDATE.postedOnLabel)
  })

  it('shows the new text from then on', () => {
    expect(livePolicyVersion(at('2026-10-15T12:00:00Z'))).toBe('current')
    expect(livePolicyVersion(at('2026-10-16T12:00:00Z'))).toBe('next')
    expect(livePolicyVersion(at('2026-11-03T12:00:00Z'))).toBe('next')
  })

  it('shows one "Last updated" date once posted and effective are the same day', () => {
    expect(nextVersionSubtitle(at('2026-10-16T12:00:00Z'))).toBe('Last updated: October 16, 2026')
  })
})

describe('the policy update notice email', () => {
  it('says the update has happened', () => {
    expect(policyUpdateNoticeSubject()).toBe("We've updated our Privacy Policy and Terms")
  })

  it('links all three live policies', async () => {
    const html = await render(PolicyUpdateNoticeEmail({ siteUrl: 'https://example.test' }))
    expect(html).toContain('href="https://example.test/privacy"')
    expect(html).toContain('href="https://example.test/terms"')
    expect(html).toContain('href="https://example.test/cookies"')
    expect(html).not.toContain('/upcoming')
  })

  it('says when it took effect and that nothing is needed', async () => {
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
})
