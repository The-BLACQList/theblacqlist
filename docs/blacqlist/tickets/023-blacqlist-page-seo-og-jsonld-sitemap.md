# Ticket 023: Business BLACQList Page — SEO Metadata, OG Image, JSON-LD, Sitemap

**Ticket ID:** BLACQ-023
**Title:** Business BLACQList Page: SEO metadata, OG image, JSON-LD, and sitemap
**Type:** Feature
**Priority:** P1 — Critical
**Estimate:** M (2–4h)
**Status:** Backlog
**Phase:** Phase 3: Entity Pages as BLACQList Micro-Websites
**Feature Area:** SEO / BLACQList Page

---

## Context

Search discoverability is a core distribution channel for The BLACQList. Every business page must be a first-class SEO asset — with a unique title, description, canonical URL, Open Graph metadata for social sharing, and JSON-LD structured data for Google rich results. Without this, pages cannot be found by the users the platform is built to serve. This ticket also implements the platform sitemap and robots.txt, which are required before any SEO-targeted page goes live.

Source artifacts:
- `docs/blacqlist/ux/mvp-screen-map.md` — Business BLACQList Page SEO spec: title format, JSON-LD type, OG image note
- `docs/blacqlist/architecture/api-contract.md` — Endpoint 5: `listing.meta_title`, `listing.meta_description`, `listing.canonical_url`, `listing.og_image_path`, `listing.noindex`, `details.phone`, `details.address_*`, `details.hours`, `listing_links` (sameAs)
- `docs/blacqlist/design/blacqlist-page-design-system.md` — Brand colors and typography for OG image design

This ticket depends on Ticket 020 (listing page route and data fetching). It does not implement dynamic OG images for profiles other than listings.

---

## User Story

> As someone discovering The BLACQList via Google or social media, I want each business page to have an accurate title, description, and preview image, so that I can identify the business before clicking and am shown relevant content when links are shared.

---

## Scope

**In scope:**
- `generateMetadata()` export on `app/[city-slug]/business/[listing-slug]/page.tsx`: `title`, `description`, `openGraph` (title, description, image URL, type, url), `twitter` (card type), canonical URL (`alternates.canonical`), `robots` (index/noindex based on `listing.noindex`)
- Title format: `"[Business Name] — [Category Name] in [City Name] | The BLACQList"`
- Description: first 155 characters of `listing.meta_description` if set; otherwise first 155 characters of `details.description` if set; otherwise fallback template: `"Discover [Business Name], a [Category Name] business in [City Name]. Find contact info, hours, services, and more on The BLACQList."`
- OG image URL: dynamic route `GET /app/og/listing/[id]/route.ts` (see implementation notes); generates a branded image at render time using `@vercel/og` (`next/og`) with business name, category, city, and trust badge
- JSON-LD: `LocalBusiness` schema with `name`, `description`, `address` (`PostalAddress`), `telephone`, `openingHoursSpecification` (one entry per day from `listing_hours`), `image` (cover image CDN URL), `url` (canonical URL), `sameAs` (array of social link URLs from `listing_links`)
- `app/sitemap.ts`: generates sitemap XML with entries for all published listings — url (canonical `/[city-slug]/business/[listing-slug]`), lastmod (`listing.updated_at`), changefreq `'weekly'`, priority `0.8`. Paginated if record count exceeds 50,000 (use `generateSitemaps()`). ISR-compatible via `revalidate` export.
- `app/robots.ts`: allow `*` user-agent on all paths; disallow `/admin/`, `/dashboard/`, `/api/`; sitemap URL included
- Canonical URL is always the definitive slug path — if `listing.canonical_url` is set, use it; otherwise construct from `listing.city.slug`, `listing.entity_type`, `listing.slug`

**Out of scope:**
- OG images for city landing pages, collections, or user profiles (separate tickets)
- Schema.org for event, job, or professional entity types (Beta/V1)
- Google Search Console verification (deployment/ops concern)
- Per-page `robots` meta for admin or auth pages (handled by middleware)
- Structured data for reviews and ratings (V1, when reviews go live)

---

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| BLACQ-020: Listing page route and `EntityPageData` data fetch | Blocking ticket | Not started |
| `@vercel/og` or `next/og` installed in the project | Infrastructure | Must be installed |
| Listing `updated_at`, `city.slug`, `slug`, `entity_type`, `category.name`, `trust_tier` fields available from Endpoint 5 | Data contract | Defined in api-contract.md |
| All published listings accessible from Supabase for sitemap generation | Database | Must be queryable via service_role in `app/sitemap.ts` |
| Brand fonts available as static assets for OG image rendering | Design | Glacial Indifference Bold .woff2 or .ttf must be in `public/fonts/` |

---

## UX Notes

