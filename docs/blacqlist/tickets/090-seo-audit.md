# Ticket 090: SEO audit — `sitemap.xml`, `robots.txt`, Google Search Console submission

## Status
Draft

## Phase
Phase 17: Security, QA, Accessibility, Launch

## Priority
P1

## Feature Area
SEO

---

## Context

The BLACQList's long-term growth depends on organic search. Every BLACQList Page must be discoverable by Google. This requires: a valid sitemap with all published page URLs, a correctly configured `robots.txt`, verified OG tags on listing and city pages, JSON-LD LocalBusiness structured data on listing pages, and Google Search Console submission after production launch. This ticket conducts a pre-launch SEO audit, fixes any issues found, and documents the post-launch steps.

Source documents: `docs/blacqlist/architecture/production-architecture.md` § 2 (Frontend Architecture — ISR Strategy, OG Image Generation); Ticket 023 (SEO metadata, OG image, JSON-LD, sitemap); `docs/blacqlist/architecture/deployment-plan.md` § 7 (SEO section).

---

## User Story

As a potential user searching Google for Black-owned businesses in their city, I want The BLACQList's pages to appear in search results with correct titles, descriptions, and visual previews, so that they can discover the platform and the businesses listed on it.

---

## Scope

**In scope:**

**1. `sitemap.xml` verification and fixes**
- Verify `app/sitemap.ts` generates a valid XML sitemap accessible at `[production-url]/sitemap.xml`
- Required URL groups in the sitemap:
  - All published BLACQList Pages: `[domain]/[city-slug]/business/[listing-slug]`
  - All city pages: `[domain]/city/[city-slug]`
  - All city-category pages: `[domain]/city/[city-slug]/[category-slug]`
  - All published collection pages: `[domain]/collection/[slug]`
  - Static pages: `/`, `/discover`, `/for-business`, `/about`, `/privacy`, `/terms`
