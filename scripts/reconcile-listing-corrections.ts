/**
 * reconcile-listing-corrections.ts
 *
 * Applies declared single-field corrections to listing rows that already exist
 * in the connected Supabase project.
 *
 * WHY THIS SCRIPT HAS TO EXIST. `seed-launch-listings.ts` writes both the
 * `listings` row and the `listing_details_business` row with
 * `ignoreDuplicates: true`. That is what makes re-seeding safe, and it is also
 * why the seeder can *never* fix a field on a row it already inserted: the
 * corpus JSON is corrected, the seed runs clean, and the wrong value stays in
 * the database forever. Correcting the corpus is therefore only half of any
 * data fix — this script is the other half.
 *
 * WHY THE CORRECTIONS ARE DECLARED IN THIS FILE rather than passed as flags.
 * A script that takes "slug, column, value" from the command line is a
 * general-purpose production write tool, and nothing about the invocation shows
 * up in review. Declaring them here puts every correction — and its reason — in
 * the diff, bounds the blast radius to rows someone deliberately listed, and
 * makes the whole change reviewable before GATE-DATA rather than after.
 * Same shape as the CLOSED_NAMES table in reconcile-staging-listings.ts.
 *
 * Usage (dry run — reads only, safe to run anywhere):
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx tsx scripts/reconcile-listing-corrections.ts
 *
 * To write:  ... npx tsx scripts/reconcile-listing-corrections.ts --apply [--yes]
 *
 * Idempotent: a row already holding the expected value is reported and skipped.
 * Re-running after a successful apply is a no-op.
 *
 * TARGET SAFETY: no dotenv and no --env flag, matching seed-launch-listings.ts.
 * The database is chosen entirely by the exported SUPABASE_URL, so the script
 * prints the resolved project ref before doing anything and refuses to write to
 * a non-local host without --yes.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env['SUPABASE_URL']
const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
  process.exit(1)
}

const APPLY = process.argv.includes('--apply')

/** The table a correction targets. Extend deliberately, not speculatively. */
type CorrectionTable = 'listings' | 'listing_details_business'

interface Correction {
  /** `listings.slug` — the stable identifier a correction is addressed to. */
  slug: string
  table: CorrectionTable
  column: string
  /** The value the row should hold. Compared before writing. */
  expected: string | null
  /** Why this is the right value. Read at the gate; keep it sourced. */
  reason: string
}

/**
 * Declared corrections. Each one is a founder-visible line item at GATE-DATA.
 *
 * Remove entries once applied and confirmed — a permanently growing list stops
 * being reviewable, and this script is not the audit log. `ops-log.md` is.
 */
const CORRECTIONS: Correction[] = [
  {
    slug: 'the-corner-grille-atl',
    table: 'listing_details_business',
    column: 'state',
    expected: 'GA',
    reason:
      'Seeded as "GE", which is not a US state code — a typo for Georgia. The row is a College Park, ' +
      'GA restaurant at 2341 Marietta Blvd; scripts/data/listings-atlanta.json was corrected to "GA" ' +
      'on branch feat/city-corpus-la-dc-nola. The seeder cannot propagate that fix (ignoreDuplicates), ' +
      'so the database still holds the typo. [Measured — scripts/data/listings-atlanta.json, 2026-08-14]',
  },
]

/**
 * Confirm the operator meant this database.
 *
 * Copied in shape from seed-launch-listings.ts deliberately: two scripts that
 * both write to production should refuse in the same way, so the operator
 * learns one gesture rather than two.
 */
function assertTargetConfirmed(url: string): void {
  const host = new URL(url).hostname
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')
  const ref = host.endsWith('.supabase.co') ? host.split('.')[0] : host

  console.log(`Target: ${isLocal ? 'LOCAL' : 'REMOTE'} — project ref "${ref}" (${host})`)
  console.log(APPLY ? 'Mode:   APPLY (will write)' : 'Mode:   DRY RUN (reads only)\n')

  if (!APPLY || isLocal || process.argv.includes('--yes')) return

  console.error(
    `\nRefusing to write to remote project "${ref}" without confirmation.\n` +
      `Check the ref above against the project you intend to write to, then re-run with --yes.\n` +
      `Remote writes are a GATE-DATA action — confirm the gate before passing it.`
  )
  process.exit(1)
}

