# MVP Bug Risk Log — The BLACQList

**Date:** 2026-05-11
**Updated:** 2026-05-11 — blocker fix session applied
**Status:** Updated — all P0 blockers and P1 security issues resolved
**Source:** Static code audit, migration review, and route analysis

Risks are rated by likelihood (L), impact (I), and overall severity. Severity = L × I (both 1–3 scale).

---

## Critical / Blocking (Must Fix Before Any Launch)

### BRK-01 — Upload Route Handler Does Not Exist

| Field | Value |
|---|---|
| Severity | Critical — P0 |
| Likelihood | Certain (confirmed missing) |
| Impact | All media upload flows fail: gallery, receipt documents, profile images |
| Area | API — `app/api/upload/[bucket]/route.ts` |
| First affected flow | Add Business Step 5 (gallery upload), Receipt submission |

**Detail:** `app/api/upload/[bucket]/route.ts` was identified as a required deliverable in ticket `030-media-upload-api.md` but does not currently exist in the codebase. Any page that attempts a media upload will receive a 404 from the API.

**Risk if shipped:** Gallery images cannot be added. Receipt documents cannot be attached. Profile/logo images cannot be uploaded. The add-business flow will fail at the media step.

**Fix required:** Implement upload route with auth, file type validation, size limit, filename sanitization, and Supabase Storage integration. See security review SR-06 for full spec.

---

### BRK-02 — Business Detail Page Serves Mock Data

| Field | Value |
|---|---|
| Severity | Critical — P0 |
| Likelihood | Certain (confirmed in code) |
| Impact | Every business page shows the same mock business data regardless of URL |
| Area | `app/(public)/[citySlug]/business/[listingSlug]/page.tsx` |
| First affected flow | Any user navigating to a real business's page |

**Detail:** The business detail page calls `getEntityPageBySlug()` which returns `MOCK_ENTITIES` data — hardcoded mock content — rather than fetching from the `listings` database table. The `listingSlug` URL param is not used to query real data.

**Risk if shipped:** Business owners who claim and set up their page will not see their real content on the public-facing page. Every business page will show identical mock content.

**Fix required:** Replace `getEntityPageBySlug()` mock with a real Supabase query using `listingSlug` and `citySlug` to fetch the matching listing.

---

### BRK-03 — Search and Discover Pages Serve Mock Data

| Field | Value |
|---|---|
| Severity | Critical — P0 |
| Likelihood | Likely (reported in research audit) |
| Impact | Search results show mock businesses; real businesses not discoverable |
| Area | `app/(public)/discover/page.tsx` and search routes |
| First affected flow | Any user searching for a real business |

**Detail:** The discovery and search pages use mock entity data rather than querying the `listings` table. Users cannot find real businesses that have been added to the platform.

**Fix required:** Wire search API endpoint (`/api/search`) to real `listings` database query, apply filters (city, category, keyword), and connect results to the discover/search pages.

---

## High Severity

### BRH-01 — No Rate Limiting on Analytics Event API

| Field | Value |
|---|---|
| Severity | High — P1 |
| Likelihood | Medium (requires a determined attacker) |
| Impact | Spam/abuse can flood `analytics_events` table; inflated stats for any listing |
| Area | `app/api/analytics/event/route.ts` |

**Detail:** The analytics event ingestion API accepts anonymous POST requests. There is no rate limiting, IP-based throttling, or bot detection. A bad actor could send thousands of `page_view` events for a competitor's listing, inflating their views or flooding the DB.

**Fix:** Add rate limiting (10 req/IP/min) using Vercel Edge middleware or an in-memory rate limiter. Consider requiring a honeypot token or simple CAPTCHA for high-frequency event sources.

---

### BRH-02 — Admin Audit Log Completeness Unknown

| Field | Value |
|---|---|
| Severity | High — P1 |
| Likelihood | Low (likely complete for main flows) |
| Impact | Missing audit entries make incident response and compliance auditing impossible |
| Area | `lib/actions/admin/` — all admin server actions |

**Detail:** The audit log (`admin_audit_log`) is an important compliance and accountability mechanism. It's confirmed present in claim approval/rejection actions, but a full audit of every admin mutation is needed to confirm completeness.

