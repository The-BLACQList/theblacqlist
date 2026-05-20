# Beta Build Task Index — The BLACQList

**Date:** 2026-05-12  
**Purpose:** Ordered list of the next 20 build tasks to move from shell/demo state to production-ready beta. Tasks are ordered by dependency chain — earlier tasks unblock later ones.

---

## How to Read This Index

- **Current state** — what exists today in the codebase
- **Target beta state** — what must be true for this task to be marked done
- **Risk** — LOW / MEDIUM / HIGH for the build step itself (not the feature)
- **Done means** — specific observable proof that the task is complete

---

## Task Table

| # | Feature | Current State | Target Beta State | Files Likely Involved | Data Needed | Dependencies | Risk | Done Means |
|---|---|---|---|---|---|---|---|---|
| 1 | **Seed cities reference data** | `cities` table exists, no rows | 13 launch cities seeded with `slug`, `state_abbr`, `is_active=true` | `supabase/seeds/` (new seed file or SQL) | Launch city list from `data/seed-data-plan.md` | None | LOW | `SELECT count(*) FROM cities` returns 13; city slugs match route map |
| 2 | **Seed categories taxonomy** | `categories` table exists, no rows (or partial) | Full 25-category tree with subcategories seeded; all have `is_active=true` and correct `parent_id` chain | `supabase/seeds/` (new seed file) | Category tree from `data/seed-data-plan.md` | Task 1 | LOW | `SELECT count(*) FROM categories WHERE parent_id IS NULL` returns 25; subcategories properly parented |
| 3 | **Seed 5–10 demo listings** | `listings` table empty in staging | At least 5 real `listings` rows with `status='published'`, matching `listing_details_business` rows, city/category FK links valid | `supabase/seeds/001_listings.sql` (99KB seed file exists — verify and push) | Valid city + category IDs from Tasks 1–2 | Tasks 1–2 | MEDIUM | `/discover` shows real businesses without falling back to mock; `/search?q=` returns results |
| 4 | **Replace STUB_CITIES in onboarding** | `STUB_CITIES` hardcoded (8 cities) in `app/onboarding/page.tsx` | Onboarding fetches `cities` from DB; shows all active launch cities | `app/onboarding/page.tsx` | Cities seeded (Task 1) | Task 1 | LOW | Onboarding city pills match `SELECT name FROM cities WHERE is_active=true ORDER BY name`; removing a city from DB removes it from onboarding |
| 5 | **Remove mock fallback from /discover** | `MOCK_ENTITIES` array renders when Supabase returns 0 results | Real empty state shown ("No businesses found — be the first to submit"); no mock import | `app/(public)/discover/page.tsx`, `lib/listings/query.ts` | Listings seeded (Task 3) | Task 3 | MEDIUM | With DB seeded: discover shows real businesses. With DB empty: proper empty-state UI shows, not fake businesses. `MOCK_ENTITIES` import removed. |
| 6 | **Remove mock fallback from /search** | `MOCK_ENTITIES` fallback renders when search returns 0 | Real empty state shown for zero-result searches; no mock import | `app/(public)/search/page.tsx`, `lib/listings/query.ts` | Listings seeded (Task 3) | Task 3 | MEDIUM | Searching for a real seeded business name returns that business. Searching for "xyznotreal" shows empty state, not fake businesses. |
| 7 | **Wire SaveButton to /api/saves** | `SaveButton` renders placeholder; TODO comment; API route fully functional | Clicking save calls `POST /api/saves`; clicking again calls `DELETE /api/saves`; icon reflects saved state; loading state during call; error toast on failure | `components/entity-page/SaveButton.tsx` | None | None | Authenticated user can save and unsave a listing from its entity page; save persists on page refresh; unauthenticated user is prompted to sign in |
| 8 | **Wire /account/saved to saves query** | Page always shows empty state regardless of user's actual saves | Page fetches user's saves via Supabase or `/api/saves`; renders saved listing cards; correct empty state when no saves | `app/account/saved/page.tsx` | None | Task 7 (logical) | LOW | User who has saved listings sees them listed. User who has no saves sees an encouraging empty state with a link to `/discover`. |
| 9 | **Implement admin verification queue** | `/admin/verification` shows "Verification queue coming soon" | Paginated table of claims/listings in `status='pending_verification'`; link to document review; approve/reject actions | `app/admin/verification/page.tsx`, `lib/actions/admin/` | None | None | MEDIUM | Admin can view verification requests; approve sets `status='verified'`; reject sets status with reason; action is logged in `admin_audit_log` |
| 10 | **Implement admin reviews moderation** | `/admin/reviews` shows "Review moderation coming soon" | Table of `reviews` where `status='intake'`; approve publishes review; reject with reason; bulk actions | `app/admin/reviews/page.tsx`, `lib/actions/admin/moderateReviewAction` (exists) | None | None | MEDIUM | Admin sees intake reviews; approving sets `status='published'` and increments `listings.review_count`; rejecting hides with reason |
| 11 | **Implement admin reports/corrections queue** | `/admin/reports` shows "Reports queue coming soon" | Table from `moderation_queue` where type includes user corrections and content reports; resolve/dismiss actions | `app/admin/reports/page.tsx`, `lib/actions/` (new action) | None | None | MEDIUM | Admin sees pending reports; resolving marks `moderation_queue.status='resolved'`; dismissing marks `status='dismissed'`; action logged |
| 12 | **Render article rich text in /blacqlight/[slug]** | Fetches article from DB but renders "Article content coming soon" | `rich_text_content` column rendered as HTML or markdown; article body displays fully | `app/(public)/blacqlight/[slug]/page.tsx` | At least 1 published article with `rich_text_content` populated | None | LOW | Published article with content shows rendered body text; heading hierarchy renders correctly; no "coming soon" message visible |
| 13 | **Render guide sections in /guides/[slug]** | Fetches guide from DB but renders "Sections coming soon" | `guide_sections` records rendered as ordered content blocks under guide detail | `app/(public)/guides/[slug]/page.tsx` | At least 1 published guide with `guide_sections` rows | None | LOW | Published guide shows all its sections in order; section headings and content visible; no "coming soon" message |
| 14 | **Implement entity type routing (ADR-010)** | Only `/[citySlug]/business/[listingSlug]` exists; other `listing_type` values 404 | Dynamic `[entityType]` segment handles all entity types; page logic reads `listing_type` from DB not URL; any listing with valid type routes correctly | `app/[citySlug]/business/[listingSlug]/page.tsx` → restructure to `app/[citySlug]/[entityType]/[listingSlug]/page.tsx` | Seeded listings with non-business listing_types | Task 3 | HIGH | Listing with `listing_type='restaurant'` is accessible at `/atlanta/restaurant/slug`; listing with `listing_type='business'` still works at `/atlanta/business/slug`; invalid entity type returns 404 |
| 15 | **Wire ShareButton to Web Share API** | Placeholder button; no share behavior | Clicking opens native share sheet on mobile; falls back to clipboard copy on desktop; success toast "Link copied" | `components/entity-page/ShareButton.tsx` | None | None | LOW | On a mobile device, tapping share opens native OS share sheet with entity URL + name; on desktop, clicking copies URL and shows toast |
| 16 | **Replace legal page placeholder copy** | Privacy, terms, cookies pages have explicit "attorney-review required" warnings | All three pages have attorney-reviewed and finalized legal copy; warning notices removed | `app/(public)/privacy/page.tsx`, `app/(public)/terms/page.tsx`, `app/(public)/cookies/page.tsx` | Attorney-reviewed copy | None | HIGH | Pages load with real legal content; no "placeholder" or "attorney review" language visible; last-reviewed date present |
| 17 | **Set up dedicated local Supabase environment** | `.env.local` points to a live Supabase cloud project; dev mutations affect staging DB | Local dev uses Supabase CLI + Docker (`supabase start`); `.env.local` points to `localhost:54321`; staging cloud project used only for staging deploys | `.env.local`, `supabase/config.toml` | None | None | HIGH | `supabase start` runs all 7 migrations successfully; local app connects to `localhost:54321`; seeding local DB does not affect cloud staging project |
| 18 | **Migrate types from mock files to types/index.ts** | `types/index.ts` is a 2-line placeholder; real types scattered in `data/mock-entities.ts` and `data/mock-entity-page.ts` | `types/index.ts` exports all shared types; `DiscoveryEntity`, `EntityPageData`, `EntityType`, `TrustTier`, etc. exported from one place; no imports from `@/data/mock-*` in `lib/` | `types/index.ts`, `data/mock-entities.ts`, `data/mock-entity-page.ts`, `lib/listings/query.ts`, `lib/listings/entityPage.ts` | None | Tasks 5–6 complete (mocks no longer rendering) | LOW | `lib/listings/query.ts` imports from `@/types`, not `@/data/mock-entities`; tsc passes; no type errors |
| 19 | **Delete mock data files** | `data/mock-entities.ts` and `data/mock-entity-page.ts` still present | Both files deleted; no imports pointing to them anywhere in codebase | `data/mock-entities.ts`, `data/mock-entity-page.ts` | None | Tasks 5, 6, 18 complete | LOW | `grep -r "mock-entities\|mock-entity-page" app/ lib/ components/` returns no results; `pnpm tsc --noEmit` passes |
| 20 | **Beta smoke test pass** | No formal smoke test run against seeded DB | All P0 smoke test cases from `docs/blacqlist/launch/prelaunch-smoke-test.md` pass; no console errors on key routes; admin can approve a listing end-to-end | All routes | Seeded DB (Tasks 1–3) | Tasks 1–19 | MEDIUM | Sign-up → onboarding → discover → entity page → save → account/saved all work without errors; submit business → admin review → approve → entity page visible publicly; receipt upload → admin approve → community-spend reflects it |

