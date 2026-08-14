/**
 * The seed-corpus city registry — one list, consumed by everything.
 *
 * Four files used to enumerate the launch cities independently
 * (`build-seed-review.ts`, `apply-seed-review.ts`, `seed-launch-listings.ts`,
 * `e2e/launch-gates.spec.ts`), and they drifted: `apply-seed-review.ts` had six
 * cities in CITY_FILES but three in THRESHOLDS, which rendered
 * "⚠️ SHORT by NaN" into a founder-facing report. This module exists so adding
 * a city is one edit, not four.
 *
 * `slug` must match `cities.slug` in the database (see supabase/seed.sql).
 * `label` is the human name used as the City column in the review CSV — the
 * founder types it back, so changing it breaks in-flight review sheets.
 * `center` mirrors the lat/lng on the `cities` row and feeds CITY_VIEWS.
 *
 * No DB access, no side effects — pure data, safe to import anywhere.
 */

/**
 * Cities whose listings ship from a JSON corpus in this directory.
 *
 * `minPublished` is the M9 launch-gate threshold asserted by
 * `e2e/launch-gates.spec.ts`. It is only meaningful once the city is active;
 * see `activeInProd` below.
 */
export interface SeedCity {
  /** Matches `cities.slug`. */
  slug: string
  /** Human label; also the `City` column value in seed-review.csv. */
  label: string
  /**
   * The canonical value of `city_text` for a row inside the city proper.
   * Usually identical to `label` — but DC's rows read "Washington", so
   * comparing `city_text` against the label flagged all 33 as metro-area and
   * buried the real out-of-city rows in 33 false positives.
   */
  cityText: string
  /** Two-letter state code every row in this corpus must carry. */
  state: string
  /** Corpus filename inside scripts/data/. */
  file: string
  /** M9 minimum published listings for this city. */
  minPublished: number
  /** [lng, lat] — mirrors the `cities` row, feeds map CITY_VIEWS. */
  center: [number, number]
  /**
   * Whether `cities.is_active` is true in production today.
   *
   * The M9 gate only asserts on active cities: a threshold that is knowingly
   * red through a whole review window makes `pnpm test:gates` a command nobody
   * runs. Flip this in the same PR that flips `is_active`.
   */
  activeInProd: boolean
}

export const SEED_CITIES: SeedCity[] = [
  {
    slug: 'atlanta-ga',
    label: 'Atlanta',
    cityText: 'Atlanta',
    state: 'GA',
    file: 'listings-atlanta.json',
    minPublished: 150,
    center: [-84.387352, 33.748752],
    activeInProd: true,
  },
  {
    slug: 'houston-tx',
    label: 'Houston',
    cityText: 'Houston',
    state: 'TX',
    file: 'listings-houston.json',
    minPublished: 50,
    center: [-95.369803, 29.760427],
    activeInProd: true,
  },
  {
    slug: 'chicago-il',
    label: 'Chicago',
    cityText: 'Chicago',
    state: 'IL',
    file: 'listings-chicago.json',
    minPublished: 50,
    center: [-87.629799, 41.878113],
    activeInProd: true,
  },
  {
    slug: 'los-angeles-ca',
    label: 'Los Angeles',
    cityText: 'Los Angeles',
    state: 'CA',
    file: 'listings-los-angeles.json',
    minPublished: 40,
    center: [-118.243683, 34.052235],
    activeInProd: false,
  },
  {
    slug: 'washington-dc',
    label: 'Washington DC',
    cityText: 'Washington',
    state: 'DC',
    file: 'listings-washington-dc.json',
    minPublished: 40,
    center: [-77.036873, 38.907192],
    activeInProd: false,
  },
  {
    slug: 'new-orleans-la',
    label: 'New Orleans',
    cityText: 'New Orleans',
    state: 'LA',
    file: 'listings-new-orleans.json',
    minPublished: 40,
    center: [-90.071533, 29.951065],
    activeInProd: false,
  },
]

/** Lookup by the founder-facing label used in the review CSV. */
export function cityByLabel(label: string): SeedCity {
  const found = SEED_CITIES.find((c) => c.label === label)
  if (!found) {
    throw new Error(
      `Unknown city label "${label}". Known labels: ${SEED_CITIES.map((c) => c.label).join(', ')}. ` +
        `Add it to scripts/data/cities.ts rather than hardcoding it at the call site.`
    )
  }
  return found
}
