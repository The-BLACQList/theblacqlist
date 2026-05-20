# Ticket 020: BLACQList Page — Route, Data Layer, and Page Component

## Status

Draft

## Phase

Phase 2: Public Marketing and Discovery Shell

## Priority

P0

## Feature Area

Core Workflow

## Context

The BLACQList Page is the central product screen — the public-facing page for each business, professional, creative, event, or job listing. It is the destination of every sharing link, search result, and QR code the platform generates. It must load fast, be indexable by search engines, and display the full listing profile: cover image, name, trust badge, description, hours, contact information, links, services, and media gallery. This ticket implements the route, data fetch, TypeScript type, and Server Component for the listing page. UI sub-sections (gallery, review widget, related listings, save button) are implemented in separate follow-on tickets. Source: `docs/blacqlist/architecture/api-contract.md` → Endpoint 5 (Get Entity Page by Slug), `docs/blacqlist/data/database-schema-plan.md` → listings, listing_details_business, listing_hours, listing_links, services, media_attachments tables.

## User Story

As a visitor, I want to view a complete, fast-loading public page for a Black-owned business, so that I can learn about the business, find its hours and contact info, and decide whether to visit or hire them.

## Scope

- `app/[city-slug]/[entity-type]/[listing-slug]/page.tsx` — Server Component with `export const revalidate = 3600` (1-hour ISR)
- `generateStaticParams()` — queries all published listings at build time to pre-render pages; `dynamicParams = true` for listings added after build
- `generateMetadata()` — per-listing SEO title, description, OG image, canonical URL, noindex flag
- `lib/data/listings.ts` — `getListingPageData()` server-side data function that queries all required tables and returns a `ListingPageData` typed object
- `types/listing.ts` — TypeScript interface `ListingPageData` matching the API contract response shape from Endpoint 5
- Page layout sections rendered from data: cover image hero, trust badge + listing name + category, about/description section, business hours table, contact information card (phone, email, address, website, social links), primary CTA button
- `notFound()` call when listing is not published, soft-deleted, or `flag_status !== 'none'`
- 301 redirect when `city-slug` or `entity-type` in the URL path do not match the listing's stored values
- `listing_page_viewed` analytics event emitted via a fire-and-forget server-side call after data fetch
- Cache tag `listing-${id}` for targeted ISR invalidation via `revalidateTag`
- JSON-LD `LocalBusiness` schema in `<head>` via `generateMetadata` script injection

## Out of Scope

- Services section UI (separate ticket — depends on this data layer existing)
- Media gallery carousel (separate ticket)
- Review submission widget and review list (separate ticket)
- "More like this" / Related listings section (separate ticket)
- Save button (Ticket 015 for save server action; separate UI integration ticket)
- Edit mode / owner draft preview (owner dashboard ticket)
- Claim and verification CTAs (claim flow ticket)
- Admin moderation panel on the listing page (admin ticket)

## Dependencies

| Dependency                                                                                                                                 | Type            | Status      |
| ------------------------------------------------------------------------------------------------------------------------------------------ | --------------- | ----------- |
| Ticket 009 — Core entity tables (listings, cities, categories tables must exist)                                                           | Blocking ticket | Not started |
| Ticket 010 — Listing sub-tables migration (listing_details_business, listing_hours, listing_links, services, media_attachments must exist) | Blocking ticket | Not started |
| Ticket 013 — RLS policies (anonymous SELECT on published listings must be enabled)                                                         | Blocking ticket | Not started |
| Ticket 015 — App shell layout (root layout with nav and footer must exist)                                                                 | Blocking ticket | Done        |
| Ticket 019 — 404 / error boundary pages (listing-specific not-found.tsx must exist for notFound() to invoke the correct UI)                | Informs UX      | Not started |
| Ticket 001 — Next.js project initialization (project and Supabase client helper must exist)                                                | Blocking        | Done        |

**Risk:** `generateStaticParams` queries Supabase at build time. If Supabase is unavailable during CI/CD build, the build will fail. Add a `try/catch` that returns an empty array on error, allowing the build to succeed and falling back to on-demand SSR with `dynamicParams = true`.

## UX Notes