- **Screen:** Business BLACQList Page — search engines, social media share previews, and Google rich results
- **Flow reference:** `docs/blacqlist/ux/mvp-screen-map.md` → BLACQList Page SEO section
- **Entry points:** Google search results, Twitter/X share card, Facebook share preview, iMessage link preview
- **Exit points:** Click from search results or social card → page loads
- **No visible UI:** This ticket produces only metadata, structured data, and the sitemap — no visible user interface changes on the BLACQList Page itself. The OG image route produces a PNG image consumed by social platforms and search crawlers.
- **OG image visual spec:** 1200px × 630px. Background: Deep Background (`#19191E`). Left half: business name in Glacial Indifference Bold, 48px, White; category in Lato Regular 20px, Charcoal (`#595758`); city in Lato Regular 18px, Charcoal; trust badge as a pill (same color rules as the page badge). Right half: cover image at 560px × 630px, `object-fit: cover`, with a soft left-edge gradient fade. Bottom-left: BLACQList wordmark or "theblacqlist.com" in Lato Regular 16px Amber Gold. If no cover image: full-width branded background with centered layout.

---

## Design Notes

- **OG Image font loading:** `@vercel/og` supports loading fonts from the filesystem. Load Glacial Indifference Bold and Lato Regular from `public/fonts/`. Use `ArrayBuffer` fetched from `fs.readFileSync` (in Node.js Edge runtime, use `fetch` to the font URL) at route initialization.
- **OG Image trust badge:** Render as a `<div>` with inline styles (OG image generation uses JSX + inline styles, not Tailwind). Charcoal = `#595758`, Blue = `#3B82F6`, Amber Gold = `#E2A428`.
- **JSON-LD hours format:** `openingHoursSpecification` requires one entry per open day in the format `{ "@type": "OpeningHoursSpecification", "dayOfWeek": "https://schema.org/Monday", "opens": "09:00", "closes": "17:00" }`. Map `listing_hours` day_of_week (0–6) to schema.org day URLs. Omit days with `is_closed = true`.
- **No Tailwind in OG route:** The OG image route handler uses `ImageResponse` from `next/og` — Tailwind is not available. Use `style={{}}` objects only.

---

## Data Notes

- **Data model:** `docs/blacqlist/architecture/data-model.md` → `listings`, `listing_details_business`, `listing_hours`, `listing_links`
- **Entities involved:** All published listings (for sitemap); individual listing data (for `generateMetadata` and OG image)
- **Operations:**
  - `generateMetadata()`: reads from `EntityPageData` already fetched by the page component (no additional query — metadata is derived from existing data)
  - `app/sitemap.ts`: `SELECT id, slug, entity_type, city.slug as city_slug, updated_at FROM listings WHERE status = 'published' AND deleted_at IS NULL AND entity_type = 'business'` via Supabase service_role client. Paginated in batches of 10,000.
  - OG image route `GET /og/listing/[id]`: `SELECT listings.id, listings.name, listings.trust_tier, listings.cover_image_path, categories.name, cities.name FROM listings JOIN ... WHERE listings.id = $id AND status = 'published'`
- **Sitemap scale:** At launch, expected <1,000 listings. Pagination is implemented for future growth — use `generateSitemaps()` returning pages of 50,000 each.
- **RLS:** `app/sitemap.ts` uses service_role client (bypasses RLS). OG image route uses service_role for read-only listing lookup.
- **Migration required:** No.

---

## API Notes

- **API contract:** `docs/blacqlist/architecture/api-contract.md` — Endpoint 5 (listing data consumed by `generateMetadata`)
- **Endpoints involved:**
  - OG image route: `GET /og/listing/[id]` — this is a new Route Handler, not in the API contract. It is not a public-facing data API; it produces a PNG image for meta tag consumption.
  - Sitemap: `GET /sitemap.xml` — handled by Next.js `app/sitemap.ts` convention
  - Robots: `GET /robots.txt` — handled by Next.js `app/robots.ts` convention
- **Auth required:** No — OG image route, sitemap, and robots.txt are all public and unauthenticated
- **Error codes to handle:**
  - OG route `[id]` not found → return a generic branded fallback OG image (not a 404 — crawlers must always receive a valid image response)
  - `generateMetadata()` receives null description → use fallback template (no error thrown)

---

## Implementation Notes

