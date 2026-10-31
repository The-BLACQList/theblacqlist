/**
 * Subcategory backfill (ticket 170). Applies the decided suggestion CSV.
 *
 * Reads the sheet scripts/ops/suggest-subcategories.ts produced, after the
 * founder has filled in the DECISION column. Only rows marked `APPLY` are
 * touched. Everything else is counted and skipped.
 *
 * What stands between this script and a bad write:
 *
 *   1. The default is a dry run. `--apply` alone is refused; it needs `--yes`.
 *   2. Every APPLY row must move a listing from a group to one of that group's
 *      own children, checked against the categories table on the target. A
 *      blank or foreign suggested_category_id stops the run before any write.
 *   3. The rollback CSV is written to disk before the first UPDATE, so a run
 *      that dies halfway is still covered.
 *   4. Every UPDATE is guarded against drift. A listing whose category_id moved
 *      since the sheet was made is left alone and reported.
 *
 * The search_vector trigger runs on any listings UPDATE, so search picks up the
 * new category name with no extra step.
 *
 * Usage:
 *   DATABASE_URL=postgres://... npx tsx scripts/ops/apply-subcategories.ts <csv>
 *   DATABASE_URL=postgres://... npx tsx scripts/ops/apply-subcategories.ts <csv> --apply --yes
 *   DATABASE_URL=postgres://... npx tsx scripts/ops/apply-subcategories.ts --rollback <csv> [--apply --yes]
 *
 * With no CSV path, the newest suggestion file in docs/blacqlist/ops/data/ is
 * used. Even a dry run reads the categories table on the target, so a dry run
 * against production still needs the founder's word. `--apply` against
 * production is GATE-DATA.
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, isAbsolute, join } from 'path'
import { fileURLToPath } from 'url'
import { Client } from 'pg'
import { describeConnectionTarget } from '../../lib/listings/locationTypeAudit'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = join(__dirname, '..', '..', 'docs', 'blacqlist', 'ops', 'data')

const argv = process.argv.slice(2)
const APPLY = argv.includes('--apply')
const YES = argv.includes('--yes')
const ROLLBACK_FLAG = argv.indexOf('--rollback')
const ROLLBACK_FILE = ROLLBACK_FLAG >= 0 ? argv[ROLLBACK_FLAG + 1] : undefined

// ── RFC-4180 CSV parser (handles quoted fields with commas + embedded newlines) ──
// Same parser as scripts/apply-location-type.ts, kept local so neither script
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

/** The newest `subcategory-suggest-*.csv` in the ops data directory. */
function latestSheet(): string {
  let files: string[]
  try {
    files = readdirSync(dataDir)
  } catch {
    throw new Error(`No CSV given and ${dataDir} does not exist. Run scripts/ops/suggest-subcategories.ts first.`)
  }
  const sheets = files.filter((f) => /^subcategory-suggest-.*\.csv$/.test(f)).sort()
  const newest = sheets[sheets.length - 1]
  if (!newest) throw new Error('No CSV given and none found. Run scripts/ops/suggest-subcategories.ts first.')
  return join(dataDir, newest)
}

/**
 * Name the target before touching it. A live run against a remote project
 * also requires --yes, and refuses outright when the ref can't be read: --yes
 * means "yes, that ref is the one I meant", and there is no ref to mean.
 */
function assertTargetConfirmed(url: string, live: boolean): void {
  const { kind, projectRef } = describeConnectionTarget(url)
  const isLocal = kind === 'local'
  const where = isLocal ? 'LOCAL' : kind === 'remote' ? 'REMOTE' : 'UNRECOGNISED'

  console.log(`Target: ${where}, project ref ${projectRef ? `"${projectRef}"` : '[could not read]'}`)
  if (!live) {
    console.log('Mode:   DRY RUN, nothing will be written.\n')
    return
  }
  console.log('Mode:   LIVE, this run updates category_id on the project above.\n')
  if (isLocal) return

  if (!projectRef) {
    console.error(
      'Refusing to write: the project ref could not be read from DATABASE_URL.\n' +
        'Expected a Supabase connection string: db.<ref>.supabase.co, or a pooler host\n' +
        'with the ref in the username as postgres.<ref>. Fix the URL and re-run.'
    )
    process.exit(1)
  }
  if (YES) return

  console.error(
    `Refusing to write to remote project "${projectRef}" without confirmation.\n` +
      `Check the ref above against the project you intend to write to, then re-run with --yes.\n` +
      `Writing category_id on a remote project is a GATE-DATA action; confirm the gate before passing it.`
  )
  process.exit(1)
}

interface Planned {
  id: string
  name: string
  from: string
  to: string
  toName: string
}

interface CategoryRow {
  id: string
  name: string
  parent_id: string | null
}

