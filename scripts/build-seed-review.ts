/**
 * Build a founder-review sheet for the seeded listings.
 *
 * Reads every corpus file named by scripts/data/cities.ts and emits:
 *   - docs/blacqlist/data/seed-review.csv   (open in Google Sheets / Excel)
 *   - docs/blacqlist/data/seed-review.md    (how-to + per-city counts + category coverage)
 *
 * Each row is auto-flagged so the riskiest entries surface first:
 *   assumed-contact — one or more fields were drafted from recall, not sourced
 *   metro-area  — city_text isn't the canonical city (e.g. Decatur tagged atlanta-ga)
 *   no-website  — no website_url / instagram to verify against
 *   no-address  — no street address (often online-only)
 *   duplicate   — another listing in the same city has a near-identical name
 *
 * The sheet also gives the founder a one-click Google Maps search per row to
 * confirm the business is real and currently operating, and the README lists
 * categories that are below the "≥3 per city" launch gate.
 *
 * The founder marks each row Keep / Edit / Remove and confirms it's real,
 * currently operating, genuinely Black-owned, and OK to be listed publicly.
 *
 * Usage:  npx tsx scripts/build-seed-review.ts
 * No DB access; pure file in → file out.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { SEED_CITIES } from './data/cities'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const dataDir = join(root, 'scripts', 'data')
const outDir = join(root, 'docs', 'blacqlist', 'data')

// One registry, four consumers — see scripts/data/cities.ts for why.
const CITIES = SEED_CITIES

interface Listing {
  name: string
  city_slug: string
  city_text: string | null
  category_slug: string
  website_url: string | null
  social_instagram: string | null
  address_line_1: string | null
  status: string
  /**
   * Fields on this row that were drafted from recall rather than sourced.
   * Set during corpus drafting, cleared by apply-seed-review.ts when the
   * founder marks the row Keep or Edit, and hard-blocked by geocode-dry-run.ts
   * until it is empty.
   */
  _unverified?: string[]
}

interface Row {
  city: string
  name: string
  cityText: string
  category: string
  hasWebsite: boolean
  hasAddress: boolean
  isDuplicate: boolean
  /** Unverified field names, joined for the Assumption column ('' when none). */
  assumed: string
  searchUrl: string
  flags: string[]
}

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

/** Normalize a business name for near-duplicate detection. */
function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|llc|inc|co|company|corp|ltd|group)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function mapsSearchUrl(name: string, location: string): string {
  const q = encodeURIComponent(`${name} ${location}`.trim())
  return `https://www.google.com/maps/search/?api=1&query=${q}`
}

const rows: Row[] = []
const counts: Record<
  string,
  { total: number; metro: number; noWeb: number; noAddr: number; dupe: number; assumed: number }
> = {}
// per-city category counts, and the union of all categories seen (the "taxonomy" we can observe)
const categoryByCity: Record<string, Record<string, number>> = {}
const categoryUniverse = new Set<string>()

for (const city of CITIES) {
  const data = JSON.parse(readFileSync(join(dataDir, city.file), 'utf8')) as Listing[]
  counts[city.label] = { total: data.length, metro: 0, noWeb: 0, noAddr: 0, dupe: 0, assumed: 0 }
  categoryByCity[city.label] = {}

  // First pass: count normalized names within this city to find duplicates.
  const nameCounts = new Map<string, number>()
  for (const l of data) {
    const key = normName(l.name)
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1)
  }

  for (const l of data) {
    const cityText = (l.city_text ?? '').trim()
    // Compared against the registry's canonical `cityText`, not its label.
    // DC's label is "Washington DC" and its rows read "Washington", so the
    // label comparison flagged all 33 rows as metro-area — 33 false positives
    // that trained the reader to skip the flag.
    const isMetro = cityText !== '' && cityText.toLowerCase() !== city.cityText.toLowerCase()
    const hasWebsite = Boolean(l.website_url || l.social_instagram)
    const hasAddress = Boolean(l.address_line_1)
    const isDuplicate = (nameCounts.get(normName(l.name)) ?? 0) > 1
    const assumedFields = l._unverified ?? []
    const isAssumed = assumedFields.length > 0

    const flags: string[] = []
    // Listed first because it is the flag that decides whether the rest of the
    // row can be trusted at all. Backfilling drafted URLs drives `no-website`
    // to zero exactly when the data is least trustworthy — without this flag,
    // the sheet would sort the least-sourced rows to the bottom.
    if (isAssumed) flags.push('assumed-contact')
    if (isMetro) flags.push('metro-area')
    if (!hasWebsite) flags.push('no-website')
    if (!hasAddress) flags.push('no-address')
    if (isDuplicate) flags.push('duplicate')

    if (isMetro) counts[city.label]!.metro++
    if (!hasWebsite) counts[city.label]!.noWeb++
    if (!hasAddress) counts[city.label]!.noAddr++
    if (isDuplicate) counts[city.label]!.dupe++
    if (isAssumed) counts[city.label]!.assumed++

    categoryUniverse.add(l.category_slug)
    categoryByCity[city.label]![l.category_slug] =
      (categoryByCity[city.label]![l.category_slug] ?? 0) + 1

    rows.push({
      city: city.label,
      name: l.name,
      cityText: cityText || '—',
      category: l.category_slug,
      hasWebsite,
      hasAddress,
      isDuplicate,
      assumed: assumedFields.join(' / '),
      searchUrl: mapsSearchUrl(l.name, cityText || city.label),
      flags,
    })
  }
}