**Required audit:** Every function in `lib/actions/admin/` must have an `admin_audit_log` INSERT before any mutation returns. Verify: approve claim, reject claim, verify listing, reject listing, moderate review, manage collection members, manage products, approve receipts.

---

### BRH-03 — Receipt RLS Cross-User Access (Unverified)

| Field | Value |
|---|---|
| Severity | High — P1 |
| Likelihood | Low if RLS is complete |
| Impact | A supporter could read another supporter's receipt amounts and business history |
| Area | `supabase/migrations/20260510000001_mvp_rls_policies.sql` — `receipts` table |

**Detail:** Receipt data includes purchase amounts and business identifiers. If the RLS SELECT policy on `receipts` allows any authenticated user to read all rows (rather than only their own), buyer anonymity is compromised.

**Fix:** Verify the `receipts` SELECT policy includes `WHERE user_id = auth.uid()` for supporter role and service-role-only for admin access. Test with cross-user scenario in TA-20.

---

### BRH-04 — No Automated Test Suite

| Field | Value |
|---|---|
| Severity | High — P2 |
| Likelihood | Certain (confirmed: no `test` script in package.json) |
| Impact | Regressions cannot be caught automatically; every release requires full manual QA |
| Area | `package.json` |

**Detail:** `package.json` scripts: `{ "dev", "build", "start", "lint" }`. No `test` command exists. No Jest, Vitest, Playwright, or Cypress configuration found.

**Risk:** Without automated tests, every code change requires manual regression testing. As the codebase grows, manual QA becomes increasingly expensive and coverage decreases.

**Recommended:** Add Playwright for E2E tests covering P1 flows (auth, add-business, claim, dashboard) before the first major release after launch.

---

## Medium Severity

### BRM-01 — `text-charcoal/40` Hint Text Contrast Failure

| Field | Value |
|---|---|
| Severity | Medium — P1 (accessibility blocker) |
| Likelihood | High |
| Impact | Hint text in AI checklist and other hint areas fails WCAG AA contrast |
| Area | `app/dashboard/pages/[entityId]/ai-suggestions/page.tsx` and others |

**Detail:** `text-charcoal/40` at 40% opacity on a white background produces approximately a 1.6:1 contrast ratio — well below the WCAG 2.1 AA requirement of 4.5:1 for normal text.

**Fix:** Use a fixed hex value (e.g., `#757575` or `#6B6B6B`) for hint/helper text rather than an opacity modifier, or increase to at minimum `text-charcoal/50` and verify the resulting contrast ratio.

---

### BRM-02 — Icon-Only Buttons Without aria-label

| Field | Value |
|---|---|
| Severity | Medium — P1 (accessibility) |
| Likelihood | Medium |
| Impact | Screen reader users cannot determine what Save, Share, Delete, or reorder buttons do |
| Area | Business detail page Save/Share; gallery reorder/delete; admin table actions |

**Detail:** Buttons that contain only an icon (no visible text label) must have an `aria-label` attribute to be accessible to screen reader users.

**Fix:** Add `aria-label="Save [business name]"`, `aria-label="Share [business name]"`, `aria-label="Delete image"`, etc. to all icon-only interactive elements. Where appropriate, add `aria-pressed` for toggle states (Save/Unsave).

---

### BRM-03 — Image Gallery alt Text Not Enforced

| Field | Value |
|---|---|
| Severity | Medium — P2 |
| Likelihood | High (no alt text field in media_attachments schema) |
| Impact | Gallery images have no alternative text for screen readers |
| Area | `media_attachments` table, gallery display components |

**Detail:** The `media_attachments` table schema does not include an `alt_text` field. Gallery images will be rendered without meaningful alt text, making them inaccessible to screen reader users.

**Fix options:** (1) Add optional `alt_text` column to `media_attachments` and provide an input in the gallery manager, or (2) Generate descriptive alt text from the business name + image position (e.g., `"[Business Name] — gallery image 3"`).

---

### BRM-04 — Supabase Types Hand-Maintained (Sync Risk)

| Field | Value |
|---|---|
| Severity | Medium — P2 |
| Likelihood | Medium |
| Impact | TypeScript compilation succeeds but actual DB schema differs from types; runtime errors |
| Area | `lib/supabase/types.ts` |

