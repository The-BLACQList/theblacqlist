/**
 * Pre-seed geocode + static validation dry run.
 *
 * Playbook §4 requires a ≥95% geocode success rate before any listing corpus
 * reaches a database. This is that check, and it is deliberately incapable of
 * writing anywhere: it imports no Supabase client and reads no DATABASE_URL, so
 * it cannot seed the wrong project no matter how it is invoked.
 *
 * The 41 unrecoverable geocode failures still open as ledger 2.4 are what this
 * step exists to prevent. Those addresses reached production before anyone
 * checked whether they resolved; correcting them afterwards is manual, per-row,
 * and cannot be batched.
 *
 * Usage:
 *   npx tsx scripts/geocode-dry-run.ts [--city los-angeles-ca] [--no-network]
 *
 * Runtime: ~1.1s per addressed row (Nominatim's published rate limit, which the
 * shared User-Agent identifies us under). ~150 rows ≈ 3 minutes.
 *
 * Writes docs/blacqlist/data/geocode-dry-run-<date>.md — a tracked directory,
 * so the report lands next to the review sheet it gates.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { geocodeAddress } from '../lib/listings/geocode'
import { SEED_CITIES, type SeedCity } from './data/cities'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const dataDir = join(root, 'scripts', 'data')
const outDir = join(root, 'docs', 'blacqlist', 'data')

/** Pass mark for the geocode rate, per playbook §4. */
const PASS_RATE = 0.95
/** Nominatim asks for ≤1 request/second; 1100ms leaves headroom for clock drift. */
const RATE_LIMIT_MS = 1100

/**
 * Location types that legitimately have no street address.
 *
 * A `physical` row with no address is not "online-only" — it is a storefront
 * whose address nobody filled in, which is exactly the defect class that
 * produced ledger 2.4. Those land in `gapPhysical` and fail the run.
 */
const ADDRESSLESS_OK = new Set(['virtual', 'hybrid', 'service_area', 'national', 'traveling'])

interface Row {
  name: string
  city_slug: string
  city_text: string | null
  state: string
  zip: string | null
  address_line_1: string | null
  location_type: string
  category_slug: string
  _unverified?: string[]
}

type Bucket = 'ok' | 'fail' | 'skipOnline' | 'gapPhysical'

interface Result {
  row: Row
  bucket: Bucket
  coords?: { lat: number; lng: number }
}

// ── CLI ────────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
const cityArg = argv.includes('--city') ? argv[argv.indexOf('--city') + 1] : null
/** Static checks only — useful for a fast re-run after editing addresses. */
const noNetwork = argv.includes('--no-network')

const cities: SeedCity[] = cityArg
  ? SEED_CITIES.filter((c) => c.slug === cityArg)
  : [...SEED_CITIES]