// Sort: by city, then unsourced rows, then most-flagged, then name — so the
// rows whose facts are least established sit at the top of each city block.
// `assumed-contact` outranks flag count on purpose: a row with three flags but
// sourced values is a judgment call, while a single unsourced field is an
// unanswered question, and unanswered questions block the seed.
const cityOrder = new Map(CITIES.map((c, i) => [c.label, i]))
rows.sort((a, b) => {
  const c = (cityOrder.get(a.city) ?? 0) - (cityOrder.get(b.city) ?? 0)
  if (c !== 0) return c
  const aAssumed = a.assumed ? 1 : 0
  const bAssumed = b.assumed ? 1 : 0
  if (aAssumed !== bAssumed) return bAssumed - aAssumed
  if (b.flags.length !== a.flags.length) return b.flags.length - a.flags.length
  return a.name.localeCompare(b.name)
})

// ── CSV ──────────────────────────────────────────────────────────────────────
const header = [
  'City',
  'Name',
  'City (listed)',
  'Category',
  'Has website/social',
  'Has address',
  'Dupe?',
  'Unsourced fields',
  'Flags',
  'Verify (Google Maps)',
  'Keep / Edit / Remove',
  'Founder notes',
]
const csvLines = [header.map(csvCell).join(',')]
for (const r of rows) {
  csvLines.push(
    [
      r.city,
      r.name,
      r.cityText,
      r.category,
      r.hasWebsite ? 'yes' : 'NO',
      r.hasAddress ? 'yes' : 'NO',
      r.isDuplicate ? 'DUPE' : '',
      r.assumed,
      r.flags.join(' / '),
      r.searchUrl,
      '', // Keep/Edit/Remove — founder fills
      '', // notes — founder fills
    ]
      .map((v) => csvCell(String(v)))
      .join(',')
  )
}

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'seed-review.csv'), csvLines.join('\n') + '\n')

// ── Category coverage (launch gate: every category ≥ 3 per city) ──────────────
//
// Measured against the categories THIS city actually uses, not the union across
// every corpus file. The union is 22 categories; scoring each city against it
// listed ~19 categories as "below 3" for every new city, which is three walls
// of noise rather than a finding. A category a city has deliberately not
// entered is not a coverage gap — a category it entered once or twice is.
const CATEGORY_MIN = 3
const sortedCategories = [...categoryUniverse].sort()
const coverageLines: string[] = []
for (const c of CITIES) {
  const perCat = categoryByCity[c.label]!
  const thin = Object.entries(perCat)
    .map(([cat, n]) => ({ cat, n }))
    .filter((x) => x.n < CATEGORY_MIN)
    .sort((a, b) => a.n - b.n || a.cat.localeCompare(b.cat))
  const present = Object.keys(perCat).length
  if (thin.length === 0) {
    coverageLines.push(
      `- **${c.label}** — all ${present} categories present have ≥ ${CATEGORY_MIN}. ✅`
    )
  } else {
    const list = thin.map((x) => `\`${x.cat}\` (${x.n})`).join(', ')
    coverageLines.push(
      `- **${c.label}** — ${present} categories present; below ${CATEGORY_MIN}: ${list}`
    )
  }
}

// ── README ───────────────────────────────────────────────────────────────────
const totalAll = Object.values(counts).reduce((s, c) => s + c.total, 0)
const flaggedAll = rows.filter((r) => r.flags.length > 0).length

const assumedAll = rows.filter((r) => r.assumed).length

const countsTable = CITIES.map((c) => {
  const k = counts[c.label]!
  return `| ${c.label} | ${k.total} | ${k.assumed} | ${k.metro} | ${k.noWeb} | ${k.noAddr} | ${k.dupe} |`
}).join('\n')

