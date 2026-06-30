# SEO Audit Checklist — The BLACQList

**Audited:** 2026-05-18  
**Environment:** Staging (run against production after Ticket 092)  
**Status:** Pre-launch code fixes complete ✅ — manual verification steps pending until staging is live

---

## 1. `sitemap.xml`

| Item                                                    | Status               | Notes                                                                                             |
| ------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------- |
| Accessible at `/sitemap.xml`                            | ⬜ Verify on staging | Next.js App Router generates automatically                                                        |
| Published listing pages (`/[citySlug]/business/[slug]`) | ✅ Implemented       | `sitemap.ts` queries `listings` where `status='published'` and `deleted_at IS NULL`               |
| City landing pages (`/discover/[citySlug]`)             | ✅ Implemented       | Queries `cities` where `is_active=true`                                                           |
| Collection pages (`/collections/[slug]`)                | ✅ Added 2026-05-18  | Was missing — now queries `collections` where `is_active=true`                                    |
| City-category pages                                     | N/A                  | Category filtering uses query params (`?category=`), not separate URL routes — correctly excluded |
| Static pages (/, /discover, /for-business, etc.)        | ✅ Implemented       | Hard-coded in `staticRoutes`                                                                      |
| `lastmod` on all entries                                | ✅ Implemented       | Uses `updated_at` for dynamic pages; `now()` for static                                           |
| XML validation                                          | ⬜ Verify on staging | Use xmlvalidator.net                                                                              |
| No staging/preview URLs                                 | ✅                   | Uses `NEXT_PUBLIC_SITE_URL` env var                                                               |

---

## 2. `robots.txt`

| Item                         | Status               | Notes                                            |
| ---------------------------- | -------------------- | ------------------------------------------------ |
| Accessible at `/robots.txt`  | ⬜ Verify on staging |                                                  |
| `/admin/` disallowed         | ✅                   |                                                  |
| `/dashboard/` disallowed     | ✅                   |                                                  |
| `/account/` disallowed       | ✅                   |                                                  |
| `/api/` disallowed           | ✅                   |                                                  |
| `/auth/` disallowed          | ✅                   | Covers `/auth/callback`                          |
| `/onboarding/` disallowed    | ✅                   |                                                  |
| `/sign-in/` disallowed       | ✅ Added 2026-05-18  | Was missing                                      |
| `/sign-up/` disallowed       | ✅ Added 2026-05-18  | Was missing                                      |
| `/verify-email/` disallowed  | ✅ Added 2026-05-18  | Was missing                                      |
| `/claim/` disallowed         | ✅ Added 2026-05-18  | Was missing                                      |
| `/discover` allowed (public) | ✅                   | `Allow: /` covers it; no Disallow on `/discover` |
| `Sitemap:` reference         | ✅                   | Points to `${NEXT_PUBLIC_SITE_URL}/sitemap.xml`  |

---

## 3. OG Tag Audit (manual — run on staging)

Verify 10 published listing pages and 5 city pages using:

```bash
curl -A "facebookexternalhit/1.1" https://[staging-url]/[citySlug]/business/[slug] \
  | grep -E "og:|twitter:|canonical"
```

| Tag                          | Status              | Notes                                                       |
| ---------------------------- | ------------------- | ----------------------------------------------------------- |
| `og:title`                   | ✅ Implemented      | From `generateMetadata`                                     |
| `og:description`             | ✅ Implemented      | From `generateMetadata`                                     |
| `og:image`                   | ✅ Implemented      | Uses `cover_image_path` — verify URL returns 200 on staging |
| `og:url`                     | ✅ Added 2026-05-18 | Was missing — now set to canonical URL                      |
| `twitter:card`               | ✅ Added 2026-05-18 | Was missing — `summary_large_image`                         |
| Manual spot-check (10 pages) | ⬜ Pending staging  |                                                             |

---

## 4. JSON-LD Structured Data (manual — run on staging)

Test at: [search.google.com/test/rich-results](https://search.google.com/test/rich-results)

| Field                       | Status             | Notes                                        |
| --------------------------- | ------------------ | -------------------------------------------- |
| `@type: LocalBusiness`      | ✅ Implemented     | `buildJsonLd()` in entity page               |
| `name`                      | ✅                 |                                              |
| `description`               | ✅                 | Falls back to `tagline` if no description    |
| `url`                       | ✅                 | Uses `NEXT_PUBLIC_SITE_URL` + canonical path |
| `address`                   | ✅                 | Present when `details.address` is set        |
| `telephone`                 | ✅                 | Present when `details.phone` is set          |
| `aggregateRating`           | ✅                 | Present when `avg_rating > 0`                |
| Rich Results Test — 5 pages | ⬜ Pending staging | Zero errors required                         |

---

## 5. Canonical URLs

| Item                        | Status              | Notes                                                                  |
| --------------------------- | ------------------- | ---------------------------------------------------------------------- |
| Entity pages                | ✅ Added 2026-05-18 | `alternates.canonical` added to `generateMetadata`                     |
| City pages                  | ✅ Added 2026-05-18 | `alternates.canonical` added to city page `generateMetadata`           |
| No trailing slash           | ✅                  | Constructed without trailing slash                                     |
| No query string             | ✅                  | Canonical always uses clean path                                       |
| Points to production domain | ⬜ Verify env var   | Requires `NEXT_PUBLIC_SITE_URL=https://theblacqlist.com` in production |

---

## 6. Page Title Uniqueness

| Item                               | Status                  | Notes                                                       |
| ---------------------------------- | ----------------------- | ----------------------------------------------------------- |
| Entity page format                 | ✅                      | `[Business Name] \| The BLACQList`                          |
| City page format                   | ✅                      | `Black-Owned Businesses in [City, ST] \| The BLACQList`     |
| Homepage title                     | ⬜ Verify in layout.tsx | Expected: `The BLACQList — Discover Black-Owned Businesses` |
| Spot-check 10 pages for uniqueness | ⬜ Pending staging      |                                                             |

---

## 7. Post-Launch: Google Search Console (done 2026-06-30)

- [x] Create property — **Domain property** `theblacqlist.com`.
- [x] Verify ownership — **DNS record (Domain property)** method (chosen over the HTML-meta method since the gated site redirects the homepage to `/coming-soon`; DNS is gate-independent and covers the whole domain). No code change needed.
- [x] Submit `https://theblacqlist.com/sitemap.xml` — Status **Success**, **269 pages discovered**. (Domain property requires the full URL, not the bare path.)
- [ ] Request indexing for: homepage, priority listing pages, city pages — **after the public flip** (pages are discovered but won't index while the gate redirects Googlebot).
- [x] Verification method = DNS record (no meta tag needed; nothing to add to env checklist).

---

## Code Changes Made (2026-05-18)

| File                                             | Change                                                                       |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| `app/robots.ts`                                  | Added `/sign-in/`, `/sign-up/`, `/verify-email/`, `/claim/` to Disallow      |
| `app/sitemap.ts`                                 | Added collection pages (`/collections/[slug]`)                               |
| `app/[citySlug]/business/[listingSlug]/page.tsx` | Added `og:url`, `twitter:card`, `alternates.canonical` to `generateMetadata` |
| `app/(public)/discover/[citySlug]/page.tsx`      | Added `og:url`, `twitter:card`, `alternates.canonical` to `generateMetadata` |