assertTargetConfirmed(SUPABASE_URL)

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

type Outcome = 'corrected' | 'already-correct' | 'would-correct' | 'missing' | 'error'

async function applyCorrection(c: Correction): Promise<Outcome> {
  // Resolve the slug to a listing id first. `listing_details_business` is keyed
  // by listing_id and carries no slug, so there is no way to address the target
  // row directly — and doing the lookup by slug means a renamed slug fails loudly
  // here rather than silently matching nothing.
  const { data: listing, error: listingErr } = await supabase
    .from('listings')
    .select('id, slug')
    .eq('slug', c.slug)
    .maybeSingle()

  if (listingErr) {
    console.error(`  ✗ ${c.slug} — lookup failed: ${listingErr.message}`)
    return 'error'
  }
  if (!listing) {
    console.warn(`  ? ${c.slug} — no listing with this slug in the target project`)
    return 'missing'
  }

  const listingId = listing.id as string
  const filter =
    c.table === 'listings' ? { column: 'id', value: listingId } : { column: 'listing_id', value: listingId }

  const { data: row, error: readErr } = await supabase
    .from(c.table)
    .select(c.column)
    .eq(filter.column, filter.value)
    .maybeSingle()

  if (readErr) {
    console.error(`  ✗ ${c.slug} — read failed: ${readErr.message}`)
    return 'error'
  }
  if (!row) {
    console.warn(`  ? ${c.slug} — listing exists but has no ${c.table} row`)
    return 'missing'
  }

  // `select()` with a runtime column name can't be typed by the Supabase client
  // — it widens to a union that includes its error shape. The `maybeSingle()`
  // error was already handled above, so the row here is a real record.
  const current = (row as unknown as Record<string, unknown>)[c.column] ?? null

  if (current === c.expected) {
    console.log(`  = ${c.slug}.${c.column} — already ${JSON.stringify(c.expected)}, skipping`)
    return 'already-correct'
  }

  if (!APPLY) {
    console.log(
      `  → ${c.slug}.${c.column} — would change ${JSON.stringify(current)} → ${JSON.stringify(c.expected)}`
    )
    return 'would-correct'
  }

  const { error: writeErr } = await supabase
    .from(c.table)
    .update({ [c.column]: c.expected })
    .eq(filter.column, filter.value)

  if (writeErr) {
    console.error(`  ✗ ${c.slug} — update failed: ${writeErr.message}`)
    return 'error'
  }

  console.log(
    `  ✓ ${c.slug}.${c.column} — ${JSON.stringify(current)} → ${JSON.stringify(c.expected)}`
  )
  return 'corrected'
}

async function main(): Promise<void> {
  console.log(`Corrections declared: ${CORRECTIONS.length}\n`)

  const tally: Record<Outcome, number> = {
    corrected: 0,
    'already-correct': 0,
    'would-correct': 0,
    missing: 0,
    error: 0,
  }

  for (const c of CORRECTIONS) {
    console.log(`${c.slug} · ${c.table}.${c.column}`)
    console.log(`  reason: ${c.reason}`)
    tally[await applyCorrection(c)]++
    console.log('')
  }

  console.log('─'.repeat(60))
  console.log(
    `Corrected: ${tally.corrected}  ·  Already correct: ${tally['already-correct']}  ·  ` +
      `Would correct: ${tally['would-correct']}  ·  Missing: ${tally.missing}  ·  Errors: ${tally.error}`
  )

  if (!APPLY && tally['would-correct'] > 0) {
    console.log(`\nDry run. Re-run with --apply --yes to write these ${tally['would-correct']}.`)
  }

  // A failed correction is a failed run. Exiting 0 on errors would let this
  // pass in a script chain while the wrong value is still live.
  if (tally.error > 0) process.exit(1)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
