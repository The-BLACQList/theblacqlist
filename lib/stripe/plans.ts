export type PlanSlug = "free" | "standard" | "premium"

export interface PlanMeta {
  slug: PlanSlug
  name: string
  price_monthly: number
  price_yearly: number
  features: string[]
  cta: string
  highlighted: boolean
}

export const PLANS: PlanMeta[] = [
  {
    slug: "free",
    name: "Free",
    price_monthly: 0,
    price_yearly: 0,
    features: [
      "Basic listing page",
      "Contact info & hours",
      "1 photo",
      "Category & city listing",
    ],
    cta: "Get started",
    highlighted: false,
  },
  {
    slug: "standard",
    name: "Standard",
    price_monthly: 29,
    price_yearly: 290,
    features: [
      "Everything in Free",
      "Up to 10 photos",
      "Owner analytics dashboard",
      "Claimed badge",
      "Services list",
      "Priority search placement",
    ],
    cta: "Upgrade to Standard",
    highlighted: true,
  },
  {
    slug: "premium",
    name: "Premium",
    price_monthly: 79,
    price_yearly: 790,
    features: [
      "Everything in Standard",
      "Unlimited photos",
      "Featured placement",
      "Homepage spotlight eligibility",
      "Priority support",
      "Custom CTA label",
      "Advanced analytics",
    ],
    cta: "Upgrade to Premium",
    highlighted: false,
  },
]

export function getPlanMeta(slug: PlanSlug): PlanMeta {
  const plan = PLANS.find((p) => p.slug === slug)
  if (!plan) throw new Error(`Unknown plan slug: ${slug}`)
  return plan
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
