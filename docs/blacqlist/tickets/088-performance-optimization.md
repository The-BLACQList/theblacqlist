# Ticket 088: Performance optimization — Core Web Vitals, ISR config, image optimization

## Status

Draft

## Phase

Phase 17: Security, QA, Accessibility, Launch

## Priority

P1

## Feature Area

Performance

---

## Context

The BLACQList's SEO value depends on Core Web Vitals scores. Google uses LCP, CLS, and INP as ranking signals. The most traffic-heavy pages — BLACQList Pages and search results — must pass Core Web Vitals thresholds before launch. This ticket is a performance audit and fix pass across the entire codebase, covering: Next.js Image optimization, ISR revalidation configuration, bundle size analysis, and Supabase query optimization. Deliverables include documented Lighthouse scores on 5 key pages and a list of resolved performance issues.

Target thresholds (GOOD range): LCP < 2.5s, CLS < 0.1, INP < 200ms on a simulated mobile connection (Lighthouse mobile preset).

Source documents: `docs/blacqlist/architecture/production-architecture.md` §§ 2 (Frontend Architecture), 13 (Deployment Architecture), 15 (Scalability Considerations); deployment checklist in `docs/blacqlist/architecture/deployment-plan.md` § 7 (Performance checks).

---

## User Story

As a visitor to The BLACQList, I want pages to load quickly and feel responsive, so that I can discover businesses without frustration and the platform ranks well in search engine results.

---

## Scope

**In scope:**

**1. Image optimization audit**

- Grep all component files for `<img` tags — must return zero results; all images must use `next/image`
- Verify `priority` prop on above-the-fold images (hero cover image on BLACQList Page, homepage hero) — these must use `priority` to avoid LCP penalty
- Verify `sizes` attribute is set correctly on all `next/image` components to match actual rendered size breakpoints (prevents oversized image downloads)
- Verify `next.config.ts` `images.remotePatterns` includes the Supabase Storage CDN domain
- Verify images in the `listing-media` bucket are stored as JPEG or WebP — reject PNG uploads > 1MB in the upload service if not already enforced

**2. ISR revalidation configuration**

- Audit all `app/(public)` page components for the presence of `revalidate` export or `fetch` cache configuration
- Verify revalidation intervals match the spec: BLACQList Pages = 3600 (1h), city pages = 86400 (24h), homepage = 1800 (30m), collection pages = 3600 (1h)
- Verify `revalidateTag` and `revalidatePath` are called correctly in Server Actions that mutate listing content (listing publish, listing edit, admin approve)
- Document the `generateStaticParams` usage for BLACQList Pages and city pages — confirm only published listings are pre-built at build time

**3. Bundle analysis**

- Run `@next/bundle-analyzer` and identify the top 5 largest client-side chunks
- For each large chunk: determine if it can be lazy-loaded, server-rendered instead, or replaced with a lighter alternative
- Particular targets: `recharts` (used in analytics), any chart library imported at the root layout level, any icon library importing the entire package instead of tree-shaking

**4. Supabase query optimization**

- Review all queries on the 3 highest-traffic paths (BLACQList Page, search results, homepage) in Supabase Dashboard → Logs → API Logs
- Verify GIN index on `search_vector` is active and being used (`EXPLAIN ANALYZE` on a sample search query)
- Verify the `pg_trgm` extension is enabled — check in Supabase Dashboard → Extensions
- Identify any N+1 query patterns in the BLACQList Page data layer (Ticket 020) — use Supabase logs to count queries per page load
- Add missing indexes identified during this audit via a migration

**5. Lighthouse audit and documentation**

- Run Lighthouse mobile audit on 5 key pages: homepage, a BLACQList Page, search results page, city landing page, sign-up page
- Document: LCP, CLS, INP, Performance score for each page
- Deliverable: `docs/blacqlist/launch/lighthouse-scores.md` with scores and any remaining issues

**Out of scope:**

- CDN or infrastructure changes
- Algolia search migration (V1 trigger)
- Service worker / offline caching (deferred)
- HTTP/3 or Brotli compression configuration (handled by Vercel automatically)

---

## Dependencies

| Dependency                                           | Type                                | Status                        |
| ---------------------------------------------------- | ----------------------------------- | ----------------------------- |
| All frontend tickets (015–083)                       | Must be implemented before auditing | In Progress                   |
| `@next/bundle-analyzer` npm package (dev dependency) | Tooling                             | Must be installed             |
| Staging environment with seed data                   | Infrastructure                      | Required for Lighthouse runs  |
| Supabase Dashboard access                            | Infrastructure                      | Required for query log review |

---

## UX Notes

This is a performance engineering ticket. No UX changes.

---

## Design Notes

No design changes. Performance fixes that change visual output (e.g., image `sizes` attribute affecting rendered image dimensions) must be verified to not break layout.

---

## Data Notes

**Migrations possibly required:**

- Add missing indexes identified during Supabase query analysis (migration filename: `add-performance-indexes-[date]`)
- Potentially add an index on `listings.published_at DESC` if the homepage "recently added" query shows a sequential scan

---

## API Notes

No API changes. Route Handler performance fixes (e.g., adding a cache header to `GET /api/search` for non-personalized requests) may be in scope if identified during the audit.

---

## Implementation Notes

**Files to create:**

- `docs/blacqlist/launch/lighthouse-scores.md` — documented Lighthouse scores for 5 pages
- `supabase/migrations/[timestamp]_add-performance-indexes.sql` — only if missing indexes are found

**Files to modify:**

