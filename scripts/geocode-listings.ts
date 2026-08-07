/**
 * Geocode backfill: published listings with an address but no lat/lng get
 * coordinates via OSM Nominatim (1.1s spacing per usage policy, identified
 * User-Agent). Failure-tolerant per row; reports a summary.
 *
 * Usage (GATE-DATA against production; staging runs are auto):
 *   DATABASE_URL=postgres://... npx tsx scripts/geocode-listings.ts
 *
 * Requires: DATABASE_URL (direct Postgres connection string).
 */
import { Client } from 'pg'
import { geocodeAddress } from '../lib/listings/geocode'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')
  const db = new Client({ connectionString: url })
  await db.connect()

  const { rows } = await db.query<{
    listing_id: string
    address_line_1: string
    city_text: string | null
    state: string | null
    zip: string | null
  }>(`
    SELECT d.listing_id, d.address_line_1, d.city_text, d.state, d.zip
    FROM listing_details_business d
    JOIN listings l ON l.id = d.listing_id
    WHERE l.status = 'published' AND l.deleted_at IS NULL
      AND d.address_line_1 IS NOT NULL AND d.lat IS NULL
  `)
  console.log(`to geocode: ${rows.length}`)

  let ok = 0
  let fail = 0
  for (const [i, row] of rows.entries()) {
    const geo = await geocodeAddress({
      address: row.address_line_1,
      city: row.city_text,
      state: row.state,
      zip: row.zip,
    })
    if (geo) {
      await db.query('UPDATE listing_details_business SET lat = $1, lng = $2 WHERE listing_id = $3', [
        geo.lat,
        geo.lng,
        row.listing_id,
      ])
      ok++
    } else {
      fail++
    }
    if ((i + 1) % 25 === 0) console.log(`${i + 1}/${rows.length} ok=${ok} fail=${fail}`)
    await sleep(1100)
  }
  console.log(`DONE ok=${ok} fail=${fail} (failed rows keep null lat/lng — no pin)`)
  await db.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
