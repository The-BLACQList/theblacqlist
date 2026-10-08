/**
 * The "Help me choose" guide on step 1 of /add-business (ticket 125).
 *
 * [Decision — founder, 2026-10-05] Owners get stuck picking a listing type and
 * a category, so step 1 asks two plain questions and suggests both:
 *
 *   1. "What do customers come to you for?"  → a short list of categories
 *   2. "Where do they get it?"                → location type, and a nudge on
 *                                               the listing type
 *   3. "Which fits best?"                     → the owner picks one
 *
 * There's also a "Type what you do" search that matches category names plus
 * common words ("barber", "lawyer", "candles").
 *
 * Rules only, no AI, so it is instant and the same for everyone. Every field
 * the guide fills stays editable.
 *
 * This file is the ONE place the answers, the category lists and the search
 * words live. tests/sorting-guide.test.ts checks every slug here against
 * supabase/seed.sql, so a renamed category fails the build instead of quietly
 * dropping out of the guide. At runtime a slug that isn't in the live tree is
 * skipped, never shown.
 *
 * Pure and client-safe.
 */

import type { LocationType } from '@/lib/constants/listing'
import { TYPE_CATEGORY_SLUGS, typeExcludedSlugs } from '@/lib/listings/type-shortcuts'

export interface GuideCategory {
  id: string
  name: string
  slug: string
  parent_id: string | null
}

/** The listing types the add-business form offers. Events and jobs list elsewhere. */
export type GuideEntityType =
  | 'business'
  | 'restaurant'
  | 'service_provider'
  | 'creative'
  | 'professional'
  | 'vendor'

export const GUIDE_TYPE_LABELS: Record<GuideEntityType, string> = {
  business: 'Business',
  restaurant: 'Restaurant',
  service_provider: 'Service Provider',
  creative: 'Creative',
  professional: 'Professional',
  vendor: 'Vendor',
}

// ── Question 2: where customers get it ──────────────────────────────────────

export type GuideWhereId = 'visit' | 'come_to_them' | 'online' | 'popups'

export interface GuideWhere {
  id: GuideWhereId
  label: string
  hint: string
  locationType: LocationType
}

export const GUIDE_WHERE: readonly GuideWhere[] = [
  {
    id: 'visit',
    label: 'A place they visit',
    hint: 'A shop, studio, office or restaurant',
    locationType: 'physical',
  },
  {
    id: 'come_to_them',
    label: 'I come to them',
    hint: 'Homes, offices or events',
    locationType: 'service_area',
  },
  {
    id: 'online',
    label: 'Online or shipped',
    hint: 'Online sessions, a web shop, or mail orders',
    locationType: 'virtual',
  },
  {
    id: 'popups',
    label: 'Pop-ups and markets',
    hint: 'Markets, festivals, a truck or a booth',
    locationType: 'traveling',
  },
]

// ── Question 1: what customers come for ─────────────────────────────────────

export interface GuideCandidate {
  slug: string
  /** Where this category is the strongest fit. Those rise to the top. */
  fits?: readonly GuideWhereId[]
}

export interface GuideAnswer {
  id: string
  label: string
  hint: string
  candidates: readonly GuideCandidate[]
  /** Makers and sellers list as a Vendor unless their category says otherwise. */
  leansVendor?: boolean
}

const c = (slug: string, ...fits: GuideWhereId[]): GuideCandidate => ({ slug, fits })