**Files to create:**
- `app/og/listing/[id]/route.ts` — Route Handler that returns `ImageResponse` (PNG) for the listing OG image. Query: fetch listing by `id`, generate branded 1200×630 image with `ImageResponse` from `next/og`. Fallback: if listing not found or no cover image, render text-only branded image.
- `app/sitemap.ts` — Next.js sitemap convention. Exports default async function returning `MetadataRoute.Sitemap`. Queries all published business listings. Implements `generateSitemaps()` for pagination.
- `app/robots.ts` — Next.js robots convention. Returns `MetadataRoute.Robots` with `rules`, `sitemap` URL.
- `lib/seo/generateListingMetadata.ts` — Pure function: `(data: EntityPageData, baseUrl: string) => Metadata`. Derives title, description, OG, twitter, canonical, robots from `EntityPageData`.
- `lib/seo/generateListingJsonLd.ts` — Pure function: `(data: EntityPageData, baseUrl: string) => WithContext<LocalBusiness>` (using `schema-dts` types or plain object). Constructs `LocalBusiness` schema.

**Files to modify:**
- `app/[city-slug]/business/[listing-slug]/page.tsx` — Add `export async function generateMetadata(...)` that calls `generateListingMetadata()`. Add `<script type="application/ld+json">` in the page's `<head>` via Next.js `<Script>` strategy `beforeInteractive` or direct `<script>` tag in the `<head>` section (use `dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}`).

**Key patterns:**
- `generateMetadata()` in Next.js App Router receives `{ params }` — the same params used to fetch `EntityPageData`. To avoid a second database query, call the same `fetchListingPageData()` function used by the page. Next.js deduplicates `fetch()` calls with the same URL within a single render cycle via request memoization — ensure the data fetch is a `fetch()` call (not a direct Supabase client call) so memoization applies.
- OG image font loading: use `new URL('../../../../public/fonts/GlacialIndifference-Bold.woff2', import.meta.url)` in the route handler to load fonts as buffers for `ImageResponse`.
- JSON-LD injection: `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />` inside the page component's return. This is the Next.js App Router pattern for JSON-LD — no separate library required.
- Sitemap ISR: Export `export const revalidate = 3600` (1 hour) from `app/sitemap.ts`. For dynamic sitemap regeneration on new listing publish, also call `revalidatePath('/sitemap.xml')` from the admin publish action.
- OG image caching: Set `Cache-Control: public, max-age=3600, s-maxage=3600` response header in the OG route handler. OG images do not need to be real-time.

**Do not:**
- Add the `schema-dts` npm package unless it is already a project dependency — use typed plain objects if not.
- Use `dangerouslySetInnerHTML` for anything other than the JSON-LD `<script>` tag.
- Hardcode the base URL — read it from `process.env.NEXT_PUBLIC_SITE_URL` or Next.js `headers()`.

---

## Acceptance Criteria

- [ ] Given any published Business listing, the page `<title>` element is `"[Business Name] — [Category Name] in [City Name] | The BLACQList"`.
- [ ] Given a listing with `meta_description` set, the meta description tag uses that value (truncated to 155 chars). Given no `meta_description` but a `description`, the first 155 chars of `description` are used. Given neither, the fallback template is used.
- [ ] The `og:image` meta tag points to `/og/listing/[id]` and the OG image route returns a valid 1200×630 PNG with business name, category, city, and trust badge rendered on a branded background.
- [ ] The `og:url` meta tag equals the canonical URL in the format `https://theblacqlist.com/[city-slug]/business/[listing-slug]`.
- [ ] The `twitter:card` meta tag is `summary_large_image`.
- [ ] The page contains a `<script type="application/ld+json">` with valid `LocalBusiness` JSON-LD including name, description, address, telephone, openingHoursSpecification, image, url, and sameAs fields populated from listing data.
- [ ] Given a listing with `listing.noindex = true`, the page meta robots tag is `"noindex, nofollow"`. Given `noindex = false`, the tag is absent or `"index, follow"`.
- [ ] `GET /sitemap.xml` returns valid XML with at least one `<url>` entry for every published Business listing, each containing `<loc>` (canonical URL), `<lastmod>` (ISO 8601), `<changefreq>weekly</changefreq>`, and `<priority>0.8</priority>`.
- [ ] `GET /robots.txt` allows all crawlers on public pages and disallows `/admin/`, `/dashboard/`, and `/api/`. The sitemap URL is listed.
- [ ] Given the listing has a cover image, the OG image renders the cover image on the right half. Given no cover image, a text-only branded OG image renders with no broken image areas.
- [ ] The JSON-LD `openingHoursSpecification` includes entries only for days where `is_closed = false`.

---

## Failure States

