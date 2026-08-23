import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './helpers/auth'
import {
  OWNER_EMAIL,
  OWNER_PASSWORD,
  FIXTURE_OWNED_ID,
  FIXTURE_OWNED_SLUG,
  FIXTURE_OWNED_NAME,
  FIXTURE_CLAIMABLE_ID,
  FIXTURE_CLAIMABLE_SLUG,
  FIXTURE_CLAIMABLE_NAME,
  FIXTURE_PENDING_CLAIM_ID,
  FIXTURE_PENDING_CLAIM_SLUG,
  FIXTURE_PENDING_CLAIM_NAME,
  FIXTURE_LISTING_IDS,
} from './helpers/fixtures'

/**
 * Provisions (idempotently) the accounts and rows the e2e suite runs against.
 * Uses the Supabase service-role client so it bypasses RLS and can write to
 * user_roles, listings, and claims.
 *
 * Idempotent here means *reconciled*, not merely *present*. Every run rewrites
 * the mutable state back to the expected starting point, because the database
 * outlives a single run on staging and in CI, and because several specs
 * deliberately mutate the fixture — approving the pending claim, editing the
 * owned listing. A setup that only inserted-if-missing would leave the second
 * run of the suite testing whatever the first run left behind.
 *
 * The user_roles UNIQUE (user_id, role, listing_id) constraint treats NULL
 * listing_id values as distinct, so we check for an existing admin row before
 * inserting rather than relying on upsert/onConflict.
 */

type ServiceClient = SupabaseClient

/**
 * The production project, by ref. Not a secret — it is served to every browser
 * inside NEXT_PUBLIC_SUPABASE_URL, and it already appears throughout
 * docs/blacqlist/launch/.
 */
const PRODUCTION_PROJECT_REFS = ['ytlrnczevdnsfdzjbeqg']

/**
 * Refuse to plant fixtures in production.
 *
 * Playwright wires this setup onto *every* Playwright run, and the target
 * database is chosen entirely by whatever NEXT_PUBLIC_SUPABASE_URL happens to
 * hold in .env.local — there is no --env flag and nothing else to notice the
 * difference. Before this file provisioned listings the blast radius of a
 * mistargeted run was one test admin account, which is bad enough; it now also
 * creates published listings and deletes claims, and a published listing in
 * production is visible to the public.
 *
 * There is no legitimate reason to run the e2e suite against production, so
 * this is a hard stop rather than a confirmation prompt. Staging and local both
 * pass straight through.
 */
function assertNotProduction(supabaseUrl: string): void {
  const host = new URL(supabaseUrl).hostname
  const ref = (host.endsWith('.supabase.co') ? host.split('.')[0] : host) ?? host

  if (PRODUCTION_PROJECT_REFS.includes(ref)) {
    throw new Error(
      `global-setup: refusing to run against the production Supabase project ("${ref}"). ` +
        'The e2e suite creates test users, published listings, and claims. ' +
        'Point NEXT_PUBLIC_SUPABASE_URL at staging or local Supabase and re-run.'
    )
  }
}

/**
 * Find-or-create an auth user and reconcile its password on every run.
 *
 * The reconcile is not cosmetic. Until 2026-08-11 the existing-user branch did
 * nothing, which held only against a throwaway local database: on a long-lived
 * project the account survives from an earlier run with an earlier password, so
 * setup printed "ready" while every UI sign-in failed. That is exactly how the
 * first CI e2e run failed — the sign-in server action answered 200 with
 * {"error":"Incorrect email or password."} and loginAsAdmin() timed out waiting
 * for a redirect that was never coming.
 *
 * Both fixture addresses use the unroutable .test.local TLD, so this only ever
 * rewrites accounts this setup owns.
 */
