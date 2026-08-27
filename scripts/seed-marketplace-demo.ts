/**
 * Seed three obviously-fake demo storefronts so the marketplace can be walked.
 *
 * WHY THIS EXISTS
 * The catalog half of the marketplace ships in code — /vendors, /marketplace,
 * product and service detail pages, owner CRUD — but no seed anywhere in the
 * repo creates a marketplace_products row, a marketplace_services row, or an
 * entity_type='vendor' listing. So every one of those pages renders its empty
 * state and there is no way to tell a working page from a broken one. This
 * script produces the fixture that makes 4.4b's browser checks performable.
 *
 * The data is deliberately, visibly fake: every name starts with "Demo — ",
 * every slug starts with "demo-", every image is a placehold.co placeholder,
 * and every CTA points at https://example.com/demo. Nothing here should ever
 * be mistaken for a real business.
 *
 * TARGET SAFETY: there is no dotenv and no --env flag here. The database is
 * chosen entirely by the exported SUPABASE_URL, so a mistyped host silently
 * seeds the wrong project. assertTargetConfirmed() prints the resolved project
 * ref and refuses any remote host without --yes. On top of that, this script
 * hard-refuses the production ref even with --yes — demo data must never be one
 * typo away from the live site.
 *
 * SERVICE ROLE: writes go through the service key, matching what the app itself
 * does (lib/actions/marketplace/createProduct.ts uses createServiceClient for
 * the insert and proves ownership in code). --purge *requires* the service role:
 * neither marketplace table has a DELETE policy, so RLS default-deny means
 * nothing else on the platform can remove these rows.
 *
 * Usage:
 *   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=… \
 *     npx tsx scripts/seed-marketplace-demo.ts --owner-email=you@example.com
 *
 *   SUPABASE_URL=https://<staging-ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=… \
 *     npx tsx scripts/seed-marketplace-demo.ts --owner-email=you@example.com --yes
 *
 *   …same, plus --purge   → removes the three demo listings and, by cascade,
 *                           every marketplace row hanging off them.
 *
 * The owner email is a FLAG, not a constant: data-privacy.md rule 2 keeps PII
 * out of committed artifacts, and a hardcoded personal address in a repo script
 * is exactly that.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env['SUPABASE_URL']
const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
  process.exit(1)
}

/**
 * The production project ref. Named here so the refusal below can be absolute
 * rather than depending on an operator reading the printed ref carefully.
 */
const PRODUCTION_REF = 'ytlrnczevdnsfdzjbeqg'

/**
 * Confirm the operator meant this database.
 *
 * Local hosts run unattended. Anything else — staging or production — is a
 * consequential write behind GATE-DATA, so it must be named out loud with
 * --yes. The project ref is printed either way; it is the only signal that
 * distinguishes staging from production at the command line.
 *
 * Departure from scripts/seed-launch-listings.ts: production is refused
 * outright and --yes does not override it. That script seeds real editorial
 * listings, which production legitimately wants. This one seeds fake shops,
 * which production never does.
 */
function assertTargetConfirmed(url: string): void {
  const host = new URL(url).hostname
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')
  const ref = host.endsWith('.supabase.co') ? host.split('.')[0] : host

  console.log(`Target: ${isLocal ? 'LOCAL' : 'REMOTE'} — project ref "${ref}" (${host})`)

  if (ref === PRODUCTION_REF) {
    console.error(
      `\nRefusing to seed the PRODUCTION project "${ref}".\n` +
        `This script writes obviously-fake demo storefronts. There is no --yes for production.\n` +
        `If you meant staging, re-export SUPABASE_URL with the staging ref and run again.`
    )
    process.exit(1)
  }

  if (isLocal || process.argv.includes('--yes')) return

  console.error(
    `\nRefusing to seed remote project "${ref}" without confirmation.\n` +
      `Check the ref above against the project you intend to write to, then re-run with --yes.\n` +
      `Remote seeds are a GATE-DATA action — confirm the gate before passing it.`
  )
  process.exit(1)
}

// ── Flags ────────────────────────────────────────────────────────────────────
// Hand-parsed off process.argv, matching scripts/seed-launch-listings.ts. No
// yargs: one dependency-free convention across every script in this folder.

const PURGE = process.argv.includes('--purge')

const ownerFlag = process.argv.find((a) => a.startsWith('--owner-email='))
const OWNER_EMAIL = ownerFlag?.slice('--owner-email='.length).trim() ?? ''

