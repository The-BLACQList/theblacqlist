/**
 * remove-temp-closed.ts
 *
 * Removes the "temporarily closed" listings (founder review notes) from the
 * launch dataset. These were Edit-marked in seed-review-complete.csv but, per
 * founder decision, are being removed rather than kept. Replacements are added
 * separately (scripts/add-replacement-listings.ts) to keep cities ≥ M9.
 *
 * Usage:  npx tsx scripts/remove-temp-closed.ts
 * Idempotent: a name already absent is skipped.
 */

import { readFileSync, writeFileSync, appendFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..')
const DATA_DIR = join(ROOT, 'scripts/data')
const REPORT_PATH = join(ROOT, 'docs/blacqlist/data/seed-review-apply-report.md')

const TEMP_CLOSED: Record<string, string[]> = {
  'listings-atlanta.json': ['BARE SKINtentions', 'Nourish Botanica', 'Omni Coffee & Eggs', 'The Beehive ATL'],
  'listings-houston.json': ["Lilly's Kloset", 'Vybe Studio', 'MELODRAMA Boutique'],
  'listings-chicago.json': ['Semicolon Bookstore'],
}

interface Listing {
  name: string
  [key: string]: unknown
}

const reportLines: string[] = []
let totalRemoved = 0

for (const [file, names] of Object.entries(TEMP_CLOSED)) {
  const path = join(DATA_DIR, file)
  const data = JSON.parse(readFileSync(path, 'utf8')) as Listing[]
  const before = data.length
  const targets = new Set(names)
  const removed = data.filter((l) => targets.has(l.name)).map((l) => l.name)
  const kept = data.filter((l) => !targets.has(l.name))
  writeFileSync(path, JSON.stringify(kept, null, 2))
  totalRemoved += removed.length
  console.log(`${file}: ${before} → ${kept.length} (removed ${removed.length})`)
  if (removed.length > 0) {
    reportLines.push(`### ${file} (−${removed.length})`, ...removed.map((n) => `- ${n}`), '')
  }
}

if (reportLines.length > 0) {
  appendFileSync(
    REPORT_PATH,
    '\n## Removed — temporarily closed (founder decision)\n\n' + reportLines.join('\n') + '\n'
  )
}
console.log(`Total removed: ${totalRemoved}.`)
