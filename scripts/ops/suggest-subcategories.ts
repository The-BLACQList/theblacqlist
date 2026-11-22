/**
 * Subcategory suggestions (ticket 170). Read-only.
 *
 * Finds every published listing filed only under a top-level group
 * (Professional Services, Events & Entertainment, ...) and suggests the child
 * category its own words point to, using lib/listings/subcategorySuggest.ts.
 * Writes a CSV with a blank DECISION column for the founder to fill in. It
 * opens no write path: no INSERT, no UPDATE. The only thing it can damage is a
 * local file.
 *
 * Usage:
 *   DATABASE_URL=postgres://... npx tsx scripts/ops/suggest-subcategories.ts
 *   DATABASE_URL=postgres://... npx tsx scripts/ops/suggest-subcategories.ts --into=bath-body
 *
 * --into=<slug> (ticket 257): every published listing, in any category, that
 * belongs in this one subcategory by the rule in INTO_RULES
 * (lib/listings/subcategorySuggest.ts). For a new category that takes
 * listings from several places. Writes subcategory-suggest-<slug>-<date>.csv
 * with the same columns. Rows whose words matched but that another trade's
 * word ruled out are listed last as `excluded`, for a look, never suggested.
 * Mark the rows to move MOVE (APPLY works only for a listing filed under the
 * target's own group; the note says which).
 *
 * Point it at staging first. Reading production needs the founder's word
 * (plan approval is not prod-read permission). The target is printed before
 * the first query.
 *
 * Writes docs/blacqlist/ops/data/subcategory-suggest-<date>.csv, an ops-auto
 * directory that is gitignored. Listings are public, so the sheet holds no
 * personal data: ids, business names and category names only.
 *
 * Next step: put APPLY or SKIP in the DECISION column of every row. A row with
 * no suggestion can still be APPLY if you type a child category id into
 * suggested_category_id. Then run scripts/ops/apply-subcategories.ts.
 */

import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { Client } from 'pg'
import { describeConnectionTarget } from '../../lib/listings/locationTypeAudit'
import {
  INTO_RULES,
  suggestInto,
  suggestSubcategory,
  type IntoSuggestion,
  type SubcategorySuggestion,
} from '../../lib/listings/subcategorySuggest'
import type { AssistCategory } from '../../lib/search/assist'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', '..', 'docs', 'blacqlist', 'ops', 'data')

/** Name the target before touching it. Never print the connection string: it carries the password. */
function announceTarget(url: string): void {
  const { kind, projectRef } = describeConnectionTarget(url)
  const where = kind === 'local' ? 'LOCAL' : kind === 'remote' ? 'REMOTE' : 'UNRECOGNISED'
  console.log(`Target: ${where}, project ref ${projectRef ? `"${projectRef}"` : '[could not read]'}`)
  if (kind !== 'local' && !projectRef) {
    console.log('        Check by hand which project this points at before trusting the numbers.')
  }
  console.log('Mode:   READ-ONLY, this script never writes to the database.\n')
}

/** RFC 4180: quote every field, double any embedded quote. Business names contain commas. */
function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

interface CategoryRow {
  id: string
  name: string
  slug: string
  parent_id: string | null
}

interface ListingRow {
  id: string
  name: string
  tagline: string | null
  description: string | null
  category_id: string
  subcategory_count: number
}

// Most sure first, so the rows worth a quick yes sit at the top of the sheet.
const ORDER: Record<SubcategorySuggestion['confidence'], number> = { several: 0, one: 1, tie: 2, none: 3 }
const INTO_ORDER: Record<IntoSuggestion['confidence'], number> = { name: 0, several: 1, excluded: 2, none: 3 }

const HEADER = [
  'listing_id',
  'name',
  'current_category',
  'current_category_id',
  'suggested_subcategory',
  'suggested_category_id',
  'matched_words',
  'confidence',
  'note',
  'DECISION',
].join(',')

function arg(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length)
}

interface IntoListingRow {
  id: string
  name: string
  tagline: string | null
  description: string | null
  category_id: string
}

