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
// Every bullet below was traced to its gate or limit on 2026-10-03
// (docs/blacqlist/design/plan-features-audit-2026-10.md). Free and Starter are
// on sale, so each of their bullets must be something the code enforces today.
// Growth and Premium are not for sale; their cards render no bullets until they
// are (PricingPlans, UpgradePlans), and their lists hold only what we can
// realistically build. No AI lines until a real model is on.
export const PLANS: PlanMeta[] = [
  {
    slug: 'free',
    name: 'Free',
    tagline: 'Be found.',
    price_monthly: 0,
    price_yearly: 0,
    features: [
      'Your page with hours, contact info, and website',
      'A short description (up to 300 characters)',
      '1 photo',
      'Up to 3 details customers filter by, like outdoor seating',
      'Category, city, and search placement',
      'A map pin once your address is confirmed',
      'Community reviews, checked before they post',
      'Claim it and get Verified, free',
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
      'Up to 10 photos',
      'A video from YouTube or Vimeo',
      'Your full story, with no length limit',
      'Up to 10 details customers filter by',
      'A common questions section (up to 5)',
      'Social links on your page',
      'Reply to reviews in public',
      'See your views, saves, and taps over the last 30 days',
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
      'Up to 25 photos',
      'A storefront for up to 25 products and services',
      'Up to 3 events at a time',
      '1 job posting every 30 days',
      'The search terms that found you, with 12 months of history',
      'Up to 5 team members',
      'Support replies within 1 business day',
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
      'Up to 50 photos',
      'Unlimited products, services, and events',
      '3 job postings every 30 days',
      'Coupons and deals',
      'Booking requests',
      'Up to 3 locations on one account',
      'Your community spend view, once 5 or more receipts are logged',
      'A named support contact',
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
