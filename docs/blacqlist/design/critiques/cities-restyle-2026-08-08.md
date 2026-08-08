# Design Critique — `/cities` restyle (`app/(public)/cities/page.tsx`)

**Reviewed by:** design-critic · **Date:** 2026-08-08 · **Branch:** `feat/cities-restyle`
**Against references:** `docs/blacqlist/design/living-commerce-index.md` (adopted direction; this exact
page is named as the problem at lines ~29–32, ~46) + `docs/blacqlist/design/design-references.md`
**Standards:** `.claude/rules/visual-design.md` (craft) + `.claude/rules/design-system.md` (baseline)
**Sibling grammar checked against:** `components/home/CityChapters.tsx`, `components/home/HomeCategories.tsx`,
`app/(public)/collections/page.tsx`, `app/(public)/discover/[citySlug]/page.tsx`

---

## Verdict: ITERATE

No ✗ Fail and no "could be any product" tell — this reads as *this* product: the flat-black bento
tiles, the ember-gold node wash, the `Coming soon` chip row all carry the house grammar established
in `HomeCategories`/`CityChapters`, and the restyle directly answers the exact problem the brief
named (white cards → dark bento hierarchy; hidden coming-soon cities → a visible, quiet chip row).
The bento hierarchy is real, not decorative — the feature tile earns its size with more data (metro
line), not just more pixels. The single most important thing to fix before calling this done isn't
visual: the page has no way to tell a genuine "no live cities yet" state apart from a failed Supabase
query — both currently render the same reassuring `EmptyState`, which is a correctness problem
wearing a design-polish disguise. Fix that, verify the tile type ramp against a real long city name
at 375px, and this ships.

---

## Findings

