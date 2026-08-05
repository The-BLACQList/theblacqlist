import { describe, it, expect, vi } from 'vitest'

// The Resend client throws at import when RESEND_API_KEY is unset (test env),
// so stub the email module before importing the handlers module under test.
vi.mock('@/lib/email/resend', () => ({ sendEmail: vi.fn() }))

import { normalizeStatus } from '@/lib/services/billing/webhookHandlers'

// normalizeStatus maps every Stripe subscription status onto one of the app's
// subscriptions.status CHECK values.
describe('normalizeStatus', () => {
  const cases: Record<string, string> = {
    active: 'active',
    trialing: 'trialing',
    past_due: 'past_due',
    unpaid: 'past_due',
    canceled: 'canceled',
    incomplete_expired: 'canceled',
    incomplete: 'inactive',
    paused: 'inactive',
  }

  for (const [input, expected] of Object.entries(cases)) {
    it(`maps ${input} → ${expected}`, () => {
      expect(normalizeStatus(input as Parameters<typeof normalizeStatus>[0])).toBe(expected)
    })
  }
})
