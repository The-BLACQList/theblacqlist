/**
 * Seed launch listings from JSON data files.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx tsx scripts/seed-launch-listings.ts [--yes]
 *
 * Idempotent: re-running does not create duplicates (ON CONFLICT DO NOTHING).
 * Logs "Inserted: N, Skipped: N, Errors: N" per city after completion.
 *
 * The cities seeded and their corpus files come from scripts/data/cities.ts —
 * add a city there, not here. Per-city launch thresholds live on the same
 * registry and are asserted by e2e/launch-gates.spec.ts (M9).
 *
 * The JSON files are the single source of corpus truth for every environment.
 * After they change, re-run this seed against LOCAL too — a stale local corpus
 * makes the M9 gate fail locally even though production passes.
 *
 * TARGET SAFETY: there is no dotenv and no --env flag here. The database is
 * chosen entirely by the exported SUPABASE_URL, so a mistyped host silently
 * seeds the wrong project. The script prints the resolved project ref before
 * writing and requires --yes for any non-local host.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { SEED_CITIES } from './data/cities'
import { VALID_OWNERSHIP_LABELS, type OwnershipLabel } from '../lib/constants/listing'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = process.env['SUPABASE_URL']
const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
  process.exit(1)
}

/**
 * Confirm the operator meant this database.
 *
 * Local hosts run unattended. Anything else — staging or production — is a
 * consequential write behind GATE-DATA, so it must be named out loud with
 * --yes. The project ref is printed either way; it is the only signal that
 * distinguishes staging from production at the command line.
 */
function assertTargetConfirmed(url: string): void {
  const host = new URL(url).hostname
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')
  const ref = host.endsWith('.supabase.co') ? host.split('.')[0] : host

  console.log(`Target: ${isLocal ? 'LOCAL' : 'REMOTE'} — project ref "${ref}" (${host})`)

  if (isLocal || process.argv.includes('--yes')) return

  console.error(
    `\nRefusing to seed remote project "${ref}" without confirmation.\n` +
      `Check the ref above against the project you intend to write to, then re-run with --yes.\n` +
      `Remote seeds are a GATE-DATA action — confirm the gate before passing it.`
  )
  process.exit(1)
}

/**
 * Restrict the run to named cities: `--only=los-angeles-ca,washington-dc`.
 *
 * Without it the seeder walks every entry in SEED_CITIES, which means a run
 * intended to launch three new cities also writes to the three already-live
 * ones. That is how staging picked up 11 unplanned rows in Atlanta and Houston
 * on 2026-08-14. The inserts are additive and slug-idempotent, so nothing was
 * damaged — but a production write should be bounded to the cities the change
 * is actually about, and the operator should be able to say in advance exactly
 * which rows it can touch.
 *
 * Unknown slugs are a hard error rather than a silent no-op: a typo'd --only
 * that quietly seeds nothing looks identical to a clean run in the output.
 */
function resolveCitiesToSeed(): typeof SEED_CITIES {
  const flag = process.argv.find((a) => a.startsWith('--only='))
  if (!flag) return SEED_CITIES

  const wanted = flag
    .slice('--only='.length)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const known = new Set(SEED_CITIES.map((c) => c.slug))
  const unknown = wanted.filter((s) => !known.has(s))
  if (wanted.length === 0 || unknown.length > 0) {
    console.error(
      `\n--only did not name a seedable city: ${unknown.join(', ') || '(empty)'}\n` +
        `Known slugs: ${[...known].join(', ')}`
    )
    process.exit(1)
  }

  const scoped = SEED_CITIES.filter((c) => wanted.includes(c.slug))
  console.log(`Scoped by --only to ${scoped.length} of ${SEED_CITIES.length} cities: ${wanted.join(', ')}`)
  return scoped
}

assertTargetConfirmed(SUPABASE_URL)

/**
 * Resolved before any network call: a bad --only must fail on the spot, not
 * after a round trip that makes the error look like a connectivity problem.
 */
const CITIES_TO_SEED = resolveCitiesToSeed()

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

