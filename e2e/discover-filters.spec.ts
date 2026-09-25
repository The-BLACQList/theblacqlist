import { test, expect, type Page } from '@playwright/test'

/**
 * PR 3b — the discover filters actually filter, on all three pages that read
 * the same query string.
 *
 * The defect this guards: /discover/[citySlug] and /search declared four of the
 * facet keys and dropped the rest in silence. Nothing errored. The page answered
 * with the whole directory underneath the filter chips the visitor had just
 * clicked, which reads as "your filter matched everything" rather than "your
 * filter was thrown away".
 *
 * The forwarding assertions use a deliberately nonexistent attribute slug rather
 * than a real one, and the mechanism is worth stating because it is not the
 * obvious one. An unknown slug never reaches the RPC at all: resolveFacetParams
 * reports it in `unresolved`, and queryListings returns an empty page before any
 * search runs (lib/listings/query.ts, the hasUnresolved branch). So the slug has
 * only two possible outcomes, and they are exactly the two states of the bug:
 *   forwarded → the page sees an unresolvable filter → zero results, empty state
 *   dropped   → the param never reaches queryListings → the full directory
 * That makes the assertion deterministic against any database, seeded or live,
 * and independent of whether the faceted RPC is reachable.
 */

const NO_SUCH_ATTR = 'zzzz-no-such-attribute-zzzz'

/** DiscoveryGrid's copy for the deepRpcFailed state. Matched, not paraphrased. */
const UNAVAILABLE_HEADING = 'These filters are unavailable right now'

/**
 * What the grid can answer: a number, or the honest refusal.
 *
 * `filtersUnavailable` is not zero and must never be read as zero. It is what
 * DiscoveryGrid renders when the faceted RPC failed under a price, attribute,
 * open-now or radius filter: rather than show results that ignore the filter,
 * the page says it could not apply it. Folding that into 0 would let this whole
 * suite pass vacuously the moment the RPC is unreachable, which is the same
 * masking trap as a describe.skipIf over a dead database.
 */
type GridAnswer = number | 'filters-unavailable'

/**
 * The rendered result total, the empty state as 0, or the unavailable alert.
 *
 * DiscoveryGrid returns EmptyState before the count line when there are no
 * entities, so "0 results" is never a string on the page — the absence of the
 * count IS the zero. The alert replaces both. Waiting on whichever of the three
 * arrives keeps this from racing the Suspense boundary.
 */
async function resultTotal(page: Page): Promise<GridAnswer> {
  const count = page.getByText(/^(Showing [\d,]+ of [\d,]+ results|1 result)$/)
  const empty = page.getByText(/^(No results for|No businesses found|Nothing within)/)
  const unavailable = page.getByText(UNAVAILABLE_HEADING)

  await expect(count.or(empty).or(unavailable).first()).toBeVisible()

  if ((await unavailable.count()) > 0) return 'filters-unavailable'
  if ((await count.count()) === 0) return 0

  const text = (await count.first().textContent()) ?? ''
  if (text.trim() === '1 result') return 1
  const match = text.match(/of ([\d,]+) results/)
  expect(match, `could not read a total out of "${text}"`).toBeTruthy()
  return Number(match![1]!.replace(/,/g, ''))
}

async function totalAt(page: Page, url: string): Promise<GridAnswer> {
  await page.goto(url)
  return resultTotal(page)
}

/**
 * The number, or a loud failure.
 *
 * Used wherever "unavailable" is not a legitimate answer. A URL carrying no deep
 * facet has nothing that can be unavailable, so the alert there means the RPC is
 * down and every comparison built on that page would be meaningless — which is a
 * broken environment to report, not a test to pass.
 */
function requireNumber(answer: GridAnswer, where: string): number {
  if (answer === 'filters-unavailable') {
    throw new Error(
      `${where} rendered "${UNAVAILABLE_HEADING}" with no deep filter in the URL. ` +
        'search_listings_faceted is failing for this database — check that every ' +
        'migration in supabase/migrations is applied, then re-run.'
    )
  }
  return answer
}

/**
 * Stops a case that cannot be judged, naming why.
 *
 * Price, attributes, open-now and radius are the four facets the RPC alone can
 * answer. When it is unreachable the page is behaving correctly by refusing, and
 * there is no count to compare — so the case skips with the reason on the report
 * rather than passing on a comparison it never made.
 */
function skipIfUnavailable(answer: GridAnswer, where: string): asserts answer is number {
  test.skip(
    answer === 'filters-unavailable',
    `${where}: the grid answered "${UNAVAILABLE_HEADING}", so there is no count to compare. ` +
      'This is the deepRpcFailed guard working, not the filter failing.'
  )
}

async function firstCitySlug(page: Page): Promise<string> {
  await page.goto('/cities')
  const href = await page.locator('a[href^="/discover/"]').first().getAttribute('href')
  expect(href, '/cities must link at least one city').toBeTruthy()
  return href!.replace('/discover/', '')
}

