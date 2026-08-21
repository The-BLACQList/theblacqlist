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
//
// Every tier is sold to every business at the same price regardless of ownership label
// (Black-Owned / Certified Black-Owned / Ally). No tier, price, or benefit is restricted by
// ownership, and the Certified badge is earned, never purchased — see the note in
// `lib/stripe/features.ts`. Do not add an ownership-conditional plan or price here.
//
// Entitlements behind this copy live in `lib/stripe/features.ts`. When a bullet changes, change the
// gate or limit too — this list is marketing copy, not the enforcement boundary.
export const PLANS: PlanMeta[] = [
  {
    slug: 'free',
    name: 'Free',
    tagline: 'Be found.',
    price_monthly: 0,
    price_yearly: 0,
    features: [
      'Listing page with contact info & hours',
      '1 photo',
      'Category, city & map placement',
      'Appear in search and city pages',
      'Community reviews on your page',
    ],
    cta: 'Get started',
    highlighted: false,
  },
  {
    slug: 'starter',
    name: 'Starter',
    tagline: 'Look legitimate.',
    price_monthly: 19,
    price_yearly: 182,
    features: [
      'Everything in Free',
      'Verified badge',
      'Up to 10 photos and 1 video',
      'Full-length description & 10 tags',
      'FAQ section (up to 5)',
      'Respond to reviews',
      'Owner analytics (30-day history)',
      'Social links on your page',
      '10 AI listing assists per month',
      'Remove "Powered by BLACQList" badge',
    ],
    cta: 'Upgrade to Starter',
    highlighted: false,
  },
  {
    slug: 'growth',
    name: 'Growth',
    tagline: 'Get chosen.',
    price_monthly: 49,
    price_yearly: 470,
    features: [
      'Everything in Starter',
      'Up to 25 photos and 3 videos',
      'Products & services storefront (up to 25)',
      'Service menu with pricing',
      'Events (up to 3 active) & team members',
      '1 free job posting every 30 days',
      'Rating breakdown: service, quality, value',
      'Unlimited FAQs and tags',
      'Priority search placement',
      'Featured collections & BLACQLight eligibility',
      'Full analytics (search terms, 12-month history)',
      '100 AI assists per month',
      'Priority support',
    ],
    cta: 'Upgrade to Growth',
    highlighted: true,
  },
  {
    slug: 'premium',
    name: 'Premium',
    tagline: 'Own the category.',
    price_monthly: 99,
    price_yearly: 950,
    features: [
      'Everything in Growth',
      'Up to 50 photos and unlimited video',
      'Unlimited products, services & events',
      '3 free job postings every 30 days',
      'Coupons & deals',
      'Booking and appointment requests',
      'Up to 3 locations on one account',
      'Homepage featured placement',
      'Sponsored Spotlight credit ($299 value)',
      'Category exclusivity in one city',
      'Community spend impact for your business',
      '500 AI assists per month + advanced agents',
      'Dedicated account support',
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
