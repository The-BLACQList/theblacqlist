import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkoutTermsConsentOn, renewalLine } from '@/lib/stripe/renewal'

// Ticket 144: the auto-renewal disclosure shown before the owner pays.

describe('renewalLine', () => {
  it('names the price and cycle the owner picked', () => {
    expect(renewalLine('growth', 'monthly')).toBe(
      'Renews automatically at $49 a month until you cancel. Cancel anytime from your dashboard.'
    )
    expect(renewalLine('starter', 'annual')).toBe(
      'Renews automatically at $182 a year until you cancel. Cancel anytime from your dashboard.'
    )
  })

  it('says nothing for Free, which never renews', () => {
    expect(renewalLine('free', 'monthly')).toBeNull()
  })

  it('uses no em dashes (copy voice)', () => {
    expect(renewalLine('premium', 'annual')).not.toMatch(/—/)
  })
})

describe('checkoutTermsConsentOn', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('is off when unset or unrecognized', () => {
    vi.stubEnv('STRIPE_CHECKOUT_TERMS_CONSENT', '')
    expect(checkoutTermsConsentOn()).toBe(false)
    vi.stubEnv('STRIPE_CHECKOUT_TERMS_CONSENT', 'maybe')
    expect(checkoutTermsConsentOn()).toBe(false)
  })

  it('is on for 1, true, on and yes', () => {
    for (const v of ['1', 'true', 'ON', ' yes ']) {
      vi.stubEnv('STRIPE_CHECKOUT_TERMS_CONSENT', v)
      expect(checkoutTermsConsentOn()).toBe(true)
    }
  })
})
