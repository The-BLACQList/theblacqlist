import { resolveMediaPath } from '@/lib/listings/coverImage'
import { directionsUrl } from '@/lib/listings/directions'
import { isExampleAssetPath } from '@/lib/listings/exampleAssets'
import { buildEntityUrl } from '@/lib/listings/url'
import type { EntityPageData, WeeklyHours } from '@/types'

// The LocalBusiness structured data for a listing page. Lifted out of
// app/[citySlug]/[entityType]/[listingSlug]/page.tsx in ticket 184 so it can be
// unit-tested and rendered on the sample pages, where the founder can paste a
// Preview URL into Google's Rich Results test. Ticket 189 grew it: a
// category-mapped @type, opening hours, geo, the cover image, price range,
// founding year, socials, an offer catalog and the owner's upcoming events. It
// also fixed the two quirks the move kept (address line 2 dropped; a 0 average
// treated as no rating). Pinned by tests/jsonld.test.ts.

export const DEFAULT_SITE_URL = 'https://theblacqlist.com'

/** The public origin, as every absolute URL on the site derives it. */
export function siteBaseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL
}

/**
 * schema.org LocalBusiness subtypes by category slug. Only LocalBusiness
 * subtypes: a place type that is not a business (Museum, PlaceOfWorship) would
 * drop the business properties, so those categories keep LocalBusiness.
 */
const SCHEMA_TYPE_BY_CATEGORY: Record<string, string> = {
  restaurants: 'Restaurant',
  restaurant: 'Restaurant',
  'food-trucks': 'FoodEstablishment',
  'catering-events-food': 'FoodEstablishment',
  'meal-prep-delivery': 'FoodEstablishment',
  'juice-bars-smoothies': 'FoodEstablishment',
  'cafes-coffee': 'CafeOrCoffeeShop',
  'bakeries-pastry-shops': 'Bakery',
  'ice-cream-desserts': 'IceCreamShop',
  'bars-lounges': 'BarOrPub',
  'hair-salons': 'HairSalon',
  'barber-shops': 'HairSalon',
  'braiding-extensions': 'HairSalon',
  'locs-natural-hair': 'HairSalon',
  'nail-salons-spas': 'NailSalon',
  'estheticians-skincare': 'BeautySalon',
  'makeup-artists': 'BeautySalon',
  'mens-grooming': 'BeautySalon',
  'massage-therapy': 'DaySpa',
  'fitness-studios': 'ExerciseGym',
  'yoga-pilates': 'SportsActivityLocation',
  'law-legal-services': 'LegalService',
  'estate-planning': 'LegalService',
  'notary-document-services': 'Notary',
  'accounting-tax-preparation': 'AccountingService',
  'tax-services': 'AccountingService',
  'financial-planning-wealth': 'FinancialService',
  'credit-repair-financial-coaching': 'FinancialService',
  'mortgage-lending': 'FinancialService',
  'banks-credit-unions': 'BankOrCreditUnion',
  insurance: 'InsuranceAgency',
  'real-estate': 'RealEstateAgent',
  dentists: 'Dentist',
  'primary-care-physicians': 'Physician',
  'pediatric-healthcare': 'Physician',
  'urgent-care': 'MedicalClinic',
  pharmacies: 'Pharmacy',
  'vision-optometry': 'Optician',
  'veterinary-care': 'VeterinaryCare',
  'childcare-centers': 'ChildCare',
  'auto-repair-mechanics': 'AutoRepair',
  'mobile-mechanic': 'AutoRepair',
  'auto-body-paint': 'AutoBodyShop',
  'car-dealers': 'AutoDealer',
  'car-rental': 'AutoRental',
  'car-detailing': 'AutoWash',
  'tire-wheel-services': 'TireShop',
  'towing-roadside': 'EmergencyService',
  electricians: 'Electrician',
  plumbing: 'Plumber',
  hvac: 'HVACBusiness',
  'general-contractors': 'GeneralContractor',
  'painting-finishing': 'HousePainter',
  'home-repair-renovation': 'HomeAndConstructionBusiness',
  'flooring-tile': 'HomeAndConstructionBusiness',
  'carpentry-woodworking': 'HomeAndConstructionBusiness',
  'moving-storage': 'MovingCompany',
  'clothing-boutiques': 'ClothingStore',
  'streetwear-urban-fashion': 'ClothingStore',
  'formal-occasion-wear': 'ClothingStore',
  'swimwear-activewear': 'ClothingStore',
  'secondhand-vintage': 'ClothingStore',
  'shoe-stores': 'ShoeStore',
  'accessories-jewelry': 'JewelryStore',
  bookstores: 'BookStore',
  'bike-shops': 'BikeStore',
  'grocery-markets': 'GroceryStore',
  'farms-farm-stands': 'GroceryStore',
  'plant-shops-nurseries': 'GardenStore',
  'balloon-floral-design': 'Florist',
  'furniture-decor': 'FurnitureStore',
  'candles-home-fragrance': 'HomeGoodsStore',
  'pet-supplies-accessories': 'PetStore',
  'beauty-supply': 'Store',
  'gift-shops': 'Store',
  'hotels-stays': 'LodgingBusiness',
  'travel-agencies': 'TravelAgency',
  'museums-galleries': 'ArtGallery',
  'hr-staffing': 'EmploymentAgency',
  'staffing-workforce': 'EmploymentAgency',
  'temp-contract-staffing': 'EmploymentAgency',
  'executive-search': 'EmploymentAgency',
}

