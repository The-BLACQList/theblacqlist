/**
 * Apply the corpus verification ledger to the seed corpus JSON files.
 *
 *   npx tsx scripts/apply-verification.ts [--dry]
 *
 * The three new city corpora (LA / DC / NOLA) were drafted from recall and every
 * addressed row was marked `_unverified`. A live-source check of each row is
 * recorded in docs/blacqlist/data/corpus-verification-2026-08-13.json; this
 * script is what turns that evidence into corpus edits.
 *
 * Why a ledger and a script rather than editing the JSON directly: the corpus
 * says what we will publish, the ledger says why we believe it. Hand-editing the
 * corpus lets the two drift, and six months from now nobody can tell a sourced
 * address from a remembered one. Re-running this script is always safe — it is
 * idempotent, and the ledger is the only place a verified fact is authored.
 *
 * NO DATABASE ACCESS. This edits files in scripts/data/ only. Seeding those rows
 * anywhere remote is a separate, gated step (scripts/seed-launch-listings.ts).
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { SEED_CITIES } from './data/cities'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LEDGER = join(__dirname, '..', 'docs', 'blacqlist', 'data', 'corpus-verification-2026-08-13.json')

/**
 * What a live source check concluded about one business.
 *
 * `closed` deletes the row. That is deliberate and it is the whole reason this
 * pass exists: a directory that lists a closed business has done the one thing
 * a directory must never do. Deleting is recoverable through git; publishing a
 * dead storefront to real users is not.
 */
type Verdict = 'open' | 'relocated' | 'temp-closed' | 'mobile' | 'closed' | 'entity-mismatch'

interface Entry {
  slug: string
  city: string
  verdict: Verdict
  sources: string[]
  /** Written over the corpus row verbatim. An explicit null means "checked, there is none". */
  fields: Record<string, string | number | null>
  /** Only on entity-mismatch: the row described a different business than its address. */
  rename?: { name: string; slug: string }
  /**
   * Reset the row's location_type. Usually paired with `mobile` — a storefront
   * that became a truck, or a website, is not a closure — but also valid on
   * `temp-closed`, where a shop on hiatus is trading online in the meantime.
   */
  location_type?: string
  note: string
}

interface Ledger {
  checked_on: string
  method: string
  entries: Entry[]
}

interface Row {
  name: string
  slug: string
  status: string
  location_type: string
  _unverified?: string[]
  /** Provenance stamped onto every verified row — see stampVerified below. */
  _verified?: { on: string; verdict: Verdict; sources: string[]; note: string }
  [k: string]: unknown
}

const dry = process.argv.includes('--dry')

const ledger = JSON.parse(readFileSync(LEDGER, 'utf8')) as Ledger
const bySlug = new Map(SEED_CITIES.map((c) => [c.slug, c]))

// Group by city so each corpus file is read and written exactly once.
const byCity = new Map<string, Entry[]>()
for (const e of ledger.entries) {
  if (!bySlug.has(e.city)) {
    throw new Error(`Ledger entry "${e.slug}" names city "${e.city}", which is not in scripts/data/cities.ts.`)
  }
  const list = byCity.get(e.city) ?? []
  list.push(e)
  byCity.set(e.city, list)
}

/**
 * Record how we know, next to what we know.
 *
 * `_unverified` is cleared field by field rather than wholesale: a row can have
 * a sourced address and still be missing a sourced phone, and collapsing that
 * to a single boolean is how a corpus quietly starts claiming more than it can
 * show. Both keys are inert at the database boundary — seed-launch-listings.ts
 * builds its payloads from named keys, so neither can reach a column.
 */
function stampVerified(row: Row, e: Entry): void {
  for (const [k, v] of Object.entries(e.fields)) row[k] = v
  const cleared = new Set(Object.keys(e.fields))
  const left = (row._unverified ?? []).filter((f) => !cleared.has(f))
  if (left.length > 0) row._unverified = left
  else delete row._unverified
  row._verified = { on: ledger.checked_on, verdict: e.verdict, sources: e.sources, note: e.note }
}

let applied = 0
let removed = 0
let drafted = 0
const missing: string[] = []
const report: string[] = []

for (const [citySlug, entries] of byCity) {
  const city = bySlug.get(citySlug)!
  const path = join(__dirname, 'data', city.file)
  const rows = JSON.parse(readFileSync(path, 'utf8')) as Row[]
  const index = new Map(rows.map((r, i) => [r.slug, i]))
  const drop = new Set<number>()

  for (const e of entries) {
    const i = index.get(e.slug)
    if (i === undefined) {
      // A `closed` entry whose row is already gone is this script having run
      // before, not a typo — the row it names was deleted by the previous run
      // and is supposed to be absent. Every other verdict expects its row to
      // exist, so an absent slug there is still the typo we want to fail on.
      if (e.verdict === 'closed') {
        report.push(`  · already removed  ${e.slug}`)
        continue
      }
      // Same for a rename that already landed: the entry still names the old
      // slug, because the ledger records what we found, not what the corpus
      // currently says. Only fall through to `missing` if neither slug exists.
      if (e.rename && index.has(e.rename.slug)) {
        report.push(`  · already renamed  ${e.slug} → ${e.rename.slug}`)
        continue
      }
      missing.push(`${citySlug}/${e.slug}`)
      continue
    }
    const row = rows[i]!

    if (e.verdict === 'closed') {
      drop.add(i)
      removed++
      report.push(`  ✗ REMOVED  ${row.name} — ${e.note}`)
      continue
    }

    if (e.rename) {
      report.push(`  ~ RENAMED  ${row.name} → ${e.rename.name}`)
      row.name = e.rename.name
      row.slug = e.rename.slug
    }
    if (e.location_type) {
      report.push(`  ~ RETYPED  ${row.name}: ${row.location_type} → ${e.location_type}`)
      row.location_type = e.location_type
    }

    stampVerified(row, e)

    // A business that is shut today does not publish today. Holding it as a
    // draft keeps the sourced record without putting a closed door in front of
    // a user, and the founder can publish it from the review sheet when it
    // reopens. It also stops counting toward the M9 threshold, which is correct.
    if (e.verdict === 'temp-closed' && row.status === 'published') {
      row.status = 'draft'
      drafted++
      report.push(`  ! DRAFTED  ${row.name} — temporarily closed, held back from publish`)
    } else {
      report.push(`  ✓ ${e.verdict.toUpperCase().padEnd(9)} ${row.name}`)
    }
    applied++
  }

  const kept = rows.filter((_, i) => !drop.has(i))
  if (!dry) writeFileSync(path, JSON.stringify(kept, null, 2) + '\n')
  console.log(`\n[${city.label}] ${kept.length} rows (was ${rows.length})`)
}

console.log(`\n${report.join('\n')}`)
console.log(
  `\nApplied ${applied} · removed ${removed} · held as draft ${drafted}` +
    (dry ? '  (DRY RUN — nothing written)' : '')
)

if (missing.length > 0) {
  console.error(
    `\nLedger references ${missing.length} slug(s) that do not exist in any corpus file:\n` +
      missing.map((m) => `  ${m}`).join('\n') +
      `\nA typo'd slug fails silently as "verified" otherwise, so this is an error.`
  )
  process.exit(1)
}
