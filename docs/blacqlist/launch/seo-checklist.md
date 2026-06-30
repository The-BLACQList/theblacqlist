# SEO Checklist — The BLACQList

**Ticket:** 090  
**Status:** Pending — execute on staging, then repeat post-launch  
**References:** `app/sitemap.ts`, `app/robots.ts`, `app/layout.tsx`

---

## Code Changes Completed

| Change | File | Status |
|---|---|---|
| Root-level `openGraph` defaults added | `app/layout.tsx` | ✅ Done |
| `metadataBase` set for OG image URL resolution | `app/layout.tsx` | ✅ Done |
| `title.template` set to `%s \| The BLACQList` | `app/layout.tsx` | ✅ Done |
| `twitter.card: summary_large_image` | `app/layout.tsx` | ✅ Done |

---

## 1. Sitemap Verification

Access `[staging-url]/sitemap.xml` and verify these URL groups are present.

| URL group | Expected count | Present? | Sample URL checked |
|---|---|---|---|
| BLACQList Pages | All published listings | Pending | |
| City pages | All seeded cities | Pending | |
| City-category pages | City × category combinations | Pending | |
| Collection pages | All published collections | Pending | |
| Static pages (/, /discover, /for-business, /about, /privacy, /terms) | 6 | Pending | |

**Validate sitemap XML:** Paste the sitemap URL into [xmlvalidator.net](https://www.xmlvalidator.net/) — zero validation errors required.

**`lastmod` check:** Each listing URL must include `lastmod` matching `listings.updated_at`.

---

## 2. `robots.txt` Verification

Access `[staging-url]/robots.txt` and verify:

| Rule | Expected | Present? |
|---|---|---|
| `User-agent: *` | Present | Pending |
| `Allow: /` | Present | Pending |
| `Disallow: /admin` | Present | Pending |
| `Disallow: /dashboard` | Present | Pending |
| `Disallow: /account` | Present | Pending |
| `Disallow: /api` | Present | Pending |
| `Disallow: /sign-in` | Present | Pending |
| `Disallow: /sign-up` | Present | Pending |
| `Disallow: /onboarding` | Present | Pending |
| `Disallow: /reset-password` | Present | Pending |
| `Disallow: /verify-email` | Present | Pending |
| `Disallow: /claim` | Present | Pending |
| `Sitemap: https://theblacqlist.com/sitemap.xml` | Present | Pending |

---

## 3. OG Tag Spot-Check

Test 10 BLACQList Pages and 5 city pages. Use:
```bash
curl -A "facebookexternalhit/1.1" [url] | grep -i "og:"
```
Or paste URL into [opengraph.xyz](https://www.opengraph.xyz/).

| URL | `og:title` | `og:description` | `og:image` accessible | `og:url` canonical | Pass? |
|---|---|---|---|---|---|
| Listing 1 | Pending | Pending | Pending | Pending | |
| Listing 2 | Pending | Pending | Pending | Pending | |
| Listing 3 | Pending | Pending | Pending | Pending | |
| Listing 4 | Pending | Pending | Pending | Pending | |
| Listing 5 | Pending | Pending | Pending | Pending | |
| Listing 6 | Pending | Pending | Pending | Pending | |
| Listing 7 | Pending | Pending | Pending | Pending | |
| Listing 8 | Pending | Pending | Pending | Pending | |
| Listing 9 | Pending | Pending | Pending | Pending | |
| Listing 10 | Pending | Pending | Pending | Pending | |
| City: Atlanta | Pending | Pending | Pending | Pending | |
| City: Houston | Pending | Pending | Pending | Pending | |
| City: Chicago | Pending | Pending | Pending | Pending | |
| City 4 | Pending | Pending | Pending | Pending | |
| City 5 | Pending | Pending | Pending | Pending | |

---

## 4. JSON-LD Structured Data Spot-Check

Test 5 BLACQList Pages via [Google Rich Results Test](https://search.google.com/test/rich-results).

| URL | Schema type | Required fields present | Validation errors | Pass? |
|---|---|---|---|---|
| Listing 1 | LocalBusiness | `@type`, `name`, `description`, `url`, `address` | Pending | |
| Listing 2 | LocalBusiness | Same | Pending | |
| Listing 3 | LocalBusiness | Same | Pending | |
| Listing 4 | LocalBusiness | Same | Pending | |
| Listing 5 | LocalBusiness | Same | Pending | |

**Zero validation errors** required in Google Rich Results Test for each.

---

## 5. Page Title Uniqueness Check

Expected format: `[Business Name] — [City] | The BLACQList`

| Listing | `<title>` value | Unique? | Format correct? |
|---|---|---|---|
| Listing 1 | Pending | | |
| Listing 2 | Pending | | |
| Listing 3 | Pending | | |
| Listing 4 | Pending | | |
| Listing 5 | Pending | | |
| Listing 6 | Pending | | |
| Listing 7 | Pending | | |
| Listing 8 | Pending | | |
| Listing 9 | Pending | | |
| Listing 10 | Pending | | |
| Homepage | `The BLACQList — Discover Black-Owned Businesses` | n/a | Pending |

---

## 6. Canonical URL Check

| Page type | Has `<link rel="canonical">`? | URL correct (no trailing slash, no staging domain)? |
|---|---|---|
| BLACQList Page | Pending | |
| City landing | Pending | |
| Homepage | Pending | |
| Static pages (/about, /privacy, /terms) | Pending | |

---

## Post-Launch Actions (after production deploy)

- [x] **Verify property ownership** — done 2026-06-30 via **DNS record (Domain property)**; "Ownership verified."
- [x] **Submit `https://theblacqlist.com/sitemap.xml`** to Google Search Console — done 2026-06-30; Status **Success**, **269 pages discovered** (full URL required for a Domain property — bare `sitemap.xml` is rejected).
- [ ] Request indexing for homepage — **after the public flip** (`COMING_SOON_MODE=false`); while gated, pages 307→/coming-soon so they won't index yet (discovered ≠ indexed).
- [ ] Request indexing for 5 priority listing pages — after the public flip.
- [x] Verification method: **DNS record (Domain property)**.
- [x] Submission date: **2026-06-30**.

> **090 status (2026-06-30):** sitemap + robots verified live on prod (robots 200 w/ sitemap ref; sitemap 200 `application/xml`, base `https://theblacqlist.com`, 269 URLs). GSC domain verified + sitemap submitted (Success, 269 discovered). **Remaining = indexing, which follows automatically once the gate is flipped public.**

---

## Go/No-Go Recommendation

**PENDING** — Execute spot-checks on staging and update this document.

**Go criteria:**
- Sitemap generates valid XML with all 4 URL groups present
- `robots.txt` has all 12 `Disallow` rules and sitemap reference
- All 10 OG spot-checks pass (title, description, image, url all present)
- JSON-LD validates with zero errors for all 5 checked pages
- All page titles unique and correctly formatted