async function ensureUser(
  admin: ServiceClient,
  existingUsers: Array<{ id: string; email?: string }>,
  email: string,
  password: string
): Promise<string> {
  const existingId = existingUsers.find((u) => u.email === email)?.id

  if (!existingId) {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (createError || !created.user) {
      throw new Error(`global-setup: createUser(${email}) failed — ${createError?.message}`)
    }
    return created.user.id
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(existingId, {
    password,
    email_confirm: true,
  })
  if (updateError) {
    throw new Error(`global-setup: updateUserById(${email}) failed — ${updateError.message}`)
  }
  return existingId
}

/**
 * The three fixture listings are city-less on purpose — see helpers/fixtures.ts.
 * They still need a category: listings.category_id is NOT NULL with an ON DELETE
 * RESTRICT foreign key, so there is no "unset" to fall back to. Any category
 * will do; nothing asserts which one, so take the first by slug for stability
 * across environments rather than hardcoding a slug that a future taxonomy
 * change could retire.
 */
async function resolveCategoryId(admin: ServiceClient): Promise<string> {
  const { data, error } = await admin
    .from('categories')
    .select('id')
    .order('slug')
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`global-setup: read categories failed — ${error.message}`)
  if (!data) {
    throw new Error(
      'global-setup: no categories exist — the fixture listings cannot be created. ' +
        'Apply the schema migrations and seed the taxonomy before running the e2e suite.'
    )
  }
  return data.id as string
}

interface FixtureListing {
  id: string
  slug: string
  name: string
  ownerUserId: string | null
  trustTier: 'unclaimed' | 'claimed'
  /**
   * Subscription tier. The owned fixture is 'starter' because analytics,
   * social links, FAQs and video are all Starter+ gated (lib/stripe/features.ts)
   * — on 'free' the owner dashboard's analytics route renders a paywall and
   * those editor sections never mount, so a free-tier fixture cannot exercise
   * the owner surfaces it exists to unlock. The unowned fixtures stay 'free'.
   */
  tier: 'free' | 'starter'
}

/**
 * Upsert on the pinned id, so a spec that changed a listing's status, tier, or
 * ownership is put back. The slug carries a UNIQUE index: if a row already
 * holds one of these slugs under a *different* id, this fails loudly on the
 * constraint rather than silently creating a second copy — which is the
 * outcome we want, since that state means something outside the fixture is
 * squatting on a reserved slug.
 */
async function ensureFixtureListing(
  admin: ServiceClient,
  categoryId: string,
  listing: FixtureListing
): Promise<void> {
  const { error: listingError } = await admin.from('listings').upsert(
    {
      id: listing.id,
      name: listing.name,
      slug: listing.slug,
      tagline: 'Fixture row for the automated end-to-end suite.',
      entity_type: 'business',
      category_id: categoryId,
      city_id: null,
      location_type: 'virtual',
      status: 'published',
      tier: listing.tier,
      trust_tier: listing.trustTier,
      ownership_label: 'black_owned',
      owner_user_id: listing.ownerUserId,
      is_featured: false,
      source: 'admin',
      published_at: new Date().toISOString(),
      deleted_at: null,
    },
    { onConflict: 'id' }
  )
  if (listingError) {
    throw new Error(`global-setup: upsert listing ${listing.slug} failed — ${listingError.message}`)
  }

  const { error: detailError } = await admin.from('listing_details_business').upsert(
    {
      listing_id: listing.id,
      description:
        'This listing exists only to give the automated end-to-end suite a stable ' +
        'business page to sign in against, claim, and edit. It is not a real business.',
      city_text: 'Online',
      state: 'GA',
      phone: '404-555-0100',
      website_url: 'https://example.com',
      cta_type: 'visit',
      cta_url: 'https://example.com',
    },
    { onConflict: 'listing_id' }
  )
  if (detailError) {
    throw new Error(
      `global-setup: upsert listing_details_business ${listing.slug} failed — ${detailError.message}`
    )
  }
}

