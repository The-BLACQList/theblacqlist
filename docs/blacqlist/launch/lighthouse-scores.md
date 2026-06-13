# Lighthouse Performance Scores — The BLACQList

**Ticket:** 088  
**Status:** Pending — to be run on staging Vercel URL  
**Method:** Chrome DevTools → Lighthouse tab → Mobile preset → Navigation mode  
**Target:** LCP <2.5s · CLS <0.1 · INP <200ms · Performance score ≥ 80

---

## ISR Configuration Audit

Verify revalidation intervals match spec before running Lighthouse.

| Page | File | Expected `revalidate` | Confirmed |
|---|---|---|---|
| BLACQList Page | `app/(public)/[city-slug]/business/[listing-slug]/page.tsx` | 3600 (1h) | Pending |
| City landing | `app/(public)/city/[city-slug]/page.tsx` | 86400 (24h) | Pending |
| Homepage | `app/(public)/page.tsx` | 1800 (30m) | Pending |
| Collection pages | `app/(public)/collection/[slug]/page.tsx` | 3600 (1h) | Pending |
| Sitemap | `app/sitemap.ts` | 3600 (1h) | Pending |

---

## Image Optimization Audit

### `<img>` → `next/image` Conversions (completed this session)

| File | Status |
|---|---|
| `app/(public)/marketplace/products/[slug]/page.tsx` | ✅ Converted |
| `app/(public)/marketplace/services/[slug]/page.tsx` | ✅ Converted |
| `components/marketplace/ProductCard.tsx` | ✅ Converted |
| `components/marketplace/ServiceCard.tsx` | ✅ Converted |

### `priority` Prop on Above-the-Fold Images

Verify `priority` is set on the hero image in these files:

| File | Image | Has `priority`? |
|---|---|---|
| `app/(public)/[city-slug]/business/[listing-slug]/page.tsx` | Cover image (hero) | Pending check |
| `app/(public)/page.tsx` | Homepage hero | Pending check |

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

**Notes:** No `recharts` or chart library installed (project uses custom `TrendBar` component). Main risk is icon library tree-shaking — verify `lucide-react` imports are named (not namespace imports).

---

## Supabase Query Analysis

Review Supabase Dashboard → Logs → API Logs for the 3 highest-traffic paths.

| Path | Query count per page load | N+1 detected? | Action |
|---|---|---|---|
| BLACQList Page | Pending | Pending | |
| Search results | Pending | Pending | |
| Homepage | Pending | Pending | |

**GIN index verification:**
```sql
-- Run in Supabase Studio
EXPLAIN ANALYZE SELECT * FROM listings WHERE search_vector @@ plainto_tsquery('english', 'restaurant');
```
Expected: Index Scan on `search_vector_idx`. If Sequential Scan appears, the index is missing.

---

## Performance Issues Log

| Issue | Page | Severity | Fix | Status |
|---|---|---|---|---|
| — | — | — | — | Pending |

---

## Go/No-Go Recommendation

**PENDING** — Run Lighthouse on staging and update scores above.

**Go criteria:**
- LCP <2.5s on BLACQList Page and homepage
- CLS <0.1 on all 5 pages
- INP <200ms on all 5 pages
- No `<img>` tags remaining in the codebase (zero `no-img-element` lint suppressions)
