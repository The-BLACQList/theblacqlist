/**
 * Title Case on stored category names (ticket 205).
 *
 * The migration 20261119000000_title_case_saved_labels.sql fixes the seeded
 * names it knows. Categories an admin added from a category request are only
 * in the target database, so this script reads them, prints each rename and,
 * with `--apply --yes`, writes it. The rules live in
 * lib/categories/title-case-plan.ts (the same helper the site uses).
 *
 *   1. The default is a dry run. `--apply` alone is refused; it needs `--yes`.
 *   2. Each UPDATE matches the old name too, so a name edited since the dry run
 *      is left alone and reported.
 *   3. The rollback SQL is printed before the first write.
 *
 * Usage:
 *   DATABASE_URL=postgres://... npx tsx scripts/ops/title-case-categories.ts
 *   DATABASE_URL=postgres://... npx tsx scripts/ops/title-case-categories.ts --apply --yes
 *
 * Even a dry run reads the target, so a dry run against production still needs
 * the founder's word. `--apply` against production is GATE-DATA.
 */

import { Client } from 'pg'
import { describeConnectionTarget } from '../../lib/listings/locationTypeAudit'
import { planCategoryTitleCase, type CategoryNameRow } from '../../lib/categories/title-case-plan'

const argv = process.argv.slice(2)
const APPLY = argv.includes('--apply')
const YES = argv.includes('--yes')

const sqlText = (s: string) => `'${s.replace(/'/g, "''")}'`

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')
  if (APPLY && !YES) {
    console.error(
      '--apply requires --yes.\nAgainst production this is a GATE-DATA action; confirm the gate before passing it.'
    )
    process.exit(1)
  }

  const { kind, projectRef } = describeConnectionTarget(url)
  const where = kind === 'local' ? 'LOCAL' : kind === 'remote' ? 'REMOTE' : 'UNRECOGNISED'
  console.log(
    `Target: ${where}, project ref ${projectRef ? `"${projectRef}"` : '[could not read]'}`
  )
  console.log(
    APPLY
      ? 'Mode:   LIVE, this run renames categories.\n'
      : 'Mode:   DRY RUN, nothing will be written.\n'
  )
  if (APPLY && kind !== 'local' && !projectRef) {
    console.error('Refusing to write: the project ref could not be read from DATABASE_URL.')
    process.exit(1)
  }

  const db = new Client({ connectionString: url })
  await db.connect()
  try {
    const { rows } = await db.query<CategoryNameRow>(
      'SELECT id, slug, name FROM categories ORDER BY slug'
    )
    const plan = planCategoryTitleCase(rows)
    for (const r of plan) console.log(`  ${r.slug}: "${r.from}" → "${r.to}"`)
    console.log(`\n${plan.length} of ${rows.length} categories need Title Case.`)
    if (!APPLY || plan.length === 0) {
      if (plan.length > 0) console.log('Re-run with --apply --yes to write them.')
      return
    }

    console.log('\nRollback SQL:')
    for (const r of plan) {
      console.log(
        `  UPDATE categories SET name = ${sqlText(r.from)} WHERE id = '${r.id}' AND name = ${sqlText(r.to)};`
      )
    }

    const drifted: string[] = []
    let written = 0
    for (const r of plan) {
      const res = await db.query('UPDATE categories SET name = $1 WHERE id = $2 AND name = $3', [
        r.to,
        r.id,
        r.from,
      ])
      if ((res.rowCount ?? 0) === 0) drifted.push(r.slug)
      else written += res.rowCount ?? 0
    }
    console.log(`\nRenamed: ${written}.`)
    if (drifted.length > 0)
      console.warn(`Changed since the read, left alone: ${drifted.join(', ')}`)
  } finally {
    await db.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