async function globalSetup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      'global-setup: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set ' +
        '(loaded from .env.local). Is local Supabase running (`npx supabase start`)?'
    )
  }

  assertNotProduction(url)

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 1. Find or create both fixture auth users, from a single listUsers page.
  const { data: list, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (listError) throw new Error(`global-setup: listUsers failed — ${listError.message}`)

  const adminUserId = await ensureUser(admin, list.users, ADMIN_EMAIL, ADMIN_PASSWORD)
  const ownerUserId = await ensureUser(admin, list.users, OWNER_EMAIL, OWNER_PASSWORD)

  // 2. Ensure a platform-wide admin role row exists (listing_id IS NULL).
  const { data: existingRole, error: roleReadError } = await admin
    .from('user_roles')
    .select('id')
    .eq('user_id', adminUserId)
    .eq('role', 'admin')
    .is('listing_id', null)
    .maybeSingle()
  if (roleReadError) {
    throw new Error(`global-setup: read user_roles failed — ${roleReadError.message}`)
  }

  if (!existingRole) {
    const { error: insertError } = await admin
      .from('user_roles')
      .insert({ user_id: adminUserId, role: 'admin', listing_id: null })
    if (insertError) {
      throw new Error(`global-setup: insert admin role failed — ${insertError.message}`)
    }
  }

  // 3. The owner account must NOT be an admin. Several cases assert that an
  //    ordinary signed-in owner is turned away from /admin/*, and that assertion
  //    is only meaningful if the account is guaranteed not to hold the role —
  //    getAdminRole() matches on 'admin' or 'super_admin' (lib/admin/guard.ts).
  const { error: demoteError } = await admin
    .from('user_roles')
    .delete()
    .eq('user_id', ownerUserId)
    .in('role', ['admin', 'super_admin'])
  if (demoteError) {
    throw new Error(`global-setup: clear owner admin roles failed — ${demoteError.message}`)
  }

  // 4. The three fixture listings.
  const categoryId = await resolveCategoryId(admin)

  await ensureFixtureListing(admin, categoryId, {
    id: FIXTURE_OWNED_ID,
    slug: FIXTURE_OWNED_SLUG,
    name: FIXTURE_OWNED_NAME,
    ownerUserId,
    trustTier: 'claimed',
    tier: 'starter',
  })
  await ensureFixtureListing(admin, categoryId, {
    id: FIXTURE_CLAIMABLE_ID,
    slug: FIXTURE_CLAIMABLE_SLUG,
    name: FIXTURE_CLAIMABLE_NAME,
    ownerUserId: null,
    trustTier: 'unclaimed',
    tier: 'free',
  })
  await ensureFixtureListing(admin, categoryId, {
    id: FIXTURE_PENDING_CLAIM_ID,
    slug: FIXTURE_PENDING_CLAIM_SLUG,
    name: FIXTURE_PENDING_CLAIM_NAME,
    ownerUserId: null,
    trustTier: 'unclaimed',
    tier: 'free',
  })

  // 5. Claims. Cleared and re-planted every run, scoped strictly to the three
  //    fixture listing ids: the admin queue cases approve and reject this claim,
  //    and a claim left in a reviewed state would make the second run of the
  //    suite assert against an empty queue. The delete cannot reach a real
  //    claim — no production listing carries a fixture id.
  const { error: claimClearError } = await admin
    .from('claims')
    .delete()
    .in('listing_id', FIXTURE_LISTING_IDS as unknown as string[])
  if (claimClearError) {
    throw new Error(`global-setup: clear fixture claims failed — ${claimClearError.message}`)
  }

  const { error: claimInsertError } = await admin.from('claims').insert({
    listing_id: FIXTURE_PENDING_CLAIM_ID,
    claimant_user_id: ownerUserId,
    status: 'pending',
    verification_email: OWNER_EMAIL,
    role_at_business: 'owner',
    notes: 'Fixture claim planted by e2e/global-setup.ts.',
  })
  if (claimInsertError) {
    throw new Error(`global-setup: insert fixture claim failed — ${claimInsertError.message}`)
  }

  console.log(`global-setup: admin ready (${ADMIN_EMAIL})`)
  console.log(
    `global-setup: owner ready (${OWNER_EMAIL}) — ` +
      `owned=${FIXTURE_OWNED_SLUG}, claimable=${FIXTURE_CLAIMABLE_SLUG}, ` +
      `pending-claim=${FIXTURE_PENDING_CLAIM_SLUG}`
  )
}

export default globalSetup