| Failure | Condition | User sees | Recovery |
|---|---|---|---|
| `generateMetadata` receives null city | Listing has no city (online-only entity) | Title uses `"[Business Name] — [Category Name] | The BLACQList"` (city segment omitted) | Fallback title template handles null city |
| OG image route receives unknown listing ID | Listing not found or unpublished | Branded fallback OG image returned (200 OK with generic BLACQList branding) — no 404 | Fallback rendering path in OG route handler |
| Sitemap query times out | Database slow or unavailable | Next.js returns empty sitemap (not an error page) — crawlers get no URLs but do not error | Revalidation on next cycle |
| JSON-LD `openingHoursSpecification` has no open days | All days `is_closed = true` | JSON-LD omits `openingHoursSpecification` field entirely — still valid schema | Valid JSON-LD with reduced fields |
| Font file not found for OG image | Font path incorrect | OG image renders with system fallback font — not ideal but not a crash | Correct font path in environment setup |
| Description is null and fallback template references null city | Online-only listing | Fallback template uses "[City Name]" only when city is non-null; otherwise omits the city phrase | Null-safe template construction |

---

## Edge Cases

- Business name contains special characters (ampersand, quotes, angle brackets): JSON-LD must escape properly — use `JSON.stringify()` which handles this automatically. Meta title must not contain unescaped HTML — Next.js `Metadata` API handles this.
- Business name is very long (100+ chars): OG image must truncate business name at ~40 chars with ellipsis to prevent overflow in the 1200px image.
- Listing has no social links: `sameAs` field in JSON-LD is an empty array `[]` — omit the field entirely rather than including an empty array.
- City name or category name contains a slash: canonical URL construction must encode the slug, not the name. Slugs from the database are already URL-safe.
- Sitemap has more than 50,000 listings: `generateSitemaps()` is implemented from the start, but at launch this path is not exercised. Verify it compiles correctly.
- `listing.cover_image_path` exists but CDN returns 404: OG image route should handle image fetch failure gracefully and render the text-only fallback.

---

## Accessibility Notes

- This ticket produces no visible UI and therefore has no direct accessibility requirements.
- Ensure the JSON-LD `<script>` tag does not interfere with screen reader parsing — `type="application/ld+json"` tags are ignored by screen readers by specification.
- The OG image is consumed by social platforms and search engines, not by screen readers.

---

## QA Test Cases

| ID | Test | Steps | Expected |
|---|---|---|---|
| QA-023-1 | Page title format | Navigate to any published Business page, inspect `<title>` | Title matches `"[Business Name] — [Category Name] in [City Name] | The BLACQList"` |
| QA-023-2 | OG image renders | Navigate to `/og/listing/[id]` in the browser for a listing with a cover image | Returns 200 PNG, 1200×630, with business name, category, city visible, cover image on right half |
| QA-023-3 | OG image fallback | Navigate to `/og/listing/[non-existent-uuid]` | Returns 200 PNG with generic BLACQList branding — no 404, no crash |
| QA-023-4 | JSON-LD structure | Open a Business page, inspect the page source for `<script type="application/ld+json">`, paste into Google's Rich Results Test | Valid LocalBusiness schema with name, address, telephone, openingHours, image, url. No validation errors. |
| QA-023-5 | Robots.txt | Navigate to `/robots.txt` | File present, disallows `/admin/`, `/dashboard/`, `/api/`. Sitemap URL listed. |
| QA-023-6 | Sitemap | Navigate to `/sitemap.xml` | Valid XML with `<url>` entries for all published Business listings. Each entry has `<loc>`, `<lastmod>`, `<changefreq>`, `<priority>`. |
| QA-023-7 | noindex listing | Set `listing.noindex = true` for a test listing, load the page | `<meta name="robots" content="noindex, nofollow">` present in `<head>` |
| QA-023-8 | Meta description fallback | Load a listing page where `meta_description` is null but `description` is set | Meta description equals first 155 chars of `description` |

---

## Security Notes

- OG image route: query by `listing.id` (UUID from URL path). Validate UUID format before the database query — reject malformed UUIDs with the fallback image response (never expose a database error).
- JSON-LD is constructed server-side from trusted database values and serialized with `JSON.stringify()` — no opportunity for XSS via the data itself.
- `dangerouslySetInnerHTML` on the JSON-LD `<script>` tag is the correct and safe pattern when the content is `JSON.stringify()`-serialized server-side data. The `<script>` tag has `type="application/ld+json"` which browsers treat as non-executable data.
- Sitemap uses service_role client for the database query — ensure this code is in a Server Component or Route Handler, never exposed to the browser.

---

## Completion Checklist

- [ ] Acceptance criteria all pass
- [ ] `tsc --noEmit` — zero TypeScript errors
- [ ] `npm run lint` — zero lint errors
- [ ] Page title, description, OG tags verified via browser DevTools for a real listing
- [ ] OG image rendered and visually verified at `/og/listing/[id]`
- [ ] JSON-LD validated via Google Rich Results Test
- [ ] Sitemap XML validates (W3C sitemap validator or `curl /sitemap.xml` + manual review)
- [ ] Robots.txt verified for correct allow/disallow rules
- [ ] noindex listing tested
- [ ] Listing with null description — fallback meta description verified
- [ ] Listing with no cover image — OG image fallback verified
