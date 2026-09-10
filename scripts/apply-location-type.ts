/**
 * Location-type correction — applies the decided audit CSV.
 *
 * Reads the sheet scripts/audit-location-type.ts produced, after the founder
 * has filled in the DECISION column. Only rows marked `APPLY` are touched.
 * Everything else is counted and skipped.
 *
 * Four things stand between this script and a bad write:
 *
 *   1. The default is a dry run. `--apply` alone is refused; it needs `--yes`.
 *   2. The rollback CSV is written to disk before the first UPDATE, not after
 *      the last one. If the run dies halfway, the file already covers the rows
 *      that changed (deploy-safety.md rule 3).
 *   3. Every UPDATE is guarded against drift. A row whose location_type moved
 *      between the audit and the apply is not overwritten — the guard fails to
 *      match and the row is reported as skipped.
 *   4. The proposed value must be one of the six the CHECK constraint allows.
 *      A blank cell in `proposed_location_type` — which is what the audit
 *      writes whenever the evidence could not decide — fails validation before
 *      a connection is opened.
 *
 * Usage:
 *   DATABASE_URL=postgres://... npx tsx scripts/apply-location-type.ts <csv>
 *   DATABASE_URL=postgres://... npx tsx scripts/apply-location-type.ts <csv> --apply --yes
 *   DATABASE_URL=postgres://... npx tsx scripts/apply-location-type.ts --rollback <csv>
 *
 * With no CSV path, the most recent audit file in
 * docs/blacqlist/ops/data/ is used.
 *
 * Running with `--apply` against production is GATE-DATA. Confirm the gate
 * before passing the flag.
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, isAbsolute, join } from 'path'
import { fileURLToPath } from 'url'
import { Client } from 'pg'
import { isValidLocationType } from '../lib/listings/locationTypeAudit'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = join(__dirname, '..', 'docs', 'blacqlist', 'ops', 'data')

const argv = process.argv.slice(2)
const APPLY = argv.includes('--apply')
const YES = argv.includes('--yes')
const ROLLBACK_FLAG = argv.indexOf('--rollback')
const ROLLBACK_FILE = ROLLBACK_FLAG >= 0 ? argv[ROLLBACK_FLAG + 1] : undefined

// ── RFC-4180 CSV parser (handles quoted fields with commas + embedded newlines) ──
// Same parser as scripts/apply-seed-review.ts:61 — kept local so neither script
// can break the other by editing it.
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

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function resolvePath(p: string): string {
  return isAbsolute(p) ? p : join(process.cwd(), p)
}

/** The newest `location-type-audit-*.csv` in the ops data directory. */
function latestAudit(): string {
  let files: string[]
  try {
    files = readdirSync(dataDir)
  } catch {
    throw new Error(`No audit CSV given and ${dataDir} does not exist. Run scripts/audit-location-type.ts first.`)
  }
  const audits = files.filter((f) => /^location-type-audit-.*\.csv$/.test(f)).sort()
  const newest = audits[audits.length - 1]
  if (!newest) {
    throw new Error('No audit CSV given and none found. Run scripts/audit-location-type.ts first.')
  }
  return join(dataDir, newest)
}

/**
 * Name the target before touching it — scripts/seed-editorial-launch.ts:63.
 * A live run against a remote project additionally requires --yes.
 */
function assertTargetConfirmed(url: string, live: boolean): void {
  const host = new URL(url).hostname
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')
  const ref = host.endsWith('.supabase.co') ? host.split('.')[0] : host

  console.log(`Target: ${isLocal ? 'LOCAL' : 'REMOTE'} — project ref "${ref}" (${host})`)
  if (!live) {
    console.log('Mode:   DRY RUN — nothing will be written.\n')
    return
  }
  console.log('Mode:   LIVE — this run updates location_type on the project above.\n')
  if (isLocal || YES) return
  console.error(
    `Refusing to write to remote project "${ref}" without confirmation.\n` +
      `Check the ref above against the project you intend to write to, then re-run with --yes.\n` +
      `Writing location_type on a remote project is a GATE-DATA action; confirm the gate before passing it.`
  )
  process.exit(1)
}

interface Planned {
  id: string
  name: string
  from: string
  to: string
}

function plan(csvPath: string): { planned: Planned[]; skipped: number; problems: string[] } {
  const rows = parseCsv(readFileSync(csvPath, 'utf8'))
  const planned: Planned[] = []
  const problems: string[] = []
  let skipped = 0

  rows.forEach((row, i) => {
    const line = i + 2 // header is line 1
    const decision = (row.DECISION ?? '').toUpperCase()
    if (decision !== 'APPLY') {
      skipped += 1
      if (decision !== '' && decision !== 'SKIP') {
        problems.push(`line ${line}: DECISION "${row.DECISION}" is neither APPLY nor SKIP`)
      }
      return
    }

    const id = row.listing_id ?? ''
    const to = row.proposed_location_type ?? ''
    const from = row.current_location_type ?? ''

    if (!id) {
      problems.push(`line ${line}: marked APPLY but has no listing_id`)
      return
    }
    if (!isValidLocationType(to)) {
      problems.push(
        `line ${line} (${id}): marked APPLY but proposed_location_type is ${
          to === '' ? 'blank' : `"${to}"`
        } — fill in one of the six valid values`
      )
      return
    }
    if (to === from) {
      problems.push(`line ${line} (${id}): marked APPLY but proposed equals current ("${from}") — nothing to change`)
      return
    }
    planned.push({ id, name: row.name ?? '', from, to })
  })

  return { planned, skipped, problems }
}