- Each URL must include `lastmod` (listing's `updated_at` for listing pages; static date for static pages)
- Sitemap must paginate if URL count approaches 50,000 (not expected at MVP but the code should handle it gracefully via sitemap index)
- Validate sitemap XML with an online validator (e.g., `xmlvalidator.net`) — no validation errors allowed

**2. `robots.txt` verification and fixes**
- Verify `app/robots.ts` generates the correct `robots.txt` accessible at `[production-url]/robots.txt`
- Required `Disallow` rules: `/admin`, `/dashboard`, `/account`, `/api`, `/sign-in`, `/sign-up`, `/onboarding`, `/reset-password`, `/verify-email`, `/claim`
- `Allow: /` for all other paths
- `Sitemap: https://theblacqlist.com/sitemap.xml` reference included
- Test that Googlebot is not blocked (`User-agent: *` must have `Disallow` only for authenticated/private paths)

**3. OG tag audit**
- Sample 10 published BLACQList Pages and 5 city pages
- For each, verify via `curl -A "facebookexternalhit/1.1" [url]` or a social preview tool (opengraph.xyz):
  - `og:title` — present, non-empty, matches page title
  - `og:description` — present, non-empty, unique per page
  - `og:image` — present, points to the OG image route (`/og/listing/[id]` or equivalent); image URL is accessible
  - `og:url` — present, matches the canonical URL
  - `twitter:card` — present (use `summary_large_image`)

**4. JSON-LD structured data spot-check**
- Spot-check 5 published BLACQList Pages using Google's Rich Results Test (search.google.com/test/rich-results)
- Verify `LocalBusiness` schema is present and valid: `@type`, `name`, `description`, `url`, `address`, `telephone` (if available), `openingHours` (if available), `image`
- Zero validation errors in the Rich Results Test for each checked page

**5. Canonical URL verification**
- Verify `<link rel="canonical" href="...">` is present on all entity pages, city pages, and static pages
- Canonical URL must match the clean production URL (not a URL with trailing slash, query string, or staging domain)

**6. Page title uniqueness check**
- Spot-check 10 different BLACQList Pages — each must have a unique `<title>` tag
- Format: `[Business Name] — [City] | The BLACQList`
- Homepage title: `The BLACQList — Discover Black-Owned Businesses`

**7. Post-launch: Google Search Console submission** (action items for after production deployment, not for staging)
- Submit sitemap URL to Google Search Console at `https://search.google.com/search-console`
- Document the property verification method used (HTML tag meta in root layout or DNS record)
- Request indexing for the homepage and 5 priority listing pages

**Out of scope:**
- Bing Webmaster Tools submission (deferred)
- Schema markup for non-listing pages (deferred)
- Search engine ranking analysis (V1 — requires live traffic data)

---

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| Ticket 023: BLACQList Page SEO metadata, OG image, JSON-LD, sitemap | Must be implemented and complete | In Progress |
| Ticket 027: City landing pages | Must exist for city page sitemap entries | In Progress |
| All BLACQList Page tickets (020–024) | Must be implemented for OG audit | In Progress |
| Staging environment with seed data | Infrastructure | Required |
| Production deployment (Ticket 092) | Required for Google Search Console submission | Must happen after this ticket's pre-launch work |

---

## UX Notes

No user-facing UI changes in this ticket. The only visible change is the addition of `<link rel="canonical">` tags if missing, and corrections to `<title>` or `<meta description>` values.

---

## Design Notes

No design changes.

---

## Data Notes

**`sitemap.ts` data queries:**
- `SELECT slug, city_id, updated_at FROM listings WHERE status = 'published' AND deleted_at IS NULL AND flag_status = 'none'` — for listing page URLs
- JOIN to `cities` to get `city_slug` for the URL construction
- `SELECT slug, updated_at FROM cities WHERE is_active = true` — for city pages
- `SELECT c.slug AS city_slug, cat.slug AS category_slug FROM listings l JOIN cities c ON l.city_id = c.id JOIN categories cat ON l.category_id = cat.id WHERE l.status = 'published' GROUP BY c.slug, cat.slug` — for city-category pages (distinct combinations only)
- `SELECT slug, updated_at FROM collections WHERE is_published = true` — for collection pages

All sitemap queries are public-safe (only published, non-deleted content). Use the Supabase anon client in `sitemap.ts`.

---

## API Notes

No new API endpoints. `sitemap.ts` and `robots.ts` are Next.js App Router built-in file conventions.

---

## Implementation Notes

**Files to modify:**
- `app/sitemap.ts` — verify and fix all URL groups; ensure `lastmod` is included; add pagination support (`generateSitemaps` function from Next.js for large sitemaps)
- `app/robots.ts` — verify all `Disallow` rules; add `Sitemap` reference

**Files to create:**
- `docs/blacqlist/launch/seo-audit-checklist.md` — completed checklist with pass/fail per item and notes on any issues found and resolved

**Sitemap pagination pattern (for future-proofing):**
```ts
// app/sitemap.ts — generate up to 1000 URLs per sitemap; use generateSitemaps for more
export async function generateSitemaps() {
  const listingCount = await getPublishedListingCount()
  const pages = Math.ceil(listingCount / 1000)
  return Array.from({ length: pages }, (_, i) => ({ id: i }))
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  const listings = await getPublishedListings({ offset: id * 1000, limit: 1000 })
  return listings.map(l => ({ url: `.../${l.slug}`, lastModified: l.updated_at }))
}
```

**OG audit tool command:**
```bash
curl -A "facebookexternalhit/1.1" https://staging.theblacqlist.com/atlanta-ga/business/sweet-auburn-bbq-atl \
  | grep -E "og:|twitter:|canonical"
```

**Rich Results Test:** Cannot be automated — must be run manually at search.google.com/test/rich-results for each of the 5 checked pages.

**Do not:**
- Include staging or preview URLs in the sitemap (sitemap must only reference production URLs)
- Include `/og/` image generation routes in the sitemap (these are not indexable pages)
- Disallow `/discover` or `/search` in `robots.txt` (these are public discovery pages that should be indexed)

---

## Acceptance Criteria

- [ ] `/sitemap.xml` accessible and valid XML at the staging (and later production) URL
- [ ] Sitemap includes all published listing pages, city pages, distinct city-category pages, published collections, and static pages
- [ ] Each sitemap entry includes a `lastmod` value
- [ ] `/robots.txt` accessible; disallows `/admin`, `/dashboard`, `/account`, `/api`, and auth routes
- [ ] `robots.txt` includes `Sitemap: [production-url]/sitemap.xml` reference
- [ ] OG audit: all 10 sampled listing pages have `og:title`, `og:description`, `og:image`, `og:url` present and non-empty
- [ ] OG images accessible: `GET [og:image URL]` returns a 200 response with `Content-Type: image/*`
- [ ] JSON-LD Rich Results Test: all 5 spot-checked listing pages pass with zero validation errors
- [ ] `<link rel="canonical">` present on all entity pages and city pages
- [ ] 10 spot-checked listing pages each have a unique `<title>` tag
- [ ] SEO audit checklist document written and committed to `docs/blacqlist/launch/seo-audit-checklist.md`
- [ ] Post-launch Google Search Console submission documented as an action item for launch day

---

## Failure States

| Failure | Resolution |
|---|---|
| Sitemap XML validation error | Fix the `sitemap.ts` output; re-validate |
| OG image returns 404 | Verify OG image route exists at `app/og/...`; check `next.config.ts` for route exclusions |
| JSON-LD Rich Results Test errors | Fix the `generateMetadata` function in the listing page component (Ticket 023) |
| Canonical URL points to staging domain | Update `NEXT_PUBLIC_APP_URL` env var; rebuild and retest |
| `robots.txt` blocks Googlebot from public pages | Remove incorrect `Disallow` rule; verify `Allow: /` is present |

---

## Edge Cases

- Listing with a slug containing special characters: verify the sitemap URL is properly encoded
- City-category combination with zero published listings: should not appear in the sitemap (the GROUP BY query handles this)
- Sitemap URL count exceeds 50,000 at some future date: the `generateSitemaps` pagination pattern handles this without code changes

---

## Accessibility Notes

This ticket has no direct accessibility impact. SEO metadata changes (`<title>`, `<meta description>`) may improve screen reader page identification.

---

## QA Test Cases

| # | Scenario | Role | Steps | Expected result |
|---|---|---|---|---|
| QA-1 | Sitemap valid XML | Developer | Navigate to `/sitemap.xml`; copy content; validate at xmlvalidator.net | Zero validation errors |
| QA-2 | Robots.txt correct | Developer | Navigate to `/robots.txt`; verify all Disallow rules | All private paths disallowed; `/discover`, `/search`, `city/` allowed |
| QA-3 | OG tags on listing page | Developer | Run curl OG audit command on 3 different listing pages | All four OG tags present and non-empty for each |
| QA-4 | JSON-LD structured data | Developer | Run Rich Results Test on one listing page | `LocalBusiness` schema present; zero validation errors |
| QA-5 | Canonical URL format | Developer | View source of any listing page; find `<link rel="canonical">` | URL matches production domain format; no trailing slash; no query string |

---

## Security Notes

The sitemap must not include URLs for private pages (dashboard, admin, account). Verify the sitemap generator excludes all non-public routes.

---

## Completion Checklist

- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] All four states implemented (loading, empty, error, success)
- [ ] Mobile tested at 375px
- [ ] Keyboard navigation tested
- [ ] Accessibility requirements met
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