export const GUIDE_ANSWERS: readonly GuideAnswer[] = [
  {
    id: 'food',
    label: 'Food and drink',
    hint: 'Restaurants, bakeries, catering, groceries',
    candidates: [
      c('restaurants', 'visit'),
      c('cafes-coffee', 'visit'),
      c('bakeries-pastry-shops', 'visit', 'online'),
      c('bars-lounges', 'visit'),
      c('catering-events-food', 'come_to_them'),
      c('food-trucks', 'popups'),
      c('meal-prep-delivery', 'online', 'come_to_them'),
      c('juice-bars-smoothies', 'visit', 'popups'),
      c('grocery-markets', 'visit'),
    ],
  },
  {
    id: 'beauty',
    label: 'Hair, beauty and self-care',
    hint: 'Hair, barbers, braids, nails, skin, makeup',
    candidates: [
      c('hair-salons', 'visit'),
      c('barber-shops', 'visit'),
      c('braiding-extensions', 'visit', 'come_to_them'),
      c('locs-natural-hair', 'visit'),
      c('nail-salons-spas', 'visit'),
      c('estheticians-skincare', 'visit'),
      c('makeup-artists', 'come_to_them'),
      c('massage-therapy', 'visit', 'come_to_them'),
    ],
  },
  {
    id: 'health',
    label: 'Health and fitness',
    hint: 'Gyms, trainers, therapy, doctors, dentists',
    candidates: [
      c('fitness-studios', 'visit'),
      c('personal-trainers', 'come_to_them', 'online'),
      c('yoga-pilates', 'visit', 'online'),
      c('mental-health-therapy', 'visit', 'online'),
      c('nutritionists-dietitians', 'online'),
      c('holistic-integrative-health', 'visit'),
      c('chiropractic-physical-therapy', 'visit'),
      c('primary-care-physicians', 'visit'),
      c('dentists', 'visit'),
      c('vision-optometry', 'visit'),
      c('specialty-medicine', 'visit'),
      c('telehealth-services', 'online'),
    ],
  },
  {
    id: 'money_law',
    label: 'Help with money, law or business',
    hint: 'Lawyers, taxes, insurance, real estate, consulting',
    candidates: [
      c('law-legal-services', 'visit'),
      c('accounting-tax-preparation', 'visit', 'online'),
      c('tax-services', 'online'),
      c('financial-planning-wealth', 'online'),
      c('credit-repair-financial-coaching', 'online'),
      c('insurance', 'visit'),
      c('real-estate', 'come_to_them'),
      c('mortgage-lending'),
      c('banks-credit-unions', 'visit', 'online'),
      c('business-consulting', 'online'),
      c('business-formation-incorporation', 'online'),
      c('estate-planning'),
      c('notary-document-services', 'come_to_them'),
    ],
  },
  {
    id: 'tech',
    label: 'Tech and digital',
    hint: 'IT help, software, apps, websites, data',
    candidates: [
      c('it-support-managed-services', 'come_to_them'),
      c('software-development', 'online'),
      c('app-mobile-development', 'online'),
      c('web-app-design', 'online'),
      c('cybersecurity', 'online'),
      c('data-analytics', 'online'),
      c('tech-consulting', 'online'),
      c('ecommerce-solutions', 'online'),
    ],
  },
  {
    id: 'creative',
    label: 'Creative work',
    hint: 'Photo, video, design, music, writing, marketing',
    candidates: [
      c('photography', 'come_to_them'),
      c('videography-film', 'come_to_them'),
      c('graphic-design', 'online'),
      c('music-recording', 'visit'),
      c('visual-art-illustration', 'online', 'popups'),
      c('content-creation', 'online'),
      c('branding-marketing', 'online'),
      c('social-media-management', 'online'),
      c('authors-writers', 'online'),
      c('wedding-photography', 'come_to_them'),
      c('portrait-photography', 'visit'),
    ],
  },
  {
    id: 'make_sell',
    label: 'Things I make or sell',
    hint: 'Clothing, jewelry, candles, gifts, body care',
    leansVendor: true,
    candidates: [
      c('clothing-boutiques', 'visit', 'online'),
      c('accessories-jewelry', 'online', 'popups'),
      c('streetwear-urban-fashion', 'online', 'popups'),
      c('candles-home-fragrance', 'online', 'popups'),
      c('handmade-artisan-goods', 'popups', 'online'),
      c('health-wellness-products', 'online'),
      c('gift-shops', 'visit'),
      c('cultural-heritage-products', 'popups'),
      c('bookstores', 'visit'),
      c('secondhand-vintage', 'visit', 'popups'),
      c('plant-shops-nurseries', 'visit'),
      c('organic-natural-products', 'online'),
      c('farms-farm-stands', 'visit', 'popups'),
    ],
  },
  {
    id: 'home',
    label: 'Home and repair',
    hint: 'Cleaning, repairs, contractors, moving, yards',
    candidates: [
      c('cleaning-services'),
      c('home-repair-renovation'),
      c('general-contractors'),
      c('plumbing'),
      c('electricians'),
      c('hvac'),
      c('painting-finishing'),
      c('landscaping-outdoor'),
      c('moving-storage'),
      c('interior-design', 'online'),
      c('organizing-staging'),
      c('smart-home-installation'),
    ],
  },
  {
    id: 'events',
    label: 'Events and parties',
    hint: 'Planning, DJs, venues, rentals, decor',
    candidates: [
      c('event-planning'),
      c('djs-live-music'),
      c('venue-rental', 'visit'),
      c('party-supplies-rentals'),
      c('balloon-floral-design'),
      c('photo-video-booths'),
      c('catering-bar-service'),
      c('entertainment-booking', 'online'),
    ],
  },
  {
    id: 'learning',
    label: 'Learning, kids and family',
    hint: 'Tutoring, childcare, classes, youth programs',
    candidates: [
      c('academic-tutoring', 'online', 'come_to_them'),
      c('childcare-centers', 'visit'),
      c('early-childhood-education', 'visit'),
      c('after-school-programs', 'visit'),
      c('test-preparation', 'online'),
      c('music-lessons', 'visit'),
      c('art-classes', 'visit', 'popups'),
      c('stem-technology-education', 'visit'),
      c('nannies-au-pairs', 'come_to_them'),
      c('youth-sports-activities', 'visit'),
      c('college-prep-counseling', 'online'),
      c('career-coaching', 'online'),
    ],
  },
  {
    id: 'community',
    label: 'Community and causes',
    hint: 'Churches, nonprofits, mentoring, culture',
    candidates: [
      c('churches-places-of-worship', 'visit'),
      c('nonprofits-community-orgs'),
      c('youth-programs'),
      c('mentorship-programs', 'online'),
      c('cultural-organizations'),
      c('support-groups-recovery'),
      c('museums-galleries', 'visit'),
      c('cultural-events-festivals', 'popups'),
      c('urban-farming-community-gardens', 'visit'),
    ],
  },
  {
    id: 'cars_travel',
    label: 'Cars, travel and delivery',
    hint: 'Mechanics, detailing, rides, travel, delivery',
    candidates: [
      c('auto-repair-mechanics', 'visit'),
      c('mobile-mechanic', 'come_to_them'),
      c('car-detailing', 'come_to_them', 'visit'),
      c('auto-body-paint', 'visit'),
      c('towing-roadside', 'come_to_them'),
      c('car-services-black-cars', 'come_to_them'),
      c('travel-agencies', 'online'),
      c('delivery-services', 'come_to_them'),
      c('shuttle-airport-transport', 'come_to_them'),
    ],
  },
  {
    id: 'pets',
    label: 'Pets',
    hint: 'Grooming, walking, training, vet care, supplies',
    candidates: [
      c('pet-grooming', 'visit', 'come_to_them'),
      c('dog-walking-pet-sitting', 'come_to_them'),
      c('pet-training', 'come_to_them'),
      c('veterinary-care', 'visit'),
      c('pet-supplies-accessories', 'online', 'visit'),
    ],
  },
]

