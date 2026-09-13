/**
 * Location-type audit — read-only.
 *
 * Reads every published business-side listing, classifies its `location_type`
 * against the address evidence, and writes a CSV with a blank DECISION column
 * for the founder to fill in. It opens no write path: no INSERT, no UPDATE, no
 * service-role client. The only thing it can damage is a local file.
 *
 * The correction pass this feeds is deliberately per-listing and
 * founder-reviewed, not a heuristic sweep
 * (supabase/migrations/20260904000000_search_location_types.sql:82-87).
 *
 * Usage:
 *   DATABASE_URL=postgres://... npx tsx scripts/audit-location-type.ts
 *
 * Requires: DATABASE_URL (direct Postgres connection string). Point it at
 * staging first. Reading production is not a gated action, but the target is
 * printed before the first query either way.
 *
 * Writes docs/blacqlist/ops/data/location-type-audit-<date>.csv — an
 * ops-auto directory, gitignored, so the sheet never reaches a commit. It
 * carries listing IDs and names only (data-privacy.md:12).
 *
 * Next step after this runs: open the CSV, put APPLY or SKIP in the DECISION
 * column of every row, fill in any blank proposed_location_type, then hand it
 * to scripts/apply-location-type.ts.
 */

import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { Client } from 'pg'
import {
  AUDIT_REASONS,
  describeConnectionTarget,
  diff,
  summarize,
  type AuditListing,
} from '../lib/listings/locationTypeAudit'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'docs', 'blacqlist', 'ops', 'data')

/**
 * Name the target before touching it. This script is read-only, so there is no
 * confirmation flag; the point is that the operator sees which project the
 * numbers came from before the numbers appear.
 *
 * The ref is derived by `describeConnectionTarget`, which knows the two shapes
 * a Supabase Postgres URL comes in. Never print the connection string itself —
 * it carries the database password.
 */
function announceTarget(url: string): void {
  const { kind, projectRef } = describeConnectionTarget(url)
  const where = kind === 'local' ? 'LOCAL' : kind === 'remote' ? 'REMOTE' : 'UNRECOGNISED'
  console.log(`Target: ${where} — project ref ${projectRef ? `"${projectRef}"` : '[could not read]'}`)
  if (kind !== 'local' && !projectRef) {
    console.log('        Check by hand which project this points at before trusting the numbers.')
  }
  console.log('Mode:   READ-ONLY — this script never writes to the database.\n')
}

/** RFC 4180: quote every field, double any embedded quote. Business names contain commas. */
function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

interface QueryRow {
  id: string
  name: string
  location_type: string | null
  service_area_description: string | null
  listing_ships_nationwide: boolean | null
  details_ships_nationwide: boolean | null
  address_line_1: string | null
  has_details_row: boolean
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')

  announceTarget(url)

  const db = new Client({ connectionString: url })
  await db.connect()

  // `event` and `job` listings keep their location data in
  // listing_details_event / listing_details_job, so joining them to
  // listing_details_business would report every one of them as missing an
  // address (lib/actions/listings/createListing.ts:362-398). They are out of
  // scope for this pass.
  const { rows } = await db.query<QueryRow>(`
    SELECT
      l.id,
      l.name,
      l.location_type,
      l.service_area_description,
      l.ships_nationwide            AS listing_ships_nationwide,
      d.ships_nationwide            AS details_ships_nationwide,
      d.address_line_1,
      (d.listing_id IS NOT NULL)    AS has_details_row
    FROM listings l
    LEFT JOIN listing_details_business d ON d.listing_id = l.id
    WHERE l.status = 'published'
      AND l.deleted_at IS NULL
      AND l.entity_type NOT IN ('event', 'job')
    ORDER BY l.name
  `)

  await db.end()

  // Both columns are written from the same form field
  // (lib/actions/listings/submitListing.ts:185, :208) and read details-first
  // (lib/listings/entityPage.ts:425). Resolve them the same way here.
  const listings: AuditListing[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    locationType: r.location_type,
    addressLine1: r.address_line_1,
    serviceAreaDescription: r.service_area_description,
    shipsNationwide: r.details_ships_nationwide ?? r.listing_ships_nationwide ?? false,
    hasDetailsRow: r.has_details_row,
  }))

  const counts = summarize(listings)
  const auditRows = diff(listings)

  const date = new Date().toISOString().slice(0, 10)
  const outFile = join(outDir, `location-type-audit-${date}.csv`)

  const header = [
    'listing_id',
    'name',
    'current_location_type',
    'proposed_location_type',
    'reason',
    'DECISION',
  ].join(',')

  const body = auditRows.map((row) =>
    [
      csvCell(row.id),
      csvCell(row.name),
      csvCell(row.current ?? ''),
      csvCell(row.proposed),
      csvCell(`${row.verdict}: ${AUDIT_REASONS[row.reason].explanation}`),
      csvCell(''),
    ].join(',')
  )

  mkdirSync(outDir, { recursive: true })
  writeFileSync(outFile, [header, ...body].join('\n') + '\n', 'utf8')

  console.log(`Published business-side listings scanned: ${listings.length}`)
  console.log(`  already consistent (not in the CSV):    ${counts.ok}`)
  console.log(`  proposed change:                        ${counts.change}`)
  console.log(`  needs your judgement (blank proposal):  ${counts.review}`)
  console.log(`\nRows written: ${auditRows.length}`)
  console.log(`Wrote: ${outFile}`)
  console.log(
    '\nNext: fill in DECISION (APPLY or SKIP) on every row, and a value for any\n' +
      'blank proposed_location_type, then run scripts/apply-location-type.ts.'
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