if (!OWNER_EMAIL) {
  console.error(
    'Error: --owner-email=<email> is required.\n' +
      'It resolves listings.owner_user_id and marketplace_*.created_by at run time,\n' +
      'so the demo storefronts belong to a real account you can sign in as.'
  )
  process.exit(1)
}

assertTargetConfirmed(SUPABASE_URL)

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// ── Demo data ────────────────────────────────────────────────────────────────

/**
 * Every demo image routes through here so swapping to real photography later is
 * a one-line change.
 *
 * The colours are the BLACQList brand tokens read from app/globals.css:
 * --color-brand-black #000000 on --color-amber-gold #c4a065.
 *
 * No next.config.ts change is needed: next.config whitelists only Supabase
 * Storage hosts, and resolveRemoteImage (lib/listings/coverImage.ts) returns
 * unoptimized:true for any unlisted host and emits a plain <img>. That is
 * deliberate, per its own docblock — off-platform images render with zero config.
 */
function demoImage(label: string): string {
  return `https://placehold.co/800x800/000000/c4a065/png?text=${encodeURIComponent(label)}`
}

/** Obviously-fake destination. Present so the CTA button renders at all. */
const DEMO_CTA_URL = 'https://example.com/demo'

interface DemoProduct {
  slug: string
  name: string
  description: string
  price_cents: number | null
  compare_at_price_cents?: number
  price_display_text?: string | null
  shipping_options: 'shipping' | 'pickup' | 'both' | 'digital' | 'none'
  status: 'draft' | 'active'
}

interface DemoService {
  slug: string
  name: string
  description: string
  starting_price_cents: number | null
  duration_text: string
  delivery_mode: 'virtual' | 'in_person' | 'travel' | 'hybrid'
}

interface DemoListing {
  slug: string
  name: string
  tagline: string
  entity_type: 'vendor' | 'creative' | 'service_provider'
  trust_tier: 'unclaimed' | 'claimed' | 'verified'
  category_slug: string
  city_slug: string
  products: DemoProduct[]
  services: DemoService[]
}

/**
 * Three listings, chosen to exercise all three branches of the /vendors index
 * query at app/(public)/vendors/page.tsx:81-84.
 *
 * Offering counts are deliberately distinct — 4 / 3 / 2 — so the sort at
 * page.tsx:108 (offerings desc, then name) is itself checkable in the browser.
 * Peach State's fifth product is a draft, which must NOT be counted: that is the
 * check that proves the status='active' filter is live.
 */