/** How many suggestions show before "More options". */
export const BEST_FIT_COUNT = 4

// ── Search: "Type what you do" ──────────────────────────────────────────────

/**
 * Common words owners use for what they do, mapped to category slugs. Category
 * names already match on their own words ("Dentists" finds dentists), so this
 * only carries words a name doesn't contain.
 */
export const GUIDE_SEARCH_WORDS: Readonly<Record<string, readonly string[]>> = {
  barber: ['barber-shops'],
  haircut: ['barber-shops', 'hair-salons'],
  stylist: ['hair-salons'],
  hairstylist: ['hair-salons'],
  braid: ['braiding-extensions'],
  wig: ['braiding-extensions'],
  sew: ['braiding-extensions', 'tailoring-alterations'],
  loc: ['locs-natural-hair'],
  nail: ['nail-salons-spas'],
  lash: ['estheticians-skincare'],
  brow: ['estheticians-skincare'],
  facial: ['estheticians-skincare'],
  esthetician: ['estheticians-skincare'],
  mua: ['makeup-artists'],
  lawyer: ['law-legal-services'],
  attorney: ['law-legal-services'],
  cpa: ['accounting-tax-preparation'],
  bookkeep: ['accounting-tax-preparation'],
  taxes: ['tax-services', 'accounting-tax-preparation'],
  credit: ['credit-repair-financial-coaching'],
  realtor: ['real-estate'],
  notary: ['notary-document-services'],
  consultant: ['business-consulting'],
  llc: ['business-formation-incorporation'],
  wills: ['estate-planning'],
  doctor: ['primary-care-physicians', 'specialty-medicine'],
  therapist: ['mental-health-therapy'],
  counselor: ['mental-health-therapy'],
  counseling: ['mental-health-therapy', 'family-counseling'],
  trainer: ['personal-trainers', 'pet-training'],
  gym: ['fitness-studios'],
  chiropractor: ['chiropractic-physical-therapy'],
  nutrition: ['nutritionists-dietitians'],
  doula: ['holistic-integrative-health'],
  'food truck': ['food-trucks'],
  caterer: ['catering-events-food'],
  chef: ['meal-prep-delivery', 'catering-events-food'],
  baker: ['bakeries-pastry-shops'],
  cake: ['bakeries-pastry-shops'],
  coffee: ['cafes-coffee'],
  smoothie: ['juice-bars-smoothies'],
  candle: ['candles-home-fragrance'],
  soap: ['handmade-artisan-goods'],
  handmade: ['handmade-artisan-goods'],
  crafts: ['handmade-artisan-goods'],
  boutique: ['clothing-boutiques'],
  clothes: ['clothing-boutiques'],
  shirt: ['streetwear-urban-fashion'],
  tshirt: ['streetwear-urban-fashion'],
  jewelry: ['accessories-jewelry'],
  skincare: ['health-wellness-products', 'estheticians-skincare'],
  'body butter': ['health-wellness-products'],
  plant: ['plant-shops-nurseries'],
  vintage: ['secondhand-vintage'],
  thrift: ['secondhand-vintage'],
  books: ['bookstores', 'authors-writers'],
  author: ['authors-writers'],
  photographer: ['photography'],
  videographer: ['videography-film'],
  designer: ['graphic-design', 'interior-design', 'web-app-design'],
  logo: ['graphic-design'],
  artist: ['visual-art-illustration'],
  painter: ['visual-art-illustration', 'painting-finishing'],
  musician: ['music-recording', 'djs-live-music'],
  studio: ['music-recording'],
  podcast: ['content-creation'],
  influencer: ['content-creation', 'influencer-marketing'],
  marketing: ['branding-marketing', 'social-media-management'],
  website: ['web-app-design'],
  developer: ['software-development', 'app-mobile-development'],
  app: ['app-mobile-development'],
  it: ['it-support-managed-services'],
  computer: ['it-support-managed-services'],
  cleaner: ['cleaning-services'],
  maid: ['cleaning-services'],
  handyman: ['home-repair-renovation'],
  contractor: ['general-contractors'],
  plumber: ['plumbing'],
  electrician: ['electricians'],
  lawn: ['landscaping-outdoor'],
  movers: ['moving-storage'],
  dj: ['djs-live-music'],
  planner: ['event-planning'],
  wedding: ['event-planning', 'wedding-photography'],
  party: ['party-supplies-rentals', 'event-planning'],
  balloon: ['balloon-floral-design'],
  florist: ['balloon-floral-design'],
  flowers: ['balloon-floral-design'],
  venue: ['venue-rental'],
  tutor: ['academic-tutoring'],
  daycare: ['childcare-centers'],
  nanny: ['nannies-au-pairs'],
  coach: ['career-coaching', 'personal-trainers', 'youth-sports-activities'],
  church: ['churches-places-of-worship'],
  ministry: ['churches-places-of-worship'],
  nonprofit: ['nonprofits-community-orgs'],
  charity: ['nonprofits-community-orgs'],
  mentor: ['mentorship-programs'],
  mechanic: ['auto-repair-mechanics', 'mobile-mechanic'],
  detail: ['car-detailing'],
  tow: ['towing-roadside'],
  driver: ['car-services-black-cars'],
  limo: ['car-services-black-cars'],
  courier: ['delivery-services'],
  trucking: ['freight-logistics'],
  groomer: ['pet-grooming'],
  dog: ['dog-walking-pet-sitting', 'pet-grooming', 'pet-training'],
  vet: ['veterinary-care'],
  farm: ['farms-farm-stands', 'urban-farming-community-gardens'],
  farmer: ['farms-farm-stands'],
  produce: ['farms-farm-stands', 'grocery-markets'],
  ranch: ['farms-farm-stands'],
  csa: ['farms-farm-stands'],
  grocery: ['grocery-markets'],
  grocer: ['grocery-markets'],
  supermarket: ['grocery-markets'],
  bank: ['banks-credit-unions'],
  'credit union': ['banks-credit-unions'],
  // A banker or advisor is a person, so they list as a Professional, not a bank
  // [Decision - founder, 2026-10-08].
  banker: ['financial-planning-wealth'],
  'financial advisor': ['financial-planning-wealth'],
  'financial planner': ['financial-planning-wealth'],
  'loan officer': ['mortgage-lending'],
  garden: ['urban-farming-community-gardens', 'landscaping-outdoor'],
  staffing: ['temp-contract-staffing'],
  recruiter: ['executive-search', 'temp-contract-staffing'],
  resume: ['resume-interview-coaching'],
}

