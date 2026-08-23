/**
 * Deterministic identities for the e2e data fixture.
 *
 * Shared by e2e/global-setup.ts (which provisions the rows) and by every spec
 * that navigates to them, so a slug or an id is never written down twice and
 * cannot drift between the setup and the assertion.
 *
 * The ids are pinned rather than generated. A spec that needs
 * /dashboard/pages/{id}/edit or /claim/{id} would otherwise have to open its
 * own service-role client just to translate a slug into a uuid — which means
 * shipping the service key into more files than necessary, for a lookup whose
 * answer we already control at insert time.
 *
 * All three listings are deliberately city-less (`city_id = null`,
 * `location_type = 'virtual'`), for two reasons:
 *   1. launch-gates.spec.ts M9 counts published listings per city. A fixture
 *      attached to a real city inflates that gate's input, and a launch gate
 *      whose numbers include test rows has stopped measuring the thing it
 *      exists to measure.
 *   2. buildEntityUrl() (lib/listings/url.ts) maps a null city onto the
 *      reserved `online` segment, so a fixture's public URL is derivable from
 *      its slug alone.
 */

/**
 * The owner account: authenticated, owns a listing, and is deliberately NOT an
 * admin — several negative cases assert that /admin/* turns this user away.
 */
export const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? 'e2e-owner@test.local'
export const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD ?? 'E2EOwner1234!'

/** Published, owned by the owner account. Drives the owner dashboard cases. */
export const FIXTURE_OWNED_ID = 'e2e00000-0000-4000-8000-000000000001'
export const FIXTURE_OWNED_SLUG = 'e2e-fixture-owned-business'
export const FIXTURE_OWNED_NAME = 'E2E Fixture Owned Business'

/** Published, unclaimed, no open claim — the claim form renders for it. */
export const FIXTURE_CLAIMABLE_ID = 'e2e00000-0000-4000-8000-000000000002'
export const FIXTURE_CLAIMABLE_SLUG = 'e2e-fixture-claimable-business'
export const FIXTURE_CLAIMABLE_NAME = 'E2E Fixture Claimable Business'

/**
 * Published, unclaimed, with one pending claim from the owner account. Serves
 * three surfaces at once: the "you already have a pending claim" branch of
 * /claim/[listingId], a deterministic row in /account/claims, and a
 * deterministic row in the /admin/claims queue.
 */
export const FIXTURE_PENDING_CLAIM_ID = 'e2e00000-0000-4000-8000-000000000003'
export const FIXTURE_PENDING_CLAIM_SLUG = 'e2e-fixture-pending-claim-business'
export const FIXTURE_PENDING_CLAIM_NAME = 'E2E Fixture Pending Claim Business'

/**
 * A syntactically valid uuid that is never inserted. Owner-scoped routes must
 * answer 404 for it — the same answer they give for a listing owned by someone
 * else, which is the point: a "not found" and a "not yours" must be
 * indistinguishable from outside.
 */
export const FIXTURE_ABSENT_ID = 'e2e00000-0000-4000-8000-0000000000ff'

/** Substring shared by all three names — the query the claim search uses. */
export const FIXTURE_NAME_QUERY = 'E2E Fixture'

export const FIXTURE_LISTING_IDS = [
  FIXTURE_OWNED_ID,
  FIXTURE_CLAIMABLE_ID,
  FIXTURE_PENDING_CLAIM_ID,
] as const

/** The public URL of a city-less fixture listing. Mirrors buildEntityUrl(). */
export function fixtureListingUrl(slug: string): string {
  return `/online/business/${slug}`
}
