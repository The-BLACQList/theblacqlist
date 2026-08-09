# 113 — City imagery (city tiles + city page hero)

| | |
|---|---|
| **Phase** | V1.5 |
| **Priority** | P3 |
| **Status** | Documented, not built — **needs decision** |
| **Depends on** | — |
| **Gates** | **GATE-DATA** (adds a column to `cities`), then GATE-DEPLOY |
| **Written** | 2026-08-09 |

---

## Why this is a ticket and not a change

`photographic-style-direction.md` puts city tiles at **Priority 7** — the last slot in its own
priority order — and already defers them. Three findings make building it now the wrong call:

1. **`cities` has no image column.** `cover_image_path` exists on `listings`, `collections`,
   `editorial_articles`, and `guides`, but not on `cities`
   `[Measured — psql prod, 2026-08-09]`. Adding it is a migration, and migrations against
   production are **GATE-DATA**.
2. **We have no city photography.** The twelve licensed photos in `public/images/editorial/` are
   business-themed — a bookshop, a kitchen, a fitness studio — not skylines or streetscapes. None
   of them can honestly stand in for Atlanta, Houston, or Chicago.
3. **Thirteen cities, three of them live.** ATL / HOU / CHI carry essentially all published
   listings; the other ten are near-empty. Sourcing thirteen city images before ten of those
   cities have content is work ahead of its own demand.

Nothing is broken today: city surfaces render type and the existing layout, with no empty image
slot waiting to be filled.

---

## Scope when this is picked up

**Data (GATE-DATA).**

```sql
alter table cities add column cover_image_path text;
```

Additive, nullable, backward-compatible; the down-plan is a single `drop column`. Follow the same
convention as the other four tables: store a **Supabase Storage path** (bucket `listing-media`, or
a new `city-media` bucket if buckets are to be separated by content type — decide before the
migration, not after), never a URL. `lib/listings/coverImage.ts` already exports `resolveMediaPath`,
which turns a stored path into something `next/image` can load; reuse it rather than building a
second rule.

**Assets.** Thirteen images, or three if the scope is narrowed to the live cities — which is the
recommendation. Requirements:

| | |
|---|---|
| Ratio | 3:2 (house ratio — `photographic-style-direction.md`, and every existing asset) |
| Delivered | 1600px wide WebP, ≤150 KB — run `pnpm images:editorial` |
| Content | Recognizably the city, not a generic urban stock skyline |
| Licensing | Source / author / license / commercial-use recorded **before** the file is committed (`.claude/rules/3d-assets.md`); add rows to `docs/blacqlist/design/editorial-image-licenses.md` |
| Alt text | Names the city — these are informative, not decorative, so `alt=""` is wrong here (unlike the `/about` editorial photos) |

**Surfaces.** City tiles wherever cities are listed, and the `/[citySlug]` page hero. Every slot
must degrade when `cover_image_path` is null — the ten quiet cities will have no image for a long
time, and a half-filled grid of images and blanks looks worse than a grid with none.

---

## Open decisions for the founder

1. **Three cities or thirteen?** Recommendation: **three** (ATL / HOU / CHI). Ship images where
   there is content; leave the rest on the type-only treatment.
2. **Photography or the abstract treatment?** The same fork already settled for business covers
   (`[Decision — 023, 2026-08-09]`) applies here — except the objection that killed stock on
   business cards does **not** apply to cities. A photo of Atlanta misrepresents nobody. So
   licensed city photography is legitimate here in a way it was not there.
3. **Bucket:** reuse `listing-media`, or create `city-media`? Affects the migration, so decide first.

## Definition of done

- [ ] Founder answers the three decisions above
- [ ] Migration written with a down-plan; applied to staging and verified; **GATE-DATA** for production
- [ ] Assets licensed, recorded, optimized (≤150 KB, 3:2 WebP), committed
- [ ] City tiles and the `/[citySlug]` hero read the column and degrade cleanly when null
- [ ] Alt text names the city
- [ ] Lighthouse LCP on `/[citySlug]` no worse than before
