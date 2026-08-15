// =============================================================================
// Community-aggregate privacy threshold
// =============================================================================
// /flow-map publishes a promise to the community: a named business or city only
// appears once AGGREGATE_MIN_TRANSACTIONS or more distinct transactions are
// behind its total.
//
// Before this suite the promise was kept by exactly ONE of the per-entity
// queries that back it — a bare `.gte('transaction_count', 5)` on the flow_edges
// query in app/api/flow-map/summary/route.ts. The other per-entity queries
// carried nothing, so a business with a single receipt was published by name,
// with its exact dollar total and transaction_count: 1, on the public page, on
// the public JSON API, and on /account/community-spend.
//
// So this file guards two different things:
//
//   1. The module's own logic (pure, cheap).
//   2. That every per-entity query in the four surfaces still carries the
//      threshold — asserted by parsing the source, because vitest runs
//      environment: 'node' with no jsdom, and these are Server Components and
//      route handlers that cannot be rendered here. Source-parsing is the same
//      guard tests/account-surfaces.test.ts uses for the RLS policy it protects.
//      Deleting a .gte() should fail CI, not quietly widen a published promise.
// =============================================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import {
  AGGREGATE_MIN_TRANSACTIONS,
  meetsAggregateThreshold,
  filterToPublishable,
  applyAggregateThreshold,
} from '@/lib/spend/aggregate-privacy'

// ── The threshold itself ────────────────────────────────────────────────────

describe('AGGREGATE_MIN_TRANSACTIONS', () => {
  it('is 5, matching the sentence published on /flow-map', () => {
    expect(AGGREGATE_MIN_TRANSACTIONS).toBe(5)
  })

  it('is the number the privacy notice interpolates, so copy cannot drift', () => {
    const page = readFileSync(
      path.resolve(process.cwd(), 'app/(public)/flow-map/page.tsx'),
      'utf8'
    )
    // The notice must render the constant, not a hardcoded digit. If someone
    // types "5" back into the copy, changing the constant would silently make
    // the page lie.
    expect(page).toContain('{AGGREGATE_MIN_TRANSACTIONS}')
  })
})

describe('meetsAggregateThreshold', () => {
  it('rejects a single-transaction entity — the disclosure the threshold exists for', () => {
    expect(meetsAggregateThreshold({ transaction_count: 1 })).toBe(false)
  })

  it('rejects one short of the bar', () => {
    expect(meetsAggregateThreshold({ transaction_count: AGGREGATE_MIN_TRANSACTIONS - 1 })).toBe(
      false
    )
  })

  it('accepts exactly at the bar — the boundary is inclusive, matching .gte()', () => {
    expect(meetsAggregateThreshold({ transaction_count: AGGREGATE_MIN_TRANSACTIONS })).toBe(true)
  })

  it('accepts above the bar', () => {
    expect(meetsAggregateThreshold({ transaction_count: 400 })).toBe(true)
  })

  it('rejects zero', () => {
    expect(meetsAggregateThreshold({ transaction_count: 0 })).toBe(false)
  })
})

describe('filterToPublishable', () => {
  it('drops sub-threshold rows and keeps the rest, in order', () => {
    const rows = [
      { entity_id: 'a', transaction_count: 12 },
      { entity_id: 'b', transaction_count: 1 },
      { entity_id: 'c', transaction_count: 5 },
      { entity_id: 'd', transaction_count: 4 },
    ]
    expect(filterToPublishable(rows).map((r) => r.entity_id)).toEqual(['a', 'c'])
  })

  it('returns an empty array when nothing clears the bar — an empty page is the correct outcome', () => {
    expect(filterToPublishable([{ transaction_count: 1 }, { transaction_count: 2 }])).toEqual([])
  })

  it('handles an empty input', () => {
    expect(filterToPublishable([])).toEqual([])
  })
})

describe('applyAggregateThreshold', () => {
  it('pushes a gte on transaction_count into the query builder and returns the chain', () => {
    const calls: Array<[string, number]> = []
    const builder = {
      gte(column: string, value: number) {
        calls.push([column, value])
        return this
      },
    }

    const returned = applyAggregateThreshold(builder)

    expect(calls).toEqual([['transaction_count', AGGREGATE_MIN_TRANSACTIONS]])
    expect(returned).toBe(builder)
  })
})

