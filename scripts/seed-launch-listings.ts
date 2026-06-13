/**
 * Seed launch listings from JSON data files.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx tsx scripts/seed-launch-listings.ts
 *
 * Idempotent: re-running does not create duplicates (ON CONFLICT DO NOTHING).
 * Logs "Inserted: N, Skipped: N, Errors: N" per city after completion.
 *
 * NOTE: The JSON files contain the 80 businesses from the SQL seed (40 ATL / 20 HOU / 20 CHI).
 * Launch requires 250+ listings (150 ATL / 50 HOU / 50 CHI).
 * Add more entries to the JSON files before running in production to meet launch thresholds.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = process.env['SUPABASE_URL']
const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

interface ListingHours {
  day: number
  open_time: string | null
  close_time: string | null
  is_closed: boolean
}

interface ListingLink {
  platform: string
  url: string
}

interface ListingInput {
  name: string
  slug: string
  tagline: string
  description: string
  listing_type: string
  city_slug: string
  category_slug: string
  location_type: 'physical' | 'online' | 'hybrid'
  status: 'published' | 'draft'
  is_featured: boolean
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
    listings = JSON.parse(raw) as ListingInput[]
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

    // Insert links if provided
    if (listing.links && listing.links.length > 0) {
      const linkRows = listing.links.map((l) => ({
        listing_id: listingId,
        platform: l.platform,
        url: l.url,
      }))
      const { error: linksErr } = await supabase
        .from('listing_links')
        .upsert(linkRows, { onConflict: 'listing_id,platform', ignoreDuplicates: true })
      if (linksErr) {
        console.warn(`[${cityLabel}] Links warning for ${listing.name}:`, linksErr.message)
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

  await seedCity('listings-atlanta.json', 'Atlanta', lookups)
  await seedCity('listings-houston.json', 'Houston', lookups)
  await seedCity('listings-chicago.json', 'Chicago', lookups)

  console.log('\nSeed complete.')
  console.log(
    'NOTE: Launch requires 150+ Atlanta / 50+ Houston / 50+ Chicago listings.',
    'Add more entries to the JSON files and re-run if counts are below threshold.'
  )
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