/** The schema.org type for a category slug; LocalBusiness when none fits. */
export function schemaTypeFor(categorySlug: string | null | undefined): string {
  return (categorySlug && SCHEMA_TYPE_BY_CATEGORY[categorySlug]) || 'LocalBusiness'
}

const DAYS: [keyof WeeklyHours, string][] = [
  ['monday', 'Monday'],
  ['tuesday', 'Tuesday'],
  ['wednesday', 'Wednesday'],
  ['thursday', 'Thursday'],
  ['friday', 'Friday'],
  ['saturday', 'Saturday'],
  ['sunday', 'Sunday'],
]

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * One OpeningHoursSpecification per distinct open/close pair, listing the
 * days that share it. Closed days and malformed times are left out.
 */
export function openingHoursSpecification(
  hours: WeeklyHours | null | undefined
): Record<string, unknown>[] {
  if (!hours) return []
  const groups = new Map<string, { opens: string; closes: string; days: string[] }>()
  for (const [key, name] of DAYS) {
    const day = hours[key]
    if (!day || day.closed || !TIME.test(day.open) || !TIME.test(day.close)) continue
    const id = `${day.open}-${day.close}`
    const group = groups.get(id) ?? { opens: day.open, closes: day.close, days: [] }
    group.days.push(`https://schema.org/${name}`)
    groups.set(id, group)
  }
  return [...groups.values()].map((g) => ({
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: g.days.length === 1 ? g.days[0] : g.days,
    opens: g.opens,
    closes: g.closes,
  }))
}

/** "$45" or "$4.50" as a number; anything with words ("From $350") is not a price. */
function plainPrice(text: string | null): string | null {
  const m = text?.trim().match(/^\$\s?(\d{1,6}(?:\.\d{2})?)$/)
  return m?.[1] ?? null
}

function absolute(baseUrl: string, path: string): string {
  return path.startsWith('/') ? `${baseUrl}${path}` : path
}

