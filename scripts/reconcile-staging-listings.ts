/**
 * reconcile-staging-listings.ts
 *
 * Removes the closed businesses (deleted during the launch data cleanup) from the
 * connected Supabase project so they no longer appear publicly. Uses a SOFT delete
 * (status='archived' + deleted_at + a moderation note): reversible, preserves
 * reviews/saves/claims/analytics, and RLS already hides non-published / soft-deleted
 * rows from the public site + the M9 count. Hard delete would cascade into many
 * tables and is irreversible, so it is intentionally avoided.
 *
 * `seed-launch-listings.ts` is insert-only (ON CONFLICT slug DO NOTHING), so it can
 * ADD the 11 replacements but never removes these — hence this companion script.
 *
 * Usage (auto-loads .env.local; mirrors seed-launch's env):
 *   npx tsx scripts/reconcile-staging-listings.ts
 *   # then: npx tsx scripts/seed-launch-listings.ts   (inserts the 11 replacements)
 *
 * Idempotent: rows already archived/soft-deleted are skipped.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Best-effort .env.local loader so the script runs without env prefixing.
const envPath = join(__dirname, '..', '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m && m[1] && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2]!.replace(/^["']|["']$/g, '')
    }
  }
}

const SUPABASE_URL = process.env['SUPABASE_URL'] || process.env['NEXT_PUBLIC_SUPABASE_URL']
const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'Error: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY must be set.'
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// The 23 closed businesses removed in the launch data cleanup
// (15 permanently closed + 8 temporarily closed — see seed-review-apply-report.md).
const CLOSED_NAMES = [
  // Permanently closed (15)
  'Centered Life Therapy',
  'Lenox Cupcakes',
  'Grace In Design Services',
  'Medu Bookstore',
  'iwi fresh Garden Day Spa',
  'TAGS Boutique',
  'Shades of Black Photography',
  'DJU Entertainment',
  'The Black Sheep Agency',
  'Tutti Treats',
  "Alfreda's Soul Food",
  "Phil & Derek's",
  'Yoga House Houston',
  'Africa Auto Repair & Body Shop',
  'Premier Health Urgent Care',
  // Temporarily closed (8)
  'BARE SKINtentions',
  'Nourish Botanica',
  'Omni Coffee & Eggs',
  'The Beehive ATL',
  "Lilly's Kloset",
  'Vybe Studio',
  'MELODRAMA Boutique',
  'Semicolon Bookstore',
]

async function main() {
  console.log(`Reconciling ${CLOSED_NAMES.length} closed businesses on ${SUPABASE_URL} …\n`)

  const { data: found, error: findErr } = await supabase
    .from('listings')
    .select('id, name, status, deleted_at')
    .in('name', CLOSED_NAMES)

  if (findErr) {
    console.error('Lookup failed:', findErr.message)
    process.exit(1)
  }

  const present = found ?? []
  const presentNames = new Set(present.map((r) => r.name))
  const missing = CLOSED_NAMES.filter((n) => !presentNames.has(n))
  const toArchive = present.filter((r) => r.deleted_at === null && r.status !== 'archived')

  let archived = 0
  let errors = 0
  for (const row of toArchive) {
    const { error } = await supabase
      .from('listings')
      .update({
        status: 'archived',
        deleted_at: new Date().toISOString(),
        moderation_notes: 'Removed in launch data cleanup (closed/unverified).',
      })
      .eq('id', row.id)
    if (error) {
      console.error(`  ✗ ${row.name}: ${error.message}`)
      errors++
    } else {
      console.log(`  ✓ archived: ${row.name}`)
      archived++
    }
  }

  console.log('\nSummary:')
  console.log(`  present on staging:       ${present.length}/${CLOSED_NAMES.length}`)
  console.log(`  newly archived:           ${archived}`)
  console.log(`  already archived/deleted: ${present.length - toArchive.length}`)
  console.log(`  errors:                   ${errors}`)
  if (missing.length) {
    console.log(`  not found on staging (${missing.length}): ${missing.join(', ')}`)
  }
  console.log('\nNext: npx tsx scripts/seed-launch-listings.ts   (inserts the 11 replacements)')

  if (errors > 0) process.exitCode = 1
}

void main()
