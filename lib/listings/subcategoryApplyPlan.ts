/**
 * The checks scripts/ops/apply-subcategories.ts runs on a decided sheet before
 * it writes anything (ticket 170). Pure, so tests/subcategory-apply-plan.test.ts
 * can run it without a database.
 *
 * A row's DECISION is one of:
 *
 *   APPLY  Move the listing to a child of the group it is already in. This is
 *          the backfill's normal case: a law firm under Legal & Financial
 *          becomes Law & Legal Services.
 *   MOVE   Move the listing to a child of a different group. For listings filed
 *          under the wrong group, decided by hand: a candle maker under Home &
 *          Living becomes Retail & Gifts > Candles & Home Fragrance.
 *   SKIP   Leave it alone. A blank DECISION means the same.
 *
 * Both APPLY and MOVE must land on a subcategory, never on a top-level group.
 */

export interface SheetRow {
  [column: string]: string | undefined
}

export interface PlanCategory {
  id: string
  name: string
  parent_id: string | null
}

export interface PlannedChange {
  id: string
  name: string
  decision: 'APPLY' | 'MOVE'
  from: string
  to: string
  toName: string
}

export interface SheetPlan {
  planned: PlannedChange[]
  skipped: number
  problems: string[]
}

export function planSubcategoryRows(
  rows: readonly SheetRow[],
  categories: ReadonlyMap<string, PlanCategory>
): SheetPlan {
  const planned: PlannedChange[] = []
  const problems: string[] = []
  const seen = new Set<string>()
  let skipped = 0

  rows.forEach((row, i) => {
    const line = i + 2 // header is line 1
    const decision = (row.DECISION ?? '').trim().toUpperCase()
    if (decision !== 'APPLY' && decision !== 'MOVE') {
      skipped += 1
      if (decision !== '' && decision !== 'SKIP') {
        problems.push(`line ${line}: DECISION "${row.DECISION}" is not APPLY, MOVE or SKIP`)
      }
      return
    }

    const id = row.listing_id ?? ''
    const from = row.current_category_id ?? ''
    const to = row.suggested_category_id ?? ''

    if (!id) {
      problems.push(`line ${line}: marked ${decision} but has no listing_id`)
      return
    }
    if (seen.has(id)) {
      problems.push(`line ${line} (${id}): listing appears twice in the sheet`)
      return
    }
    seen.add(id)
    if (!from) {
      problems.push(`line ${line} (${id}): current_category_id is blank, nothing was planned for it`)
      return
    }
    if (!to) {
      problems.push(`line ${line} (${id}): marked ${decision} but suggested_category_id is blank, fill in a child category id`)
      return
    }
    const child = categories.get(to)
    if (!child) {
      problems.push(`line ${line} (${id}): suggested_category_id "${to}" is not a category on this project`)
      return
    }
    if (child.parent_id === null) {
      problems.push(`line ${line} (${id}): "${child.name}" is a top-level group, pick one of its subcategories`)
      return
    }
    if (to === from) {
      problems.push(`line ${line} (${id}): the listing is already in "${child.name}"`)
      return
    }
    if (decision === 'APPLY' && child.parent_id !== from) {
      problems.push(
        `line ${line} (${id}): "${child.name}" is not a subcategory of the listing's current group. ` +
          'Use MOVE if it really belongs in another group.'
      )
      return
    }
    planned.push({ id, name: row.name ?? '', decision, from, to, toName: child.name })
  })

  return { planned, skipped, problems }
}