interface ListingHours {
  day: number
  open_time: string | null
  close_time: string | null
  is_closed: boolean
}

interface ListingLink {
  // JSON key is "platform"; it maps onto the listing_links.link_type column.
  platform: string
  url: string
}

// Allowed values for listing_links.link_type (matches the column CHECK).
const ALLOWED_LINK_TYPES = new Set([
  'website',
  'instagram',
  'facebook',
  'tiktok',
  'youtube',
  'linkedin',
  'twitter',
  'booking',
  'menu',
  'order',
  'other',
])

// Social platforms already stored on listing_details_business.social_* — seeding
// these into listing_links too would duplicate them on the page, so we skip them.
// listing_links is reserved for flexible action links (booking, menu, order, …).
const SOCIAL_LINK_TYPES = new Set([
  'instagram',
  'facebook',
  'tiktok',
  'youtube',
  'linkedin',
  'twitter',
])

interface ListingInput {
  name: string
  slug: string
  tagline: string
  description: string
  listing_type: string
  city_slug: string
  category_slug: string
  // Mirrors the listings_location_type_check constraint added in migration
  // 20260524000001. The old union here read 'physical' | 'online' | 'hybrid',
  // which was wrong in both directions — 'online' is not a valid column value
  // and the Atlanta corpus has always used 'virtual'. Nothing caught it because
  // the JSON is cast rather than parsed (see loadCorpus below).
  location_type: 'physical' | 'virtual' | 'hybrid' | 'service_area' | 'national' | 'traveling'
  status: 'published' | 'draft'
  is_featured: boolean
  /**
   * Optional: the three original corpus files predate migration
   * 20260707000000, which added the column with a 'black_owned' default. Rows
   * without it fall back to that same default rather than being re-labelled
   * here — relabelling an existing listing is founder verification work, not a
   * seeder concern.
   */
  ownership_label?: OwnershipLabel
  address_line_1: string | null
  city_text: string
  state: string
  zip: string | null
  phone: string | null
  website_url: string | null
  social_instagram: string | null
  cta_type: string
  cta_url: string | null
  price_range: string | null
  founded_year: number | null
  hours: ListingHours[]
  links: ListingLink[]
}

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

