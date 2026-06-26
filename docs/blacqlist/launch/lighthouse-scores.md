# Lighthouse Performance Scores — The BLACQList

**Ticket:** 088
**Status:** Local config + audits COMPLETE (2026-06-20) — Lighthouse score tables remain PENDING a production (Vercel/CDN) run
**Method:** Chrome DevTools → Lighthouse tab → Mobile preset → Navigation mode
**Target:** LCP <2.5s · CLS <0.1 · INP <200ms · Performance score ≥ 80

> **Local pass summary (2026-06-20):** ISR intervals verified + the two gaps fixed · all page images use `next/image` with `priority` on both heroes · `lucide-react` imports all named (0 namespace) · GIN + `pg_trgm` search index confirmed · `next` bumped 16.2.5→16.2.6. The only thing that genuinely needs production is the Lighthouse measurement itself (localhost CDN/caching makes local scores meaningless). **Verdict: GO with conditions — re-run Lighthouse on the production deploy.**

---

## ISR Configuration Audit ✅ (2026-06-20)

| Page | File | Expected `revalidate` | Confirmed |
|---|---|---|---|
| BLACQList Page | `app/[citySlug]/[entityType]/[listingSlug]/page.tsx` | 3600 (1h) | ✅ 3600 |
| City landing | `app/[citySlug]/[entityType]/page.tsx` | 86400 (24h) | ✅ 86400 |
| Homepage | `app/page.tsx` | 1800 (30m) | ✅ **fixed 3600→1800** |
| Collection page | `app/(public)/collections/[slug]/page.tsx` | 3600 (1h) | ✅ **added (was missing)** |
| Sitemap | `app/sitemap.ts` | 3600 (1h) | ✅ 3600 |

---

## Image Optimization Audit

### `<img>` → `next/image` Conversions (completed this session)

| File | Status |
|---|---|
| `app/(public)/marketplace/products/[slug]/page.tsx` | ✅ Converted |
| `app/(public)/marketplace/services/[slug]/page.tsx` | ✅ Converted |
| `components/marketplace/ProductCard.tsx` | ✅ Converted |
| `components/marketplace/ServiceCard.tsx` | ✅ Converted |

### Raw `<img>` audit ✅

4 raw `<img>` tags remain (`app/add-business/_components/steps/MediaStep.tsx` ×2, `PreviewPublishStep.tsx` ×2). All four are **upload-preview overlays on user-selected CDN URLs** before the listing exists, each with an intentional `eslint-disable @next/next/no-img-element`. Every *page-rendered* image uses `next/image`. No action.

### `priority` Prop on Above-the-Fold Images ✅

| File | Image | Has `priority`? |
|---|---|---|
| `components/entity-page/EntityPageHero.tsx` (listing cover) | Cover image (hero, `fill`) | ✅ yes (line 55) |
| `app/page.tsx` | Homepage hero | ✅ yes (line 84) |

### `next.config.ts` Remote Patterns

```
✅ *.supabase.co — /storage/v1/object/public/**
```

No additional domains needed for marketplace image sources (all from Supabase Storage).

---

## Lighthouse Results

Run on staging Vercel URL. **Not localhost** — CDN caching affects scores.

### Homepage (`/`)

| Metric | Score | Pass? |
|---|---|---|
| LCP | — | Pending |
| CLS | — | Pending |
| INP | — | Pending |
| Performance | — | Pending |
| Accessibility | — | Pending |
| Best Practices | — | Pending |
| SEO | — | Pending |

### BLACQList Page (`/[city]/business/[slug]`)

| Metric | Score | Pass? |
|---|---|---|
| LCP | — | Pending |
| CLS | — | Pending |
| INP | — | Pending |
| Performance | — | Pending |
| Accessibility | — | Pending |
| Best Practices | — | Pending |
| SEO | — | Pending |

### Search Results (`/search?q=restaurant&city=atlanta-ga`)

| Metric | Score | Pass? |
|---|---|---|
| LCP | — | Pending |
| CLS | — | Pending |
| INP | — | Pending |
| Performance | — | Pending |

### City Landing (`/city/atlanta-ga`)

| Metric | Score | Pass? |
|---|---|---|
| LCP | — | Pending |
| CLS | — | Pending |
| INP | — | Pending |
| Performance | — | Pending |

### Sign-up (`/sign-up`)

| Metric | Score | Pass? |
|---|---|---|
| LCP | — | Pending |
| CLS | — | Pending |
| INP | — | Pending |
| Performance | — | Pending |

---

## Bundle Analysis

Run after confirming baseline Lighthouse scores.

```bash
cd projects/theblacqlist
ANALYZE=true pnpm build
```

**Top 5 client-side chunks to investigate:**

| Chunk | Size | Action needed |
|---|---|---|
| — | — | Pending |
| — | — | Pending |
| — | — | Pending |
| — | — | Pending |
| — | — | Pending |

**Notes:** No `recharts` or chart library installed (project uses custom `TrendBar`), so the "lazy-load chart libs" item is N/A. ✅ `lucide-react` imports are **all named** (0 namespace imports across `app` + `components`), so icon tree-shaking is healthy. The `ANALYZE=true` chunk table below is the only deferred item — run it against the production build alongside the Lighthouse pass. **No `@next/bundle-analyzer` installed yet** (avoided a speculative dependency; add it only when running the prod bundle pass).

---

## Supabase Query Analysis

Review Supabase Dashboard → Logs → API Logs for the 3 highest-traffic paths.

| Path | Query count per page load | N+1 detected? | Action |
|---|---|---|---|
| BLACQList Page | Pending | Pending | |
| Search results | Pending | Pending | |
| Homepage | Pending | Pending | |

**GIN index verification:** ✅ confirmed in `supabase/migrations/20260510000000_initial_blacqlist_mvp_schema.sql`:
- `CREATE EXTENSION IF NOT EXISTS pg_trgm;` (line 43)
- `CREATE INDEX listings_search_vector_idx ON listings USING GIN (search_vector);` (line 365)
- trigger `update_listings_search_vector()` keeps the `search_vector` current on insert/update.

```sql
-- Optional runtime confirmation in Supabase Studio (prod):
EXPLAIN ANALYZE SELECT * FROM listings WHERE search_vector @@ plainto_tsquery('english', 'restaurant');
```
Expected: Index Scan on `listings_search_vector_idx`. If Sequential Scan appears, the index is missing.

---

## Performance Issues Log

| Issue | Page | Severity | Fix | Status |
|---|---|---|---|---|
| — | — | — | — | Pending |

---

## Go/No-Go Recommendation

**GO WITH CONDITIONS** — every locally-verifiable performance item is complete (ISR intervals correct, images optimized with `priority` heroes, named icon imports, GIN search index, `next` patched). The remaining work is **production-only by nature**: Lighthouse scores and the `ANALYZE=true` bundle pass must run against the Vercel deploy (localhost caching makes local scores meaningless). This card clears its local items; the production Lighthouse run is the condition, tracked alongside the production stand-up (091/092).

**Condition (production):**
- LCP <2.5s on BLACQList Page and homepage · CLS <0.1 · INP <200ms on the 5 representative pages — measured on the production URL.
- `ANALYZE=true pnpm build` chunk review on the production build.

**Note on the original "zero `<img>`" criterion:** 4 `<img>` remain by design (upload-preview overlays with `eslint-disable`); they are not page-render images and do not affect Core Web Vitals.