const DEMO_LISTINGS: DemoListing[] = [
  {
    slug: 'demo-peach-state-provisions',
    name: 'Demo — Peach State Provisions',
    tagline: 'Placeholder storefront for walking the marketplace. Not a real business.',
    // The vendor-typed branch of the index query, and the only listing that
    // renders the Verified pill (page.tsx:166).
    entity_type: 'vendor',
    trust_tier: 'verified',
    category_slug: 'retail-gifts',
    city_slug: 'atlanta-ga',
    products: [
      {
        slug: 'sweet-tea-candle',
        name: 'Demo — Sweet Tea Candle',
        description: 'Placeholder product. Nothing here is for sale.',
        price_cents: 2400,
        shipping_options: 'shipping',
        status: 'active',
      },
      {
        slug: 'peach-preserves-trio',
        name: 'Demo — Peach Preserves Trio',
        description: 'Placeholder product with a compare-at price, so the strike-through renders.',
        price_cents: 3200,
        compare_at_price_cents: 3800,
        shipping_options: 'shipping',
        status: 'active',
      },
      {
        slug: 'market-tote',
        name: 'Demo — Market Tote',
        description: 'Placeholder product on the pickup-only shipping label.',
        price_cents: 4500,
        shipping_options: 'pickup',
        status: 'active',
      },
      {
        // The null-price row. price_cents AND price_display_text are both null so
        // ProductCard.tsx:35-37 falls all the way through to "Contact for pricing".
        slug: 'gift-box-builder',
        name: 'Demo — Build Your Own Gift Box',
        description: 'Placeholder product with no price, to show the pricing fallback.',
        price_cents: null,
        price_display_text: null,
        shipping_options: 'both',
        status: 'active',
      },
      {
        // Draft on purpose. If this one shows up in a count or on a public page,
        // the status='active' filter has regressed.
        slug: 'holiday-bundle',
        name: 'Demo — Holiday Bundle (draft)',
        description: 'Placeholder DRAFT product. It must not appear publicly or in any count.',
        price_cents: 6000,
        shipping_options: 'shipping',
        status: 'draft',
      },
    ],
    services: [],
  },
  {
    slug: 'demo-crown-heights-collective',
    name: 'Demo — Crown Heights Collective',
    tagline: 'Placeholder storefront for walking the marketplace. Not a real business.',
    // NOT vendor-typed. This listing appears in the index only because it sells
    // something — the id.in.(…) fallback branch at page.tsx:83. It is the real
    // test of the index↔detail contract: if the two queries have diverged, this
    // is the card that appears in the grid and then 404s on click.
    entity_type: 'creative',
    trust_tier: 'claimed',
    category_slug: 'fashion-apparel',
    city_slug: 'new-york-ny',
    products: [
      {
        slug: 'hand-dyed-scarf',
        name: 'Demo — Hand-Dyed Scarf',
        description: 'Placeholder product. Nothing here is for sale.',
        price_cents: 6800,
        shipping_options: 'shipping',
        status: 'active',
      },
      {
        slug: 'studio-print',
        name: 'Demo — Studio Print (download)',
        description: 'Placeholder product on the digital shipping label.',
        price_cents: 3500,
        shipping_options: 'digital',
        status: 'active',
      },
    ],
    services: [
      {
        slug: 'custom-tailoring',
        name: 'Demo — Custom Tailoring Session',
        description: 'Placeholder service. Nothing here is bookable.',
        starting_price_cents: 12000,
        duration_text: '1–2 hours',
        delivery_mode: 'travel',
      },
    ],
  },
  {
    slug: 'demo-southside-sound-studio',
    name: 'Demo — Southside Sound Studio',
    tagline: 'Placeholder storefront for walking the marketplace. Not a real business.',
    // Services-only seller — proves the services half of the seller union at
    // page.tsx:41-45 independently of the products half.
    entity_type: 'service_provider',
    trust_tier: 'unclaimed',
    category_slug: 'creative-media',
    city_slug: 'chicago-il',
    products: [],
    services: [
      {
        slug: 'studio-session',
        name: 'Demo — Half-Day Studio Session',
        description: 'Placeholder service. Nothing here is bookable.',
        starting_price_cents: 9000,
        duration_text: '4 hours',
        delivery_mode: 'in_person',
      },
      {
        slug: 'mixing-mastering',
        name: 'Demo — Mixing & Mastering',
        description: 'Placeholder service on the virtual delivery label.',
        starting_price_cents: 15000,
        duration_text: 'varies',
        delivery_mode: 'virtual',
      },
    ],
  },
]

const DEMO_SLUGS = DEMO_LISTINGS.map((l) => l.slug)

// ── Resolution helpers ───────────────────────────────────────────────────────

/**
 * Resolve the owner account.
 *
 * profiles has no email column (20260510000000_initial_blacqlist_mvp_schema.sql:197),
 * so the address has to be matched against auth.users. listUsers paginates —
 * default 50 per page — so a single call silently misses anyone past the first
 * page. The loop is bounded so a bad address cannot spin forever.
 *
 * Both ids are then needed and they are not interchangeable in intent even
 * though they are the same uuid: listings.owner_user_id targets auth.users(id),
 * marketplace_*.created_by targets profiles(id). A user with no profiles row
 * would satisfy the first FK and violate the second.
 */
async function resolveOwner(email: string): Promise<string> {
  const wanted = email.toLowerCase()
  const PER_PAGE = 200
  const MAX_PAGES = 25

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PER_PAGE })
    if (error) throw new Error(`Could not list users: ${error.message}`)

    const users = data?.users ?? []
    const match = users.find((u) => u.email?.toLowerCase() === wanted)
    if (match) {
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', match.id)
        .maybeSingle()

      if (profileErr) throw new Error(`Could not read profiles: ${profileErr.message}`)
      if (!profile) {
        throw new Error(
          `Account exists but has no profiles row. marketplace_*.created_by targets ` +
            `profiles(id), so the seed would violate that FK. Sign in once on this target ` +
            `to trigger create_profile_on_signup(), then re-run.`
        )
      }
      return match.id
    }

    if (users.length < PER_PAGE) break
  }

  throw new Error(
    `No account for that address on this target — sign up there first.\n` +
      `A fresh "supabase db reset" loads reference data and listings but no auth users ` +
      `(supabase/config.toml), so a local run needs a sign-up at localhost:3000 first.`
  )
}