- **Screen:** BLACQList Page — full-bleed hero + constrained content layout
- **Route:** `/[city-slug]/[entity-type]/[listing-slug]`  
  Example: `/atlanta/business/beloved-bookstore`
- **Entry points:** Search results, homepage featured cards, city landing page cards, collection pages, direct URL, shared link, search engine organic result
- **Exit points:** CTA button (book, order, website), social links, share action, save action (toggle), back to search/discover, related listings
- **Mobile behavior at 375px:**
  - Cover image hero: 280px tall (vs 400px on desktop), full bleed to screen edge
  - Listing name and trust badges stack vertically
  - Content layout: single column (no sidebar split on mobile)
  - Contact card: full-width, stacked rows
  - Hours table: full-width, readable at small size
  - Primary CTA button: full-width, sticky to bottom of viewport on mobile

### BLACQList Page Layout (top to bottom)

1. **Cover image hero** — Full-bleed, 400px tall desktop / 280px mobile. If no cover image: gradient placeholder using brand colors. Logo badge overlaid at bottom-left of hero.
2. **Listing header** — Trust tier badge (`unclaimed` / `claimed` / `verified` / `certified`), listing name in Glacial Indifference, category + city pills, `avg_rating` star row (if reviews exist), save button
3. **About section** — `details.description` rendered as rich text (sanitized HTML or plain text per what is stored); section heading "About [Name]"
4. **Business hours** — `listing_hours` rows rendered as a weekly table; today's day highlighted; "Closed" shown for `is_closed = true` rows
5. **Contact card** — address (formatted), phone (formatted as tel: link), email (mailto: link), website URL (external link), social links row (icons: Instagram, TikTok, Facebook, LinkedIn, YouTube, X)
6. **Primary CTA button** — derived from `details.cta_type` and `details.cta_url`; label defaults to type ("Book Now", "Order Online", "Visit Website", "Get a Quote", "Apply Now", "Get Directions"); Amber Gold, full-width on mobile, centered on desktop

## Design Notes

- **Design brief:** `docs/blacqlist/design/design-brief.md`
- **Cover image hero:**
  - Container: `relative w-full h-[280px] md:h-[400px] overflow-hidden`
  - Image: `next/image` with `fill`, `object-fit: cover`, `priority` (LCP element)
  - Gradient fallback: `bg-gradient-to-br from-[#19191E] to-[#595758]` if no cover image
  - Logo badge: `absolute bottom-4 left-4 w-16 h-16 rounded-xl bg-white shadow-lg object-cover`
- **Listing name:** `font-headline text-3xl md:text-4xl font-bold text-black`
- **Trust tier badges:**
  - `unclaimed`: `bg-gray-100 text-gray-600 text-xs font-medium px-3 py-1 rounded-full`
  - `claimed`: `bg-[#E9E9F7] text-[#595758] text-xs font-medium px-3 py-1 rounded-full`
  - `verified`: `bg-[#E2A428]/10 text-[#E2A428] text-xs font-bold px-3 py-1 rounded-full`
  - `certified`: `bg-[#E2A428] text-black text-xs font-bold px-3 py-1 rounded-full`
- **Category pill:** `bg-[#FCFAF4] text-[#595758] text-xs px-3 py-1 rounded-full border border-gray-200`
- **About section:** `max-w-3xl` prose block. Heading `text-xl font-bold text-black font-headline`. Body `text-base leading-relaxed text-[#595758]`
- **Hours table:** `w-full text-sm`. Row for today: `font-bold text-black`. Other rows: `text-[#595758]`. "Open" / "Closed" status shown.
- **Contact card:** `bg-white rounded-2xl p-6 shadow-sm`. Each row: icon (24px, Amber Gold) + text. Phone and email are `<a>` elements with `tel:` and `mailto:` schemes.
- **Primary CTA:** `w-full md:w-auto bg-[#E2A428] text-black font-bold px-8 py-4 rounded-full text-lg hover:bg-[#FFD867]`. Mobile: sticky `fixed bottom-4 left-4 right-4`.
- **Content layout:** `grid grid-cols-1 md:grid-cols-3 gap-8`. About + hours: `md:col-span-2`. Contact card + CTA: `md:col-span-1`.
- **Page background:** `bg-white` within `max-w-5xl mx-auto`
- **Components to use:** `next/image` for cover and logo images, shadcn/ui `Badge` for trust tier badges, `Button` for CTA, `Card` and `CardContent` for contact card