async function seedCity(
  cityFile: string,
  cityLabel: string,
  lookups: { cities: Record<string, string>; categories: Record<string, string> }
): Promise<void> {
  const filePath = join(__dirname, 'data', cityFile)
  let listings: ListingInput[]

  try {
    const raw = readFileSync(filePath, 'utf8')
    // `as ListingInput[]` is a cast, not a check — TypeScript never sees the
    // file contents. Validate the two fields that carry a DB CHECK constraint,
    // so a bad value fails here with the row name rather than as an opaque
    // PostgREST error partway through a production seed.
    listings = JSON.parse(raw) as ListingInput[]
    for (const l of listings) {
      if (l.ownership_label && !VALID_OWNERSHIP_LABELS.includes(l.ownership_label)) {
        throw new Error(
          `"${l.name}" has ownership_label "${l.ownership_label}"; ` +
            `expected one of ${VALID_OWNERSHIP_LABELS.join(', ')}`
        )
      }
    }
  } catch (err) {
    console.error(`[${cityLabel}] Failed to read ${cityFile}:`, err)
    return
  }

  let inserted = 0
  let skipped = 0
  let errors = 0

  for (const listing of listings) {
    const cityId = lookups.cities[listing.city_slug]
    const categoryId = lookups.categories[listing.category_slug]

    if (!cityId) {
      console.warn(`[${cityLabel}] Unknown city_slug: ${listing.city_slug} (${listing.name})`)
      errors++
      continue
    }
    if (!categoryId) {
      console.warn(`[${cityLabel}] Unknown category_slug: ${listing.category_slug} (${listing.name})`)
      errors++
      continue
    }

    // Upsert listing row
    const { data: listingRow, error: listingErr } = await supabase
      .from('listings')
      .upsert(
        {
          name: listing.name,
          slug: listing.slug,
          tagline: listing.tagline,
          entity_type: listing.listing_type,
          category_id: categoryId,
          city_id: cityId,
          location_type: listing.location_type,
          status: listing.status,
          tier: 'free',
          trust_tier: 'unclaimed',
          is_featured: listing.is_featured,
          ownership_label: listing.ownership_label ?? 'black_owned',
          save_count: 0,
          review_count: 0,
          source: 'admin',
          published_at: listing.status === 'published' ? new Date().toISOString() : null,
        },
        { onConflict: 'slug', ignoreDuplicates: true }
      )
      .select('id')
      .maybeSingle()

    if (listingErr) {
      console.error(`[${cityLabel}] Error inserting ${listing.name}:`, listingErr.message)
      errors++
      continue
    }

    if (!listingRow) {
      // ON CONFLICT — already exists
      skipped++
      continue
    }

    const listingId = listingRow.id as string

    // Insert listing_details_business
    const { error: detailErr } = await supabase.from('listing_details_business').upsert(
      {
        listing_id: listingId,
        description: listing.description,
        address_line_1: listing.address_line_1,
        city_text: listing.city_text,
        state: listing.state,
        zip: listing.zip,
        phone: listing.phone,
        website_url: listing.website_url,
        social_instagram: listing.social_instagram,
        cta_type: listing.cta_type,
        cta_url: listing.cta_url,
        price_range: listing.price_range,
        founded_year: listing.founded_year,
      },
      { onConflict: 'listing_id', ignoreDuplicates: true }
    )

    if (detailErr) {
      console.warn(`[${cityLabel}] Details insert warning for ${listing.name}:`, detailErr.message)
    }

    // Insert hours if provided
    if (listing.hours && listing.hours.length > 0) {
      const hoursRows = listing.hours.map((h) => ({
        listing_id: listingId,
        day_of_week: h.day,
        open_time: h.open_time,
        close_time: h.close_time,
        is_closed: h.is_closed,
      }))
      const { error: hoursErr } = await supabase
        .from('listing_hours')
        .upsert(hoursRows, { onConflict: 'listing_id,day_of_week', ignoreDuplicates: true })
      if (hoursErr) {
        console.warn(`[${cityLabel}] Hours warning for ${listing.name}:`, hoursErr.message)
      }
    }

    // Insert flexible links if provided. This block only runs for newly-inserted
    // listings (existing ones `continue` above), so a plain insert is idempotent.
    // Social links are skipped — they already live in social_* columns.
    if (listing.links && listing.links.length > 0) {
      const linkRows = listing.links
        .filter((l) => /^https:\/\//i.test(l.url) && !SOCIAL_LINK_TYPES.has(l.platform))
        .map((l, i) => ({
          listing_id: listingId,
          link_type: ALLOWED_LINK_TYPES.has(l.platform) ? l.platform : 'other',
          url: l.url,
          display_order: i,
        }))
      if (linkRows.length > 0) {
        const { error: linksErr } = await supabase.from('listing_links').insert(linkRows)
        if (linksErr) {
          console.warn(`[${cityLabel}] Links warning for ${listing.name}:`, linksErr.message)
        }
      }
    }

    // Refresh search_vector for this listing
    await supabase.rpc('refresh_listing_search_vector', { p_listing_id: listingId }).maybeSingle()

    inserted++
  }

  console.log(
    `[${cityLabel}] Done — Inserted: ${inserted}, Skipped: ${skipped}, Errors: ${errors} (total in file: ${listings.length})`
  )
}

async function main() {
  console.log('Resolving city and category lookups...')
  const lookups = await resolveLookups()
  console.log(
    `Found ${Object.keys(lookups.cities).length} cities, ${Object.keys(lookups.categories).length} categories`
  )

  for (const city of CITIES_TO_SEED) {
    await seedCity(city.file, city.label, lookups)
  }

  console.log('\nSeed complete.')
  console.log(
    'NOTE: per-city launch thresholds live on SEED_CITIES in scripts/data/cities.ts',
    'and are asserted by e2e/launch-gates.spec.ts (M9). If a count is short, add',
    'entries to that city’s JSON file and re-run — against LOCAL as well as remote.'
  )
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
