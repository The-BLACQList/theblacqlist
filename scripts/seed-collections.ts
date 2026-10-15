/**
 * Seed editorial collection(s) — satisfies launch gate M4 and showcases the
 * full editorial Collection experience (subtitle, narrative body, per-business
 * blurbs, and editorial sections).
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx tsx scripts/seed-collections.ts
 *   npx tsx scripts/seed-collections.ts --only=black-farmers-you-should-know-about,black-art-museums-and-stages
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
        blurb:
          'Smothered, fried, and Southern to the core — a dependable neighborhood soul food anchor.',
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
        blurb:
          'A revived neighborhood seafood institution carrying a beloved local legacy forward.',
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
        blurb:
          'Inventive breakfast — oxtail biscuits and gravy — from a downtown cafe with NFL roots.',
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
  // ── Added 2026-10-15 (founder: "we need 2 or 3 more collections") ──────────
  // Every blurb restates the listing's own published tagline, which came from
  // that listing's cited source. No new claims are added here. Plain copy, no
  // em dashes (site copy voice).
  {
    title: 'Black Farmers You Should Know About',
    slug: 'black-farmers-you-should-know-about',
    subtitle: 'Black-owned farms in six cities selling produce, meat, honey and flowers.',
    description:
      'Black farmers growing produce, meat, honey and flowers in and around Atlanta, Houston, Chicago, DC, New Orleans and Los Angeles.',
    body: `Buying straight from a farm keeps the money close to the people who grow the food. These farms sell through CSAs, farm stands, markets and online shops.

Two from each city to start. Check each farm's page for market days and how to order.`,
    display_order: 1,
    items: [
      {
        slug: 'patchwork-city-farms',
        blurb:
          'A Certified Naturally Grown urban farm in southwest Atlanta. Order ahead each week.',
      },
      {
        slug: 'bread-and-butter-farms',
        blurb: 'A five acre natural farm in Sparta, Georgia, with a CSA and a farm general store.',
      },
      {
        slug: 'sweetwater-farms-htx',
        blurb: 'A six acre regenerative farm inside the Loop, known for okra and greens.',
      },
      {
        slug: 'ivy-leaf-farms',
        blurb: 'An urban farm in Sunnyside growing fresh produce for Houston neighborhoods.',
      },
      {
        slug: 'sistas-in-the-village',
        blurb: 'A Black woman-led farm in Englewood selling and sharing produce at local markets.',
      },
      {
        slug: 'westside-bee-boyz',
        blurb: 'Beekeepers in North Lawndale selling honey, honey drinks and body care.',
      },
      {
        slug: 'eightfold-farms-dc',
        blurb: 'A mobile mushroom farm in Wards 7 and 8 selling fresh and dried mushrooms.',
      },
      {
        slug: 'ad-astra-farms',
        blurb: "A woman-owned farm in Prince George's County with a May to October CSA.",
      },
      {
        slug: 'barcelo-gardens',
        blurb: 'An Upper Ninth Ward community garden with a Saturday produce market.',
      },
      {
        slug: 'muse-3-farm',
        blurb:
          'A family livestock farm in Greensburg, Louisiana, with an on-farm store and online shop.',
      },
      {
        slug: 'bloom-ranch-of-acton',
        blurb: 'A ranch in Acton with U-pick, a farm store and produce boxes.',
      },
      {
        slug: 'logans-gardens',
        blurb: 'A father and son selling rare heirloom edible plants at Santa Monica markets.',
      },
    ],
    sections: [
      {
        heading: 'Before you go',
        body: `Many farms sell by pre-order or on set market days, not walk-in. Check the farm's page or site before you drive out.`,
      },
    ],
  },
  {
    title: 'Black Art, Museums and Stages',
    slug: 'black-art-museums-and-stages',
    subtitle: 'Galleries, museums and dance and music spaces across six cities.',
    description:
      'Black-owned galleries, museums, theaters and dance companies in Atlanta, Houston, Chicago, DC, New Orleans and Los Angeles.',
    body: `Places to see Black art and history in person, and the stages where it is still being made.

A starting list across six cities. More to come.`,
    display_order: 2,
    items: [
      {
        slug: 'apex-museum-atl',
        blurb: 'An African American history museum on Auburn Avenue in Sweet Auburn.',
      },
      {
        slug: 'hammonds-house-museum-atl',
        blurb: 'A West End museum for fine art of the African diaspora.',
      },
      {
        slug: 'zucot-gallery',
        blurb: "The Southeast's largest African American-owned fine art gallery.",
      },
      {
        slug: 'gite-gallery-hou',
        blurb: 'A Third Ward gallery specializing in sub-Saharan and West African art.',
      },
      {
        slug: 'gallery-guichard-chi',
        blurb: 'A Bronzeville fine art gallery for art of the African Diaspora.',
      },
      {
        slug: 'red-clay-dance-chicago',
        blurb: 'A contemporary dance company honoring African American movement.',
      },
      {
        slug: 'anacostia-arts-center',
        blurb: 'A Ward 8 arts hub with galleries, small businesses and a black box theater.',
      },
      { slug: 'step-afrika', blurb: 'The first professional company dedicated to stepping.' },
      {
        slug: 'backstreet-cultural-museum',
        blurb: 'The Mardi Gras Indian and social aid and pleasure club archive in Tremé.',
      },
      {
        slug: 'studio-be',
        blurb: "Brandan 'BMike' Odums' 35,000 square foot mural warehouse in the Bywater.",
      },
      {
        slug: 'the-world-stage',
        blurb: "Leimert Park's jazz and poetry workshop, founded by Billy Higgins.",
      },
      {
        slug: 'museum-of-african-american-art',
        blurb: 'Founded by Dr. Samella Lewis, inside Baldwin Hills Crenshaw Plaza.',
      },
    ],
    sections: [
      {
        heading: 'Before you go',
        body: `Hours change with shows and seasons. Check each page or call ahead, especially for dance companies and theaters, which perform on set dates.`,
      },
    ],
  },
  {
    title: 'New Orleans: Creole, Soul and Beyond',
    slug: 'new-orleans-creole-soul-and-beyond',
    subtitle:
      'Ten Black-owned places to eat in New Orleans, from Creole classics to Haitian and West African cooking.',
    description:
      'Black-owned restaurants in New Orleans serving Creole, soul food, Caribbean and African cooking.',
    body: `Black cooks helped shape how New Orleans eats. Here are ten places to start, from rooms that fed the civil rights movement to newer kitchens cooking the rest of the diaspora.`,
    display_order: 3,
    items: [
      {
        slug: 'dooky-chases-restaurant',
        headline: 'Icon',
        blurb: "Leah Chase's Creole dining room, where the civil rights movement ate.",
      },
      { slug: 'willie-maes-scotch-house', blurb: 'Fried chicken worth the line in Tremé.' },
      {
        slug: 'lil-dizzys-cafe',
        blurb: 'Tremé Creole soul food and a buffet locals plan their week around.',
      },
      {
        slug: 'vaucressons-creole-cafe-and-deli',
        blurb: 'The Creole hot sausage family that has fed Jazz Fest since it began.',
      },
      {
        slug: 'compere-lapin',
        blurb: "Chef Nina Compton's Caribbean-Creole dining room in the Warehouse District.",
      },
      { slug: 'fritai', blurb: 'Haitian cooking from chef Charly Pierre.' },
      {
        slug: 'bennachin-restaurant',
        blurb: 'West African cooking in the French Quarter since the early nineties.',
      },
      {
        slug: 'cafe-reconcile',
        blurb: 'A Creole lunch counter that is also a youth culinary training program.',
      },
      { slug: 'sweet-soulfood', blurb: 'An all-vegan Southern cafeteria on North Broad.' },
      {
        slug: 'lorettas-authentic-pralines',
        blurb: 'Pralines from the first Black woman to own a praline company in New Orleans.',
      },
    ],
    sections: [],
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
  if (missing.length)
    console.warn(`[${c.slug}] skipped (not found/published): ${missing.join(', ')}`)

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

// `--only slug-a,slug-b` seeds just those collections. Use it on a database
// that already has collections: a full run re-writes every one listed here,
// which would undo edits made since in /admin/collections.
function selectedCollections(): CollectionSeed[] {
  const arg = process.argv.find((a) => a.startsWith('--only='))
  if (!arg) return COLLECTIONS
  const wanted = new Set(arg.slice('--only='.length).split(',').filter(Boolean))
  const chosen = COLLECTIONS.filter((c) => wanted.has(c.slug))
  const unknown = [...wanted].filter((slug) => !COLLECTIONS.some((c) => c.slug === slug))
  if (unknown.length) {
    console.error(`Unknown collection slug(s): ${unknown.join(', ')}`)
    process.exit(1)
  }
  return chosen
}

async function main(): Promise<void> {
  for (const c of selectedCollections()) {
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