function plan(
  csvPath: string,
  categories: ReadonlyMap<string, CategoryRow>
): { planned: Planned[]; skipped: number; problems: string[] } {
  const rows = parseCsv(readFileSync(csvPath, 'utf8'))
  const planned: Planned[] = []
  const problems: string[] = []
  const seen = new Set<string>()
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
    const from = row.current_category_id ?? ''
    const to = row.suggested_category_id ?? ''

    if (!id) {
      problems.push(`line ${line}: marked APPLY but has no listing_id`)
      return
    }
    if (seen.has(id)) {
      problems.push(`line ${line} (${id}): listing appears twice in the sheet`)
      return
    }
    seen.add(id)
    if (!to) {
      problems.push(`line ${line} (${id}): marked APPLY but suggested_category_id is blank, fill in a child category id`)
      return
    }
    const child = categories.get(to)
    if (!child) {
      problems.push(`line ${line} (${id}): suggested_category_id "${to}" is not a category on this project`)
      return
    }
    if (child.parent_id !== from) {
      problems.push(
        `line ${line} (${id}): "${child.name}" is not a subcategory of the listing's current group, nothing was planned for it`
      )
      return
    }
    planned.push({ id, name: row.name ?? '', from, to, toName: child.name })
  })

  return { planned, skipped, problems }
}

async function loadCategories(db: Client): Promise<Map<string, CategoryRow>> {
  const { rows } = await db.query<CategoryRow>(`SELECT id, name, parent_id FROM categories`)
  return new Map(rows.map((r) => [r.id, r]))
}

async function runRollback(url: string, file: string) {
  const path = resolvePath(file)
  const rows = parseCsv(readFileSync(path, 'utf8'))
  const live = APPLY

  assertTargetConfirmed(url, live)
  console.log(`Rollback source: ${path}`)
  console.log(`Rows to restore: ${rows.length}\n`)

  if (!live) {
    rows.slice(0, 20).forEach((r) => console.log(`  ${r.listing_id}  ${r.applied_category_id} → ${r.previous_category_id}`))
    if (rows.length > 20) console.log(`  … and ${rows.length - 20} more`)
    console.log(`\n0 rows written. Re-run with --apply --yes to restore.`)
    return
  }

  const db = new Client({ connectionString: url })
  await db.connect()
  let restored = 0
  const drifted: string[] = []
  for (const r of rows) {
    if (!r.listing_id || !r.previous_category_id || !r.applied_category_id) {
      console.warn(`  skip a row with a blank listing_id, previous_category_id or applied_category_id`)
      continue
    }
    // Only undo what this backfill did: a listing an owner has moved since is left alone.
    const res = await db.query(
      `update listings
          set category_id = $2, updated_at = now()
        where id = $1
          and category_id = $3`,
      [r.listing_id, r.previous_category_id, r.applied_category_id]
    )
    if ((res.rowCount ?? 0) === 0) drifted.push(r.listing_id)
    else restored += res.rowCount ?? 0
  }
  await db.end()
  console.log(`\n${restored} rows restored.`)
  if (drifted.length > 0) {
    console.warn(`${drifted.length} row(s) changed since the backfill and were left alone:\n  ${drifted.join('\n  ')}`)
  }
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
  const csvPath = csvArg ? resolvePath(csvArg) : latestSheet()

  assertTargetConfirmed(url, APPLY)

  const db = new Client({ connectionString: url })
  await db.connect()
  try {
    const categories = await loadCategories(db)
    const { planned, skipped, problems } = plan(csvPath, categories)

    console.log(`Decision sheet: ${csvPath}`)
    console.log(`Rows marked APPLY: ${planned.length}`)
    console.log(`Rows skipped:      ${skipped}`)

    if (problems.length > 0) {
      console.error(`\n${problems.length} problem(s) in the sheet:`)
      problems.forEach((p) => console.error(`  ${p}`))
      console.error('\nFix the sheet and re-run. Nothing was written.')
      process.exitCode = 1
      return
    }

    if (planned.length === 0) {
      console.log('\n0 rows written.')
      return
    }

    console.log('')
    planned.slice(0, 20).forEach((p) => console.log(`  ${p.id}  → ${p.toName}  ${p.name}`))
    if (planned.length > 20) console.log(`  … and ${planned.length - 20} more`)

    if (!APPLY) {
      console.log(`\n0 rows written. Re-run with --apply --yes to write these ${planned.length} rows.`)
      return
    }

    // Rollback file first, before a single UPDATE runs. It records the group
    // each listing was in at plan time, which is also what the drift guard
    // below matches on, and the child it moved to, which the rollback guards on.
    const date = new Date().toISOString().slice(0, 10)
    const rollbackFile = join(dataDir, `subcategory-rollback-${date}.csv`)
    mkdirSync(dataDir, { recursive: true })
    writeFileSync(
      rollbackFile,
      [
        'listing_id,previous_category_id,applied_category_id',
        ...planned.map((p) => `${csvCell(p.id)},${csvCell(p.from)},${csvCell(p.to)}`),
      ].join('\n') + '\n',
      'utf8'
    )
    console.log(`\nRollback written first: ${rollbackFile}`)

    let written = 0
    const drifted: string[] = []
    for (const p of planned) {
      const res = await db.query(
        `update listings
            set category_id = $2, updated_at = now()
          where id = $1
            and category_id = $3`,
        [p.id, p.to, p.from]
      )
      if ((res.rowCount ?? 0) === 0) drifted.push(p.id)
      else written += res.rowCount ?? 0
    }

    console.log(`\n${written} rows written.`)
    if (drifted.length > 0) {
      console.warn(
        `${drifted.length} row(s) changed since the sheet was made and were left alone:\n  ${drifted.join('\n  ')}\n` +
          'Re-run the suggestion script to pick them up.'
      )
    }
    console.log(`To undo: --rollback ${rollbackFile} --apply --yes`)
  } finally {
    await db.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
