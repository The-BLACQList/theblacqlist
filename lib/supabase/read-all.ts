/**
 * Reading every row, past the API's row cap (ticket 278).
 *
 * The hosted API returns at most 1,000 rows per request (Supabase "Max Rows")
 * and raises no error when it cuts a result short, so a plain select silently
 * loses rows past the cap. These helpers read page by page and never return
 * part of a result as if it were all of it: any failed page fails the read.
 */

/** Rows asked for per page. The server may return fewer if its own cap is lower. */
export const READ_PAGE_SIZE = 1000

/** Ids per `in (…)` filter, so the request address stays short. */
export const IN_BATCH_SIZE = 100

/** Batches in flight at once, so one page view can't flood the database. */
export const BATCH_CONCURRENCY = 5

/** Below every real id, so the first page starts at the beginning. */
export const FIRST_ID = '00000000-0000-0000-0000-000000000000'

export interface ReadAllResult<T> {
  /** Empty whenever `error` is set. */
  data: T[]
  error: { message: string } | null
}

interface PageResult<T> {
  data: T[] | null
  error: { message: string } | null
  count: number | null
}

/**
 * Reads every row of a select, in id order. The query must:
 *   - select `id`, with `{ count: 'exact' }`
 *   - filter `.gt('id', afterId)`, `.order('id')`, `.limit(limit)`
 *
 * Paging by id rather than by offset means a row added or removed between two
 * pages can't push another row past the edge or count it twice. `count` is how
 * many rows are left, so a full result costs one request and a short page from
 * a lower server cap is never mistaken for the last one.
 */
export async function readAllRows<T extends { id: string }>(
  readPage: (afterId: string, limit: number) => PromiseLike<PageResult<T>>
): Promise<ReadAllResult<T>> {
  const out: T[] = []
  let afterId = FIRST_ID
  for (;;) {
    const { data, error, count } = await readPage(afterId, READ_PAGE_SIZE)
    if (error) return { data: [], error }
    const rows = data ?? []
    out.push(...rows)
    const last = rows[rows.length - 1]
    if (!last) {
      if (!count) return { data: out, error: null }
      return { data: [], error: { message: `Read stopped with ${count} rows left.` } }
    }
    if (count !== null && rows.length >= count) return { data: out, error: null }
    // Guards against a query that forgot `.gt('id', afterId)` and never moves on.
    if (last.id <= afterId) return { data: [], error: { message: 'Read did not move forward.' } }
    afterId = last.id
  }
}

/** Runs an `in (…)` read in batches, a few at a time. Any failed batch fails the read. */
export async function readInBatches<T>(
  ids: readonly string[],
  readBatch: (ids: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<ReadAllResult<T>> {
  const batches: string[][] = []
  for (let i = 0; i < ids.length; i += IN_BATCH_SIZE) batches.push(ids.slice(i, i + IN_BATCH_SIZE))
  const out: T[] = []
  for (let i = 0; i < batches.length; i += BATCH_CONCURRENCY) {
    const results = await Promise.all(
      batches.slice(i, i + BATCH_CONCURRENCY).map((b) => readBatch(b))
    )
    const failed = results.find((r) => r.error)
    if (failed) return { data: [], error: failed.error }
    for (const r of results) out.push(...(r.data ?? []))
  }
  return { data: out, error: null }
}
