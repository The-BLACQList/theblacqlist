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

// -----------------------------------------------------------------------------
// A failed read is not a finding
// -----------------------------------------------------------------------------
// Three things can leave the filtered tables empty: an unknown slug, a filter
// that genuinely matched nothing, and a query that failed. The first two are
// facts about the data. The third is not — and because all three arrive at the
// same empty tables, the page will describe a broken read as a fact about the
// community's spend unless it is made to keep them apart.
//
// That is the exact failure no-fabrication.md rule 2 names: a number (or here, a
// claim) is either measured or Unknown, never inferred from an absence. The
// page's own privacy copy is what makes it acute — "nothing has cleared the
// privacy threshold yet" reads as a measured statement about real businesses.
//
// Non-vacuity: every assertion in this block fails on the pre-fix tree. The
// listings and options queries destructured `data` only and dropped `error`, so
// there was no `filterLoadFailed`, no retry action, and a failed filter rendered
// the below-threshold explanation verbatim.
// -----------------------------------------------------------------------------

describe('flow-map filter load failure', () => {
  it('captures the error from every query the filter depends on', () => {
    const source = read(PAGE)
    // Both reads feed the filter: the options lists resolve the slug, the
    // listings query resolves the matching set. Either failing produces the
    // same empty tables, so both have to be observed.
    expect(source).toContain('cityResult.error')
    expect(source).toContain('categoryResult.error')
    expect(source).toContain('error: matchingError')
    expect(source).toContain('listingsLoadFailed = !!matchingError')
  })

  it('does not call a slug unknown when the lists it was checked against failed to load', () => {
    const source = read(PAGE)
    // With `cities` empty because the query failed, every slug looks
    // unrecognized. Guarding `unresolvedFilter` on the load is what stops the
    // page saying "we do not track that city" about a city we do track.
    expect(source).toMatch(/unresolvedFilter\s*=\s*\n?\s*!optionsLoadFailed/)
  })

  it('gives a failed read its own message instead of the threshold explanation', () => {
    const source = read(PAGE)
    expect(source).toContain("Couldn't apply these filters")
    expect(source).toContain("we can't say what these filters would show")
    // The below-threshold copy is a claim about real businesses. It must sit
    // behind the failure branch, not beside it.
    const failureIndex = source.indexOf('filterLoadFailed\n')
    const thresholdIndex = source.indexOf('Nothing here has cleared the privacy threshold yet')
    expect(failureIndex).toBeGreaterThan(-1)
    expect(thresholdIndex).toBeGreaterThan(failureIndex)
  })

  it('still suppresses the tables, rather than showing unfiltered rows under an active filter', () => {
    const source = read(PAGE)
    // Falling back to the unfiltered top ten would be worse than an empty
    // state: the filter chips would still read as applied, so the reader would
    // take community-wide rows for a city or category slice.
    expect(source).toMatch(/const noMatches =\s*\n?\s*filterLoadFailed/)
  })

  it('offers a retry that keeps the filters, not only a way to abandon them', () => {
    const source = read(PAGE)
    expect(source).toContain('Try again')
    expect(source).toContain('href={currentHref}')
    // The retry has to rebuild the current view's URL from the params it was
    // given; linking to /flow-map would silently drop the filters and look like
    // the retry had succeeded.
    expect(source).toContain("currentParams.set('city', requestedCity)")
    expect(source).toContain("currentParams.set('category', requestedCategory)")
    // And the way out stays available alongside it.
    expect(source).toContain('Clear filters')
  })
})