const readme = `# Seed data — founder review

**Purpose.** Before the production seed, every listing must be confirmed **real, currently operating, genuinely Black-owned, and OK to be listed publicly.** The directory listings were researched from third-party sources (press roundups, directories, the businesses' own sites), so this is the human verification pass.

**How to use.**
1. Open \`seed-review.csv\` in Google Sheets (File → Import → Upload).
2. Work top-down — within each city, rows with **unsourced fields come first**, then the most-flagged. The entries whose facts are least established are at the top.
3. Use the **Verify (Google Maps)** link in each row to confirm the business exists and is open in one click.
4. For each row set **Keep / Edit / Remove** and add a note.
   - **Keep** means "I looked at the drafted values and they are right." On an \`assumed-contact\` row that is a confirmation, and it clears the block — so don't Keep a row you only skimmed.
   - **Edit** — put the corrected value in the note as \`field: value\` (e.g. \`address_line_1: 4325 Degnan Blvd\`). Only the fields you name are treated as sourced.
   - **Remove** — the business is closed, not real, or shouldn't be listed.
5. When done, the decisions drive \`npx tsx scripts/apply-seed-review.ts\`, which rewrites \`scripts/data/listings-*.json\` before the production seed (board card 093). Re-run \`npx tsx scripts/build-seed-review.ts\` any time to regenerate this sheet from the current data.

**Flag legend** (a row may carry more than one):
- \`assumed-contact\` — **the important one.** One or more fields on this row were drafted from recall rather than read off a source. The **Unsourced fields** column names which. These rows sort to the **top of each city**, ahead of every other flag, and the seed is hard-blocked until each one is decided. See the accuracy note below.
- \`metro-area\` — the listed city isn't the canonical city (e.g. a Decatur/East Point business tagged to Atlanta). Decide: keep under the metro, relabel, or remove.
- \`no-website\` — no website **or** Instagram to verify against. Confirm it exists and is current.
- \`no-address\` — no street address (often online-only). Fine for online brands; confirm it's not a closed storefront.
- \`duplicate\` — another listing **in the same city** has a near-identical name (after normalizing case/punctuation/suffixes). Check whether it's the same business entered twice, or two genuinely different businesses.

### How accurate are the unsourced fields?

Measured, not guessed. Twelve drafted addresses were checked against live sources on 2026-08-13 and **six were wrong** — but not evenly:

| Tier | Sampled | Wrong | How it fails |
|---|---|---|---|
| Rows already flagged uncertain | 6 | 4 (67%) | Wrong neighbourhood, wrong city, or a since-moved location |
| Random mid-tier rows | 6 | 2 (33%) | Street number drifts; the street and ZIP are right |

**Read that as: treat every \`assumed-contact\` address as unconfirmed, not as probably-fine.** A street number that is close but wrong drops a map pin on the wrong building, which is worse than no pin. Landmark businesses are the most reliable; the less press a business has, the more the drafted address drifts.

**Counts (generated from the current seed files):**

| City | Total | assumed-contact | metro-area | no-website/social | no-address | duplicate |
|---|---|---|---|---|---|---|
${countsTable}

**Total listings:** ${totalAll} · **rows with at least one flag:** ${flaggedAll} · **rows with unsourced fields:** ${assumedAll}

## Category coverage (launch gate: ≥ ${CATEGORY_MIN} per city)

Categories below the threshold need more listings (or a decision to merge/drop the category) before launch. Each city is measured against **the categories that city actually uses** — not against the ${sortedCategories.length}-category union across all six files, which would flag every category a city has simply chosen not to enter. A city with few categories can read clean here and still be too narrow, so check the "categories present" count as well as the thin list.

${coverageLines.join('\n')}

> The flags only surface rows that *need a closer look* — an unflagged row still needs a yes/no on "real, current, Black-owned, OK to list," it's just lower-risk. The sheet makes that judgment fast; the judgment itself is yours.
`

writeFileSync(join(outDir, 'seed-review.md'), readme)

// ── Console summary ──────────────────────────────────────────────────────────
console.log('Seed review sheet generated:')
console.log(`  ${join('docs/blacqlist/data', 'seed-review.csv')}  (${rows.length} rows)`)
console.log(`  ${join('docs/blacqlist/data', 'seed-review.md')}`)
console.log('')
const labelWidth = Math.max(...CITIES.map((c) => c.label.length))
for (const c of CITIES) {
  const k = counts[c.label]!
  console.log(
    `  ${c.label.padEnd(labelWidth)} total ${String(k.total).padStart(3)}  ·  assumed ${String(k.assumed).padStart(3)}  ·  metro ${k.metro}  ·  no-website ${k.noWeb}  ·  no-address ${k.noAddr}  ·  dupe ${k.dupe}`
  )
}
console.log(
  `  TOTAL ${totalAll}  ·  flagged rows ${flaggedAll}  ·  unsourced rows ${assumedAll}  ·  categories observed ${sortedCategories.length}`
)
