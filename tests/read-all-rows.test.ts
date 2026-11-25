// Ticket 278: the API returns at most 1,000 rows and says nothing when it cuts a
// result short. These run the real helpers and the real spend read
// against a stand-in API with a row cap.

import { describe, it, expect } from 'vitest'

import { IN_BATCH_SIZE, READ_PAGE_SIZE, readAllRows, readInBatches } from '@/lib/supabase/read-all'
import { readCountedSpend } from '@/lib/spend/counted-spend'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

interface Row {
  id: string
  amount_cents: number
  listing_id: string
  created_at: string
}

const rowsOf = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({
    id: id(i + 1),
    amount_cents: 100,
    listing_id: id(9000 + (i % 7)),
    created_at: '2026-11-24T00:00:00Z',
  }))

/** Answers like the API: at most `cap` rows, with the full count of what matched. */
function cappedReader(
  rows: Row[],
  cap: number,
  opts: { failOnPage?: number; count?: boolean } = {}
) {
  let page = 0
  const read = async (afterId: string, limit: number) => {
    page++
    if (opts.failOnPage === page) return { data: null, error: { message: 'boom' }, count: null }
    const left = rows.filter((r) => r.id > afterId)
    return {
      data: left.slice(0, Math.min(cap, limit)),
      error: null,
      count: opts.count === false ? null : left.length,
    }
  }
  return { read, pages: () => page }
}

/** Just enough of the Supabase client for readCountedSpend. */
function cappedClient(rows: Row[], cap: number, failOnPage?: number) {
  const { read } = cappedReader(rows, cap, { failOnPage })
  return {
    from(table: string) {
      expect(table).toBe('spend_events')
      let after = ''
      const chain = {
        select: () => chain,
        eq: () => chain,
        not: () => chain,
        order: () => chain,
        gt: (_column: string, value: string) => {
          after = value
          return chain
        },
        limit: (n: number) => read(after, n),
      }
      return chain
    },
  } as unknown as Parameters<typeof readCountedSpend>[0]
}

describe('readAllRows', () => {
  it.each([0, 1, 706, 999, 1000, 1001, 2000, 2500])(
    'returns all %i rows past a 1,000 cap',
    async (n) => {
      const { read } = cappedReader(rowsOf(n), 1000)
      const res = await readAllRows(read)
      expect(res.error).toBeNull()
      expect(res.data.map((r) => r.id)).toEqual(rowsOf(n).map((r) => r.id))
    }
  )

  it('does not stop at a short page when the server cap is under the page size', async () => {
    const { read } = cappedReader(rowsOf(1200), 500)
    expect(READ_PAGE_SIZE).toBeGreaterThan(500)
    expect((await readAllRows(read)).data).toHaveLength(1200)
  })

  it('still reads everything when the server sends no count', async () => {
    const { read } = cappedReader(rowsOf(1200), 500, { count: false })
    expect((await readAllRows(read)).data).toHaveLength(1200)
  })

  it('costs one request when everything fits', async () => {
    const { read, pages } = cappedReader(rowsOf(706), 1000)
    await readAllRows(read)
    expect(pages()).toBe(1)
  })

  it('fails as a whole when a later page fails, never part of the rows', async () => {
    const { read } = cappedReader(rowsOf(2500), 1000, { failOnPage: 2 })
    expect(await readAllRows(read)).toEqual({ data: [], error: { message: 'boom' } })
  })

  it('fails rather than looping when the query ignores where it left off', async () => {
    const rows = rowsOf(1500)
    const res = await readAllRows(async () => ({
      data: rows.slice(0, 1000),
      error: null,
      count: 1500,
    }))
    expect(res.data).toEqual([])
    expect(res.error).not.toBeNull()
  })

  it('fails when rows are left but none come back', async () => {
    const res = await readAllRows<Row>(async () => ({ data: [], error: null, count: 4 }))
    expect(res.data).toEqual([])
    expect(res.error).not.toBeNull()
  })

  it('neither loses nor repeats a row when others change between pages', async () => {
    const rows = rowsOf(1500)
    let calls = 0
    const res = await readAllRows(async (afterId, limit) => {
      calls++
      // Between the pages: one already-read row goes, and a new one lands before the cursor.
      if (calls === 2) rows.splice(3, 1, { ...rows[3]!, id: id(0) })
      const left = rows.filter((r) => r.id > afterId)
      return { data: left.slice(0, Math.min(1000, limit)), error: null, count: left.length }
    })
    expect(res.data).toHaveLength(1500)
    expect(new Set(res.data.map((r) => r.id)).size).toBe(1500)
  })
})

describe('readCountedSpend', () => {
  it('totals every receipt past the cap', async () => {
    const res = await readCountedSpend(cappedClient(rowsOf(2345), 1000))
    expect(res.data).toHaveLength(2345)
    expect(res.data.reduce((sum, r) => sum + r.amount_cents, 0)).toBe(234_500)
  })

  it('reports a failed second page instead of a low total', async () => {
    const res = await readCountedSpend(cappedClient(rowsOf(2345), 1000, 2))
    expect(res.data).toEqual([])
    expect(res.error).not.toBeNull()
  })
})

describe('readInBatches', () => {
  it('keeps each batch short and returns every row', async () => {
    const ids = rowsOf(250).map((r) => r.id)
    const sizes: number[] = []
    const res = await readInBatches(ids, async (batch) => {
      sizes.push(batch.length)
      return { data: batch.map((b) => ({ id: b })), error: null }
    })
    expect(Math.max(...sizes)).toBeLessThanOrEqual(IN_BATCH_SIZE)
    expect(res.data.map((r) => r.id)).toEqual(ids)
  })

  it('makes no request for no ids', async () => {
    let calls = 0
    const res = await readInBatches([], async () => {
      calls++
      return { data: [], error: null }
    })
    expect(calls).toBe(0)
    expect(res).toEqual({ data: [], error: null })
  })

  it('fails as a whole when one batch fails', async () => {
    let calls = 0
    const res = await readInBatches(
      rowsOf(250).map((r) => r.id),
      async (batch) => {
        calls++
        return calls === 2
          ? { data: null, error: { message: 'boom' } }
          : { data: batch, error: null }
      }
    )
    expect(res).toEqual({ data: [], error: { message: 'boom' } })
  })
})