## Data Notes

- **Data model:** `docs/blacqlist/data/database-schema-plan.md` — `listings`, `listing_details_business`, `listing_hours`, `listing_links`, `services`, `media_attachments`, `categories`, `cities`
- **Tables read:** All of the above — joined in `getListingPageData()`
- **Operations:** SELECT only — all server-side in the page component via `getListingPageData()`
- **Validation rules from data model:**
  - Anonymous access: `listings.status = 'published' AND listings.deleted_at IS NULL AND listings.flag_status = 'none'`
  - Owner access: additionally allows `status = 'draft'` or `status = 'pending'` for `owner_user_id = auth.uid()` (owner preview — implement in a later owner ticket, not here)
  - Services: filter to `is_visible = true` for anonymous requests
- **RLS policies (Ticket 013):** Anonymous Supabase client query — RLS policies on `listings` and listing sub-tables enforce the published filter automatically. The `getListingPageData()` function uses the anonymous client for this reason; it must not use the service role key.
- **Migration required:** No — requires migrations from Tickets 009 and 010 to be applied first

### `getListingPageData()` Query Strategy

The function performs a single Supabase query with selects across related tables, not multiple separate queries:

```typescript
const { data, error } = await supabase
  .from('listings')
  .select(
    `
    *,
    categories ( id, name, slug ),
    cities ( id, name, slug ),
    listing_details_business ( * ),
    listing_hours ( * ),
    listing_links ( * ),
    services ( * ),
    media_attachments ( id, file_path, alt_text, display_order, width, height )
  `
  )
  .eq('slug', listingSlug)
  .eq('status', 'published')
  .is('deleted_at', null)
  .eq('flag_status', 'none')
  .single()
```

Services must be filtered to `is_visible = true` after the join (`.filter('services.is_visible', 'eq', true)` syntax may vary by Supabase client version — apply in-memory filter as fallback).

## API Notes

- **API contract:** `docs/blacqlist/architecture/api-contract.md` → Section 5 — Get Entity Page by Slug
- **Endpoint involved:**
  - `GET /api/listings/[city-slug]/[entity-type]/[listing-slug]` — full listing page data
