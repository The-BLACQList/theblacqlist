/**
 * apply-seed-review.ts
 *
 * Applies the founder's completed QA pass (docs/blacqlist/data/seed-review-complete.csv)
 * to the launch dataset — one JSON file per city in SEED_CITIES
 * (scripts/data/cities.ts), which is also where per-city M9 thresholds live:
 *
 *   - Remove  → drop the matched listing from its city file
 *   - Edit    → best-effort apply the founder note: URLs routed by domain to
 *               website_url / social_instagram / links[], and a "street, city, ST zip"
 *               address parsed into address_line_1 / city_text / state / zip.
 *               Multi-location notes use the PRIMARY (first) address; the rest are
 *               flagged for manual review. Freeform / empty notes are flagged, not guessed.
 *   - Keep    → unchanged
 *
 * Never blanks existing data — only sets a field when the note supplies a value.
 * Emits an audit report at docs/blacqlist/data/seed-review-apply-report.md.
 *
 * Usage:  npx tsx scripts/apply-seed-review.ts
 * Idempotent: re-running re-applies the same edit values; removed names are skipped.
 */

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { SEED_CITIES, cityByLabel } from './data/cities'

const ROOT = join(__dirname, '..')
const CSV_PATH = join(ROOT, 'docs/blacqlist/data/seed-review-complete.csv')
const DATA_DIR = join(ROOT, 'scripts/data')
const REPORT_PATH = join(ROOT, 'docs/blacqlist/data/seed-review-apply-report.md')

// Derived from the registry so this file cannot drift from the seeder, the
// review-sheet builder, or the M9 gate — which is exactly what happened before:
// CITY_FILES listed six cities while THRESHOLDS listed three, and the missing
// lookups rendered "SHORT by NaN" into a founder-facing report.
const CITY_FILES: Record<string, string> = Object.fromEntries(
  SEED_CITIES.map((c) => [c.label, c.file])
)

interface Listing {
  name: string
  slug: string
  /**
   * Fields drafted rather than sourced, awaiting founder confirmation.
   * `scripts/geocode-dry-run.ts` hard-blocks the seed while any row still
   * carries one, so a decision here is what unblocks the corpus.
   */
  _unverified?: string[]
  location_type: string
  address_line_1: string | null
  city_text: string | null
  state: string | null
  zip: string | null
  website_url: string | null
  social_instagram: string | null
  links: { platform: string; url: string }[]
  [key: string]: unknown
}

// ── RFC-4180 CSV parser (handles quoted fields with commas + embedded newlines) ──
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let field = ''
  let record: string[] = []
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      record.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      record.push(field)
      field = ''
      // skip fully-empty trailing records
      if (record.length > 1 || record[0] !== '') rows.push(record)
      record = []
    } else {
      field += c
    }
  }
  if (field !== '' || record.length > 0) {
    record.push(field)
    rows.push(record)
  }
  const header = rows.shift() ?? []
  return rows.map((r) => {
    const obj: Record<string, string> = {}
    header.forEach((h, idx) => {
      obj[h.trim()] = (r[idx] ?? '').trim()
    })
    return obj
  })
}

// ── URL routing ────────────────────────────────────────────────────────────────
const SOCIAL_HOSTS: { host: string; platform: string }[] = [
  { host: 'instagram.com', platform: 'instagram' },
  { host: 'facebook.com', platform: 'facebook' },
  { host: 'fb.com', platform: 'facebook' },
  { host: 'tiktok.com', platform: 'tiktok' },
  { host: 'youtube.com', platform: 'youtube' },
  { host: 'youtu.be', platform: 'youtube' },
  { host: 'linkedin.com', platform: 'linkedin' },
  { host: 'twitter.com', platform: 'twitter' },
  { host: 'x.com', platform: 'twitter' },
]

function classifyUrl(url: string): { platform: string | null } {
  const lower = url.toLowerCase()
  for (const s of SOCIAL_HOSTS) if (lower.includes(s.host)) return { platform: s.platform }
  return { platform: null } // null = generic website
}