/** Words that never narrow a search ("I make candles" is just "candles"). */
const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'the',
  'i',
  'im',
  'my',
  'we',
  'our',
  'of',
  'for',
  'to',
  'in',
  'on',
  'at',
  'do',
  'own',
  'run',
  'make',
  'sell',
  'business',
  'services',
  'service',
])

function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t.length > 0 && !STOP_WORDS.has(t))
}

/** The same word, or its plural. */
function wordExact(queryWord: string, word: string): boolean {
  return queryWord === word || queryWord === `${word}s` || queryWord === `${word}es`
}

/**
 * One query word matches one key or name word: exactly, as a plural
 * ("barbers", "lashes"), as a longer form of a 4+ letter word ("braiding"), or
 * as the start of one while typing ("barb"). Three-letter words never match as
 * a prefix, so "app" doesn't find "apparel".
 */
function wordMatches(queryWord: string, word: string): boolean {
  if (wordExact(queryWord, word)) return true
  if (word.length >= 4 && queryWord.startsWith(word)) return true
  return queryWord.length >= 4 && word.startsWith(queryWord)
}

/**
 * Categories that match what the owner typed, best first. Children (the
 * specific thing) rank above parents, then A to Z. Empty for a blank query.
 */
export function searchGuide(
  query: string,
  categories: readonly GuideCategory[],
  limit = 6
): GuideCategory[] {
  const words = normalize(query)
  if (words.length === 0) return []
  const bySlug = new Map(categories.map((cat) => [cat.slug, cat]))
  const scores = new Map<string, number>()
  const bump = (slug: string, by: number) => scores.set(slug, (scores.get(slug) ?? 0) + by)

  for (const [key, slugs] of Object.entries(GUIDE_SEARCH_WORDS)) {
    const keyWords = key.split(' ')
    const hit = keyWords.every((kw) => words.some((w) => wordMatches(w, kw)))
    // An exact word beats a longer or partial one, so "banker" finds the
    // banker key ahead of the bank key it also starts with.
    const exact = keyWords.every((kw) => words.some((w) => wordExact(w, kw)))
    if (hit) for (const slug of slugs) bump(slug, 2 + keyWords.length + (exact ? 1 : 0))
  }

  for (const cat of categories) {
    const nameWords = normalize(cat.name)
    const hits = words.filter((w) => w.length >= 3 && nameWords.some((nw) => wordMatches(w, nw)))
    if (hits.length > 0) bump(cat.slug, hits.length)
  }

  return [...scores.entries()]
    .map(([slug, score]) => ({ cat: bySlug.get(slug), score }))
    .filter((r): r is { cat: GuideCategory; score: number } => r.cat !== undefined)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(a.cat.parent_id === null) - Number(b.cat.parent_id === null) ||
        a.cat.name.localeCompare(b.cat.name)
    )
    .slice(0, limit)
    .map((r) => r.cat)
}