test.describe('Discover filters — every facet reaches the query', () => {
  test('a facet that matches nothing empties /discover', async ({ page }) => {
    const all = requireNumber(await totalAt(page, '/discover'), '/discover')
    expect(all, 'the directory must have listings for this suite to mean anything').toBeGreaterThan(
      0
    )

    const filtered = await totalAt(page, `/discover?attrs=${NO_SUCH_ATTR}`)
    expect(filtered, 'the attribute filter must reach the query').toBe(0)
  })

  test('a facet that matches nothing empties the city page', async ({ page }) => {
    const slug = await firstCitySlug(page)
    const all = requireNumber(await totalAt(page, `/discover/${slug}`), `/discover/${slug}`)
    test.skip(all === 0, 'this city has no published listings to filter')

    const filtered = await totalAt(page, `/discover/${slug}?attrs=${NO_SUCH_ATTR}`)
    expect(filtered, 'the city page dropped the attribute filter').toBe(0)
  })

  test('a facet that matches nothing empties /search', async ({ page }) => {
    // The query comes from a listing that is actually there, so the baseline is
    // never zero for reasons unrelated to the filter.
    await page.goto('/discover')
    const name = await page.getByRole('heading', { level: 3 }).first().textContent()
    expect(name, '/discover must render at least one card').toBeTruthy()
    const q = encodeURIComponent(name!.trim())

    const all = requireNumber(await totalAt(page, `/search?q=${q}`), '/search')
    expect(all, 'searching for a listing by name must find it').toBeGreaterThan(0)

    const filtered = await totalAt(page, `/search?q=${q}&attrs=${NO_SUCH_ATTR}`)
    expect(filtered, '/search dropped the attribute filter').toBe(0)
  })

  // Each key gets its own case so a failure names the facet that broke rather
  // than "filters are broken". The values are the stored enum values, not the
  // labels: `virtual` is what lib/constants/listing.ts calls "Online only", and
  // `online_only` is not a location type at all.
  const KEYS: { key: string; value: string }[] = [
    { key: 'ownership', value: 'ally' },
    { key: 'trust_tier', value: 'verified' },
    { key: 'location_type', value: 'virtual' },
    { key: 'price', value: '$$' },
    { key: 'open_now', value: '1' },
  ]

  for (const { key, value } of KEYS) {
    test(`${key} narrows the result set on all three pages`, async ({ page }) => {
      const slug = await firstCitySlug(page)
      const bases = ['/discover', `/discover/${slug}`]

      for (const base of bases) {
        const all = requireNumber(await totalAt(page, base), base)
        const filtered = await totalAt(page, `${base}?${key}=${encodeURIComponent(value)}`)
        skipIfUnavailable(filtered, `${base} with ?${key}=${value}`)
        // A filter can legitimately match everything, so narrowing is the
        // assertion, not a strict decrease. What it cannot do is return MORE
        // than the unfiltered page — that only happens when the key is dropped
        // and the RPC answers something else entirely.
        expect(filtered, `${base} with ?${key}=${value}`).toBeLessThanOrEqual(all)
      }
    })
  }
})