/**
 * Resolve category and city ids by slug.
 *
 * listings.category_id is uuid NOT NULL … ON DELETE RESTRICT, so a category must
 * resolve or the run fails loudly. On a miss this prints the available slugs
 * rather than silently grabbing the first row — a demo listing filed under the
 * wrong category is worse than a failed run.
 */
async function resolveLookups(): Promise<{
  cities: Record<string, string>
  categories: Record<string, string>
}> {
  const [{ data: cities, error: cityErr }, { data: cats, error: catErr }] = await Promise.all([
    supabase.from('cities').select('id, slug'),
    supabase.from('categories').select('id, slug'),
  ])
  if (cityErr || catErr) {
    throw new Error(`Lookup failed: ${cityErr?.message ?? catErr?.message}`)
  }
  return {
    cities: Object.fromEntries((cities ?? []).map((r) => [r.slug, r.id])),
    categories: Object.fromEntries((cats ?? []).map((r) => [r.slug, r.id])),
  }
}

// ── Purge ────────────────────────────────────────────────────────────────────

/**
 * Delete the three demo listings by their hardcoded slugs. ON DELETE CASCADE on
 * marketplace_products.listing_id and marketplace_services.listing_id takes the
 * offerings with them.
 *
 * This path requires the service role. Neither marketplace table has a DELETE
 * policy (20260511000002_marketplace_foundation.sql:80-195 defines only _read,
 * _insert and _update), so under RLS default-deny nothing else on the platform
 * can remove these rows.
 */
async function purge(): Promise<void> {
  console.log(`\nPurging ${DEMO_SLUGS.length} demo listings (cascade removes their offerings)…`)

  const { data, error } = await supabase
    .from('listings')
    .delete()
    .in('slug', DEMO_SLUGS)
    .select('id, slug')

  if (error) {
    console.error(`Purge failed: ${error.message}`)
    process.exit(1)
  }

  for (const row of data ?? []) console.log(`  removed ${row.slug}`)

  console.log(
    `[marketplace-demo] Done — Inserted: 0, Skipped: 0, Errors: 0 (purged ${data?.length ?? 0} of ${DEMO_SLUGS.length})`
  )
}

// ── Seed ─────────────────────────────────────────────────────────────────────