**Detail:** `lib/supabase/types.ts` is hand-maintained because auto-generation (`supabase gen types`) requires the local Supabase instance to have all migrations applied. As new tables are added via migrations, the types file must be manually updated. If out of sync, TypeScript won't catch the mismatch — runtime errors occur when querying non-existent columns.

**Fix:** Add a CI step or `package.json` script that runs `supabase gen types` against the local or staging DB and flags any difference. Document the manual update process in CONTRIBUTING.md until auto-generation is wired.

---

### BRM-05 — Mock Data Routes Still Active in Codebase

| Field | Value |
|---|---|
| Severity | Medium — P2 (in addition to BRK-02/03) |
| Likelihood | Certain |
| Impact | Mock data import left in production code creates confusion and maintenance debt |
| Area | Business detail, discover, search pages |

**Detail:** `MOCK_ENTITIES` and related mock data objects are imported and used in production code paths. Even after BRK-02 and BRK-03 are fixed (real data wired), the mock data code must be cleanly removed (not just bypassed) to prevent accidental reversion.

**Fix:** After wiring real data, delete all mock data files and remove imports. Add a lint rule or grep check to CI that fails if `MOCK_ENTITIES` appears in any file under `app/`.

---

## Low Severity

### BRL-01 — Missing `pnpm test` Script

| Field | Value |
|---|---|
| Severity | Low — P3 |
| Impact | CI pipelines that expect `pnpm test` will fail with "Missing script" error |
| Area | `package.json` |

**Fix:** Add `"test": "echo \"No tests yet\" && exit 0"` as a placeholder until a real test framework is configured. This prevents CI failures from a missing script.

---

### BRL-02 — `supabase/types.ts` ai_suggestions and ai_generation_requests Manually Added

| Field | Value |
|---|---|
| Severity | Low |
| Impact | If migration 20260511000004 is rolled back or modified, types will be out of sync |
| Area | `lib/supabase/types.ts` |

**Detail:** Types for `ai_suggestions` and `ai_generation_requests` were manually added to the types file in this build session (since migrations haven't been applied to local Supabase). These must be regenerated from the actual DB when the migration is applied.

**Fix:** After applying migration 20260511000004 to staging, run `supabase gen types typescript --local > lib/supabase/types.ts` and verify the output matches current hand-maintained entries.

---

### BRL-03 — Collections Index Page Empty State Not Verified

| Field | Value |
|---|---|
| Severity | Low |
| Impact | Collections page may render a blank screen if no collections exist |
| Area | `app/(public)/collections/page.tsx` |

**Fix:** Verify empty state renders "No collections yet" with appropriate messaging; not a blank screen.

---

## Summary Table

| ID | Description | Severity | Status |
|---|---|---|---|
| BRK-01 | Upload route handler missing | Critical P0 | **Fixed** — `app/api/upload/[bucket]/route.ts` created |
| BRK-02 | Business detail page: mock data | Critical P0 | **Fixed** — `lib/listings/entityPage.ts` + page updated |
| BRK-03 | Search/discover: mock data | Critical P0 | **Fixed** — discover + search pages wired to DB |
| BRH-01 | No rate limiting on analytics API | High P1 | **Fixed** — 30 req/IP/min added to analytics route |
| BRH-02 | Admin audit log completeness | High P1 | **Resolved** — all 6 admin actions + 2 receipt actions confirmed |
| BRH-03 | Receipt RLS cross-user access | High P1 | **Resolved** — `USING (user_id = auth.uid())` confirmed in migration |
| BRH-04 | No automated test suite | High P2 | **Partially resolved** — placeholder `test` script added; real tests deferred |
| BRM-01 | charcoal/40 contrast failure | Medium P1 | Open |
| BRM-02 | Icon-only buttons without aria-label | Medium P1 | Open |
| BRM-03 | Gallery image alt text | Medium P2 | Open |
| BRM-04 | Supabase types hand-maintained | Medium P2 | Open |
| BRM-05 | Mock data routes still in code | Medium P2 | Open — type-only imports remain; runtime mock data removed |
| BRL-01 | Missing pnpm test script | Low P3 | **Fixed** — placeholder script added |
| BRL-02 | AI types manually added | Low | Open |
| BRL-03 | Collections empty state | Low | Needs verification |