if (cities.length === 0) {
  console.error(`No city matches "${cityArg}". Known: ${SEED_CITIES.map((c) => c.slug).join(', ')}`)
  process.exit(1)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ── Static checks ──────────────────────────────────────────────────────────────

/** Metro ZIP prefixes, used only to catch a row filed under the wrong city. */
const ZIP_PREFIXES: Record<string, string[]> = {
  'atlanta-ga': ['30'],
  'houston-tx': ['77'],
  'chicago-il': ['60'],
  'los-angeles-ca': ['90', '91'],
  'washington-dc': ['20'],
  'new-orleans-la': ['70'],
}

const PLACEHOLDER = /\b(tbd|n\/a|unknown|placeholder|xxx|123 main|address here)\b/i
const PO_BOX = /\bp\.?\s*o\.?\s*box\b/i
const STARTS_WITH_NUMBER = /^\s*\d/

interface StaticIssue {
  city: string
  name: string
  check: string
  detail: string
  hard: boolean
}

const staticIssues: StaticIssue[] = []

function runStaticChecks(city: SeedCity, rows: Row[]): void {
  const seenAddress = new Map<string, Row[]>()

  for (const r of rows) {
    const at = (check: string, detail: string, hard = true) =>
      staticIssues.push({ city: city.label, name: r.name, check, detail, hard })

    if (r.address_line_1) {
      const a = r.address_line_1
      if (PO_BOX.test(a)) at('po-box', a)
      if (PLACEHOLDER.test(a)) at('placeholder', a)
      if (!STARTS_WITH_NUMBER.test(a)) at('no-street-number', a)

      const key = `${a.toLowerCase().replace(/\s+/g, ' ').trim()}|${r.zip ?? ''}`
      const bucket = seenAddress.get(key) ?? []
      bucket.push(r)
      seenAddress.set(key, bucket)
    }

    // Checked against the registry's state, not just "is it two letters" —
    // 'CH' (a truncated "CHICAGO" that leaked out of an address parse) is two
    // letters and passed the old check while being nonsense.
    if (r.state !== city.state) at('state-mismatch', `${r.state} — expected ${city.state}`)
    if (r.zip && !/^\d{5}$/.test(r.zip)) at('zip-not-5-digit', r.zip)

    if (r.zip) {
      const prefixes = ZIP_PREFIXES[city.slug] ?? []
      if (prefixes.length && !prefixes.some((p) => r.zip!.startsWith(p))) {
        at('zip-outside-metro', `${r.zip} not in ${prefixes.join('/')}xxx`)
      }
    }

    if (!r.city_text) at('no-city-text', '(null)')

    // Not a defect — a review-state marker. Seeding a row the founder has not
    // confirmed is the whole thing this gate exists to prevent, so it is hard.
    if (r._unverified?.length) {
      at('unverified', r._unverified.join(', '))
    }
  }

  // Duplicate addresses: two listings at one address are co-tenants of a shared
  // building (Anacostia Arts Center, the Leimert Park storefronts) — common and
  // legitimate. Two listings at one address in the SAME category is a
  // double-entered business. Only the latter is a hard failure.
  for (const [key, group] of seenAddress) {
    if (group.length < 2) continue
    const byCategory = new Map<string, Row[]>()
    for (const r of group) {
      byCategory.set(r.category_slug, [...(byCategory.get(r.category_slug) ?? []), r])
    }
    for (const [cat, sameCat] of byCategory) {
      if (sameCat.length > 1) {
        staticIssues.push({
          city: city.label,
          name: sameCat.map((r) => r.name).join(' + '),
          check: 'duplicate-address-same-category',
          detail: `${key.split('|')[0]} — both in "${cat}"`,
          hard: true,
        })
      }
    }
    if (byCategory.size > 1) {
      staticIssues.push({
        city: city.label,
        name: group.map((r) => r.name).join(' + '),
        check: 'shared-address',
        detail: `${group.length} listings at ${key.split('|')[0]} in ${byCategory.size} categories — confirm co-tenancy`,
        hard: false,
      })
    }
  }
}

// ── Geocode ────────────────────────────────────────────────────────────────────

async function geocodeCity(city: SeedCity, rows: Row[]): Promise<Result[]> {
  const results: Result[] = []
  const addressed = rows.filter((r) => r.address_line_1)
  let done = 0

  for (const row of rows) {
    if (!row.address_line_1) {
      results.push({
        row,
        bucket: ADDRESSLESS_OK.has(row.location_type) ? 'skipOnline' : 'gapPhysical',
      })
      continue
    }

    if (noNetwork) {
      results.push({ row, bucket: 'ok' })
      continue
    }

    const coords = await geocodeAddress({
      address: row.address_line_1,
      city: row.city_text,
      state: row.state,
      zip: row.zip,
    })

    results.push(coords ? { row, bucket: 'ok', coords } : { row, bucket: 'fail' })
    done++
    process.stdout.write(`\r  ${city.label}: ${done}/${addressed.length} geocoded`)
    if (done < addressed.length) await sleep(RATE_LIMIT_MS)
  }

  if (addressed.length) process.stdout.write('\n')
  return results
}

// ── Run ────────────────────────────────────────────────────────────────────────

interface CityReport {
  city: SeedCity
  total: number
  ok: number
  fail: number
  skipOnline: number
  gapPhysical: number
  rate: number
  bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null
  failures: string[]
  gaps: string[]
}

const reports: CityReport[] = []

for (const city of cities) {
  const rows = JSON.parse(readFileSync(join(dataDir, city.file), 'utf8')) as Row[]
  runStaticChecks(city, rows)

  console.log(`\n${city.label} — ${rows.length} rows`)
  const results = await geocodeCity(city, rows)

  const ok = results.filter((r) => r.bucket === 'ok')
  const fail = results.filter((r) => r.bucket === 'fail')
  const skipOnline = results.filter((r) => r.bucket === 'skipOnline')
  const gapPhysical = results.filter((r) => r.bucket === 'gapPhysical')

  const coords = ok.map((r) => r.coords).filter((c): c is { lat: number; lng: number } => !!c)
  const bbox = coords.length
    ? {
        minLng: Math.min(...coords.map((c) => c.lng)),
        minLat: Math.min(...coords.map((c) => c.lat)),
        maxLng: Math.max(...coords.map((c) => c.lng)),
        maxLat: Math.max(...coords.map((c) => c.lat)),
      }
    : null

  const denom = ok.length + fail.length
  reports.push({
    city,
    total: rows.length,
    ok: ok.length,
    fail: fail.length,
    skipOnline: skipOnline.length,
    gapPhysical: gapPhysical.length,
    rate: denom ? ok.length / denom : 1,
    bbox,
    failures: fail.map((r) => `${r.row.name} — ${r.row.address_line_1}, ${r.row.zip ?? '?'}`),
    gaps: gapPhysical.map((r) => `${r.row.name} (location_type: ${r.row.location_type})`),
  })
}

// ── Verdict ────────────────────────────────────────────────────────────────────

const hardIssues = staticIssues.filter((i) => i.hard)
const softIssues = staticIssues.filter((i) => !i.hard)
const totalGaps = reports.reduce((n, r) => n + r.gapPhysical, 0)
const totalOk = reports.reduce((n, r) => n + r.ok, 0)
const totalFail = reports.reduce((n, r) => n + r.fail, 0)
const overallRate = totalOk + totalFail ? totalOk / (totalOk + totalFail) : 1

const passRate = overallRate >= PASS_RATE
const passGaps = totalGaps === 0
const passStatic = hardIssues.length === 0
const pass = passRate && passGaps && passStatic && !noNetwork

const pct = (n: number) => `${(n * 100).toFixed(1)}%`
const date = new Date().toISOString().slice(0, 10)

const lines: string[] = [
  '# Geocode Dry Run',
  '',
  `Generated by \`scripts/geocode-dry-run.ts\` on ${date}.`,
  noNetwork
    ? '\n> **Static checks only** (`--no-network`). Geocode results are not measured in this run and it cannot pass.\n'
    : '',
  `**Verdict: ${pass ? '✅ PASS' : '❌ FAIL'}**`,
  '',
  '| Gate | Required | Actual | |',
  '|---|---|---|---|',
  `| Geocode rate | ≥${pct(PASS_RATE)} | ${pct(overallRate)} | ${passRate ? '✅' : '❌'} |`,
  `| Physical rows with no address | 0 | ${totalGaps} | ${passGaps ? '✅' : '❌'} |`,
  `| Hard static failures | 0 | ${hardIssues.length} | ${passStatic ? '✅' : '❌'} |`,
  '',
  '## Per city',
  '',
  '| City | Rows | Geocoded | Failed | Rate | No address (OK) | No address (physical) |',
  '|---|---|---|---|---|---|---|',
  ...reports.map(
    (r) =>
      `| ${r.city.label} | ${r.total} | ${r.ok} | ${r.fail} | ${pct(r.rate)} | ${r.skipOnline} | ${r.gapPhysical} |`
  ),
  '',
  '## Bounding boxes',
  '',
  'Measured from successful geocodes. These set the `CITY_VIEWS` zoom in',
  '`components/map/mapStyle.ts` by measurement rather than by guess.',
  '',
  '| City | SW (lng, lat) | NE (lng, lat) | Span (° lng × ° lat) |',
  '|---|---|---|---|',
  ...reports.map((r) =>
    r.bbox
      ? `| ${r.city.label} | ${r.bbox.minLng.toFixed(4)}, ${r.bbox.minLat.toFixed(4)} | ${r.bbox.maxLng.toFixed(4)}, ${r.bbox.maxLat.toFixed(4)} | ${(r.bbox.maxLng - r.bbox.minLng).toFixed(3)} × ${(r.bbox.maxLat - r.bbox.minLat).toFixed(3)} |`
      : `| ${r.city.label} | — | — | no successful geocodes |`
  ),
  '',
]

for (const r of reports) {
  if (r.gaps.length) {
    lines.push(
      `## ${r.city.label} — physical rows with no address (${r.gaps.length})`,
      '',
      'Each is a storefront missing its address, not an online business. Supply the',
      'address or correct `location_type`; do not carry them forward.',
      '',
      ...r.gaps.map((g) => `- ${g}`),
      ''
    )
  }
  if (r.failures.length) {
    lines.push(
      `## ${r.city.label} — geocode failures (${r.failures.length})`,
      '',
      ...r.failures.map((f) => `- ${f}`),
      ''
    )
  }
}

if (hardIssues.length) {
  lines.push(`## Hard static failures (${hardIssues.length})`, '')
  lines.push('| City | Listing | Check | Detail |', '|---|---|---|---|')
  lines.push(...hardIssues.map((i) => `| ${i.city} | ${i.name} | \`${i.check}\` | ${i.detail} |`))
  lines.push('')
}

if (softIssues.length) {
  lines.push(`## Warnings — confirm, don't block (${softIssues.length})`, '')
  lines.push('| City | Listing | Check | Detail |', '|---|---|---|---|')
  lines.push(...softIssues.map((i) => `| ${i.city} | ${i.name} | \`${i.check}\` | ${i.detail} |`))
  lines.push('')
}

mkdirSync(outDir, { recursive: true })
const outPath = join(outDir, `geocode-dry-run-${date}.md`)
writeFileSync(outPath, lines.filter((l) => l !== '').join('\n') + '\n')

console.log(`\n${'─'.repeat(60)}`)
console.log(`Geocode rate:        ${pct(overallRate)} (need ≥${pct(PASS_RATE)})`)
console.log(`Physical, no address: ${totalGaps} (need 0)`)
console.log(`Hard static failures: ${hardIssues.length} (need 0)`)
console.log(`Warnings:             ${softIssues.length}`)
console.log(`Report:               ${outPath.replace(root + '/', '')}`)
console.log(`\nVerdict: ${pass ? '✅ PASS' : '❌ FAIL'}`)
console.log('─'.repeat(60))

process.exit(pass ? 0 : 1)