---

## Dependency Chain

```
Task 1 (seed cities)
  └─ Task 2 (seed categories)
       └─ Task 3 (seed listings)
            ├─ Task 4 (replace STUB_CITIES) ← also needs Task 1
            ├─ Task 5 (remove discover mock fallback)
            ├─ Task 6 (remove search mock fallback)
            └─ Task 14 (entity type routing)

Task 7 (wire SaveButton)
  └─ Task 8 (wire /account/saved)

Tasks 9, 10, 11 — independent (admin queue implementation)
Tasks 12, 13 — independent (content rendering)
Tasks 15, 16 — independent (ShareButton, legal copy)

Task 17 (local Supabase env) — independent; unblocks safe dev workflow

Tasks 5 + 6 complete
  └─ Task 18 (migrate types)
       └─ Task 19 (delete mock files)

All of the above
  └─ Task 20 (smoke test)
```

---

## Risk Register

| Risk | Tasks Affected | Mitigation |
|---|---|---|
| Entity type routing refactor breaks existing `/business/` URLs | 14 | Test existing `/[citySlug]/business/[listingSlug]` routes before and after; add redirect if needed |
| Seed data conflicts (duplicate slugs, FK violations) | 1–3 | Run seeds in order; use `ON CONFLICT DO NOTHING` in seed SQL |
| `admin/verification` workflow needs document download — signed URL auth may need extension | 9 | Reuse existing `/api/receipts/[id]/signed-url` pattern; extend to verification-docs bucket |
| Legal copy delays can block launch | 16 | Start attorney review in parallel with other tasks; do not block code work on legal |
| Removing mock fallback before DB is seeded causes blank discover page | 5, 6 | Must complete Task 3 first; gate behind feature flag if needed |
| Dev → staging DB pollution | 17 | High priority; complete early to protect staging data quality |
