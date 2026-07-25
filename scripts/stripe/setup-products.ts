/**
 * Create (or reuse) the Stripe products + prices for BLACQList's paid plans and
 * print their price IDs. Idempotent: products/prices are looked up by metadata
 * before being created, so re-running prints the same IDs without duplicating.
 *
 * Prices are $19/mo ($190/yr) Standard and $49/mo ($490/yr) Premium.
 *
 * Usage (use a RESTRICTED key with Products + Prices write scope, not sk_):
 *   STRIPE_SECRET_KEY=rk_test_... npx tsx scripts/stripe/setup-products.ts
 *
 * Run in TEST mode first (rk_test_...). Running against LIVE creates real
 * billing objects — that is a founder-gated (GATE-SPEND) action.
 *
 * After it prints the IDs, load them into the DB with:
 *   npx tsx scripts/stripe/sync-price-ids.ts <starter_m> <starter_a> <growth_m> <growth_a> <premium_m> <premium_a>
 *
 * Nothing secret is written to disk or committed.
 */
import Stripe from 'stripe'

const KEY = process.env['STRIPE_SECRET_KEY']
if (!KEY) {
  console.error('Error: STRIPE_SECRET_KEY must be set (use a restricted key, rk_...).')
  console.error('Values live in .env.local — never commit them.')
  process.exit(1)
}

const stripe = new Stripe(KEY, { apiVersion: '2026-04-22.dahlia', typescript: true })

interface PlanConfig {
  slug: 'starter' | 'growth' | 'premium'
  name: string
  monthlyCents: number
  yearlyCents: number
}

// Annual amounts are ~20% off (Starter $182, Growth $470, Premium $950).
const PLANS: PlanConfig[] = [
  { slug: 'starter', name: 'BLACQList Starter', monthlyCents: 1900, yearlyCents: 18200 },
  { slug: 'growth', name: 'BLACQList Growth', monthlyCents: 4900, yearlyCents: 47000 },
  { slug: 'premium', name: 'BLACQList Premium', monthlyCents: 9900, yearlyCents: 95000 },
]

async function ensureProduct(slug: string, name: string): Promise<Stripe.Product> {
  const found = await stripe.products.search({
    query: `metadata['blacqlist_plan']:'${slug}'`,
  })
  const existing = found.data.find((p) => p.active)
  if (existing) {
    console.log(`  product ${slug}: reusing ${existing.id}`)
    return existing
  }
  const created = await stripe.products.create({
    name,
    metadata: { blacqlist_plan: slug },
  })
  console.log(`  product ${slug}: created ${created.id}`)
  return created
}

async function ensurePrice(
  productId: string,
  slug: string,
  cycle: 'monthly' | 'annual',
  amountCents: number,
  interval: 'month' | 'year'
): Promise<string> {
  const prices = await stripe.prices.list({ product: productId, active: true, limit: 100 })
  const match = prices.data.find((p) => p.metadata?.['blacqlist_cycle'] === cycle)

  if (match) {
    if (match.unit_amount !== amountCents) {
      console.warn(
        `  ⚠ ${slug} ${cycle}: existing price ${match.id} is ${match.unit_amount} cents, ` +
          `expected ${amountCents}. Stripe prices are immutable — archive it and create a new ` +
          `one in the Dashboard rather than having two active prices. Keeping the existing id.`
      )
    }
    return match.id
  }

  const created = await stripe.prices.create({
    product: productId,
    currency: 'usd',
    unit_amount: amountCents,
    recurring: { interval },
    metadata: { blacqlist_plan: slug, blacqlist_cycle: cycle },
  })
  return created.id
}

async function main() {
  console.log(`Stripe mode: ${KEY!.startsWith('rk_live') || KEY!.startsWith('sk_live') ? 'LIVE' : 'TEST'}`)
  const ids: Record<string, string> = {}

  for (const plan of PLANS) {
    const product = await ensureProduct(plan.slug, plan.name)
    ids[`${plan.slug}_monthly`] = await ensurePrice(
      product.id,
      plan.slug,
      'monthly',
      plan.monthlyCents,
      'month'
    )
    ids[`${plan.slug}_annual`] = await ensurePrice(
      product.id,
      plan.slug,
      'annual',
      plan.yearlyCents,
      'year'
    )
  }

  console.log('\n─── Price IDs ───────────────────────────────────────')
  console.log(`starter monthly: ${ids['starter_monthly']}`)
  console.log(`starter annual:  ${ids['starter_annual']}`)
  console.log(`growth  monthly: ${ids['growth_monthly']}`)
  console.log(`growth  annual:  ${ids['growth_annual']}`)
  console.log(`premium monthly: ${ids['premium_monthly']}`)
  console.log(`premium annual:  ${ids['premium_annual']}`)
  console.log('─────────────────────────────────────────────────────')
  console.log('\nNext: load them into the DB (against the target project):')
  console.log(
    `  npx tsx scripts/stripe/sync-price-ids.ts \\\n    ${ids['starter_monthly']} ${ids['starter_annual']} ${ids['growth_monthly']} ${ids['growth_annual']} ${ids['premium_monthly']} ${ids['premium_annual']}`
  )
}

main().catch((err) => {
  console.error('setup-products failed:', err)
  process.exit(1)
})