- `next.config.ts` — enable `@next/bundle-analyzer` for the audit run; verify `images.remotePatterns`
- `app/(public)/[city-slug]/business/[listing-slug]/page.tsx` — verify `revalidate = 3600`; verify hero image uses `priority`
- `app/(public)/city/[city-slug]/page.tsx` — verify `revalidate = 86400`
- `app/(public)/page.tsx` (homepage) — verify `revalidate = 1800`
- Any component using `<img>` — replace with `next/image`
- Any chart import at root layout level — move to lazy import with `next/dynamic`

**Key patterns:**

- Bundle analyzer command: `ANALYZE=true npm run build`
- Run Lighthouse in Chrome DevTools → Lighthouse tab → Mobile preset → Navigation (not Timespan)
- Lighthouse should be run against the staging Vercel URL (not localhost) to reflect real CDN caching
- For `recharts` lazy loading: `const MetricLineChart = dynamic(() => import('./MetricLineChart'), { ssr: false })`

**Do not:**

- Remove the `priority` prop from above-the-fold images to fix a Lighthouse warning about "unused preloads" — that warning is acceptable; the LCP improvement from `priority` is more important
- Change ISR revalidation intervals without verifying with the product spec — these are deliberate decisions

**Bundle analysis steps:**

1. Add to `next.config.ts`:
   ```ts
   const withBundleAnalyzer = require('@next/bundle-analyzer')({
     enabled: process.env.ANALYZE === 'true',
   })
   module.exports = withBundleAnalyzer(nextConfig)
   ```
2. Run `ANALYZE=true npm run build`
3. Review the generated HTML report for large chunks
4. Document findings; implement fixes; re-run analyzer to confirm improvement

---

## Acceptance Criteria

- [ ] `grep -r "<img " src/` returns zero results in all component files (all images use `next/image`)
- [ ] All above-the-fold images on BLACQList Pages use `priority` prop
- [ ] ISR `revalidate` values verified to match spec on BLACQList Pages (3600), city pages (86400), homepage (1800)
- [ ] `revalidateTag` called correctly in Server Actions that mutate published listing content
- [ ] Bundle analyzer run completed; top 5 largest chunks identified and documented
- [ ] All chart components lazy-loaded with `next/dynamic({ ssr: false })` — not included in the initial server bundle
- [ ] GIN index on `search_vector` confirmed active via `EXPLAIN ANALYZE`
- [ ] `pg_trgm` extension confirmed enabled on staging and production
- [ ] N+1 query patterns on BLACQList Page resolved (max 3 DB queries per page load on cache miss)
- [ ] Lighthouse mobile scores documented for all 5 key pages: homepage LCP < 2.5s, BLACQList Page LCP < 2.5s
- [ ] All 5 pages pass CLS < 0.1 (typically caused by images without explicit dimensions — fixed by `next/image`)
- [ ] `docs/blacqlist/launch/lighthouse-scores.md` written and committed

---

## Failure States

| Failure                                    | Resolution                                                                                                           |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| LCP > 2.5s on BLACQList Page               | Investigate: cover image not using `priority`? ISR cache cold? Image oversized? Fix root cause and re-run Lighthouse |
| CLS > 0.1                                  | Typically caused by images loaded without explicit `width`/`height` — add dimensions to all `next/image` usages      |
| Large chart bundle in initial page load    | Move to `next/dynamic` with `ssr: false`; verify it loads after LCP                                                  |
| N+1 queries found                          | Consolidate into a single JOIN query in the service layer                                                            |
| Missing database index causing slow search | Add index via migration; verify with `EXPLAIN ANALYZE`                                                               |

---

## Edge Cases

- ISR cold start: the first request after a revalidation triggers a server-side rebuild — this is expected behavior; Lighthouse scores should be measured on warm (cached) pages
- `generateStaticParams` for BLACQList Pages: if a listing is published after the last build, it must be handled by Next.js dynamic fallback (`dynamicParams = true`) — verify this is configured
- Images stored as PNG in the `listing-media` bucket: the upload service should enforce JPEG/WebP but some older seed images may be PNG — these will still render correctly via `next/image` (Next.js converts them); not a blocking issue

---

## Accessibility Notes

Performance optimizations must not remove accessible image attributes. `alt` text on `next/image` components must be preserved through all changes.

---

## QA Test Cases

| #    | Scenario                                     | Role      | Steps                                                                                                                       | Expected result                                                                        |
| ---- | -------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| QA-1 | Lighthouse — BLACQList Page                  | Any       | Run Lighthouse mobile on a published listing page on staging                                                                | LCP < 2.5s, CLS < 0.1, Performance score ≥ 80                                          |
| QA-2 | No raw `<img>` tags                          | Developer | `grep -r "<img " src/`                                                                                                      | Zero results                                                                           |
| QA-3 | ISR revalidation working                     | Developer | Load a BLACQList Page, update the listing name in Supabase Studio, wait 1h (or call `revalidateTag` manually), refresh page | Updated name appears without a new deployment                                          |
| QA-4 | Search query uses GIN index                  | Developer | Run `EXPLAIN ANALYZE SELECT ... FROM listings WHERE search_vector @@ ...` in Supabase SQL Editor                            | Query plan shows `Index Scan using listings_search_vector_idx`                         |
| QA-5 | Bundle analyzer — no chart in initial bundle | Developer | Run bundle analyzer; check first-load JS breakdown                                                                          | `recharts` is not in the initial bundle; appears only in the analytics dashboard chunk |

---

## Security Notes

No security implications for this ticket. Confirm that any new `fetch` cache headers added to Route Handlers do not cause private data to be cached at the edge.

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
