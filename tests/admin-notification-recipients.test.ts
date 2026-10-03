// =============================================================================
// Admin notification recipients (2026-10-03)
// =============================================================================
// Sentry: Resend rejected "New claim submitted: ..." with "Invalid `to` field".
// The claim and the claimant's email went through; only the admin copy failed,
// because ADMIN_NOTIFICATION_EMAIL was not one plain address. The value is now
// parsed forgivingly, and a value with no usable address skips the send with
// one warning instead of a rejected send on every claim.
// =============================================================================

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { parseAdminRecipients } from '@/lib/email/adminRecipients'

const { captureMessage } = vi.hoisted(() => ({ captureMessage: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureMessage, captureException: vi.fn() }))

const ROOT = path.resolve(__dirname, '..')
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8')

// Test-only placeholder addresses on the reserved example domain.
const A = 'admin@example.com'
const B = 'ops@example.com'

describe('parseAdminRecipients', () => {
  it('is empty when unset or blank', () => {
    expect(parseAdminRecipients(undefined)).toEqual([])
    expect(parseAdminRecipients('')).toEqual([])
    expect(parseAdminRecipients('   ')).toEqual([])
  })

  it('keeps one plain address', () => {
    expect(parseAdminRecipients(A)).toEqual([A])
  })

  it('strips quotes, spaces and trailing newlines', () => {
    expect(parseAdminRecipients(`"${A}"`)).toEqual([A])
    expect(parseAdminRecipients(`'${A}'`)).toEqual([A])
    expect(parseAdminRecipients(`  ${A}\n`)).toEqual([A])
  })

  it('splits several addresses on commas, semicolons and newlines', () => {
    expect(parseAdminRecipients(`${A}, ${B}`)).toEqual([A, B])
    expect(parseAdminRecipients(`${A};${B}`)).toEqual([A, B])
    expect(parseAdminRecipients(`"${A}","${B}"`)).toEqual([A, B])
    expect(parseAdminRecipients(`${A}\n${B}`)).toEqual([A, B])
  })

  it('keeps the Name <address> form Resend accepts', () => {
    expect(parseAdminRecipients(`BLACQList Admin <${A}>`)).toEqual([`BLACQList Admin <${A}>`])
  })

  it('drops entries that are not addresses and duplicates', () => {
    expect(parseAdminRecipients(`not-an-email, ${A}, ${A}`)).toEqual([A])
    expect(parseAdminRecipients('admin@example')).toEqual([])
    expect(parseAdminRecipients('mailto admin')).toEqual([])
  })
})

describe('adminNotificationRecipients', () => {
  const original = process.env.ADMIN_NOTIFICATION_EMAIL

  beforeEach(() => {
    vi.resetModules()
    captureMessage.mockClear()
  })
  afterEach(() => {
    if (original === undefined) delete process.env.ADMIN_NOTIFICATION_EMAIL
    else process.env.ADMIN_NOTIFICATION_EMAIL = original
  })

  it('stays quiet when the variable is unset', async () => {
    delete process.env.ADMIN_NOTIFICATION_EMAIL
    const { adminNotificationRecipients } = await import('@/lib/email/adminRecipients')
    expect(adminNotificationRecipients()).toEqual([])
    expect(captureMessage).not.toHaveBeenCalled()
  })

  it('warns once, without the value, when nothing valid is set', async () => {
    process.env.ADMIN_NOTIFICATION_EMAIL = 'not an address'
    const { adminNotificationRecipients } = await import('@/lib/email/adminRecipients')
    expect(adminNotificationRecipients()).toEqual([])
    expect(adminNotificationRecipients()).toEqual([])
    expect(captureMessage).toHaveBeenCalledTimes(1)
    expect(String(captureMessage.mock.calls[0]![0])).not.toContain('not an address')
  })

  it('returns the parsed list when set', async () => {
    process.env.ADMIN_NOTIFICATION_EMAIL = `"${A}, ${B}"`
    const { adminNotificationRecipients } = await import('@/lib/email/adminRecipients')
    expect(adminNotificationRecipients()).toEqual([A, B])
    expect(captureMessage).not.toHaveBeenCalled()
  })
})

describe('admin email call sites', () => {
  for (const rel of ['lib/actions/claims/createClaim.ts', 'lib/actions/owner/submitVerificationRequest.ts']) {
    it(`${rel} sends through the parsed recipients`, () => {
      const src = read(rel)
      expect(src).not.toContain('process.env.ADMIN_NOTIFICATION_EMAIL')
      expect(src).toContain('const adminRecipients = adminNotificationRecipients()')
      expect(src).toContain('to: adminRecipients,')
    })
  }

  it('sendEmail accepts a list of recipients', () => {
    expect(read('lib/email/resend.ts')).toContain('to: string | string[]')
  })
})