function httpsify(url: string): string {
  return url.replace(/^http:\/\//i, 'https://')
}

// ── Address parsing: "street, city, ST zip" ──────────────────────────────────────
const ADDR_RE = /(\d[^,;]*?),\s*([^,;]+?),\s*([A-Za-z]{2})\.?(?:\s+(\d{5}))?/

function parseAddress(segment: string): {
  address_line_1: string
  city_text: string
  state: string
  zip: string | null
} | null {
  const m = segment.match(ADDR_RE)
  if (!m) return null
  return {
    address_line_1: m[1]!.trim().replace(/\s{2,}/g, ' '),
    city_text: m[2]!.trim(),
    state: m[3]!.toUpperCase(),
    zip: m[4] ?? null,
  }
}

interface EditResult {
  changed: string[]
  flags: string[]
  extraAddresses: string[]
  extraUrls: string[]
}

function applyEdit(listing: Listing, note: string): EditResult {
  const res: EditResult = { changed: [], flags: [], extraAddresses: [], extraUrls: [] }
  if (!note.trim()) {
    res.flags.push('empty-note (marked Edit but no note)')
    return res
  }

  // 1) Extract + route URLs, then strip them from the note for address parsing.
  const urls = note.match(/https?:\/\/[^\s;,]+/gi) ?? []
  let firstWebsiteSet = false
  for (const rawUrl of urls) {
    const url = httpsify(rawUrl.replace(/[).,]+$/, ''))
    const { platform } = classifyUrl(url)
    if (platform === 'instagram') {
      listing.social_instagram = url
      const existing = listing.links.find((l) => l.platform === 'instagram')
      if (existing) existing.url = url
      else listing.links.push({ platform: 'instagram', url })
      if (!res.changed.includes('social_instagram')) res.changed.push('social_instagram')
    } else if (platform) {
      const existing = listing.links.find((l) => l.platform === platform)
      if (existing) existing.url = url
      else listing.links.push({ platform, url })
      res.changed.push(`links:${platform}`)
    } else if (!firstWebsiteSet) {
      listing.website_url = url
      firstWebsiteSet = true
      res.changed.push('website_url')
    } else {
      res.extraUrls.push(url) // additional non-social URL — reported, not applied
    }
  }

  // 2) Parse address(es) from the URL-stripped remainder.
  // Normalize newlines to commas so "801 S Morgan St\nChicago, IL 60607" parses;
  // ';' still separates distinct locations.
  const remainder = note
    .replace(/https?:\/\/[^\s;,]+/gi, ' ')
    .replace(/[\r\n]+/g, ', ')
    .replace(/,\s*,/g, ', ')
  const segments = remainder.split(';').map((s) => s.trim()).filter(Boolean)
  let primaryApplied = false
  for (const seg of segments) {
    const addr = parseAddress(seg)
    if (!addr) continue
    if (!primaryApplied) {
      listing.address_line_1 = addr.address_line_1
      listing.city_text = addr.city_text
      listing.state = addr.state
      if (addr.zip) listing.zip = addr.zip
      res.changed.push('address')
      primaryApplied = true
      if (listing.location_type !== 'physical') {
        res.flags.push(`address added but location_type='${listing.location_type}' (verify)`)
      }
    } else {
      res.extraAddresses.push(`${addr.address_line_1}, ${addr.city_text}, ${addr.state} ${addr.zip ?? ''}`.trim())
    }
  }
  if (res.extraAddresses.length > 0) res.flags.push('multi-location (primary applied)')

  if (res.changed.length === 0) res.flags.push('freeform — no URL/address parsed (manual)')
  return res
}

// ── Main ─────────────────────────────────────────────────────────────────────────
const rows = parseCsv(readFileSync(CSV_PATH, 'utf8'))
const DEC = 'Keep / Edit / Remove'
const NOTES = 'Founder notes'

const reportLines: string[] = []
const summary: Record<
  string,
  { before: number; removed: number; edited: number; confirmed: number; after: number }
> = {}
const removedLog: string[] = []
const editedLog: string[] = []
const manualLog: string[] = []

