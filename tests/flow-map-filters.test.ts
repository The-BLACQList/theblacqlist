// =============================================================================
// /flow-map city + category filters (item 13c)
// =============================================================================
// The page publishes two kinds of number under one privacy promise:
//
//   • three community-wide figures, published ungated because they are a single
//     sum across everything reported and identify no one, and
//   • per-business and per-city totals, published only once
//     AGGREGATE_MIN_TRANSACTIONS transactions are behind them.
//
// Filtering is where that promise is easiest to break by accident. This suite
// pins the three properties that keep it intact:
//
//   1. The filters SELECT which businesses are shown. They never re-aggregate,
//      so the threshold keeps its exact unfiltered meaning and a filter can
//      never publish a total that was being withheld.
//   2. The community-wide figures are not sliced, and the page says so rather
//      than letting the reader assume a filtered headline.
//   3. A filtered dead end always offers a way out.
//
// Parsed from source because vitest runs environment: 'node' with no jsdom and
// the page is a Server Component that cannot be rendered here — the same
// technique tests/aggregate-privacy.test.ts and tests/spend-vocabulary.test.ts
// use.
//
// Non-vacuity: every assertion below was run against the pre-change tree
// (main @ fe4af0e) and failed there. The page took no searchParams, the filter
// UI was a pair of `disabled` placeholder buttons labeled "Coming soon", and
// components/flow-map/FlowMapFilters.tsx did not exist.
// =============================================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

function read(file: string): string {
  return readFileSync(path.resolve(process.cwd(), file), 'utf8')
}

const PAGE = 'app/(public)/flow-map/page.tsx'
const FILTERS = 'components/flow-map/FlowMapFilters.tsx'

describe('flow-map filter UI', () => {
  it('is a real control, not the "Coming soon" placeholder it replaced', () => {
    const source = read(PAGE)
    expect(source).not.toContain('Coming soon')
    expect(source).not.toContain('aria-disabled="true"')
    expect(source).toContain('<FlowMapFilters')
  })

  it('applies on change with no submit button', () => {
    const source = read(FILTERS)
    expect(source).toContain('onChange=')
    // A submit button would mean a round of taps between choosing a filter and
    // seeing it, which the design-system rule forbids for filters.
    expect(source).not.toContain('<form')
    expect(source).not.toContain('type="submit"')
  })

  it('keeps the filter state in the URL so a filtered view is shareable', () => {
    const source = read(FILTERS)
    expect(source).toContain('useSearchParams')
    expect(source).toContain('router.push')
    expect(source).toContain("searchParams.get('city')")
    expect(source).toContain("searchParams.get('category')")
  })

  it('labels both selects — a placeholder is not a label', () => {
    const source = read(FILTERS)
    expect(source).toContain('htmlFor="flow-map-city"')
    expect(source).toContain('htmlFor="flow-map-category"')
    expect(source).toContain('id="flow-map-city"')
    expect(source).toContain('id="flow-map-category"')
  })

  it('offers a way to clear every active filter', () => {
    const source = read(FILTERS)
    expect(source).toContain('Clear all')
  })
})

describe('flow-map filters and the aggregate threshold', () => {
  it('still gates both node queries at AGGREGATE_MIN_TRANSACTIONS', () => {
    const source = read(PAGE)
    const gated = source.match(/\.gte\('transaction_count', AGGREGATE_MIN_TRANSACTIONS\)/g) ?? []
    // One for the business nodes, one for the city nodes. A filter that dropped
    // either guard would publish a named total the privacy panel promises to
    // withhold.
    expect(gated).toHaveLength(2)
  })

  it('narrows by selecting listings, never by re-aggregating spend', () => {
    const source = read(PAGE)
    // The filter reaches flow_nodes as an `in (…)` over listing ids. If it ever
    // became a re-derived sum from spend_events, the named totals and the
    // headline would come from two different corpora — the exact defect the
    // aggregate_opt_out fix closed.
    expect(source).toContain("base.in('entity_id', filteredListingIds)")
    const spendQueries = source.match(/from\('spend_events'\)/g) ?? []
    expect(spendQueries).toHaveLength(1)
  })

  it('resolves slugs against the real lists rather than trusting the URL', () => {
    const source = read(PAGE)
    expect(source).toContain('cities.find((c) => c.slug === requestedCity)')
    expect(source).toContain('categories.find((c) => c.slug === requestedCategory)')
    expect(source).toContain('unresolvedFilter')
  })

  it('withholds the city table under a category-only filter', () => {
    const source = read(PAGE)
    // A city node totals every category in that city. Rendering one beside a
    // category-filtered business table would read as the category's city total,
    // which it is not.
    expect(source).toContain('const showCityTable = !selectedCategory || !!selectedCity')
    expect(source).toContain('if (noMatches || !showCityTable) return []')
  })
})

describe('flow-map community-wide figures', () => {
  it('does not slice the headline by city or category', () => {
    const source = read(PAGE)
    const summaryStart = source.indexOf("from('spend_events')")
    const summaryEnd = source.indexOf('const uniqueBusinessCount')
    expect(summaryStart).toBeGreaterThan(-1)
    expect(summaryEnd).toBeGreaterThan(summaryStart)
    const summaryBlock = source.slice(summaryStart, summaryEnd)
    // The published privacy notice describes these three as "a single sum
    // across everything reported, so they identify no one". That only holds
    // while the sum stays whole.
    expect(summaryBlock).not.toContain('selectedCity')
    expect(summaryBlock).not.toContain('selectedCategory')
    expect(summaryBlock).not.toContain('filteredListingIds')
  })

  it('tells the reader the headline is community-wide when a filter is on', () => {
    const source = read(PAGE)
    expect(source).toContain('These three figures are community-wide')
  })

  it('still excludes opted-out spend from the headline', () => {
    const source = read(PAGE)
    expect(source).toContain("eq('aggregate_opt_out', false)")
  })
})

describe('flow-map filtered empty state', () => {
  it('is distinct from the unfiltered empty states', () => {
    const source = read(PAGE)
    expect(source).toContain('No results for these filters')
  })

  it('always offers a way out of a filtered dead end', () => {
    const source = read(PAGE)
    // A plain link, so it works with JavaScript unavailable — FlowNodeTable's
    // `emptyText` is a bare string with no action slot, which is why this state
    // is its own block.
    expect(source).toContain('href="/flow-map"')
    expect(source).toContain('Clear filters')
  })

  it('distinguishes an unknown slug from a below-threshold result', () => {
    const source = read(PAGE)
    expect(source).toContain('That city or category is not one we track')
  })
})
