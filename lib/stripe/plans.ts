export type PlanSlug = 'free' | 'starter' | 'growth' | 'premium'

export type BillingCycle = 'monthly' | 'annual'

export interface PlanMeta {
  slug: PlanSlug
  name: string
  tagline: string
  price_monthly: number
  price_yearly: number
  features: string[]
  cta: string
  highlighted: boolean
}

// Single source of truth for tier names, prices, taglines, and human-facing
// feature lists. Both the dashboard upgrade page and the public /pricing page
// import from here so they can never drift. The DB `plans` table is the source
// only for Stripe price IDs and the active flag — never for display copy.
//
// Annual prices are ~20% off (whole-dollar; annualSavingsPct rounds each to 20%).
export const PLANS: PlanMeta[] = [
  {
    slug: 'free',
    name: 'Free',
    tagline: 'Everything you need to get discovered.',
    price_monthly: 0,
    price_yearly: 0,
    features: ['Basic listing page', 'Contact info & hours', '1 photo', 'Category & city listing'],
    cta: 'Get started',
    highlighted: false,
  },
  {
    slug: 'starter',
    name: 'Starter',
    tagline: 'Stand out and get verified.',
    price_monthly: 19,
    price_yearly: 182,
    features: [
      'Everything in Free',
      'Verified badge',
      'Priority search placement',
      'Owner analytics dashboard',
      'Up to 10 photos',
      'Respond to reviews',
      'Remove "Powered by BLACQList" badge',
    ],
    cta: 'Upgrade to Starter',
    highlighted: false,
  },
  {
    slug: 'growth',
    name: 'Growth',
    tagline: 'Grow with featured placement and editorial reach.',
    price_monthly: 49,
    price_yearly: 470,
    features: [
      'Everything in Starter',
      'Up to 20 photos',
      'Featured collection placement',
      'BLACQLight editorial eligibility',
      'Marketplace category spotlight',
      'Priority support',
    ],
    cta: 'Upgrade to Growth',
    highlighted: true,
  },
  {
    slug: 'premium',
    name: 'Premium',
    tagline: 'The full platform, front and center.',
    price_monthly: 99,
    price_yearly: 950,
    features: [
      'Everything in Growth',
      'Unlimited photos',
      'Sponsored Spotlight credit ($299 value)',
      'Homepage featured placement',
      'Dedicated account support',
      'Early access to new features',
    ],
    cta: 'Upgrade to Premium',
    highlighted: false,
  },
]

export function getPlanMeta(slug: PlanSlug): PlanMeta {
  const plan = PLANS.find((p) => p.slug === slug)
  if (!plan) throw new Error(`Unknown plan slug: ${slug}`)
  return plan
}

// Annual price expressed as an effective monthly rate (yearly / 12).
export function annualPerMonth(plan: PlanMeta): number {
  return Math.round((plan.price_yearly / 12) * 100) / 100
}

// Percentage saved by paying annually vs. 12× the monthly price.
// Annual prices are set so this rounds to ~20% for every paid tier.
export function annualSavingsPct(plan: PlanMeta): number {
  const yearlyAtMonthly = plan.price_monthly * 12
  if (yearlyAtMonthly === 0) return 0
  return Math.round(((yearlyAtMonthly - plan.price_yearly) / yearlyAtMonthly) * 100)
}

// Used by the webhook: map an incoming Stripe price ID back to a plan slug.
// Price IDs are stored in the DB (plans.stripe_price_id_monthly /
// stripe_price_id_yearly) — this helper is a convenience for cases where we
// have a price ID but no DB row in hand (e.g., inside the webhook handler).
export function getPlanSlugByPriceId(
  priceId: string,
  priceMap: Record<string, PlanSlug>
): PlanSlug | null {
  return priceMap[priceId] ?? null
}