for (const [city, file] of Object.entries(CITY_FILES)) {
  const path = join(DATA_DIR, file)
  const listings = JSON.parse(readFileSync(path, 'utf8')) as Listing[]
  const byName = new Map(listings.map((l) => [l.name, l]))
  const before = listings.length
  const removeNames = new Set<string>()
  let edited = 0
  let confirmed = 0

  for (const row of rows) {
    if ((row['City'] || '').trim() !== city) continue
    const dec = (row[DEC] || '').trim().toLowerCase()
    const name = (row['Name'] || '').trim()
    const listing = byName.get(name)

    if (dec === 'remove') {
      if (listing) {
        removeNames.add(name)
        const reason = [row['Flags'], row[NOTES]].filter((s) => (s || '').trim()).join(' · ')
        removedLog.push(`- **${city}** — ${name}${reason ? ` _(${reason})_` : ''}`)
      } else {
        removedLog.push(`- **${city}** — ${name} _(NOT FOUND in JSON — skipped)_`)
      }
    } else if (dec === 'keep') {
      // "Keep" was an unhandled decision — it fell through to the else below and
      // did nothing, so a fully-reviewed corpus still carried every _unverified
      // marker and could never clear the dry-run block. Keep means the founder
      // looked at the drafted values and they are right; that is a confirmation.
      if (listing?._unverified?.length) {
        delete listing._unverified
        confirmed++
      }
    } else if (dec === 'edit') {
      if (!listing) {
        manualLog.push(`- **${city}** — ${name} _(NOT FOUND in JSON — skipped)_`)
        continue
      }
      const r = applyEdit(listing, row[NOTES] || '')
      if (r.changed.length > 0) edited++
      // A value the founder supplied is sourced by definition; drop any marker
      // for the fields they touched, and the whole marker once none remain.
      if (listing._unverified?.length && r.changed.length) {
        const left = listing._unverified.filter((f) => !r.changed.includes(f))
        if (left.length) listing._unverified = left
        else delete listing._unverified
        confirmed++
      }
      const parts: string[] = []
      if (r.changed.length) parts.push(`changed: ${r.changed.join(', ')}`)
      if (r.flags.length) parts.push(`⚠ ${r.flags.join('; ')}`)
      if (r.extraAddresses.length) parts.push(`extra addresses: ${r.extraAddresses.join(' | ')}`)
      if (r.extraUrls.length) parts.push(`extra urls: ${r.extraUrls.join(' ')}`)
      const line = `- **${city}** — ${name}: ${parts.join('  ·  ')}`
      if (r.flags.length > 0) manualLog.push(line)
      else editedLog.push(line)
    }
  }

  const cleaned = listings.filter((l) => !removeNames.has(l.name))
  // Trailing newline: `JSON.stringify` does not emit one, so writing without it
  // strips the newline the corpus files ship with and makes an all-Keep apply —
  // a run that changes no data at all — show up as a five-file diff. A no-op
  // that looks like a change is how real changes get skimmed past in review.
  writeFileSync(path, JSON.stringify(cleaned, null, 2) + '\n')
  summary[city] = { before, removed: removeNames.size, edited, confirmed, after: cleaned.length }
}

// ── Build report ───────────────────────────────────────────────────────────────
function thresholdFor(label: string): number {
  return cityByLabel(label).minPublished
}
reportLines.push('# Seed Review — Apply Report', '')
reportLines.push(`Generated by \`scripts/apply-seed-review.ts\` from \`seed-review-complete.csv\`.`, '')
reportLines.push('## Per-city counts', '')
reportLines.push('| City | Before | Removed | Edited | Confirmed | After | M9 threshold | Status |')
reportLines.push('|---|---|---|---|---|---|---|---|')
for (const [city, s] of Object.entries(summary)) {
  const t = thresholdFor(city)
  const status = s.after >= t ? '✅ meets' : `⚠️ SHORT by ${t - s.after}`
  reportLines.push(
    `| ${city} | ${s.before} | ${s.removed} | ${s.edited} | ${s.confirmed} | **${s.after}** | ≥${t} | ${status} |`
  )
}
reportLines.push('')
reportLines.push(`## Removed (${removedLog.length})`, '', ...removedLog, '')
reportLines.push(
  `## Edits applied cleanly (${editedLog.length})`,
  '',
  ...(editedLog.length ? editedLog : ['- none']),
  ''
)
reportLines.push(
  `## ⚠️ Edits needing manual review (${manualLog.length})`,
  '',
  '_Multi-location (primary applied), freeform, empty-note, or non-physical address — verify these._',
  '',
  ...(manualLog.length ? manualLog : ['- none']),
  ''
)
writeFileSync(REPORT_PATH, reportLines.join('\n') + '\n')

// ── Console summary ──────────────────────────────────────────────────────────────
console.log('Seed review applied:')
for (const [city, s] of Object.entries(summary)) {
  const t = thresholdFor(city)
  const flag = s.after >= t ? 'OK' : `SHORT by ${t - s.after}`
  console.log(
    `  ${city}: ${s.before} → ${s.after} (removed ${s.removed}, edited ${s.edited}, confirmed ${s.confirmed}) [≥${t}: ${flag}]`
  )
}
console.log(`  Manual-review edits: ${manualLog.length}`)
console.log(`  Report: docs/blacqlist/data/seed-review-apply-report.md`)
