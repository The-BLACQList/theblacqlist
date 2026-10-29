// Ticket 144: the auto-renewal disclosure. One sentence, used above the
// checkout button on /dashboard/upgrade and again on Stripe Checkout, so the
// owner reads the same terms in both places before paying.

import { PLANS, type BillingCycle, type PlanSlug } from './plans'

/** "Renews automatically at $49 a month until you cancel. Cancel anytime
 *  from your dashboard." Null for Free, which never renews. */
export function renewalLine(slug: PlanSlug, cycle: BillingCycle): string | null {
  const plan = PLANS.find((p) => p.slug === slug)
  if (!plan || plan.slug === 'free') return null
  const price = cycle === 'annual' ? plan.price_yearly : plan.price_monthly
  const per = cycle === 'annual' ? 'year' : 'month'
  return `Renews automatically at $${price} a ${per} until you cancel. Cancel anytime from your dashboard.`
}

/** Whether Stripe Checkout asks the owner to accept the Terms before paying.
 *  Off unless STRIPE_CHECKOUT_TERMS_CONSENT is on, because Stripe refuses the
 *  session when no Terms URL is set in that Stripe account's settings. */
export function checkoutTermsConsentOn(): boolean {
  const v = (process.env.STRIPE_CHECKOUT_TERMS_CONSENT ?? '').trim().toLowerCase()
  return ['1', 'true', 'on', 'yes'].includes(v)
}
