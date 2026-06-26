/**
 * add-replacement-listings.ts
 *
 * Adds verified, currently-operating Black-owned businesses to the launch
 * dataset to offset the listings removed by the seed-review cleanup, keeping
 * each city at/above its M9 threshold (Houston was the binding case: 48 → 51).
 *
 * Every business below was confirmed Black-owned, operating, and located in the
 * target city from reputable sources (EatOkra, buyblack.org, The Infatuation,
 * local press, and the businesses' own sites) — see SOURCES.
 *
 * Usage:  npx tsx scripts/add-replacement-listings.ts
 * Idempotent: skips any slug already present.
 */

import { readFileSync, writeFileSync, appendFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..')
const DATA_DIR = join(ROOT, 'scripts/data')
const REPORT_PATH = join(ROOT, 'docs/blacqlist/data/seed-review-apply-report.md')

interface Listing {
  name: string
  slug: string
  tagline: string
  description: string
  listing_type: string
  city_slug: string
  category_slug: string
  location_type: string
  status: string
  is_featured: boolean
  address_line_1: string | null
  city_text: string | null
  state: string | null
  zip: string | null
  phone: string | null
  website_url: string | null
  social_instagram: string | null
  cta_type: string
  cta_url: string | null
  price_range: string | null
  founded_year: number | null
  hours: unknown[]
  links: { platform: string; url: string }[]
}

function ig(url: string | null): { platform: string; url: string }[] {
  return url ? [{ platform: 'instagram', url }] : []
}

function mk(p: Partial<Listing> & { name: string; slug: string; city_slug: string }): Listing {
  return {
    listing_type: 'business',
    category_slug: 'food-dining',
    location_type: 'physical',
    status: 'published',
    is_featured: false,
    tagline: '',
    description: '',
    address_line_1: null,
    city_text: null,
    state: null,
    zip: null,
    phone: null,
    website_url: null,
    social_instagram: null,
    cta_type: 'visit',
    cta_url: p.website_url ?? null,
    price_range: null,
    founded_year: null,
    hours: [],
    links: ig(p.social_instagram ?? null),
    ...p,
  }
}

const NEW: Record<string, { listings: Listing[]; sources: string[] }> = {
  'listings-houston.json': {
    listings: [
      mk({
        name: 'Trill Burgers',
        slug: 'trill-burgers',
        city_slug: 'houston-tx',
        tagline: "Bun B's smash-burger sensation, voted best burger in America.",
        description:
          "Co-founded by Houston rap legend Bun B, Trill Burgers grew from a viral food-truck smash burger into one of the city's most beloved Black-owned restaurants. Known for its signature OG smash burger, it has expanded to several Houston-area locations since 2021.",
        address_line_1: '3607 S Shepherd Dr',
        city_text: 'Houston',
        state: 'TX',
        zip: '77098',
        website_url: 'https://www.trill-burgers.com',
        social_instagram: 'https://instagram.com/trillburgers',
        price_range: '$$',
        founded_year: 2021,
      }),
      mk({
        name: "Frenchy's Chicken",
        slug: 'frenchys-chicken',
        city_slug: 'houston-tx',
        tagline: "Houston's legendary Creole fried chicken institution since 1969.",
        description:
          "Founded by New Orleans native Percy 'Frenchy' Creuzot, Frenchy's Chicken has served Houston its signature Creole-seasoned fried chicken, red beans, and dirty rice since 1969 — a Third Ward-born institution and one of the city's most enduring Black-owned restaurants.",
        address_line_1: '3602 Scott St',
        city_text: 'Houston',
        state: 'TX',
        zip: '77004',
        website_url: 'https://frenchyschicken.com',
        price_range: '$',
        founded_year: 1969,
      }),
      mk({
        name: "Esther's Cajun Café & Soul Food",
        slug: 'esthers-cajun-cafe',
        city_slug: 'houston-tx',
        tagline: 'Family-owned Cajun and soul food on North Shepherd since 2008.',
        description:
          "Esther's Cajun Café & Soul Food blends a father's soul food with a mother's Cajun roots into one of Houston's favorite Black-owned, family-operated kitchens. Established in 2008, it's known for gumbo, fried catfish, and hearty Southern comfort plates.",
        address_line_1: '5007 N Shepherd St',
        city_text: 'Houston',
        state: 'TX',
        zip: '77018',
        website_url: 'https://www.estherscajunsoul.com',
        social_instagram: 'https://instagram.com/estherscajuncafe',
        price_range: '$$',
        founded_year: 2008,
      }),
      mk({
        name: "Mikki's Soul Food Cafe",
        slug: 'mikkis-soul-food-cafe',
        city_slug: 'houston-tx',
        tagline: "Third Ward soul food carrying on a beloved Houston legacy.",
        description:
          "Run by the family of late founder Jeanette Williams, Mikki's Soul Food Cafe serves Southern classics from the historic Third Ward storefront on Blodgett — a Black-owned kitchen continuing a generations-deep Houston soul food tradition.",
        address_line_1: '2712 Blodgett St',
        city_text: 'Houston',
        state: 'TX',
        zip: '77004',
        website_url: 'https://mikkiscafe.com',
        price_range: '$$',
      }),
      mk({
        name: "Mo' Brunch and Brews",
        slug: 'mo-brunch-and-brews',
        city_slug: 'houston-tx',
        tagline: 'Museum District vegan-friendly brunch, coffee, and good vibes.',
        description:
          "Born from the Houston Sauce Co. food truck, Mo' Brunch and Brews is a Black-owned Museum District café known for craveable vegan and traditional brunch plates, specialty coffee, and a community-first atmosphere.",
        address_line_1: '1201 Southmore Blvd',
        city_text: 'Houston',
        state: 'TX',
        zip: '77004',
        website_url: 'https://mobrunchandbrews.com',
        price_range: '$$',
      }),
      mk({
        name: 'Doshi House',
        slug: 'doshi-house',
        city_slug: 'houston-tx',
        tagline: 'Historic Third Ward plant-based café built around community.',
        description:
          'Doshi House is a Black-owned café in Houston’s Historic Third Ward where community is built over coffee, tea, and plant-based victuals — a welcoming gathering place rooted in sustainable, compassionate hospitality.',
        address_line_1: '3419 Emancipation Ave',
        city_text: 'Houston',
        state: 'TX',
        zip: '77004',
        website_url: 'https://www.doshihouse.com',
        social_instagram: 'https://instagram.com/doshihouse',
        price_range: '$',
      }),
    ],
    sources: [
      'Trill Burgers — EatOkra (Black-owned), trill-burgers.com, Houston Business Journal/KHOU (operating, multiple locations)',
      "Frenchy's Chicken — frenchyschicken.com, Tripadvisor/Yelp (operating since 1969, Black-owned founder Percy Creuzot)",
      "Esther's Cajun Café & Soul Food — estherscajunsoul.com, blackownedelite.com, Yelp (updated 2026, Black-owned, est. 2008)",
      "Mikki's Soul Food Cafe — mikkiscafe.com, KHOU/FOX26/Hoodline (Black-owned family of Jeanette Williams, Third Ward, operating)",
      "Mo' Brunch and Brews — mobrunchandbrews.com, Yelp (updated June 2026), classpop/Houston Press (Black-owned, Museum District)",
      'Doshi House — doshihouse.com, visithoustontexas.com, Yelp (updated June 2026, Black-owned Third Ward café, open daily)',
    ],
  },
  'listings-atlanta.json': {
    listings: [
      mk({
        name: 'This Is It! BBQ & Seafood',
        slug: 'this-is-it-bbq-seafood',
        city_slug: 'atlanta-ga',
        tagline: "Atlanta's home of BBQ, seafood, and soul food since 1983.",
        description:
          'A metro-Atlanta institution since 1983, This Is It! BBQ & Seafood serves a signature mix of barbecue, fried seafood, and Southern sides across its Black-owned family of restaurants — a go-to for soul food done right.',
        address_line_1: '2841 Greenbriar Pkwy SW',
        city_text: 'Atlanta',
        state: 'GA',
        zip: '30331',
        website_url: 'https://thisisitbbq.com',
        price_range: '$$',
        founded_year: 1983,
      }),
      mk({
        name: 'Mr. Everything Cafe',
        slug: 'mr-everything-cafe',
        city_slug: 'atlanta-ga',
        tagline: 'A 30-year Black family-owned soul food staple on MLK Drive.',
        description:
          "Family-owned and operated for over three decades, Mr. Everything Cafe is one of Atlanta's longest-running Black-owned restaurants. Known for hearty sandwiches, rice bowls, and 'Healthy Choice' plates served just west of downtown on Martin Luther King Jr. Drive.",
        address_line_1: '882 Martin Luther King Jr Dr SW',
        city_text: 'Atlanta',
        state: 'GA',
        zip: '30314',
        website_url: 'https://mreverythingcafega.com',
        social_instagram: 'https://instagram.com/mreverythingcafe',
        price_range: '$$',
        founded_year: 1994,
      }),
      mk({
        name: 'The Breakfast Boys',
        slug: 'the-breakfast-boys',
        city_slug: 'atlanta-ga',
        tagline: "Voted Atlanta's #1 breakfast — all-day brunch in College Park.",
        description:
          "A Black-owned collaboration between restaurateur Lorenzo Wyche and the Smalls brothers of Virgil's Gullah Kitchen, The Breakfast Boys serves elevated all-day breakfast and brunch in Downtown College Park — voted the #1 breakfast restaurant in Atlanta.",
        address_line_1: '3387 Main St',
        city_text: 'College Park',
        state: 'GA',
        zip: '30337',
        website_url: 'https://eatatbreakfastboys.com',
        social_instagram: 'https://instagram.com/eatatbreakfastboys',
        price_range: '$$',
      }),
      mk({
        name: 'Juci Jerk',
        slug: 'juci-jerk',
        city_slug: 'atlanta-ga',
        tagline: 'Bold, authentic Caribbean jerk and BBQ in Stone Mountain.',
        description:
          "Juci Jerk brings bold, authentic Caribbean BBQ to metro Atlanta — jerk chicken, oxtail, and island classics from a Black-owned kitchen that has built a loyal following across its Stone Mountain and Marietta locations.",
        address_line_1: '5503 Memorial Dr',
        city_text: 'Stone Mountain',
        state: 'GA',
        zip: '30083',
        website_url: 'https://www.jucijerkofficial.com',
        price_range: '$',
      }),
      mk({
        name: "Slim & Husky's Pizza Beeria",
        slug: 'slim-and-huskys-atlanta',
        city_slug: 'atlanta-ga',
        tagline: 'Hip-hop-inspired artisan pizza on Metropolitan Parkway.',
        description:
          "Founded by Derrick Moore, Clinton Gray, and Emanuel Reed, Slim & Husky's is a Black-owned pizza beeria serving build-your-own artisan pies with a hip-hop and R&B-inspired vibe. Its Metropolitan Parkway shop anchors several Atlanta-area locations.",
        address_line_1: '581 Metropolitan Pkwy SW',
        city_text: 'Atlanta',
        state: 'GA',
        zip: '30310',
        website_url: 'https://slimandhuskys.com',
        price_range: '$$',
        founded_year: 2015,
      }),
    ],
    sources: [
      'This Is It! BBQ & Seafood — EatOkra + buyblack.org (Black-owned), thisisitbbq.com, Yelp (updated June 2026, operating since 1983)',
      'Mr. Everything Cafe — Blavity/FOX5/WSB-TV (Black family-owned, reopened), mreverythingcafega.com, buyblack.org',
      'The Breakfast Boys — Black Restaurant Weeks + The Infatuation (Black-owned: Lorenzo Wyche + Smalls brothers), eatatbreakfastboys.com, Yelp (updated June 2026)',
      'Juci Jerk — jucijerkofficial.com, Yelp (updated 2026, Black-owned Caribbean BBQ, Stone Mountain + Marietta)',
      "Slim & Husky's Pizza Beeria — Shoppe Black + Atlanta Voice (Black-owned, founded 2015), slimandhuskys.com, Yelp (Metropolitan Pkwy active)",
    ],
  },
}

const reportAdds: string[] = []
let totalAdded = 0

for (const [file, { listings, sources }] of Object.entries(NEW)) {
  const path = join(DATA_DIR, file)
  const data = JSON.parse(readFileSync(path, 'utf8')) as Listing[]
  const existing = new Set(data.map((l) => l.slug))
  const added: string[] = []
  for (const l of listings) {
    if (existing.has(l.slug)) continue
    data.push(l)
    added.push(l.name)
    totalAdded++
  }
  writeFileSync(path, JSON.stringify(data, null, 2))
  console.log(`${file}: +${added.length} (now ${data.length})`)
  if (added.length > 0) {
    reportAdds.push(`### ${file} (+${added.length})`, ...added.map((n) => `- ${n}`), '', '**Sources:**', ...sources.map((s) => `- ${s}`), '')
  }
}

if (reportAdds.length > 0) {
  appendFileSync(
    REPORT_PATH,
    '\n## Replacement listings added (verified Black-owned)\n\n' + reportAdds.join('\n') + '\n'
  )
}
console.log(`Total added: ${totalAdded}. Report updated: docs/blacqlist/data/seed-review-apply-report.md`)