- **Auth required:** No for anonymous public view
- **Implementation note:** At MVP, the data fetch is done directly in the Server Component via `lib/data/listings.ts` — not through the `/api/listings/...` Route Handler. The Route Handler will be implemented separately for external API consumers. The Server Component calls `getListingPageData()` directly for performance.
- **Error codes to handle:**
  - `NOT_FOUND` (listing doesn't exist or isn't published) → call `notFound()` from `next/navigation`
  - `WRONG_ENTITY_TYPE` (URL slug params don't match stored entity_type/city_slug) → call `redirect(correctUrl, 301)` from `next/navigation`
- **Analytics event:** After data fetch, fire-and-forget: `emitAnalyticsEvent('listing_page_viewed', { listing_id, entity_type, trust_tier, referrer: headers().get('referer') })` — this must not block page render

## Implementation Notes

**Files to create:**

- `app/[city-slug]/[entity-type]/[listing-slug]/page.tsx` — Server Component
- `lib/data/listings.ts` — `getListingPageData(params)` function
- `types/listing.ts` — `ListingPageData` TypeScript interface (matches Endpoint 5 response shape)

**Files to modify:**

- `app/[city-slug]/[entity-type]/[listing-slug]/loading.tsx` — (if Ticket 019 was implemented first) confirm `ListingPageSkeleton` layout matches the actual page layout

**`types/listing.ts` — Core type:**

```typescript
export interface ListingPageData {
  listing: {
    id: string
    name: string
    slug: string
    entity_type: 'business' | 'professional' | 'creative' | 'event' | 'job' | 'vendor'
    tagline: string | null
    status: string
    trust_tier: 'unclaimed' | 'claimed' | 'verified' | 'certified'
    listing_tier: 'free' | 'standard' | 'premium'
    logo_path: string | null
    cover_image_path: string | null
    avg_rating: number | null
    review_count: number
    save_count: number
    published_at: string | null
    noindex: boolean
    canonical_url: string | null
    meta_title: string | null
    meta_description: string | null
    og_image_path: string | null
    flag_status: string
    city: { id: string; name: string; slug: string } | null
    category: { id: string; name: string; slug: string }
  }
  details: {
    description: string | null
    hours_notes: string | null
    address_line_1: string | null
    address_line_2: string | null
    city_text: string | null
    state: string | null
    zip: string | null
    phone: string | null
    email: string | null
    website_url: string | null
    social_instagram: string | null
    social_facebook: string | null
    social_linkedin: string | null
    social_tiktok: string | null
    social_youtube: string | null
    social_twitter: string | null
    cta_type: string
    cta_url: string | null
    cta_label_override: string | null
    price_range: '$' | '$$' | '$$$' | '$$$$' | null
    founded_year: number | null
  } | null
  media: Array<{
    id: string
    file_path: string
    alt_text: string | null
    display_order: number
    width: number | null
    height: number | null
  }>
  services: Array<{
    id: string
    name: string
    description: string | null
    price: number | null
    price_type: 'fixed' | 'starting-at' | 'hourly' | 'custom' | 'free' | null
    price_note: string | null
    duration_minutes: number | null
    cta_type: string | null
    cta_url: string | null
    display_order: number
    is_visible: boolean
  }>
  listing_hours: Array<{
    day_of_week: number
    open_time: string | null
    close_time: string | null
    is_closed: boolean
    notes: string | null
  }>
  listing_links: Array<{
    platform: string
    url: string
    display_order: number
  }>
  is_saved: boolean
}
```

**`lib/data/listings.ts` — `getListingPageData()` pattern:**

```typescript
import { createServerComponentClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { ListingPageData } from '@/types/listing'

export async function getListingPageData(params: {
  citySlug: string
  entityType: string
  listingSlug: string
}): Promise<ListingPageData> {
  const supabase = createServerComponentClient()

  const { data, error } = await supabase
    .from('listings')
    .select(
      `
      id, name, slug, entity_type, tagline, status, trust_tier, tier,
      logo_path, cover_image_path, avg_rating, review_count, save_count,
      published_at, noindex, canonical_url, meta_title, meta_description,
      og_image_path, flag_status,
      categories ( id, name, slug ),
      cities ( id, name, slug ),
      listing_details_business ( * ),
      listing_hours ( day_of_week, open_time, close_time, is_closed, notes ),
      listing_links ( platform, url, display_order ),
      services ( id, name, description, price, price_type, price_note, duration_minutes, cta_type, cta_url, display_order, is_visible ),
      media_attachments ( id, file_path, alt_text, display_order, width, height )
    `
    )
    .eq('slug', params.listingSlug)
    .is('deleted_at', null)
    .single()

  if (error || !data) {
    notFound()
  }

  // RLS already enforces published filter for anon — extra safety check
  if (data.status !== 'published' || data.flag_status !== 'none') {
    notFound()
  }

  // 301 redirect if city or entity_type in URL don't match stored values
  const citySlugFromData = data.cities?.slug
  if (citySlugFromData && citySlugFromData !== params.citySlug) {
    redirect(`/${citySlugFromData}/${data.entity_type}/${data.slug}`, 301)
  }
  if (data.entity_type !== params.entityType) {
    redirect(`/${params.citySlug}/${data.entity_type}/${data.slug}`, 301)
  }

  return {
    listing: {
      ...data,
      city: data.cities ?? null,
      category: data.categories,
      listing_tier: data.tier,
    },
    details: data.listing_details_business ?? null,
    media: (data.media_attachments ?? []).sort((a, b) => a.display_order - b.display_order),
    services: (data.services ?? [])
      .filter((s) => s.is_visible)
      .sort((a, b) => a.display_order - b.display_order),
    listing_hours: (data.listing_hours ?? []).sort((a, b) => a.day_of_week - b.day_of_week),
    listing_links: (data.listing_links ?? []).sort((a, b) => a.display_order - b.display_order),
    is_saved: false, // anonymous; implement saved state in save button ticket
  }
}
```

**`app/[city-slug]/[entity-type]/[listing-slug]/page.tsx` — Page Component pattern:**

```typescript
import { getListingPageData } from '@/lib/data/listings'
import { generateListingMetadata } from '@/lib/seo/listing'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Image from 'next/image'
import { supabase as publicClient } from '@/lib/supabase/public'

export const revalidate = 3600
export const dynamicParams = true

export async function generateStaticParams() {
  try {
    const { data } = await publicClient
      .from('listings')
      .select('slug, entity_type, cities ( slug )')
      .eq('status', 'published')
      .is('deleted_at', null)
      .eq('flag_status', 'none')
      .limit(1000)

    return (data ?? []).map((listing) => ({
      'city-slug': listing.cities?.slug ?? 'unknown',
      'entity-type': listing.entity_type,
      'listing-slug': listing.slug,
    }))
  } catch {
    return [] // Fail open — on-demand rendering for all routes
  }
}

export async function generateMetadata({ params }: { params: {
  'city-slug': string
  'entity-type': string
  'listing-slug': string
} }): Promise<Metadata> {
  // Re-fetch just the fields needed for metadata — not the full page data
  // Or call getListingPageData and cache the result via React cache()
  // See "Key patterns" note below
}

export default async function ListingPage({ params }: { params: {
  'city-slug': string
  'entity-type': string
  'listing-slug': string
} }) {
  const data = await getListingPageData({
    citySlug: params['city-slug'],
    entityType: params['entity-type'],
    listingSlug: params['listing-slug'],
  })

  const { listing, details } = data

  // Resolve media URLs at render time (never store full URLs in DB)
  const coverImageUrl = listing.cover_image_path
    ? publicClient.storage.from('listing-media').getPublicUrl(listing.cover_image_path).data.publicUrl
    : null
  const logoUrl = listing.logo_path
    ? publicClient.storage.from('listing-media').getPublicUrl(listing.logo_path).data.publicUrl
    : null

  return (
    <main id="main-content">
      {/* Cover Image Hero */}
      <div className="relative w-full h-[280px] md:h-[400px] overflow-hidden bg-gradient-to-br from-[#19191E] to-[#595758]">
        {coverImageUrl && (
          <Image
            src={coverImageUrl}
            alt={`${listing.name} cover image`}
            fill
            className="object-cover"
            priority
          />
        )}
        {logoUrl && (
          <div className="absolute bottom-4 left-4">
            <Image
              src={logoUrl}
              alt={`${listing.name} logo`}
              width={64}
              height={64}
              className="rounded-xl bg-white shadow-lg object-cover"
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Listing header */}
        <header className="mb-8">
          <TrustBadge tier={listing.trust_tier} />
          <h1 className="font-headline text-3xl md:text-4xl font-bold text-black mt-2">
            {listing.name}
          </h1>
          {listing.tagline && (
            <p className="text-[#595758] text-lg mt-1">{listing.tagline}</p>
          )}
          <div className="flex gap-2 mt-3 flex-wrap">
            <CategoryPill name={listing.category.name} slug={listing.category.slug} />
            {listing.city && (
              <CityPill name={listing.city.name} slug={listing.city.slug} />
            )}
          </div>
        </header>

        {/* Main content grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left: About + Hours */}
          <div className="md:col-span-2 space-y-8">
            {details?.description && (
              <section aria-label="About">
                <h2 className="font-headline text-xl font-bold text-black mb-3">
                  About {listing.name}
                </h2>
                <p className="text-base leading-relaxed text-[#595758]">
                  {details.description}
                </p>
              </section>
            )}
            {data.listing_hours.length > 0 && (
              <BusinessHoursTable hours={data.listing_hours} />
            )}
          </div>

          {/* Right: Contact card + CTA */}
          <div className="space-y-4">
            {details && <ContactCard details={details} links={data.listing_links} />}
            {details?.cta_type && details?.cta_url && (
              <PrimaryCtaButton ctaType={details.cta_type} ctaUrl={details.cta_url} label={details.cta_label_override} />
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
```

**`generateMetadata` + `cache()` pattern — avoid double fetch:**

```typescript
import { cache } from 'react'
const getCachedListingData = cache(getListingPageData)

// Use getCachedListingData in both generateMetadata and the page component
// React cache() deduplicates the Supabase call within a single request
```

**`generateMetadata` SEO output:**

```typescript
export async function generateMetadata({ params }): Promise<Metadata> {
  const data = await getCachedListingData({ ... }).catch(() => null)
  if (!data) return { title: 'Not found', robots: { index: false } }

  const { listing } = data
  const title = listing.meta_title ?? `${listing.name} — ${listing.category.name} in ${listing.city?.name ?? ''} — The BLACQList`
  const description = listing.meta_description ?? `Discover ${listing.name}, a Black-owned ${listing.category.name} in ${listing.city?.name ?? ''}.`

  return {
    title,
    description,
    robots: { index: !listing.noindex, follow: !listing.noindex },
    openGraph: {
      title,
      description,
      type: 'website',
      url: listing.canonical_url ?? undefined,
    },
    alternates: {
      canonical: listing.canonical_url ?? undefined,
    },
  }
}
```

**JSON-LD LocalBusiness schema:**

Inject via a `<script type="application/ld+json">` in the page component's return (not `generateMetadata`):

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': listing.json_ld_type ?? 'LocalBusiness',
      name: listing.name,
      url: details?.website_url ?? listing.canonical_url,
      telephone: details?.phone,
      address: details?.address_line_1
        ? {
            '@type': 'PostalAddress',
            streetAddress: details.address_line_1,
            addressLocality: details.city_text ?? listing.city?.name,
            addressRegion: details.state,
            postalCode: details.zip,
          }
        : undefined,
      aggregateRating: listing.avg_rating
        ? {
            '@type': 'AggregateRating',
            ratingValue: listing.avg_rating,
            reviewCount: listing.review_count,
          }
        : undefined,
    }),
  }}
