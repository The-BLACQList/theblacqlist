import { aiQuota, pageCap } from '@/lib/stripe/features'

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
// Growth goes on sale on its own, before Premium (founder, 2026-10-28, ticket
// 143). Its list was cut to what works today: search terms, team members and
// 1-day support came off until they are built and staffed. Premium is not for
// sale; a card that cannot be bought renders no bullets (PricingPlans,
// UpgradePlans), and Premium's list holds only what we can realistically build.
// AI writing help is live (2026-10-16), so each paid plan's AI line comes from
// aiQuota() and names the same number the quota enforces (ticket 146, 2026-10-29).
// Ticket 238: a plan belongs to the owner and covers some of their pages. The
// number comes from pageCap(), the same one the database enforces. Free has no
// line: the founder chose (2026-11-21) not to state anything about extra pages.
function pagesLine(slug: PlanSlug): string {
  const cap = pageCap(slug)
  return cap === 1 ? 'Covers 1 of your pages' : `Covers up to ${cap} of your pages`
}

// The plan's AI writing help line, with the number the quota enforces.
function aiLine(slug: PlanSlug): string {
  const quota = aiQuota(slug)
  return quota === null
    ? 'AI writing help: unlimited drafts'
    : `AI writing help: ${quota} drafts every 30 days`
}

// Ticket 239 (founder, 2026-11-21): side by side, it must be obvious how much
// more each step up gives. Each paid list opens with "Everything in {lower}",
// which the cards print as a lead-in, and a line that raises a number says
// what the plan below has, in brackets. The full grid of every limit is
// lib/stripe/planCompare.ts, built from the same limits.
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
      'Up to 3 photos',
      'Up to 3 details customers filter by, like outdoor seating',
      'Category, city, and search placement',
      'A map pin once your address is confirmed',
      'Community reviews, checked before they post',
      'Claim it and get Verified, free',
    ],
    cta: 'Get Started',
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
      aiLine('starter'),
      pagesLine('starter'),
      'The full page layout for businesses, restaurants, and vendors',
      'Up to 10 photos (Free has 3)',
      'A video on your page, your own upload or a link',
      'Your menu or service list, with prices',
      'Your full story, with no length limit',
      'Up to 10 details customers filter by (Free has 3)',
      'A common questions section (up to 5)',
      'Social links on your page',
      '1 extra button on your page, next to your main one',
      'A Happening now post on your page and city page, 1 at a time',
      'Reply to reviews in public',
      'A simple analytics dashboard: views, saves, and taps over the last 30 days',
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
      aiLine('growth'),
      pagesLine('growth'),
      'A storefront for up to 25 products and services',
      'Up to 3 events at a time',
      '1 job posting every 30 days',
      'Up to 25 photos (Starter has 10)',
      'Up to 3 videos (Starter has 1)',
      'No limit on common questions or details customers filter by',
      'Up to 3 Happening now posts at a time (Starter has 1)',
      'Up to 2 extra buttons on your page (Starter has 1)',
      'Analytics going back 12 months (Starter has 30 days)',
    ],
    cta: 'Upgrade to Growth',
    highlighted: true,
  },
  {
    slug: 'premium',
    name: 'Premium',
    tagline: 'Keep customers coming back.',
    price_monthly: 99,
    price_yearly: 950,
    features: [
      'Everything in Growth',
      aiLine('premium'),
      pagesLine('premium'),
      'Coupons and deals',
      'Booking requests',
      'Unlimited products, services, and events (Growth has 25 and 3)',
      '3 job postings every 30 days (Growth has 1)',
      'Up to 50 photos (Growth has 25)',
      'Up to 5 Happening now posts at a time (Growth has 3)',
      'Up to 3 extra buttons on your page (Growth has 2)',
      'Link up to 3 locations so each page lists the others',
      'Your community spend view, once 5 or more receipts are logged',
      'A named support contact',
    ],
    cta: 'Upgrade to Premium',
    highlighted: false,
  },
]

/** "Everything in Starter" when a list opens with it (ticket 239), else null. */
export function leadIn(features: readonly string[]): string | null {
  return features[0]?.startsWith('Everything in ') ? features[0] : null
}

/** The lines a card prints as bullets: the list without its lead-in. */
export function addedLines(features: readonly string[]): readonly string[] {
  return leadIn(features) ? features.slice(1) : features
}

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