// ── Every per-entity query still carries the threshold ──────────────────────

describe('per-entity aggregate queries are gated at the threshold', () => {
  function source(file: string): string {
    return readFileSync(path.resolve(process.cwd(), file), 'utf8')
  }

  // The four surfaces that publish a named entity beside a dollar figure.
  const SURFACES = [
    'app/(public)/flow-map/page.tsx',
    'app/api/flow-map/summary/route.ts',
    'app/api/community-spend/route.ts',
    'app/account/community-spend/page.tsx',
  ] as const

  it.each(SURFACES)('%s imports the shared threshold', (file) => {
    expect(source(file)).toContain("from '@/lib/spend/aggregate-privacy'")
  })

  it.each(SURFACES)('%s gates every flow_nodes read on transaction_count', (file) => {
    const src = source(file)
    // One .gte per flow_nodes query. Both node types (business, city) are read
    // on all four surfaces, so the count is the check: a dropped .gte shows up
    // as 1 instead of 2.
    const nodeQueries = src.match(/\.from\('flow_nodes'\)/g) ?? []
    const gated = src.match(/\.gte\('transaction_count', AGGREGATE_MIN_TRANSACTIONS\)/g) ?? []
    expect(nodeQueries.length).toBeGreaterThan(0)
    expect(gated.length).toBeGreaterThanOrEqual(nodeQueries.length)
  })

  it('no surface hardcodes the threshold value in a query', () => {
    for (const file of SURFACES) {
      expect(source(file)).not.toMatch(/\.gte\('transaction_count',\s*\d/)
    }
  })

  it('the flow_edges query is gated on the same constant', () => {
    const src = source('app/api/flow-map/summary/route.ts')
    const edgeBlock = src.slice(src.indexOf("from('flow_edges')"))
    expect(edgeBlock).toContain(".gte('transaction_count', AGGREGATE_MIN_TRANSACTIONS)")
  })

  // The threshold is only worth what the table underneath it enforces. These
  // three tables are granted `TO anon, authenticated USING (true)` by
  // 20260511000001_receipt_community_spend.sql, so today anyone can query them
  // directly through PostgREST with the publishable key that ships in every page
  // bundle — unfiltered, including sub-threshold rows and rows whose owner set
  // aggregate_opt_out. Closing that grant is a migration and its own gate.
  //
  // What this test pins is the prerequisite: no surface may read these tables
  // with the user-scoped client. While one does, dropping the policy silently
  // empties that page instead of hardening it, and the migration cannot ship.
  it('every read of the three aggregate tables goes through the service client', () => {
    const AGGREGATE_TABLES = ['spend_events', 'flow_nodes', 'flow_edges']

    for (const file of [...SURFACES, 'app/page.tsx']) {
      const src = source(file)
      for (const table of AGGREGATE_TABLES) {
        // Walk backwards from each .from('<table>') to the client it hangs off.
        // A user-scoped read reads `await supabase\n  .from('flow_nodes')`.
        const pattern = new RegExp(`(\\w+)\\s*\\n?\\s*\\.from\\('${table}'\\)`, 'g')
        for (const [, receiver] of src.matchAll(pattern)) {
          expect(
            receiver,
            `${file} reads ${table} via "${receiver}" — must be the service client`
          ).toMatch(/service/i)
        }
      }
    }
  })

  it('community-wide totals stay ungated — suppressing them adds no privacy', () => {
    // spend_events is summed across the whole corpus and names no entity. If a
    // future change gates it too, the headline figures go to zero for no gain,
    // so the absence of a threshold here is deliberate and pinned.
    for (const file of ['app/api/flow-map/summary/route.ts', 'app/api/community-spend/route.ts']) {
      const src = source(file)
      const spendBlock = src.slice(
        src.indexOf("from('spend_events')"),
        src.indexOf("from('flow_nodes')")
      )
      expect(spendBlock).not.toContain('transaction_count')
    }
  })
})
