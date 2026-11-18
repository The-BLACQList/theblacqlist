/**
 * What the "Sample & Co." staging seed writes (ticket 187), as plain data.
 *
 * Built from the same fixtures that render /example/* (lib/example/fixtures),
 * so the seeded listings and the sample pages cannot drift. Pure: no client,
 * no clock, no file reads. scripts/seed-example-business.ts does the I/O, and
 * tests/seed-example-plan.test.ts checks every row against the table CHECKs.
 *
 * Rows here leave out listing_id and storage paths: those only exist once the
 * listing has been upserted. Photos are named by their file under
 * public/images/example; the script uploads them and fills the paths in.
 */

import {
  EXAMPLE_VARIANTS,
  EXAMPLE_VARIANT_LABEL,
  buildExampleEntity,
  type ExampleVariant,
} from '@/lib/example/fixtures'
import { EXAMPLE_ASSET_DIR, EXAMPLE_NAME, EXAMPLE_SITE } from '@/lib/example/fixtures/shared'
import type { EntityPageData } from '@/types'

/**
 * Every seeded slug starts with this, so a purge can never match a real page.
 * It keeps the sample's first name (renamed "Sample & Co." in ticket 206) on
 * purpose: the seed upserts by slug and --purge deletes by slug, so a new
 * prefix would leave the listings already on staging behind.
 */
export const SEED_SLUG_PREFIX = 'demo-test-business-123'

/** The public folder the sample photos live in, relative to the repo root. */
export const SEED_ASSET_ROOT = `public${EXAMPLE_ASSET_DIR}`

/** Reviewer accounts made by --with-reviews. example.com never receives mail. */
export const REVIEWER_EMAIL_RE = /^demo-reviewer-\d+@example\.com$/

export function reviewerEmail(n: number): string {
  return `demo-reviewer-${n}@example.com`
}

export function reviewerDisplayName(n: number): string {
  return `Demo Reviewer ${n}`
}

export function seedSlug(variant: ExampleVariant): string {
  return `${SEED_SLUG_PREFIX}-${variant}`
}