/>
```

**Sub-components to create (stub implementations acceptable at this ticket stage):**

- `components/listing/TrustBadge.tsx` — receives `tier` prop, renders the correct badge variant
- `components/listing/CategoryPill.tsx` — small pill linking to `/discover?category=[slug]`
- `components/listing/CityPill.tsx` — small pill linking to `/city/[slug]`
- `components/listing/BusinessHoursTable.tsx` — weekly hours table, highlights today
- `components/listing/ContactCard.tsx` — address, phone, email, website, social links
- `components/listing/PrimaryCtaButton.tsx` — Amber Gold CTA, full-width on mobile with sticky behavior

**Key patterns:**

- Use `export const revalidate = 3600` (1 hour ISR) — not `getStaticProps`
- Use `export const dynamicParams = true` — new listings added after build render on first request and are then cached
- Use `React.cache()` to deduplicate the `getListingPageData` call between `generateMetadata` and the page component within a single request — this is critical to avoid two Supabase roundtrips per page load
- `getListingPageData` uses the anonymous Supabase client — RLS filters apply automatically; never use the service role key here
- `notFound()` is called server-side (no try/catch suppression) — Next.js propagates it to the nearest `not-found.tsx`
- `redirect(url, 301)` from `next/navigation` handles canonical URL correction (wrong city-slug or entity-type in URL)
- All storage paths are converted to public URLs at render time via `getPublicUrl()` — never stored as full URLs in the database
- `generateStaticParams` limit of 1000 listings at MVP — increase when listing count grows; Vercel ISR handles on-demand pages beyond this

**Do not:**

- Call `supabase.auth.getUser()` in this page's Server Component — this page is public and anonymous; auth is not needed for the public view
- Use `useEffect` or client-side data fetching for the listing data — all fetching happens server-side
- Store full CDN URLs in state or variables — always derive them from storage paths at render time
- Render raw HTML from `details.description` without sanitization if the field is allowed to contain HTML (at MVP, treat as plain text)
- Implement the save button state (`is_saved`) with real auth data in this ticket — leave `is_saved: false` as a placeholder; the save button integration is a separate ticket

## Acceptance Criteria

- [ ] Navigating to `/atlanta/business/beloved-bookstore` (with a seeded listing at that slug) renders the full listing page with cover image hero, listing name in Glacial Indifference, trust tier badge, category and city pills, description, hours table, contact card, and primary CTA button
- [ ] `generateStaticParams` returns an array of params for all published listings — confirmed by checking Next.js build output
- [ ] `dynamicParams = true` allows a listing URL not in `generateStaticParams` to render on first request (confirmed by adding a new listing and hitting its URL without rebuilding)
- [ ] `generateMetadata` returns per-listing `<title>` and `<meta name="description">` using `listing.meta_title` and `listing.meta_description` when set, with correct fallback format when null
- [ ] Listing with `noindex = true` has `<meta name="robots" content="noindex,nofollow">` in the page `<head>`
- [ ] `canonical_url` set in the listing is output as `<link rel="canonical">` in the `<head>`
- [ ] Navigating to a URL where `entity-type` does not match the listing's stored `entity_type` results in a 301 redirect to the correct canonical URL
- [ ] Navigating to an unknown slug triggers `notFound()` and renders the listing-specific 404 page from Ticket 019
- [ ] Cover image uses `next/image` with `priority` prop (LCP optimization) — no `<img>` element used directly
- [ ] Storage paths are resolved to public URLs via `getPublicUrl()` at render time — no raw storage paths appear in rendered HTML
- [ ] Business hours table highlights the current day of the week
- [ ] JSON-LD `LocalBusiness` script tag is present in the rendered page `<head>` with correct `name`, `telephone`, and `address` fields
- [ ] Page renders correctly at 375px — single column layout, cover hero 280px tall, CTA button full-width

## Failure States

| Failure                                       | Condition                                                          | User sees                                                                                    | Recovery                                                                      |
| --------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Listing not found                             | Slug does not exist in `listings` table                            | Listing-specific 404 page from Ticket 019                                                    | User can search or browse from 404 CTA                                        |
| Listing is soft-deleted                       | `deleted_at IS NOT NULL` — RLS hides the row                       | 404 page (RLS returns no row, treated as not found)                                          | N/A — intentional                                                             |
| Listing unpublished or flagged                | `status != 'published'` or `flag_status != 'none'`                 | 404 page                                                                                     | Admin must re-publish or clear flag                                           |
| Wrong entity-type in URL                      | URL has `/business/` but listing is `entity_type = 'professional'` | 301 redirect to correct URL                                                                  | Redirect resolves automatically                                               |
| Cover image storage path returns 404          | Image deleted from Supabase Storage bucket                         | Gradient fallback background renders                                                         | No action needed — fallback is branded                                        |
| Supabase outage during `generateStaticParams` | Build-time query fails                                             | Empty array returned — all routes fall back to on-demand ISR                                 | Pages render on first visit; cached after first render                        |
| `details` row missing for a published listing | `listing_details_business` row not created                         | About section, hours, and contact card are hidden; listing name and trust badge still render | Owner must complete their profile; moderation queue flags incomplete listings |

## Edge Cases

- Listing with no `cover_image_path` — gradient placeholder renders; no broken image shown
- Listing with no `listing_hours` rows — hours section is hidden entirely; no "hours not available" message shown to public (owner must add hours)
- Listing with no `details.description` — about section is hidden entirely; page renders without it
- Listing where `details.cta_type = 'none'` or `details.cta_url = null` — primary CTA button is not rendered; no broken button
- Two different slugs resolving to the same listing content (historical slug redirect) — `canonical_url` in the listing resolves this at the SEO layer; the 301 redirect logic handles URL mismatches
- Listing with very long `name` (50+ characters) — heading wraps gracefully at all breakpoints; `word-break: break-word` on h1 prevents overflow
- `avg_rating` is `null` when no reviews exist — star row is hidden; do not render "0 stars" or "0 reviews"
- User navigates to listing page during Supabase downtime — Server Component throws; root error boundary from Ticket 019 catches and renders the error page with retry

## Accessibility Notes

- [ ] `<h1>` is the listing name — only one `<h1>` per page
- [ ] Cover image has descriptive `alt` text: `"[listing name] cover image"`
- [ ] Logo image has descriptive `alt` text: `"[listing name] logo"`
- [ ] If cover image is missing (gradient fallback), the `<div>` background has `role="img"` and `aria-label="[listing name] cover photo"`
- [ ] Trust tier badge is a `<span>` with `aria-label` describing the tier meaning (e.g., `aria-label="BLACQList Verified"`)
- [ ] Business hours table uses `<table>` with `<caption>` "Business Hours", `<th scope="row">` for day names, `<td>` for open/close times
- [ ] Contact card phone link: `<a href="tel:+1...">` with visually shown formatted number
- [ ] Contact card email link: `<a href="mailto:...">` with the email address visible
- [ ] External website and social links use `target="_blank" rel="noopener noreferrer"` with `aria-label` indicating they open in a new window
- [ ] Primary CTA button in sticky mobile position does not overlap important page content — ensure sufficient bottom padding on the content area

## QA Test Cases

| #    | Scenario                     | Role      | Steps                                                                                           | Expected result                                                                                                                               |
| ---- | ---------------------------- | --------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| QA-1 | Listing page renders         | Anonymous | Seed a published listing; navigate to its URL                                                   | All page sections render: hero, listing header (name + trust badge + category), about, hours, contact card                                    |
| QA-2 | SEO metadata                 | Anonymous | Navigate to a listing; view page source                                                         | `<title>` matches `meta_title` or falls back to format `"[name] — [category] in [city] — The BLACQList"`; `<meta name="description">` present |
| QA-3 | 404 for unpublished listing  | Anonymous | Navigate to URL of a draft listing                                                              | Listing-specific 404 page renders ("This business page isn't available.")                                                                     |
| QA-4 | Entity-type redirect         | Anonymous | Navigate to `/atlanta/business/[slug]` where the listing's actual entity_type is `professional` | 301 redirect to `/atlanta/professional/[slug]`; final page renders correctly                                                                  |
| QA-5 | Storage path resolved to URL | Anonymous | Inspect rendered HTML for a listing with a cover image                                          | `<img>` src is a full Supabase CDN URL, not a raw storage path                                                                                |
| QA-6 | Listing page at 375px        | Anonymous | Set viewport to 375px; load a listing page                                                      | Single column layout; hero 280px tall; CTA full-width; no horizontal overflow                                                                 |
| QA-7 | JSON-LD present              | Anonymous | View page source; search for `application/ld+json`                                              | JSON-LD script tag present with correct `name` and `@type` values                                                                             |

## Security Notes

- `getListingPageData` uses the anonymous Supabase client — RLS enforces the published filter at the database layer. Do not use the service role key for public listing page data.
- `owner_user_id` is never included in the `ListingPageData` type for anonymous requests — it is not selected in the query. If owner preview (draft view) is implemented later, it must be a separate authenticated function.
- `details.description` must be treated as plain text at MVP — do not render it as HTML via `dangerouslySetInnerHTML` without a sanitization step (e.g., DOMPurify). If rich text is needed, implement sanitization first.
- JSON-LD `dangerouslySetInnerHTML` is acceptable only because the data comes from the server-side database, not from user-controlled inputs rendered directly. Confirm all JSON-LD fields are server-sourced before using `dangerouslySetInnerHTML`.
- The `redirect()` call for canonical URL correction uses a 301 (permanent redirect) — confirm this is appropriate and not exploitable for open redirect (all redirect targets are derived from database values, not user-provided URL parameters).

## Completion Checklist

- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] `generateStaticParams` tested — build output shows pre-rendered listing routes
- [ ] `dynamicParams = true` tested — new listing URL renders on first request
- [ ] `notFound()` tested — invalid slug renders listing-specific 404
- [ ] 301 redirect tested — wrong entity-type in URL redirects to correct canonical URL
- [ ] Cover image missing fallback tested — gradient placeholder renders without errors
- [ ] ISR tested — after `revalidateTag('listing-[id]')` call, updated listing data appears within cache TTL
- [ ] JSON-LD verified in page source
- [ ] Mobile tested at 375px — single column, hero height, CTA behavior
- [ ] Keyboard navigation tested — all interactive elements reachable
- [ ] Accessibility requirements met — single h1, cover image alt, hours table markup, external link attributes
- [ ] Update `ListingPageSkeleton.tsx` (Ticket 019) to match final page layout if layout differs from Ticket 019 assumptions
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
