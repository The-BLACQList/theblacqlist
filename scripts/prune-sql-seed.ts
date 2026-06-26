/**
 * prune-sql-seed.ts
 *
 * Removes closed businesses from the local-dev SQL seed (supabase/seeds/001_listings.sql)
 * so `supabase db reset` does not seed permanently/temporarily closed listings.
 *
 * Tuple-aware: parses each `INSERT … VALUES … ON CONFLICT` block respecting
 * nested parens (the tuples contain `(SELECT id FROM …)`) and SQL `''` quote
 * escaping. Drops `listings` tuples whose NAME is in the prune set, and
 * `listing_details_business` tuples whose UUID matches those removed listings.
 *
 * Usage:  npx tsx scripts/prune-sql-seed.ts
 * Idempotent: a name/UUID already absent is skipped.
 */

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const SQL_PATH = join(__dirname, '..', 'supabase/seeds/001_listings.sql')

const PRUNE_NAMES = new Set([
  'Centered Life Therapy',
  "Phil & Derek's",
  'Yoga House Houston',
  'Premier Health Urgent Care',
  'The Beehive ATL',
  'MELODRAMA Boutique',
  'Semicolon Bookstore',
])

/** Split a VALUES region into top-level `(...)` tuples, respecting parens + 'quotes' with '' escaping. */
function splitTuples(region: string): string[] {
  const tuples: string[] = []
  let depth = 0
  let inString = false
  let start = -1
  for (let i = 0; i < region.length; i++) {
    const c = region[i]
    if (inString) {
      if (c === "'") {
        if (region[i + 1] === "'") {
          i++ // escaped quote
        } else {
          inString = false
        }
      }
      continue
    }
    if (c === '-' && region[i + 1] === '-') {
      // SQL line comment (e.g. a trailing "-- note" after a tuple, which may
      // itself contain apostrophes) — skip to end of line so it can't desync
      // string/paren tracking.
      while (i < region.length && region[i] !== '\n') i++
      continue
    }
    if (c === "'") {
      inString = true
    } else if (c === '(') {
      if (depth === 0) start = i
      depth++
    } else if (c === ')') {
      depth--
      if (depth === 0 && start >= 0) {
        tuples.push(region.slice(start, i + 1))
        start = -1
      }
    }
  }
  return tuples
}

/** Read the first N top-level single-quoted strings from a tuple (handles '' escaping). */
function firstQuoted(s: string, n: number): string[] {
  const out: string[] = []
  let i = 0
  while (out.length < n && i < s.length) {
    if (s[i] === "'") {
      let j = i + 1
      let val = ''
      while (j < s.length) {
        if (s[j] === "'") {
          if (s[j + 1] === "'") {
            val += "'"
            j += 2
            continue
          }
          j++
          break
        }
        val += s[j]
        j++
      }
      out.push(val)
      i = j
    } else {
      i++
    }
  }
  return out
}

const BLOCK_RE = /INSERT INTO (\w+) \([\s\S]*?\) VALUES\n([\s\S]*?)\n\nON CONFLICT/g

let text = readFileSync(SQL_PATH, 'utf8')

// Pass 1: collect UUIDs of listings tuples whose name is in the prune set.
const removeUuids = new Set<string>()
for (const m of text.matchAll(BLOCK_RE)) {
  if (m[1] !== 'listings') continue
  for (const t of splitTuples(m[2]!)) {
    const [uuid, name] = firstQuoted(t, 2)
    if (name && PRUNE_NAMES.has(name)) removeUuids.add(uuid!)
  }
}

// Pass 2: rebuild every block, dropping matched tuples. Kept tuples + separators
// stay byte-identical, so only removed tuples show in the diff.
let removedListings = 0
let removedDetails = 0

text = text.replace(BLOCK_RE, (full: string, table: string, region: string) => {
  const tuples = splitTuples(region)
  const kept = tuples.filter((t) => {
    if (table === 'listings') {
      const [, name] = firstQuoted(t, 2)
      const drop = !!name && PRUNE_NAMES.has(name)
      if (drop) removedListings++
      return !drop
    } else {
      const [uuid] = firstQuoted(t, 1)
      const drop = !!uuid && removeUuids.has(uuid)
      if (drop) removedDetails++
      return !drop
    }
  })
  // Build the replacement DIRECTLY (no String.replace) — the tuples contain `$`
  // (price_range like '$$'), which String.replace would mangle via $-patterns.
  const rebuilt = '  ' + kept.join(',\n\n  ')
  const marker = ') VALUES\n'
  const idx = full.indexOf(marker)
  return full.slice(0, idx + marker.length) + rebuilt + '\n\nON CONFLICT'
})

writeFileSync(SQL_PATH, text)

// ── Post-checks ──────────────────────────────────────────────────────────────
const checks: string[] = []
checks.push(`listings tuples removed: ${removedListings} (expected ${PRUNE_NAMES.size})`)
checks.push(`detail tuples removed:   ${removedDetails} (expected ${removeUuids.size})`)
checks.push(`matched listing UUIDs:   ${removeUuids.size}`)
const hasDoubleComma = /,\s*,/.test(text)
const hasDanglingComma = /,\s*\n\nON CONFLICT/.test(text)
const beginCommit = text.includes('BEGIN;') && text.trim().endsWith('COMMIT;')
const stillPresent: string[] = []
for (const n of PRUNE_NAMES) if (text.includes(`'${n.replace(/'/g, "''")}'`)) stillPresent.push(n)
checks.push(`double-comma artifact: ${hasDoubleComma ? 'FOUND ❌' : 'none ✅'}`)
checks.push(`dangling comma before ON CONFLICT: ${hasDanglingComma ? 'FOUND ❌' : 'none ✅'}`)
checks.push(`BEGIN/COMMIT intact: ${beginCommit ? '✅' : 'MISSING ❌'}`)
checks.push(`prune names still present: ${stillPresent.length ? stillPresent.join(', ') + ' ❌' : 'none ✅'}`)

console.log('prune-sql-seed results:')
for (const c of checks) console.log('  ' + c)

const ok =
  removedListings === PRUNE_NAMES.size &&
  removedDetails === removeUuids.size &&
  !hasDoubleComma &&
  !hasDanglingComma &&
  beginCommit &&
  stillPresent.length === 0
console.log(ok ? '✅ SQL prune OK' : '❌ SQL prune has issues — review above')
process.exitCode = ok ? 0 : 1