// ── Question 3: which fits best ─────────────────────────────────────────────

export function findAnswer(id: string | null | undefined): GuideAnswer | undefined {
  return GUIDE_ANSWERS.find((a) => a.id === id)
}

export function findWhere(id: string | null | undefined): GuideWhere | undefined {
  return GUIDE_WHERE.find((w) => w.id === id)
}

/**
 * The answer's categories that exist in the live tree, the ones that fit
 * `where` first, otherwise in the order written above. `best` is what shows
 * up front; `more` sits behind "More options".
 */
export function suggestCategories(
  answer: GuideAnswer,
  where: GuideWhereId | null,
  categories: readonly GuideCategory[]
): { best: GuideCategory[]; more: GuideCategory[] } {
  const bySlug = new Map(categories.map((cat) => [cat.slug, cat]))
  const present = answer.candidates.filter((cand) => bySlug.has(cand.slug))
  const ranked = where
    ? [
        ...present.filter((cand) => cand.fits?.includes(where)),
        ...present.filter((cand) => !cand.fits?.includes(where)),
      ]
    : present
  const cats = ranked.map((cand) => bySlug.get(cand.slug) as GuideCategory)
  return { best: cats.slice(0, BEST_FIT_COUNT), more: cats.slice(BEST_FIT_COUNT) }
}