| # | Dimension | Verdict | Issue | Fix |
|---|---|---|---|---|
| 1 | References & standards | ✓ Pass | `living-commerce-index.md` + `design-references.md` exist and this page is explicitly named as the target of the restyle; the delta matches the committed borrow items (dark chapter tiles, "coming-soon cities stay quiet/typographic," LCI line 47). | None — keep citing the source lines in the component comment as done. |
| 2 | Hierarchy | ✓ Pass | The feature tile isn't just bigger: `col-span-2 row-span-2` + a real type jump (19/24px → 30/40px) + an extra metro-area line it alone carries. That's a genuine third axis of hierarchy, not one lever pulled harder. Minor: *why* Atlanta (say) is the feature tile is only inferable by comparing count lines across the grid — there's no explicit "most active chapter" cue. | Add a one-word rationale label on the feature tile only (e.g. a small `Most active` eyebrow above the name) so the size jump reads as intentional data at a glance, not an arbitrary variant. |
| 3 | Type | ⚠ Risk | City-name spans have no `truncate`/`line-clamp`, tiles sit in fixed `auto-rows-[132px]` tracks, and the `Link` wrapper is `overflow-hidden`. A two-word city name (`Winston-Salem`, `Colorado Springs`) wrapping to 2 lines at the 375px/2-col tile width (~165px, ~100px usable height after `p-4`) risks the count line getting clipped by the hard row height. Untested against real data. | Add `line-clamp-2` to the name span (matches the `truncate` already used on the feature tile's metro line) and spot-check the longest city name in the `cities` table at 375px before merging. |
| 3b | Type | ⚠ Risk (pre-existing, sitewide) | H1 uses static breakpoint jump (`text-4xl md:text-5xl`) rather than fluid `clamp()`, per visual-design.md's fluid-heading guidance. Matches `collections/page.tsx` exactly — a house-wide pattern, not a regression introduced here. | Not a blocker for this page; if/when the type scale is revisited sitewide, convert display headings to `clamp()`. |
| 4 | Spacing & layout | ✓ Pass | `gap-3`, `p-4`/`p-5`, `Container`'s `px-4 md:px-6 lg:px-8` all match the approved Tailwind scale and the sibling bento components exactly. The arbitrary pixel row heights (`auto-rows-[132px]`) are justified — bento math needs pixel precision — and match `HomeCategories`' own `110px`/`130px` precedent. No sideways scroll. | None. |
| 5 | Color | ✓ Pass, with a debt note | Binding gold-on-dark / amber-on-light rule followed correctly on every surface (`text-amber` eyebrow on `pale-lavender`; `text-gold`/`text-light-gold` only on `bg-deep-bg` tiles). `EMBER_WASH` is copy-pasted verbatim as an inline style string in **three** files now (this page, `CityChapters.tsx`, `HomeCategories.tsx`). | Promote `EMBER_WASH` to one shared constant (or a CSS custom property / utility class) so a future tuning pass edits one place, not three in sync. |
| 6 | Contrast & theming | ✓ Pass | Gold `#c4a065` on `#08080a` ≈ 8:1; amber `#8f6600` on `pale-lavender` ≈ 5:1+ — both clear AA with real margin. The flagged `text-white/70` on the feature tile's metro line ≈ 9–10:1 against the near-black tile — comfortably AA. Single light theme with dark "surface islands" as a deliberate, stated brand device (not an omission) is consistent with every dark tile sitewide. | `text-white/70` is the **right call for now** — there is genuinely no dark-surface muted-text token in `globals.css` (the code comment confirms `charcoal-soft`/`charcoal-faint` are light-surface only). Formalize a token (e.g. `--color-ink-soft-on-dark`) rather than letting `white/NN` opacity utilities proliferate as more dark tiles grow a third line of text. |
| 7 | Motion | ✓ Pass | `Reveal` is used at section-boundary granularity — one wrap around the live grid, one (delayed 80ms) around the coming-soon block — not per-tile stagger. GPU-friendly properties (opacity/transform, plus a cheap color transition on hover). Reduced motion is handled entirely by the CSS media-query gate in `.blacq-reveal`, a genuine static fallback with zero JS branching. | None. |
| 8 | Genericness | ✓ Pass | Clears the project's own bar from `design-references.md` (needs 2 of 4; this hits 3: gold-node signature via the ember wash + gold text, editorial type hierarchy via the feature-tile ramp, black/cream surface language via dark tiles inside an off-white section). `rounded-xl` (not default `rounded-lg`), no shadow-sm cards, no raw slate/gray, no emoji markers. Reads as this brand, not shadcn-default. | None — but see #8b. |
| 8b | Genericness / trend-fit | ⚠ Risk (roadmap, not a blocker) | The page is currently 100% type + color, zero photography — the single biggest gap against the LCI's own formula (photography at 50–60% presence, "the photography reads as belonging to the hero, not the brand" is literally the problem statement being fixed). This mirrors the same interim state already shipped in `HomeCategories`/`CityChapters` pending the Phase 1 photographic system, so it's correctly sequenced, not a regression — but it means this page still doesn't fully deliver the adopted vision, only the achievable slice of it. | No action now. Sequence real per-city photography into these tiles when Phase 1 (photographic system) lands; flag as a named fast-follow so it doesn't quietly become permanent. |
| 9 | Trend-fit / longevity | ✓ Pass | The bento grid here encodes real editorial hierarchy (busiest-city-first, by live data) — exactly the case `design-references.md` pre-approved as passing the will-this-age test ("passes when proportions encode editorial hierarchy... fails when it's decoration"). | None. |
| 10 | Component polish | ⚠ Risk | Hover/focus states present and visible (`focus-visible:outline-amber`, hover intensifies the wash + turns text `light-gold`); coming-soon status is encoded as a bordered pill with a text label, not color alone; radius/elevation are intentional (flat dark tiles, no shadow). **But**: the route has no `loading.tsx` — the two `Promise.all` Supabase queries run unsuspended in a Server Component, so the page paints blank until both resolve. And neither `citiesRes.error` nor `listingsRes.error` is checked — a failed query silently falls through to `?? []`, which renders the *same* `EmptyState` ("No city chapters are live yet") as a genuinely-empty city table. A technical failure gets presented to the user as a roadmap fact. | Add a route-level `loading.tsx` with a skeleton matching the bento tile shapes (feature + standard). Check `citiesRes.error`/`listingsRes.error` explicitly and render a distinct "Couldn't load this page — Try again" state per `ux.md`'s three-empty-state-types rule, instead of conflating load failure with "no data yet." |

---

## Prioritized fixes

1. **[Should]** Stop conflating query failure with "no cities yet" — check `citiesRes.error` / `listingsRes.error` and render a distinct load-failure state (retry action), not the same reassuring `EmptyState` used for a genuinely empty table.
2. **[Should]** Add `app/(public)/cities/loading.tsx` — a skeleton bento grid (one large feature block + standard tiles) so the route doesn't paint blank while the two Supabase queries resolve.
3. **[Should]** Add `line-clamp-2` to the tile name span and spot-check the longest real city name at 375px/2-col — the fixed `auto-rows-[132px]` track + `overflow-hidden` wrapper risks clipping a wrapped 2-line name plus its count line.
4. **[Polish]** Give the feature tile a one-word rationale ("Most active" or similar) so the size jump reads as intentional data, not arbitrary variation.
5. **[Polish]** Deduplicate `EMBER_WASH` — one shared constant instead of the same inline gradient string copy-pasted into this file, `CityChapters.tsx`, and `HomeCategories.tsx`.
6. **[Polish]** Formalize a dark-surface muted-text token (e.g. `--color-ink-soft-on-dark`) so future dark tiles that need secondary text stop reaching for ad hoc `white/NN` opacity utilities. `text-white/70` itself is fine to keep here (clears AA ~9–10:1) — this is about the token layer, not this instance.
7. **[Note, not gating]** Zero photography on this page is the largest remaining gap against the adopted Living Commerce Index vision. Correctly sequenced behind the Phase 1 photographic system (matches the same interim treatment already live on the homepage) — track it as a named fast-follow so it doesn't quietly become the permanent state.

---

## Iterate

Ship fixes #1–#3 (the two correctness/state gaps and the untested overflow risk) before merging —
these are the items standing between this page and a clean SHIP. #4–#6 are real but non-blocking
polish; batch them whenever `HomeCategories`/`CityChapters` next get touched, since all three share
the pattern. #7 requires no code change now — just don't let it fall off the roadmap once Phase 1
photography assets exist.

**Re-critique after the fix:** dimension 3 (Type — confirm the clamp fix against real data) and
dimension 10 (Component polish — confirm the load-failure state is now visually distinct from the
empty state, and that the skeleton's shape actually matches the loaded bento grid). Everything else
above is already a Pass and does not need a second pass unless it's touched incidentally.
