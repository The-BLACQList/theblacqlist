/**
 * Build a founder-review sheet for the seeded listings.
 *
 * Reads scripts/data/listings-{atlanta,houston,chicago}.json and emits:
 *   - docs/blacqlist/data/seed-review.csv   (open in Google Sheets / Excel)
 *   - docs/blacqlist/data/seed-review.md    (how-to + per-city counts + category coverage)
 *
 * Each row is auto-flagged so the riskiest entries surface first:
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

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const dataDir = join(root, 'scripts', 'data')
const outDir = join(root, 'docs', 'blacqlist', 'data')

const CITIES = [
  { slug: 'atlanta-ga', label: 'Atlanta', file: 'listings-atlanta.json' },
  { slug: 'houston-tx', label: 'Houston', file: 'listings-houston.json' },
  { slug: 'chicago-il', label: 'Chicago', file: 'listings-chicago.json' },
]

interface Listing {
  name: string
  city_slug: string
  city_text: string | null
  category_slug: string
  website_url: string | null
  social_instagram: string | null
  address_line_1: string | null
  status: string
}

interface Row {
  city: string
  name: string
  cityText: string
  category: string
  hasWebsite: boolean
  hasAddress: boolean
  isDuplicate: boolean
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
  { total: number; metro: number; noWeb: number; noAddr: number; dupe: number }
> = {}
// per-city category counts, and the union of all categories seen (the "taxonomy" we can observe)
const categoryByCity: Record<string, Record<string, number>> = {}
const categoryUniverse = new Set<string>()

for (const city of CITIES) {
  const data = JSON.parse(readFileSync(join(dataDir, city.file), 'utf8')) as Listing[]
  counts[city.label] = { total: data.length, metro: 0, noWeb: 0, noAddr: 0, dupe: 0 }
  categoryByCity[city.label] = {}

  // First pass: count normalized names within this city to find duplicates.
  const nameCounts = new Map<string, number>()
  for (const l of data) {
    const key = normName(l.name)
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1)
  }

  for (const l of data) {
    const cityText = (l.city_text ?? '').trim()
    const isMetro = cityText !== '' && cityText.toLowerCase() !== city.label.toLowerCase()
    const hasWebsite = Boolean(l.website_url || l.social_instagram)
    const hasAddress = Boolean(l.address_line_1)
    const isDuplicate = (nameCounts.get(normName(l.name)) ?? 0) > 1

    const flags: string[] = []
    if (isMetro) flags.push('metro-area')
    if (!hasWebsite) flags.push('no-website')
    if (!hasAddress) flags.push('no-address')
    if (isDuplicate) flags.push('duplicate')

    if (isMetro) counts[city.label]!.metro++
    if (!hasWebsite) counts[city.label]!.noWeb++
    if (!hasAddress) counts[city.label]!.noAddr++
    if (isDuplicate) counts[city.label]!.dupe++

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
      searchUrl: mapsSearchUrl(l.name, cityText || city.label),
      flags,
    })
  }
}

// Sort: by city, then most-flagged first, then name — so risky rows surface at the top of each city.
const cityOrder = new Map(CITIES.map((c, i) => [c.label, i]))
rows.sort((a, b) => {
  const c = (cityOrder.get(a.city) ?? 0) - (cityOrder.get(b.city) ?? 0)
  if (c !== 0) return c
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
const CATEGORY_MIN = 3
const sortedCategories = [...categoryUniverse].sort()
const coverageLines: string[] = []
for (const c of CITIES) {
  const perCat = categoryByCity[c.label]!
  const thin = sortedCategories
    .map((cat) => ({ cat, n: perCat[cat] ?? 0 }))
    .filter((x) => x.n < CATEGORY_MIN)
    .sort((a, b) => a.n - b.n || a.cat.localeCompare(b.cat))
  if (thin.length === 0) {
    coverageLines.push(`- **${c.label}** — every observed category has ≥ ${CATEGORY_MIN}. ✅`)
  } else {
    const list = thin.map((x) => `\`${x.cat}\` (${x.n})`).join(', ')
    coverageLines.push(`- **${c.label}** — below ${CATEGORY_MIN}: ${list}`)
  }
}

// ── README ───────────────────────────────────────────────────────────────────
const totalAll = Object.values(counts).reduce((s, c) => s + c.total, 0)
const flaggedAll = rows.filter((r) => r.flags.length > 0).length

const countsTable = CITIES.map((c) => {
  const k = counts[c.label]!
  return `| ${c.label} | ${k.total} | ${k.metro} | ${k.noWeb} | ${k.noAddr} | ${k.dupe} |`
}).join('\n')

const readme = `# Seed data — founder review

**Purpose.** Before the production seed, every listing must be confirmed **real, currently operating, genuinely Black-owned, and OK to be listed publicly.** The directory listings were researched from third-party sources (press roundups, directories, the businesses' own sites), so this is the human verification pass.

**How to use.**
1. Open \`seed-review.csv\` in Google Sheets (File → Import → Upload).
2. Work top-down — rows are **sorted with the most-flagged first** within each city, so the riskiest entries are at the top.
3. Use the **Verify (Google Maps)** link in each row to confirm the business exists and is open in one click.
4. For each row set **Keep / Edit / Remove** and add a note.
5. When done, the **Remove** + **Edit** rows drive a cleanup pass on \`scripts/data/listings-*.json\` before the production seed (board card 093). Re-run \`npx tsx scripts/build-seed-review.ts\` any time to regenerate this sheet from the current data.

**Flag legend** (a row may carry more than one):
- \`metro-area\` — the listed city isn't the canonical city (e.g. a Decatur/East Point business tagged to Atlanta). Decide: keep under the metro, relabel, or remove.
- \`no-website\` — no website **or** Instagram to verify against. Confirm it exists and is current.
- \`no-address\` — no street address (often online-only). Fine for online brands; confirm it's not a closed storefront.
- \`duplicate\` — another listing **in the same city** has a near-identical name (after normalizing case/punctuation/suffixes). Check whether it's the same business entered twice, or two genuinely different businesses.

**Counts (generated from the current seed files):**

| City | Total | metro-area | no-website/social | no-address | duplicate |
|---|---|---|---|---|---|
${countsTable}

**Total listings:** ${totalAll} · **rows with at least one flag:** ${flaggedAll}

## Category coverage (launch gate: ≥ ${CATEGORY_MIN} per city)

Categories below the threshold need more listings (or a decision to merge/drop the category) before launch. Coverage is measured against the **${sortedCategories.length} categories observed in the seed data** — a category present in no city at all won't appear here, so cross-check against the full category taxonomy when topping up.

${coverageLines.join('\n')}

> The flags only surface rows that *need a closer look* — an unflagged row still needs a yes/no on "real, current, Black-owned, OK to list," it's just lower-risk. The sheet makes that judgment fast; the judgment itself is yours.
`

writeFileSync(join(outDir, 'seed-review.md'), readme)

// ── Console summary ──────────────────────────────────────────────────────────
console.log('Seed review sheet generated:')
console.log(`  ${join('docs/blacqlist/data', 'seed-review.csv')}  (${rows.length} rows)`)
console.log(`  ${join('docs/blacqlist/data', 'seed-review.md')}`)
console.log('')
for (const c of CITIES) {
  const k = counts[c.label]!
  console.log(
    `  ${c.label.padEnd(8)} total ${String(k.total).padStart(3)}  ·  metro ${k.metro}  ·  no-website ${k.noWeb}  ·  no-address ${k.noAddr}  ·  dupe ${k.dupe}`
  )
}
console.log(`  TOTAL ${totalAll}  ·  flagged rows ${flaggedAll}  ·  categories observed ${sortedCategories.length}`)