function topParent(category: GuideCategory, categories: readonly GuideCategory[]): GuideCategory {
  if (!category.parent_id) return category
  return categories.find((cat) => cat.id === category.parent_id) ?? category
}

/**
 * The listing type to suggest, most specific reason first:
 *
 *   1. Pop-ups and markets  → Vendor
 *   2. a category the discover Type chips map (Food → Restaurant, Legal →
 *      Professional, Photography → Creative), so the guide and the directory
 *      agree on what a listing is
 *   3. "Things I make or sell" → Vendor
 *   4. "I come to them", or a bank that is online only → Service Provider
 *      (a bank with a branch is a Business, not a Professional
 *      [Decision - founder, 2026-10-08])
 *   5. otherwise Business
 */
export function suggestEntityType(
  category: GuideCategory,
  categories: readonly GuideCategory[],
  answer?: GuideAnswer,
  where?: GuideWhereId | null
): GuideEntityType {
  if (where === 'popups') return 'vendor'
  const parentSlug = topParent(category, categories).slug
  for (const type of ['restaurant', 'professional', 'creative'] as const) {
    if (
      TYPE_CATEGORY_SLUGS[type]?.includes(parentSlug) &&
      !typeExcludedSlugs(type).includes(category.slug)
    ) {
      return type
    }
  }
  if (answer?.leansVendor) return 'vendor'
  if (where === 'come_to_them') return 'service_provider'
  if (where === 'online' && category.slug === 'banks-credit-unions') return 'service_provider'
  return 'business'
}

export interface GuidePick {
  entityType: GuideEntityType
  /** Fills the Category select. */
  parentCategoryId: string
  /** Fills the Subcategory select. Empty when a parent with children was picked. */
  categoryId: string
  /** Null when the owner searched instead of answering "Where". */
  locationType: LocationType | null
  categoryName: string
  /** The "Why we suggested this" line. */
  reason: string
}

/** Everything the form needs once the owner picks a suggestion. */
export function buildGuidePick(
  category: GuideCategory,
  categories: readonly GuideCategory[],
  from: { answer?: GuideAnswer; where?: GuideWhereId | null; query?: string }
): GuidePick {
  const hasChildren = categories.some((cat) => cat.parent_id === category.id)
  const parentCategoryId = category.parent_id ?? category.id
  const categoryId = category.parent_id ? category.id : hasChildren ? '' : category.id
  const where = findWhere(from.where)
  const entityType = suggestEntityType(category, categories, from.answer, from.where)

  const said = [from.answer?.label, where?.label].filter(Boolean)
  const because =
    said.length > 0
      ? `You said ${said.map((s) => `"${s}"`).join(' and ')}.`
      : from.query?.trim()
        ? `You typed "${from.query.trim()}".`
        : ''
  const typeLine =
    from.where === 'popups'
      ? 'Pop-up and market sellers usually list as a Vendor.'
      : `${category.name} usually list as a ${GUIDE_TYPE_LABELS[entityType]}.`

  return {
    entityType,
    parentCategoryId,
    categoryId,
    locationType: where?.locationType ?? null,
    categoryName: category.name,
    reason: [because, typeLine].filter(Boolean).join(' '),
  }
}
