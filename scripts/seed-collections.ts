/**
 * Seed editorial collection(s) — satisfies launch gate M4 and showcases the
 * full editorial Collection experience (subtitle, narrative body, per-business
 * blurbs, and editorial sections).
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx tsx scripts/seed-collections.ts
 *
 * Idempotent: upserts the collection on `slug`; items on (collection_id, listing_id)
 * with updates; sections are replaced for the collection on each run.
 * Requires migration 20260620000000_collections_editorial.sql to be applied.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env['SUPABASE_URL']
const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

interface CollectionItemSeed {
  slug: string
  headline?: string
  blurb: string
}

interface CollectionSectionSeed {
  heading: string
  body: string
}

interface CollectionSeed {
  title: string
  slug: string
  subtitle: string
  description: string
  body: string
  display_order: number
  items: CollectionItemSeed[]
  sections: CollectionSectionSeed[]
}

const COLLECTIONS: CollectionSeed[] = [
  {
    title: 'Atlanta Soul Food & Southern Icons',
    slug: 'atlanta-soul-food-southern-icons',
    subtitle:
      'Ten Black-owned restaurants — from civil-rights-era institutions to a new generation — that define how Atlanta eats.',
    description:
      'A starter guide to Black-owned restaurants serving the soul food and Southern cooking that define Atlanta.',
    body: `Atlanta's story is written in its kitchens. From civil-rights-era dining rooms to modern brunch counters, Black-owned restaurants here have fed movements, raised neighborhoods, and shaped what Southern food tastes like to the rest of the country.

This is a starter guide — ten places that capture the range, from decades-old institutions to a new generation reimagining the classics.

## What "soul food" means here
It's more than a menu. It's smothered chicken and collard greens, yes — but also the West End vegan spot, the Caribbean-inflected plate, and the brunch line out the door. The throughline is care, history, and community.`,
    display_order: 0,
    items: [
      {
        slug: 'paschals-atl',
        headline: 'Icon',
        blurb:
          'A civil-rights-era institution where movement leaders strategized over fried chicken. Still family-rooted, still essential.',
      },
      {
        slug: 'gochas-breakfast-bar-atl',
        blurb:
          'Chef Gocha Hawkins turned a beauty empire into a beloved Cascade brunch spot — shrimp and grits, chicken and waffles, done right.',
      },
      {
        slug: 'bomb-biscuit-co-atl',
        headline: 'Michelin pick',
        blurb:
          "Erika Council's from-scratch biscuits earned a Michelin Bib Gourmand. Get there early — the line is part of the ritual.",
      },
      {
        slug: 'roc-south-cuisine-atl',
        blurb: 'Smothered, fried, and Southern to the core — a dependable neighborhood soul food anchor.',
      },
      {
        slug: 'k-and-k-soul-food-atl',
        blurb: 'Cafeteria-style plates of unfussy, down-home Southern cooking in Bankhead.',
      },
      {
        slug: 'the-real-milk-and-honey-atl',
        blurb: 'College Park brunch with a Southern accent and a famously loyal weekend following.',
      },
      {
        slug: 'bankhead-seafood-atl',
        blurb: 'A revived neighborhood seafood institution carrying a beloved local legacy forward.',
      },
      {
        slug: 'soul-vegetarian-atl',
        headline: 'Pioneer',
        blurb:
          "The West End spot that helped pioneer Atlanta's Black vegan movement decades before plant-based was a trend.",
      },
      {
        slug: 'the-corner-grille-atl',
        blurb: 'Creole and American comfort food, generously plated, in College Park.',
      },
      {
        slug: 'omni-coffee-and-eggs-atl',
        blurb: 'Inventive breakfast — oxtail biscuits and gravy — from a downtown cafe with NFL roots.',
      },
    ],
    sections: [
      {
        heading: 'How we chose these',
        body: `We started with the institutions — the rooms that shaped the city — then added the newcomers earning their own place in the conversation. Every spot here is Black-owned and currently serving Atlanta.

This list will grow. If we missed your favorite, that's the point of a starter guide.`,
      },
      {
        heading: 'Where to go next',
        body: `Hungry for more? Explore the full directory of Black-owned restaurants across Atlanta, Houston, and Chicago — or browse other collections curated by The BLACQList team.`,
      },
    ],
  },
]

async function seedCollection(c: CollectionSeed): Promise<void> {
  // Upsert the collection (active; with editorial fields)
  const { data: collRow, error: collErr } = await supabase
    .from('collections')
    .upsert(
      {
        title: c.title,
        slug: c.slug,
        subtitle: c.subtitle,
        description: c.description,
        body: c.body,
        is_active: true,
        display_order: c.display_order,
      },
      { onConflict: 'slug' }
    )
    .select('id')
    .single()

  if (collErr || !collRow) {
    console.error(`[${c.slug}] Failed to upsert collection:`, collErr?.message)
    return
  }
  const collectionId = collRow.id as string
  console.log(`[${c.slug}] collection id ${collectionId} (is_active=true)`)

  // Resolve listing slugs -> ids (published only)
  const slugs = c.items.map((i) => i.slug)
  const { data: listings, error: listErr } = await supabase
    .from('listings')
    .select('id, slug')
    .in('slug', slugs)
    .eq('status', 'published')

  if (listErr) {
    console.error(`[${c.slug}] Failed to resolve listings:`, listErr.message)
    return
  }
  const idBySlug = new Map((listings ?? []).map((l) => [l.slug, l.id]))
  const missing = slugs.filter((s) => !idBySlug.has(s))
  if (missing.length) console.warn(`[${c.slug}] skipped (not found/published): ${missing.join(', ')}`)

  // Upsert items with blurb/headline/order (update on re-run)
  let added = 0
  for (let i = 0; i < c.items.length; i++) {
    const item = c.items[i]
    if (!item) continue
    const listingId = idBySlug.get(item.slug)
    if (!listingId) continue
    const { error: itemErr } = await supabase.from('collection_items').upsert(
      {
        collection_id: collectionId,
        listing_id: listingId,
        display_order: i,
        headline: item.headline ?? null,
        blurb: item.blurb,
      },
      { onConflict: 'collection_id,listing_id' }
    )
    if (itemErr) console.warn(`[${c.slug}] item warning for ${item.slug}:`, itemErr.message)
    else added++
  }
  console.log(`[${c.slug}] ${added} listings attached (with blurbs).`)

  // Replace sections (idempotent)
  await supabase.from('collection_sections').delete().eq('collection_id', collectionId)
  if (c.sections.length) {
    const { error: secErr } = await supabase.from('collection_sections').insert(
      c.sections.map((s, i) => ({
        collection_id: collectionId,
        heading: s.heading,
        body: s.body,
        display_order: i,
      }))
    )
    if (secErr) console.warn(`[${c.slug}] sections warning:`, secErr.message)
    else console.log(`[${c.slug}] ${c.sections.length} sections written.`)
  }
}

async function main(): Promise<void> {
  for (const c of COLLECTIONS) {
    await seedCollection(c)
  }
  const { count } = await supabase
    .from('collections')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)
  console.log(`\nActive collections now: ${count ?? 0}`)
  console.log('Collection seed complete.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