async function runRollback(url: string, file: string) {
  const path = resolvePath(file)
  const rows = parseCsv(readFileSync(path, 'utf8'))
  const live = APPLY

  assertTargetConfirmed(url, live)
  console.log(`Rollback source: ${path}`)
  console.log(`Rows to restore: ${rows.length}\n`)

  if (!live) {
    rows.slice(0, 20).forEach((r) => console.log(`  ${r.listing_id} → ${r.previous_location_type}`))
    if (rows.length > 20) console.log(`  … and ${rows.length - 20} more`)
    console.log(`\n0 rows written. Re-run with --apply --yes to restore.`)
    return
  }

  const db = new Client({ connectionString: url })
  await db.connect()
  let restored = 0
  for (const r of rows) {
    const previous = r.previous_location_type ?? ''
    if (!isValidLocationType(previous)) {
      console.warn(`  skip ${r.listing_id}: previous_location_type "${previous}" is not valid`)
      continue
    }
    const res = await db.query(
      `update listings set location_type = $2, updated_at = now() where id = $1`,
      [r.listing_id, previous]
    )
    restored += res.rowCount ?? 0
  }
  await db.end()
  console.log(`\n${restored} rows restored.`)
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')

  if (APPLY && !YES) {
    console.error(
      '--apply requires --yes.\n' +
        'Re-run as: --apply --yes\n' +
        'Against production this is a GATE-DATA action; confirm the gate before passing it.'
    )
    process.exit(1)
  }

  if (ROLLBACK_FILE) {
    await runRollback(url, ROLLBACK_FILE)
    return
  }

  const csvArg = argv.find((a) => !a.startsWith('--'))
  const csvPath = csvArg ? resolvePath(csvArg) : latestAudit()

  const { planned, skipped, problems } = plan(csvPath)

  assertTargetConfirmed(url, APPLY)
  console.log(`Decision sheet: ${csvPath}`)
  console.log(`Rows marked APPLY: ${planned.length}`)
  console.log(`Rows skipped:      ${skipped}`)

  if (problems.length > 0) {
    console.error(`\n${problems.length} problem(s) in the sheet:`)
    problems.forEach((p) => console.error(`  ${p}`))
    console.error('\nFix the sheet and re-run. Nothing was written.')
    process.exit(1)
  }

  if (planned.length === 0) {
    console.log('\n0 rows written.')
    return
  }

  console.log('')
  planned.slice(0, 20).forEach((p) => console.log(`  ${p.id}  ${p.from || '(null)'} → ${p.to}  ${p.name}`))
  if (planned.length > 20) console.log(`  … and ${planned.length - 20} more`)

  if (!APPLY) {
    console.log(`\n0 rows written. Re-run with --apply --yes to write these ${planned.length} rows.`)
    return
  }

  // Rollback file first, before a single UPDATE runs. It records what the rows
  // were at plan time, which is also what the drift guard below matches on.
  const date = new Date().toISOString().slice(0, 10)
  const rollbackFile = join(dataDir, `location-type-rollback-${date}.csv`)
  mkdirSync(dataDir, { recursive: true })
  writeFileSync(
    rollbackFile,
    ['listing_id,previous_location_type', ...planned.map((p) => `${csvCell(p.id)},${csvCell(p.from)}`)].join('\n') +
      '\n',
    'utf8'
  )
  console.log(`\nRollback written first: ${rollbackFile}`)

  const db = new Client({ connectionString: url })
  await db.connect()

  let written = 0
  const drifted: string[] = []
  for (const p of planned) {
    // The guard: only write if location_type still reads what the audit saw.
    // `is not distinct from` so a NULL current value matches a NULL guard.
    const res = await db.query(
      `update listings
          set location_type = $2, updated_at = now()
        where id = $1
          and location_type is not distinct from $3`,
      [p.id, p.to, p.from === '' ? null : p.from]
    )
    if ((res.rowCount ?? 0) === 0) drifted.push(p.id)
    else written += res.rowCount ?? 0
  }

  await db.end()

  console.log(`\n${written} rows written.`)
  if (drifted.length > 0) {
    console.warn(
      `${drifted.length} row(s) changed since the audit and were left alone:\n  ${drifted.join('\n  ')}\n` +
        'Re-run the audit to pick them up.'
    )
  }
  console.log(`To undo: --rollback ${rollbackFile} --apply --yes`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
