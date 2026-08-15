/**
 * The one definition of the community-aggregate privacy threshold.
 *
 * `/flow-map` publishes, in plain words:
 *
 *   "Community totals only appear when contributed to by 5 or more distinct
 *    transactions."
 *
 * That sentence is a promise to the community, so the number behind it lives in
 * exactly one place and every surface that publishes a per-entity total reads it
 * from here. Before this module the threshold was a bare `.gte('transaction_count', 5)`
 * on a single query in `app/api/flow-map/summary/route.ts`, and the other
 * per-entity queries carried nothing — a business with one receipt was published
 * by name, with its exact dollar total and `transaction_count: 1`.
 *
 * What the threshold does and does not cover:
 *
 * - **Per-entity totals are gated.** A named business or city is only published
 *   once at least `AGGREGATE_MIN_TRANSACTIONS` spend events point at it. Naming
 *   an entity next to a dollar figure is the disclosure that matters; below the
 *   threshold it approaches "here is one person's receipt."
 * - **Community-wide totals are not gated, deliberately.** The headline figures
 *   are a single sum across the whole corpus and identify no one. Suppressing
 *   them would not add privacy; it would only make the page empty.
 *
 * One honest limit, stated rather than implied: `transaction_count` counts spend
 * events, not distinct contributors. Five receipts from one person clear this bar.
 * The published sentence says "distinct transactions", which is exactly what this
 * enforces — but a stronger guarantee (distinct *people*) needs a join through
 * `receipt_uploads.user_id`, which `flow_nodes` does not carry today.
 */
export const AGGREGATE_MIN_TRANSACTIONS = 5

/** A row that carries a transaction count. Structural, so it fits every caller. */
type CountedRow = { transaction_count: number }

/**
 * True when a per-entity aggregate has enough transactions behind it to publish.
 *
 * Use this for anything computed in memory. For anything read from the database,
 * prefer pushing the bound into the query with `applyAggregateThreshold` so
 * sub-threshold rows never leave Postgres and never eat into a `.limit()`.
 */
export function meetsAggregateThreshold(row: CountedRow): boolean {
  return row.transaction_count >= AGGREGATE_MIN_TRANSACTIONS
}

/** Drops every per-entity row that has not cleared the threshold. */
export function filterToPublishable<T extends CountedRow>(rows: readonly T[]): T[] {
  return rows.filter(meetsAggregateThreshold)
}

/**
 * Pushes the threshold into a PostgREST query builder.
 *
 * Generic over the builder type so it works with any `.gte()`-bearing chain
 * without importing Supabase's internal generics. Chain it before `.order()` and
 * `.limit()` — filtering in the database means a `.limit(10)` returns ten
 * publishable rows rather than ten rows of which some are then discarded.
 */
export function applyAggregateThreshold<T extends { gte(column: string, value: number): T }>(
  query: T
): T {
  return query.gte('transaction_count', AGGREGATE_MIN_TRANSACTIONS)
}