export function buildJsonLd(
  entity: EntityPageData | null,
  entityType: string,
  baseUrl: string = siteBaseUrl()
): Record<string, unknown> | null {
  if (!entity) return null
  const { details, city } = entity
  const logoUrl = resolveMediaPath(entity.logo_path)
  const cover = entity.cover_image_path
  const imageUrl = isExampleAssetPath(cover) ? `${baseUrl}${cover}` : resolveMediaPath(cover)

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': schemaTypeFor(entity.category?.slug),
    name: entity.name,
    description: details.description || entity.tagline,
    url: `${baseUrl}${buildEntityUrl(entityType, city?.slug, entity.slug)}`,
    // schema.org logo must be a fetchable URL. logo_path is a Storage key, so
    // emitting it raw hands crawlers a string like "logos/abc.png" — invalid,
    // and Google drops the property. Resolve it the same way the cover is.
    ...(logoUrl && { logo: logoUrl }),
    ...(imageUrl && { image: imageUrl }),
    // A null check, not truthiness: an average of 0 is still an average. Google
    // also wants at least one review behind a rating.
    ...(entity.avg_rating != null &&
      entity.review_count > 0 && {
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: entity.avg_rating.toFixed(1),
          reviewCount: entity.review_count,
        },
      }),
  }

  if (details.address) {
    jsonLd.address = {
      '@type': 'PostalAddress',
      // Line 2 ("Suite A") belongs on the street line.
      streetAddress: [details.address, details.address_line2].filter(Boolean).join(', '),
      addressLocality: details.city_name ?? city?.name,
      addressRegion: details.state_abbr ?? city?.state_abbr,
      postalCode: details.zip,
      addressCountry: 'US',
    }
  }

  if (typeof details.lat === 'number' && typeof details.lng === 'number') {
    jsonLd.geo = { '@type': 'GeoCoordinates', latitude: details.lat, longitude: details.lng }
  }
  const map = directionsUrl({
    name: entity.name,
    street: details.address,
    city: details.city_name ?? city?.name,
    state: details.state_abbr ?? city?.state_abbr,
    zip: details.zip,
    lat: details.lat,
    lng: details.lng,
  })
  if (map) jsonLd.hasMap = map

  if (details.phone) jsonLd.telephone = details.phone

  const hours = openingHoursSpecification(details.hours)
  if (hours.length > 0) jsonLd.openingHoursSpecification = hours

  if (details.price_range) jsonLd.priceRange = details.price_range
  if (details.founded_year != null) jsonLd.foundingDate = String(details.founded_year)
  if (details.accepts_reservations != null) {
    jsonLd.acceptsReservations = details.accepts_reservations
  }

  // The website and the socials the page shows (the loader already blanks
  // socials the plan hides). https only, as the editor saves them.
  const sameAs = [details.website_url, ...Object.values(details.social ?? {})].filter(
    (u): u is string => typeof u === 'string' && /^https:\/\//i.test(u)
  )
  if (sameAs.length > 0) jsonLd.sameAs = [...new Set(sameAs)]

  const offers = (details.services ?? [])
    .filter((s) => s.name && s.price?.trim())
    .map((s) => {
      const price = plainPrice(s.price)
      return {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: s.name,
          ...(s.description && { description: s.description }),
        },
        ...(price ? { price, priceCurrency: 'USD' } : { description: s.price!.trim() }),
      }
    })
  if (offers.length > 0) {
    jsonLd.hasOfferCatalog = {
      '@type': 'OfferCatalog',
      name: 'Services',
      itemListElement: offers,
    }
  }

  const events = (entity.organizerEvents ?? []).map((e) => ({
    '@type': 'Event',
    name: e.name,
    startDate: e.starts_at,
    url: absolute(baseUrl, e.url),
    eventAttendanceMode: e.is_online
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode',
    location: e.is_online
      ? { '@type': 'VirtualLocation', url: absolute(baseUrl, e.url) }
      : {
          '@type': 'Place',
          name: e.venue_name ?? entity.name,
          ...(e.city_name && {
            address: { '@type': 'PostalAddress', addressLocality: e.city_name },
          }),
        },
  }))
  if (events.length > 0) jsonLd.event = events

  return jsonLd
}