/** --into=<slug>: every published listing that belongs in one subcategory. */
async function into(url: string, slug: string) {
  const rule = INTO_RULES[slug]
  if (!rule) throw new Error(`No rule for "${slug}". Rules exist for: ${Object.keys(INTO_RULES).join(', ')}`)

  const db = new Client({ connectionString: url })
  await db.connect()
  const { rows: categoryRows } = await db.query<CategoryRow>(
    `SELECT id, name, slug, parent_id FROM categories ORDER BY name`
  )
  const target = categoryRows.find((c) => c.slug === slug)
  if (!target || !target.parent_id) {
    await db.end()
    throw new Error(
      `"${slug}" is not a subcategory on this database. Run its migration first ` +
        '(for bath-body: 20261205000000_bath_body_subcategory.sql).'
    )
  }
  const { rows: listingRows } = await db.query<IntoListingRow>(
    `
    SELECT l.id, l.name, l.tagline, d.description, l.category_id
    FROM listings l
    LEFT JOIN listing_details_business d ON d.listing_id = l.id
    WHERE l.status = 'published'
      AND l.deleted_at IS NULL
      AND l.category_id <> $1
    ORDER BY l.name
  `,
    [target.id]
  )
  await db.end()

  const byId = new Map(categoryRows.map((c) => [c.id, c]))
  const results = listingRows
    .map((l) => ({ listing: l, suggestion: suggestInto(l, rule) }))
    .filter((r) => r.suggestion.confidence !== 'none')
    .sort(
      (a, b) =>
        INTO_ORDER[a.suggestion.confidence] - INTO_ORDER[b.suggestion.confidence] ||
        a.listing.name.localeCompare(b.listing.name)
    )

  const body = results.map(({ listing, suggestion }) => {
    const excluded = suggestion.confidence === 'excluded'
    const from = byId.get(listing.category_id)
    const note = excluded
      ? `excluded by "${suggestion.excludedBy}": check by hand, MOVE only if it really sells bath goods`
      : listing.category_id === target.parent_id
        ? 'APPLY (filed under the group itself)'
        : `MOVE (now in ${from?.name ?? 'another category'})`
    return [
      csvCell(listing.id),
      csvCell(listing.name),
      csvCell(from?.name ?? ''),
      csvCell(listing.category_id),
      csvCell(target.name),
      csvCell(target.id),
      csvCell(suggestion.matched.join('; ')),
      csvCell(suggestion.confidence),
      csvCell(note),
      csvCell(''),
    ].join(',')
  })

  const date = new Date().toISOString().slice(0, 10)
  const outFile = join(outDir, `subcategory-suggest-${slug}-${date}.csv`)
  mkdirSync(outDir, { recursive: true })
  writeFileSync(outFile, [HEADER, ...body].join('\n') + '\n', 'utf8')

  const count = (c: IntoSuggestion['confidence']) => results.filter((r) => r.suggestion.confidence === c).length
  console.log(`Published listings checked: ${listingRows.length} (not already in ${target.name})`)
  console.log(`  strong word in the name: ${count('name')}`)
  console.log(`  two or more words:       ${count('several')}`)
  console.log(`  excluded, for a look:    ${count('excluded')}`)
  console.log(`\nWrote: ${outFile}`)
  console.log(
    '\nNext: put MOVE (or APPLY, as the note says) or SKIP in DECISION on every row, then run\n' +
      `scripts/ops/apply-subcategories.ts ${outFile} (a dry run unless you pass --apply --yes).`
  )
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')

  announceTarget(url)

  const intoSlug = arg('into')
  if (intoSlug) return into(url, intoSlug)

  const db = new Client({ connectionString: url })
  await db.connect()

  const { rows: categoryRows } = await db.query<CategoryRow>(
    `SELECT id, name, slug, parent_id FROM categories ORDER BY name`
  )

  // A listing whose category_id is a group that has children. Groups with no
  // children have nothing to suggest, so they are left out.
  const { rows: listingRows } = await db.query<ListingRow>(`
    SELECT
      l.id,
      l.name,
      l.tagline,
      d.description,
      l.category_id,
      coalesce(cardinality(l.subcategory_ids), 0) AS subcategory_count
    FROM listings l
    JOIN categories c ON c.id = l.category_id AND c.parent_id IS NULL
    LEFT JOIN listing_details_business d ON d.listing_id = l.id
    WHERE l.status = 'published'
      AND l.deleted_at IS NULL
      AND EXISTS (SELECT 1 FROM categories child WHERE child.parent_id = c.id)
    ORDER BY l.name
  `)

  await db.end()

  const categories: AssistCategory[] = categoryRows.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    parentId: c.parent_id,
  }))
  const byId = new Map(categories.map((c) => [c.id, c]))

  const results = listingRows
    .map((l) => ({
      listing: l,
      suggestion: suggestSubcategory(
        { name: l.name, tagline: l.tagline, description: l.description },
        l.category_id,
        categories
      ),
    }))
    .sort(
      (a, b) =>
        ORDER[a.suggestion.confidence] - ORDER[b.suggestion.confidence] ||
        a.listing.name.localeCompare(b.listing.name)
    )

  const body = results.map(({ listing, suggestion }) => {
    const notes: string[] = []
    if (suggestion.confidence === 'tie') {
      notes.push(`tied: ${suggestion.tied.map((c) => `${c.name} (${c.id})`).join('; ')}`)
    }
    if (listing.subcategory_count > 0) notes.push('already has subcategory_ids')
    return [
      csvCell(listing.id),
      csvCell(listing.name),
      csvCell(byId.get(listing.category_id)?.name ?? ''),
      csvCell(listing.category_id),
      csvCell(suggestion.suggested?.name ?? ''),
      csvCell(suggestion.suggested?.id ?? ''),
      csvCell(suggestion.matched.join('; ')),
      csvCell(suggestion.confidence),
      csvCell(notes.join(' | ')),
      csvCell(''),
    ].join(',')
  })

  const date = new Date().toISOString().slice(0, 10)
  const outFile = join(outDir, `subcategory-suggest-${date}.csv`)
  mkdirSync(outDir, { recursive: true })
  writeFileSync(outFile, [HEADER, ...body].join('\n') + '\n', 'utf8')

  const count = (c: SubcategorySuggestion['confidence']) => results.filter((r) => r.suggestion.confidence === c).length
  console.log(`Published listings filed only under a group: ${results.length}`)
  console.log(`  several words agree:   ${count('several')}`)
  console.log(`  one word matched:      ${count('one')}`)
  console.log(`  tie (no suggestion):   ${count('tie')}`)
  console.log(`  nothing matched:       ${count('none')}`)
  console.log(`\nWrote: ${outFile}`)
  console.log(
    '\nNext: put APPLY or SKIP in DECISION on every row, then run\n' +
      'scripts/ops/apply-subcategories.ts (a dry run unless you pass --apply --yes).'
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