test.describe('Discover filters — the sidebar drives the URL', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/discover')
    await expect(page.getByRole('complementary', { name: 'Discovery filters' })).toBeVisible()
  })

  test('Type writes ?type and Clear all takes it back out', async ({ page }) => {
    const baseline = requireNumber(await resultTotal(page), '/discover')

    await page
      .getByRole('complementary', { name: 'Discovery filters' })
      .getByRole('button', { name: 'Businesses', exact: true })
      .click()
    await page.waitForURL(/[?&]type=business/)
    expect(requireNumber(await resultTotal(page), '/discover?type=business')).toBeLessThanOrEqual(
      baseline
    )

    await page.getByRole('button', { name: 'Clear all' }).click()
    await page.waitForURL((url) => !url.searchParams.has('type'))
    expect(requireNumber(await resultTotal(page), '/discover after Clear all')).toBe(baseline)
  })

  test('Ownership writes ?ownership', async ({ page }) => {
    const sidebar = page.getByRole('complementary', { name: 'Discovery filters' })
    const baseline = requireNumber(await resultTotal(page), '/discover')

    await sidebar.getByRole('button', { name: 'Ally', exact: true }).click()
    await page.waitForURL(/[?&]ownership=ally/)
    expect(requireNumber(await resultTotal(page), '/discover?ownership=ally')).toBeLessThanOrEqual(
      baseline
    )
  })

  test('Where they operate writes ?location_type', async ({ page }) => {
    const sidebar = page.getByRole('complementary', { name: 'Discovery filters' })
    const baseline = requireNumber(await resultTotal(page), '/discover')

    // The control is labelled "Online only"; the value it writes is the stored
    // enum key `virtual`. Asserting on the label would have hidden a mismatch
    // between the two, so the URL assertion names the stored value.
    // The section starts collapsed, so open it first.
    await sidebar.locator('summary', { hasText: /^Where they operate$/ }).click()
    await sidebar.getByRole('button', { name: 'Online only', exact: true }).click()
    await page.waitForURL(/[?&]location_type=virtual/)
    expect(
      requireNumber(await resultTotal(page), '/discover?location_type=virtual')
    ).toBeLessThanOrEqual(baseline)
  })

  test('Open now writes ?open_now', async ({ page }) => {
    const baseline = requireNumber(await resultTotal(page), '/discover')

    // click(), not check(). The box is controlled by the URL
    // (checked={openNow} in FacetSidebar), so its DOM state does not flip until
    // the server round-trip lands. check() asserts that state the instant after
    // it clicks and fails the race, while the URL is the thing this case is
    // actually about.
    await page.getByRole('checkbox', { name: 'Open now' }).click()
    await page.waitForURL(/[?&]open_now=1/)
    // listing_hours is empty in production today, so this is very often 0. The
    // point of the case is that the checkbox reaches the query at all.
    const filtered = await resultTotal(page)
    skipIfUnavailable(filtered, '/discover?open_now=1')
    expect(filtered).toBeLessThanOrEqual(baseline)
  })

  test('Category writes ?category', async ({ page }) => {
    const sidebar = page.getByRole('complementary', { name: 'Discovery filters' })
    // Category starts collapsed (see FacetSidebar), so open it first.
    await sidebar.locator('summary', { hasText: /^Category$/ }).click()
    const tree = sidebar.getByRole('list', { name: 'Filter by category' })
    const first = tree.getByRole('button', { pressed: false }).first()
    test.skip((await first.count()) === 0, 'no categories are active in this database')

    const baseline = requireNumber(await resultTotal(page), '/discover')
    await first.click()
    await page.waitForURL(/[?&]category=/)
    expect(requireNumber(await resultTotal(page), '/discover?category=…')).toBeLessThanOrEqual(
      baseline
    )
  })

  test('a live price button writes ?price, and a dead one is a zero count', async ({ page }) => {
    const sidebar = page.getByRole('complementary', { name: 'Discovery filters' })
    // Price starts collapsed; its buttons are not rendered visible until opened.
    await sidebar.locator('summary', { hasText: /^Price$/ }).click()
    const group = sidebar.getByRole('group', { name: 'Filter by price range' })
    const enabled = group.getByRole('button').and(page.locator(':not([disabled])'))
    const n = await enabled.count()
    // Every price button is disabled when no published listing carries that
    // band. That is the counts working, not the filter failing, so there is
    // nothing to click and nothing to assert.
    test.skip(n === 0, 'no price band has any listings in this database')

    const baseline = requireNumber(await resultTotal(page), '/discover')
    await enabled.first().click()
    await page.waitForURL(/[?&]price=/)
    const filtered = await resultTotal(page)
    skipIfUnavailable(filtered, '/discover?price=…')
    expect(filtered).toBeLessThanOrEqual(baseline)
  })

  test('two filters at once both survive in the URL', async ({ page }) => {
    const sidebar = page.getByRole('complementary', { name: 'Discovery filters' })

    await sidebar.getByRole('button', { name: 'Businesses', exact: true }).click()
    await page.waitForURL(/[?&]type=business/)
    await sidebar.getByRole('button', { name: 'Ally', exact: true }).click()
    await page.waitForURL(/[?&]ownership=ally/)

    // The second click must not clobber the first: each facet setter rewrites
    // one key on top of the existing params.
    const url = new URL(page.url())
    expect(url.searchParams.get('type')).toBe('business')
    expect(url.searchParams.get('ownership')).toBe('ally')
  })
})

/**
 * PR3 — the Type shortcuts, relevance on a keyword, and sponsored on a keyword.
 *
 * The first two need 20260924000000_type_shortcuts_relevance applied to the
 * database this server reads. Without it the code falls back on purpose (exact
 * entity_type, featured first), so these fail loudly rather than skip: a
 * skipped check counts as red, and a red here before GATE-DATA is the honest
 * answer. The sponsored case is code-only and passes on either side.
 */
test.describe('Discover — type shortcuts and keyword relevance', () => {
  for (const type of ['restaurant', 'professional', 'creative', 'service_provider']) {
    test(`?type=${type} returns listings`, async ({ page }) => {
      const n = requireNumber(await totalAt(page, `/discover?type=${type}`), `?type=${type}`)
      expect(
        n,
        `the ${type} shortcut must map to categories, not only entity_type`
      ).toBeGreaterThan(0)
    })
  }

  test('"photographer" puts a photography listing first', async ({ page }) => {
    const n = requireNumber(await totalAt(page, '/discover?q=photographer'), '?q=photographer')
    expect(n, 'the directory must have at least one photography match').toBeGreaterThan(0)

    const first = page.locator('article').first()
    const name = (await first.getByRole('heading', { level: 3 }).textContent()) ?? ''
    const category = (await first.locator('h3 + p').textContent()) ?? ''
    expect(`${name} ${category}`, 'the first card must be about photography').toMatch(/photo/i)
  })

  test('a keyword search shows no sponsored card', async ({ page }) => {
    await page.goto('/discover')
    await resultTotal(page)
    const browsing = await page.locator('article').getByText('Sponsored', { exact: true }).count()
    test.skip(browsing === 0, 'no active sponsored placement in this database, so nothing to hide')

    await totalAt(page, '/discover?q=photographer')
    await expect(page.locator('article').getByText('Sponsored', { exact: true })).toHaveCount(0)
  })
})
