# 113 — City imagery (city tiles)

| | |
|---|---|
| **Phase** | V1.5 |
| **Priority** | P3 |
| **Status** | **Decided — buildable. Blocked only on the three photographs.** |
| **Depends on** | Founder hands over 3 city photographs |
| **Gates** | **GATE-DEPLOY** only |
| **Written** | 2026-08-09 |
| **Decided** | 2026-08-09 — decision-log 026 |

---

## The three decisions

All three open questions are answered `[Decision — founder, 2026-08-09]`:

| Question | Answer |
|---|---|
| **How many cities?** | **Three** — Atlanta, Houston, Chicago. The other ten stay on the type-only treatment until they have listings. |
| **Photography or the abstract treatment?** | **Licensed city photography.** The objection that ruled out stock on business cards (decision 023) does not reach here — a skyline depicts no individual business, so nothing is misrepresented. |
| **Storage: `listing-media`, `city-media`, or something else?** | **Repo files, no DB column.** `public/images/cities/{slug}.webp` with a slug→file map in code. |

### What the storage answer removes

The prior draft of this ticket was built around `alter table cities add column cover_image_path text`, a bucket choice, a down-plan, and reuse of `resolveMediaPath`. **None of that is needed.**

Three images that change roughly annually are not user content — they are site assets, the same category as `hero-bg.jpg`. Putting them in the repo means:

- **No migration.** **GATE-DATA is no longer reached by this ticket at all.**
- No bucket policy, no signed-URL path, no `resolveMediaPath` call — `next/image` loads `/images/cities/atlanta.webp` directly.
- No admin UI needed to set a value, and no null-handling in the database layer.

The cost is that adding a fourth city is a code change rather than a DB write. At three cities changing about once a year, that is the cheaper side of the trade.

---

## Scope

### Assets — 3 photographs (founder sources)

| | |
|---|---|
| Ratio | **3:2** — house ratio (`photographic-style-direction.md`; every existing asset) |
| Delivered | **1600px wide WebP, ≤150 KB** — run `pnpm images:editorial` |
| Content | Recognizably the city: skyline, neighborhood, or landmark. Not a generic urban stock skyline. |
| Source | **Canva Pro is valid here.** No named business appears, so restriction 2 (implied endorsement) doesn't bite, and a city tile is not a brand mark, so restriction 3 doesn't either. See `docs/blacqlist/design/editorial-image-licenses.md`. |
| Licensing | Source / author / license / commercial-use recorded **before** the file is committed (`.claude/rules/3d-assets.md`). Add three rows to `editorial-image-licenses.md`. |
| Filenames | `atlanta.webp`, `houston.webp`, `chicago.webp` — the city slug, nothing else. Do **not** repeat the aspirational-business-name mistake documented in the license doc's Naming caution. |

Files land in `public/images/cities/`.

### Code — a lookup plus two components

**The map.** One exported constant, keyed by city slug, returning a public path or `undefined`. Three entries. It belongs next to `lib/design/surfaces.ts` or in `lib/listings/coverImage.ts` — not inlined in a component, since two surfaces read it.

**Surface 1 — `app/(public)/cities/page.tsx:141-190`.** The bento grid of live cities. Each tile is a dark `bg-deep-bg` card with an absolutely-positioned `EMBER_WASH` span behind relative-positioned text.

**Surface 2 — `components/home/CityChapters.tsx:36-54`.** The homepage city chapters row. Structurally identical: same `bg-deep-bg` card, same absolute `EMBER_WASH` span, same relative text on top.

Both take the same change:

- **Photo present** → render a `next/image` `fill` `object-cover` beneath, then the legibility scrim `bg-gradient-to-t from-black/80 via-black/40 to-transparent` in place of the wash. Reuse that token; do not invent a new gradient.
- **No photo** → keep `EMBER_WASH` exactly as it renders today.

Ten of thirteen cities will have no photo for a long time. **That is the intended end state, not a gap** — an image only where there is real content keeps the grid honest about where the depth is. Do not fill the other ten to make the grid uniform.

### Alt text

**Names the city:** `alt="Atlanta skyline"`. These are informative, unlike the `/about` editorial photos where the adjacent heading supplies the context and `alt=""` is correct.

The `EMBER_WASH` span stays `aria-hidden="true"` in the no-photo case — it is decoration.

---

## Not in scope

**There is no city page hero.** The earlier draft listed "the `/[citySlug]` page hero" as a third surface. `app/(public)/discover/[citySlug]/page.tsx` has no hero — it opens on a search bar, filters, and the results grid `[Observed, 2026-08-09]`. Adding one is a separate design decision, not part of this ticket.

---

## Definition of done

- [ ] Three photographs sourced, licensed, and recorded in `editorial-image-licenses.md` **before** commit
- [ ] Optimized to 3:2 / 1600px / ≤150 KB WebP; committed to `public/images/cities/`
- [ ] Slug→path map exported from one place and read by both surfaces
- [ ] Both surfaces render the photo + scrim when present and fall back to `EMBER_WASH` when absent
- [ ] Alt text names the city on every photo tile
- [ ] Lighthouse LCP on `/cities` and `/` no worse than before — these tiles are above the fold on `/cities`
- [ ] `pnpm typecheck lint test:unit build` green; Playwright `e2e/` green; 6/6 CI on the PR
- [ ] **GATE-DEPLOY** to merge