export function seedName(variant: ExampleVariant): string {
  return `Demo — ${EXAMPLE_NAME} (${EXAMPLE_VARIANT_LABEL[variant]})`
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/** The file name of a sample photo, from its /images/example/… src. Null for anything else. */
export function assetFile(src: string | null | undefined): string | null {
  if (!src) return null
  const prefix = `${EXAMPLE_ASSET_DIR}/`
  if (!src.startsWith(prefix)) return null
  const file = src.slice(prefix.length)
  return /^[a-z0-9][a-z0-9._-]*\.(webp|png|jpe?g)$/i.test(file) ? file : null
}

/** "$19" → 1900, "From $17/mo" → 1700, "$1,200" → 120000. Null when there's no amount. */
export function priceCents(label: string | null | undefined): number | null {
  const match = label?.match(/\$\s?([\d,]+(?:\.\d{1,2})?)/)
  if (!match?.[1]) return null
  return Math.round(Number(match[1].replace(/,/g, '')) * 100)
}

const DAY_MS = 24 * 60 * 60 * 1000

// ── Row shapes (without listing_id) ──────────────────────────────────────────

export interface SeedListingCore {
  slug: string
  name: string
  entity_type: string
  category_slug: string
  city_slug: string
  primary_level: string | null
  extra_levels: string[]
  tagline: string | null
  meta_title: string | null
  meta_description: string | null
  location_type: string
  ownership_label: string | null
  open_to_partnerships: boolean
}

export interface SeedPhoto {
  file: string
  alt: string
  album: string | null
}

export interface SeedLocation {
  listing: SeedListingCore
  details: Record<string, unknown>
}

export interface SeedJob {
  listing: SeedListingCore
  details: Record<string, unknown>
}

export interface SeedShopItem {
  kind: 'product' | 'service'
  name: string
  slug: string
  global_slug: string
  price_cents: number | null
  price_display_text: string | null
  photo: string | null
}

export interface SeedPost {
  headline: string
  body: string | null
  starts_at: string
  ends_at: string
  status: 'active'
  button_label: string | null
  button_url: string | null
  photo: string | null
}

export interface SeedReview {
  rating: number
  title: string | null
  body: string | null
  published_at: string | null
  is_verified_purchase: boolean
  owner_response: string | null
  owner_responded_at: string | null
}

export interface SeedStockist {
  chain_slug: string | null
  store_name: string | null
  nationwide: boolean
  position: number
  areas: { kind: 'city' | 'zip'; value: string }[]
}

export interface ExampleSeedPlan {
  variant: ExampleVariant
  listing: SeedListingCore
  details: Record<string, unknown>
  cover: SeedPhoto | null
  logo: SeedPhoto | null
  gallery: SeedPhoto[]
  attributeSlugs: string[]
  services: Record<string, unknown>[]
  faqs: Record<string, unknown>[]
  links: Record<string, unknown>[]
  videos: Record<string, unknown>[]
  buttons: Record<string, unknown>[]
  team: Record<string, unknown>[]
  deals: Record<string, unknown>[]
  posts: SeedPost[]
  booking: Record<string, unknown> | null
  credentials: Record<string, unknown>[]
  documents: { label: string; title: string }[]
  highlights: Record<string, unknown>[]
  hoursOverrides: Record<string, unknown>[]
  orderPlatforms: Record<string, unknown>[]
  stockists: SeedStockist[]
  locations: SeedLocation[]
  shop: SeedShopItem[]
  jobs: SeedJob[]
  reviews: SeedReview[]
}

// ── Builders ─────────────────────────────────────────────────────────────────

const LINK_TYPES = new Set([
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

function isHttps(url: string | null | undefined): url is string {
  return typeof url === 'string' && /^https:\/\/\S+$/.test(url)
}

function businessDetails(e: EntityPageData): Record<string, unknown> {
  const d = e.details
  return {
    description: d.description,
    address_line_1: d.address,
    address_line_2: d.address_line2,
    city_text: d.city_name,
    state: d.state_abbr,
    zip: d.zip,
    phone: d.phone,
    email: d.email,
    website_url: d.website_url,
    social_facebook: d.social.facebook ?? null,
    social_instagram: d.social.instagram ?? null,
    social_linkedin: d.social.linkedin ?? null,
    social_tiktok: d.social.tiktok ?? null,
    social_twitter: d.social.twitter ?? null,
    social_youtube: d.social.youtube ?? null,
    hours: d.hours,
    lat: d.lat,
    lng: d.lng,
    cta_type: d.cta_type,
    cta_url: d.cta_url,
    cta_label_override: d.cta_label_override,
    price_range: d.price_range ?? null,
    founded_year: d.founded_year ?? null,
    accepts_reservations: d.accepts_reservations ?? null,
    ships_nationwide: d.ships_nationwide,
  }
}

function core(
  e: EntityPageData,
  slug: string,
  name: string,
  overrides: Partial<SeedListingCore> = {}
): SeedListingCore {
  return {
    slug,
    name,
    entity_type: e.entity_type,
    category_slug: e.category.slug,
    city_slug: e.city?.slug ?? 'atlanta-ga',
    primary_level: e.primary_level ?? null,
    extra_levels: e.extra_levels ?? [],
    tagline: e.tagline ?? null,
    meta_title: null,
    meta_description: e.meta_description ?? null,
    location_type: e.location_type,
    ownership_label: e.ownership_label ?? null,
    open_to_partnerships: e.open_to_partnerships ?? false,
    ...overrides,
  }
}

function locations(e: EntityPageData, variant: ExampleVariant): SeedLocation[] {
  const main = businessDetails(e)
  return (e.locations ?? []).map((loc) => {
    const city = slugify(loc.cityName)
    return {
      listing: core(
        e,
        `${seedSlug(variant)}-${slugify(loc.label)}`,
        `${seedName(variant)} — ${loc.label}`,
        {
          // The city's name only: the fixtures don't give a location's state.
          // The script matches "<name>-<state>" and falls back to the main city.
          city_slug: city,
        }
      ),
      details: {
        ...main,
        address_line_1: loc.addressLine,
        address_line_2: null,
        city_text: loc.cityName,
        lat: loc.lat ?? null,
        lng: loc.lng ?? null,
      },
    }
  })
}

function jobs(e: EntityPageData, variant: ExampleVariant): SeedJob[] {
  return (e.hiring?.roles ?? []).map((role) => {
    const j = role.job_details
    return {
      listing: core(e, `${seedSlug(variant)}-job-${slugify(role.name)}`, `Demo — ${role.name}`, {
        entity_type: 'job',
        // A job is filed under its hiring page's category, the same as real
        // job listings. The fixtures' 'jobs' category exists only in samples.
        category_slug: e.category.slug,
        tagline: role.tagline ?? null,
        meta_description: null,
        location_type: role.location_type,
        open_to_partnerships: false,
        extra_levels: [],
      }),
      details: {
        description: role.description ?? role.tagline ?? null,
        employment_type: j?.employmentType ?? 'full-time',
        workplace_type: j?.workplaceType ?? 'on-site',
        salary_min: j?.salaryMin ?? null,
        salary_max: j?.salaryMax ?? null,
        salary_period: j?.salaryPeriod ?? null,
        closes_at: j?.closesAt ?? null,
        apply_url: `${EXAMPLE_SITE}/jobs/${slugify(role.name)}`,
      },
    }
  })
}

function shop(e: EntityPageData, variant: ExampleVariant): SeedShopItem[] {
  return (e.shop?.items ?? []).map((item) => {
    const base = item.href.split('/').filter(Boolean).pop() ?? slugify(item.name)
    const slug = `demo-${base.replace(/^example-/, '')}`
    return {
      kind: item.kind,
      name: item.name,
      slug,
      global_slug: `${SEED_SLUG_PREFIX}-${variant}-${slug.slice('demo-'.length)}`,
      price_cents: priceCents(item.priceLabel),
      price_display_text: item.priceLabel,
      photo: assetFile(item.image?.src),
    }
  })
}

function posts(e: EntityPageData, now: Date): SeedPost[] {
  const start = new Date(now.getTime() - 60 * 1000)
  // listing_posts: ends_at > starts_at and within 30 days of it.
  const latest = start.getTime() + 30 * DAY_MS - 60 * 1000
  return (e.happeningNow ?? []).map((p) => {
    const ends = Math.min(new Date(p.endsAt).getTime(), latest)
    const label = p.buttonLabel ? p.buttonLabel.slice(0, 30) : null
    return {
      headline: p.headline.slice(0, 80),
      body: p.body ? p.body.slice(0, 200) : null,
      starts_at: start.toISOString(),
      ends_at: new Date(Math.max(ends, start.getTime() + 60 * 60 * 1000)).toISOString(),
      status: 'active',
      button_label: label,
      button_url: label ? `${EXAMPLE_SITE}/${slugify(label)}` : null,
      photo: assetFile(p.imageUrl),
    }
  })
}

/** The rows one sample page becomes. `now` pins every date, as the fixtures do. */
export function buildSeedPlan(variant: ExampleVariant, now: Date): ExampleSeedPlan {
  const e = buildExampleEntity(variant, now)
  const coverFile = assetFile(e.cover_image_path)
  const logoFile = assetFile(e.logo?.src)

  return {
    variant,
    listing: core(e, seedSlug(variant), seedName(variant)),
    details: businessDetails(e),
    cover: coverFile ? { file: coverFile, alt: `${EXAMPLE_NAME} cover`, album: null } : null,
    logo: logoFile
      ? { file: logoFile, alt: e.logo?.alt ?? `${EXAMPLE_NAME} logo`, album: null }
      : null,
    gallery: e.images.flatMap((img) => {
      const file = assetFile(img.src)
      return file ? [{ file, alt: img.alt, album: img.album ?? null }] : []
    }),
    attributeSlugs: [...new Set(e.attributes.flatMap((g) => g.values.map((v) => v.slug)))],
    services: e.details.services.map((s, i) => ({
      name: s.name,
      description: s.description ?? null,
      price_display: s.price ?? null,
      group_label: s.group ?? null,
      display_order: i,
      is_featured: i < 3,
    })),
    faqs: e.faqs.map((f, i) => ({
      question: f.question,
      answer: f.answer,
      display_order: i,
      is_visible: true,
    })),
    links: e.links
      .filter((l) => LINK_TYPES.has(l.type))
      .map((l, i) => ({ link_type: l.type, url: l.url, label: l.label, display_order: i })),
    videos: e.details.videos
      .filter((v) => isHttps(v.embed_url))
      .map((v, i) => ({ kind: 'embed', embed_url: v.embed_url, position: i })),
    buttons: (e.buttons ?? []).map((b, i) => ({
      type: 'learn-more',
      value: b.href,
      label_override: b.label.slice(0, 50),
      position: i,
    })),
    team: (e.team ?? []).map((m, i) => ({
      name: m.name,
      role: m.role,
      bio: m.bio,
      is_founder: m.isFounder === true,
      sort_order: i,
    })),
    deals: (e.deals ?? []).map((d) => ({
      title: d.title,
      description: d.description,
      code: d.code,
      terms: d.terms,
      starts_at: new Date(now.getTime() - 60 * 1000).toISOString(),
      ends_at: d.endsAt,
      status: 'active',
    })),
    posts: posts(e, now),
    booking: e.booking
      ? {
          enabled: true,
          prompt: e.booking.prompt,
          ask_date: e.booking.askDate,
          ask_party_size: e.booking.askPartySize,
        }
      : null,
    credentials: (e.credentials ?? []).map((c, i) => ({
      kind: c.kind,
      title: c.title,
      issuer: c.issuer,
      year: c.year,
      url: isHttps(c.href) ? c.href : null,
      sort_order: i,
    })),
    documents: (e.documents ?? []).map((d) => ({ label: d.label.slice(0, 60), title: d.label })),
    highlights: (e.highlights ?? []).map((h, i) => ({
      kind: h.kind,
      icon: h.icon,
      title: h.title,
      text: h.text,
      sort_order: i,
    })),
    hoursOverrides: (e.hoursOverrides ?? []).map((o) => ({
      date: o.date,
      closed: o.closed,
      open: o.closed ? null : o.open,
      close: o.closed ? null : o.close,
      label: o.label,
    })),
    orderPlatforms: (e.orderLinks ?? []).map((o) => ({ platform: o.platform, url: o.url })),
    stockists: (e.findUsAt ?? []).map((s) => ({
      chain_slug: s.chainSlug,
      store_name: s.chainSlug ? null : s.name,
      nationwide: s.nationwide,
      position: s.position,
      areas: [
        ...s.cities.map((value) => ({ kind: 'city' as const, value })),
        ...s.zips.map((value) => ({ kind: 'zip' as const, value })),
      ],
    })),
    locations: locations(e, variant),
    shop: shop(e, variant),
    jobs: jobs(e, variant),
    reviews: e.reviews.map((r) => ({
      rating: r.rating,
      title: r.title,
      body: r.body,
      published_at: r.published_at,
      is_verified_purchase: r.is_verified_purchase,
      owner_response: r.owner_response,
      owner_responded_at: r.owner_responded_at,
    })),
  }
}

export function buildSeedPlans(now: Date): ExampleSeedPlan[] {
  return EXAMPLE_VARIANTS.map((v) => buildSeedPlan(v, now))
}

/** Every slug the seed can create: the three pages, their locations and their jobs. */
export function seedSlugs(plans: readonly ExampleSeedPlan[]): string[] {
  return plans.flatMap((p) => [
    p.listing.slug,
    ...p.locations.map((l) => l.listing.slug),
    ...p.jobs.map((j) => j.listing.slug),
  ])
}

/** A one-page PDF that says what it is. Enough for the documents section to link to. */
export function placeholderPdf(title: string): Uint8Array {
  // ASCII only, so string length is byte length and the xref offsets hold.
  const text = `${title} - sample document for ${EXAMPLE_NAME}, staging demo`.replace(
    /[^\x20-\x7E]|[()\\]/g,
    ''
  )
  const stream = `BT /F1 14 Tf 72 720 Td (${text}) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let body = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((obj, i) => {
    offsets.push(body.length)
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`
  })
  const xref = body.length
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const o of offsets) body += `${String(o).padStart(10, '0')} 00000 n \n`
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(body)
}
