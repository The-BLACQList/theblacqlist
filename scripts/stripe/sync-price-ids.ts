/**
 * Load Stripe price IDs (printed by setup-products.ts) into the plans table.
 * Run against whichever database you're configuring — writing to the PRODUCTION
 * database is a founder-gated (GATE-DATA) action.
 *
 * Usage (6 price IDs, in order):
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx tsx scripts/stripe/sync-price-ids.ts \
 *     <starter_monthly> <starter_annual> <growth_monthly> <growth_annual> <premium_monthly> <premium_annual>
 *
 * Price IDs are not committed to source — they differ between test and live
 * mode and belong in the DB, not code.
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env['SUPABASE_URL'] ?? process.env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.local).')
  process.exit(1)
}

const args = process.argv.slice(2)
if (args.length !== 6) {
  console.error(
    'Usage: npx tsx scripts/stripe/sync-price-ids.ts <starter_monthly> <starter_annual> <growth_monthly> <growth_annual> <premium_monthly> <premium_annual>'
  )
  process.exit(1)
}

const [starterMonthly, starterAnnual, growthMonthly, growthAnnual, premiumMonthly, premiumAnnual] =
  args as [string, string, string, string, string, string]

if (!args.every((a) => a.startsWith('price_'))) {
  console.error('Error: every argument must be a Stripe price id (price_...).')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function setPlan(name: string, monthly: string, yearly: string) {
  const { error } = await supabase
    .from('plans')
    .update({ stripe_price_id_monthly: monthly, stripe_price_id_yearly: yearly })
    .eq('name', name)
  if (error) {
    console.error(`  ${name}: update failed — ${error.message}`)
    process.exitCode = 1
  } else {
    console.log(`  ${name}: monthly=${monthly} yearly=${yearly}`)
  }
}

async function main() {
  console.log('Updating plans with Stripe price IDs…')
  await setPlan('starter', starterMonthly, starterAnnual)
  await setPlan('growth', growthMonthly, growthAnnual)
  await setPlan('premium', premiumMonthly, premiumAnnual)
  console.log('Done. Verify: SELECT name, stripe_price_id_monthly, stripe_price_id_yearly FROM plans;')
}

main().catch((err) => {
  console.error('sync-price-ids failed:', err)
  process.exit(1)
})