async function seed(): Promise<void> {
  const ownerId = await resolveOwner(OWNER_EMAIL)
  console.log(`Owner resolved — user_id ${ownerId}`)

  const { cities, categories } = await resolveLookups()

  let inserted = 0
  let skipped = 0
  let errors = 0

  for (const listing of DEMO_LISTINGS) {
    const categoryId = categories[listing.category_slug]
    if (!categoryId) {
      console.error(
        `  ✗ ${listing.slug}: category "${listing.category_slug}" not found. ` +
          `Available: ${Object.keys(categories).sort().join(', ')}`
      )
      errors++
      continue
    }

    const cityId = cities[listing.city_slug]
    if (!cityId) {
      console.error(
        `  ✗ ${listing.slug}: city "${listing.city_slug}" not found. ` +
          `Available: ${Object.keys(cities).sort().join(', ')}`
      )
      errors++
      continue
    }

    // Existence is checked before the upsert so the summary can distinguish a
    // first run from a re-run honestly. The upsert itself refreshes in place.
    const { data: existing } = await supabase
      .from('listings')
      .select('id')
      .eq('slug', listing.slug)
      .maybeSingle()

    const { data: listingRow, error: listingErr } = await supabase
      .from('listings')
      .upsert(
        {
          name: listing.name,
          slug: listing.slug,
          tagline: listing.tagline,
          entity_type: listing.entity_type,
          category_id: categoryId,
          city_id: cityId,
          location_type: 'physical',
          status: 'published',
          // canAccess(tier, 'storefront') is Growth+ in lib/stripe/features.ts.
          // That matrix is declared but not yet enforced (test-only today), so
          // 'free' would render fine now and break this demo the moment it is
          // wired. Seed the tier the data would actually need.
          tier: 'growth',
          trust_tier: listing.trust_tier,
          is_featured: false,
          ownership_label: 'black_owned',
          save_count: 0,
          review_count: 0,
          source: 'admin',
          owner_user_id: ownerId,
          submitted_by: ownerId,
          updated_by: ownerId,
          published_at: new Date().toISOString(),
        },
        // Deliberately WITHOUT ignoreDuplicates, unlike seed-launch-listings.ts:
        // a re-run should refresh drifted demo rows, not skip them.
        { onConflict: 'slug' }
      )
      .select('id')
      .maybeSingle()

    if (listingErr || !listingRow) {
      console.warn(`  ✗ ${listing.slug}: ${listingErr?.message ?? 'no row returned'}`)
      errors++
      continue
    }

    if (existing) {
      skipped++
      console.log(`  ↻ ${listing.slug} (already existed — refreshed in place)`)
    } else {
      inserted++
      console.log(`  ✓ ${listing.slug}`)
    }

    const listingId = listingRow.id

    for (const product of listing.products) {
      const { error } = await supabase.from('marketplace_products').upsert(
        {
          listing_id: listingId,
          name: product.name,
          slug: product.slug,
          // Mirrors the app's own composition at
          // lib/actions/marketplace/createProduct.ts:126. This is the lookup key
          // for /marketplace/products/[slug], so it has to match or the card
          // links nowhere.
          global_slug: `${listing.slug}-${product.slug}`,
          description: product.description,
          price_cents: product.price_cents,
          compare_at_price_cents: product.compare_at_price_cents ?? null,
          price_display_text: product.price_display_text ?? null,
          cover_image_url: demoImage('DEMO PRODUCT'),
          category_id: categoryId,
          shipping_options: product.shipping_options,
          // Null here hides the entire CTA button (ProductCard.tsx:119) and the
          // card looks dead. Obviously fake, goes nowhere real.
          external_purchase_url: DEMO_CTA_URL,
          // The column defaults to 'draft', and 'draft' is invisible to every
          // public query — which is exactly what one row here is testing.
          status: product.status,
          created_by: ownerId,
        },
        { onConflict: 'global_slug' }
      )

      if (error) {
        console.warn(`    ✗ product ${product.slug}: ${error.message}`)
        errors++
      }
    }

    for (const service of listing.services) {
      const { error } = await supabase.from('marketplace_services').upsert(
        {
          listing_id: listingId,
          name: service.name,
          slug: service.slug,
          global_slug: `${listing.slug}-${service.slug}`,
          description: service.description,
          starting_price_cents: service.starting_price_cents,
          duration_text: service.duration_text,
          // An invalid delivery_mode prints the raw DB string to the user
          // (ServiceCard.tsx:120). Typed against VALID_DELIVERY_MODES above.
          delivery_mode: service.delivery_mode,
          cover_image_url: demoImage('DEMO SERVICE'),
          // Null here hides the CTA the same way external_purchase_url does on
          // products (ServiceCard.tsx:124).
          booking_url: DEMO_CTA_URL,
          status: 'active',
          created_by: ownerId,
        },
        { onConflict: 'global_slug' }
      )

      if (error) {
        console.warn(`    ✗ service ${service.slug}: ${error.message}`)
        errors++
      }
    }
  }

  console.log(
    `[marketplace-demo] Done — Inserted: ${inserted}, Skipped: ${skipped}, Errors: ${errors} (total in file: ${DEMO_LISTINGS.length})`
  )

  // Row counts after the run, so "identical on a re-run" is verifiable from the
  // output rather than by opening the dashboard.
  const [{ count: listingCount }, { count: productCount }, { count: serviceCount }] =
    await Promise.all([
      supabase
        .from('listings')
        .select('id', { count: 'exact', head: true })
        .in('slug', DEMO_SLUGS),
      supabase
        .from('marketplace_products')
        .select('id', { count: 'exact', head: true })
        .like('global_slug', 'demo-%'),
      supabase
        .from('marketplace_services')
        .select('id', { count: 'exact', head: true })
        .like('global_slug', 'demo-%'),
    ])

  console.log(
    `[marketplace-demo] Now present — listings: ${listingCount ?? '?'}, ` +
      `products: ${productCount ?? '?'} (4 active + 1 draft on Peach State, 2 on Crown Heights), ` +
      `services: ${serviceCount ?? '?'}`
  )
  console.log(
    `[marketplace-demo] Expect /vendors to show 3 cards sorted 4 → 3 → 2. ` +
      `Sign in first — proxy.ts bounces anonymous visits to /coming-soon.`
  )
}

async function main(): Promise<void> {
  if (PURGE) {
    await purge()
    return
  }
  await seed()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
