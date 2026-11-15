/**
 * Builds data/geo/us-places.csv from two public-domain Census files (ticket 230).
 *
 * Sources (downloaded 2026-11-15):
 *   Places, names and centre points — Census 2024 Gazetteer, national places:
 *     https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_place_national.zip
 *   Population — Census Vintage 2024 subcounty estimates (SUB-EST2024):
 *     https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024.csv
 *
 * Usage (download and unzip both first; the files are read as data only):
 *   npx tsx scripts/geo/build-us-places.ts <2024_Gaz_place_national.txt> <sub-est2024.csv>
 *
 * Writes data/geo/us-places.csv. Load it with `pnpm seed:us-places`.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { buildUsPlaceRows, toCsv } from '../../lib/geo/usPlaces'

const [gazPath, estPath] = process.argv.slice(2)
if (!gazPath || !estPath) {
  console.error('Usage: npx tsx scripts/geo/build-us-places.ts <gazetteer.txt> <sub-est.csv>')
  process.exit(1)
}

// The estimates file is Latin-1 (accented Puerto Rico names). Only its numeric
// columns are read, so decoding it as latin1 is enough.
const rows = buildUsPlaceRows(readFileSync(gazPath, 'utf8'), readFileSync(estPath, 'latin1'))
const out = resolve(__dirname, '../../data/geo/us-places.csv')
writeFileSync(out, toCsv(rows))

const withPop = rows.filter((r) => r.population !== null).length
console.log(`Wrote ${rows.length} places (${withPop} with a population) to ${out}`)
