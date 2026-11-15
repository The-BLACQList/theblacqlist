/**
 * Loads data/geo/us-places.csv into public.us_places (ticket 230).
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm seed:us-places [--yes] [--production]
 *
 * Idempotent: upserts on `geoid`, so a second run changes nothing. It never
 * deletes, so a place a profile points at is never removed by a reload.
 * Requires migration 20261128000000_us_places.sql.
 *
 * GATE-DATA: a remote run needs --yes after checking the printed project ref.
 * Production also needs --production; it is meant for the ticket 230 merge.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { createClient } from '@supabase/supabase-js'

import { fromCsv } from '../../lib/geo/usPlaces'

const PRODUCTION_REF = 'ytlrnczevdnsfdzjbeqg'
const BATCH = 1000

const SUPABASE_URL = process.env['SUPABASE_URL']
const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
  process.exit(1)
}

function assertTargetConfirmed(url: string): void {
  const host = new URL(url).hostname
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')
  const ref = host.endsWith('.supabase.co') ? host.split('.')[0] : host

  console.log(`Target: ${isLocal ? 'LOCAL' : 'REMOTE'} — project ref "${ref}" (${host})`)
  if (isLocal) return

  if (!process.argv.includes('--yes')) {
    console.error(
      `\nRefusing to write to remote project "${ref}" without confirmation.\n` +
        `Check the ref above, then re-run with --yes. Remote loads are a GATE-DATA action.`
    )
    process.exit(1)
  }
  if (ref === PRODUCTION_REF && !process.argv.includes('--production')) {
    console.error(
      `\n"${ref}" is PRODUCTION. Loading it belongs to the ticket 230 merge.\n` +
        `Re-run with --yes --production once the founder has OK'd it.`
    )
    process.exit(1)
  }
}

async function main(): Promise<void> {
  assertTargetConfirmed(SUPABASE_URL!)
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

  const rows = fromCsv(readFileSync(resolve(__dirname, '../../data/geo/us-places.csv'), 'utf8'))
  console.log(`Loading ${rows.length} places in batches of ${BATCH}…`)

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { error } = await supabase.from('us_places').upsert(batch, { onConflict: 'geoid' })
    if (error) {
      console.error(`Batch starting at row ${i} failed: ${error.message}`)
      process.exit(1)
    }
    process.stdout.write(`  ${Math.min(i + BATCH, rows.length)}/${rows.length}\r`)
  }

  const { count } = await supabase.from('us_places').select('geoid', { count: 'exact', head: true })
  console.log(`\nDone. us_places now has ${count ?? '?'} rows.`)
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
