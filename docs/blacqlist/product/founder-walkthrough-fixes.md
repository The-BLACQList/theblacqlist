# Founder Walkthrough Fixes — Implementation Plan

**Date:** 2026-09-03
**Source:** Founder feedback after walking the tester tour on production (M4.11)
**Status:** Plan approved on four open decisions; PR 1 not yet started

---

## The five items, and what they actually turned out to be

| # | Founder's words | Root cause found |
|---|---|---|
| 1 | "Save on discover is hard to differentiate from hearting on the page. Are these the same action? The highlights aren't obvious enough." | **Same action, three metaphors.** Both `POST /api/saves`, same row. Bookmark on cards, heart on the page, filled amber bookmark in the stats block. Worse: the saved background on the listing page **has never rendered** — the hero passes `bg-white/20` in `className`, which tailwind-merge applies *after* the saved-state `bg-amber-gold/20`. The only saved signal shipped so far is a glyph swap. |
| 2a | "When I save the listing, the check doesn't trigger on the tour." | **It did fire.** The save moved the step `act` → `reflect`. But a collapsed `act` row and a collapsed `reflect` row render byte-identically (`TourStepRow.tsx:55`), so the rail did not change one pixel. The step is reflection-gated and needs a written note; nothing said so. |
| 2b | "Does Cloudflare Turnstile have to be on every listing page? I don't like it." | Not every listing page — **every page where he is eligible to review.** There is no "write a review" affordance, so the whole form (and its captcha) mounts eagerly on load. |
| 3 | "As an admin I need to search the entities page quickly by typing and filtering." | No search exists. Also: the queue does not filter `deleted_at`, and four statuses are unreachable because there is no "All" tab. |
| 4 | "The Carter & Co. Consulting (Demo) page looks amazing. Every listing page should look just as nice." | Carter & Co. renders through `ProfessionalTemplate`. **~250 of 254 published listings** use a plainer path with no immersive hero, anchor tabs, info rail, sticky trust panel, inquiry band or reveal motion — and lead with At-a-Glance instead of Offerings. Events and jobs additionally ship a **dead `href="#"` hero CTA**. |
| 5 | "No businesses in the Products & Services bin — online-only, no address, mobile, service-based." | **100% of the seeded catalog is `entity_type='business'`** (all 379 rows). Not a filter bug. The founder's description is a literal description of `listings.location_type`, which is already a live facet — and is already wrong: **65 published listings have no address yet are labelled `physical`.** |

---

## Decisions locked (2026-09-03)

| # | Decision | Rationale |
|---|---|---|
| **D-1** | **Bookmark everywhere.** One glyph across cards, listing page, and stats. Saved = *filled*, not a different glyph. | A heart reads as a public "like"; a bookmark reads as "save to my list", which is what `/account/saved` actually is. Heart would have forced a vocabulary change across `/account/saved` and "N people have saved this listing". |
| **D-2** | **Keep the reflection gate; make it visible.** Saving does not tick the step on its own. | Removing the gate means editing `lib/tour/steps.ts` — on the M4.13 do-not-touch list, paired with a DB CHECK — and drops the written reflection the tour exists to collect. The bug was invisibility, not the gate. |
| **D-3** | **Products & Services is defined by `location_type`**, not by re-typing listings. Bin = `virtual, hybrid, service_area, national, traveling`. | Matches the founder's own words, is already a live facet, and needs the correction pass either way. Re-typing ~250 rows' `entity_type` is a far larger destructive write that *still* needs the same pass afterwards. |
| **D-4** | **Events get reviews. Jobs do not.** | A past event is genuinely reviewable and reviews are its only social proof. Reviewing a job posting is meaningless and invites abuse. |

---

## PR sequence

Four waves. Two-file fixes ship first so there is visible movement on a Preview within a day; shared-surface refactors follow so nothing rebases; every production data write is last, behind a gate.

| # | PR | Item | Size | Why here |
|---|---|---|---|---|
| **1** | `fix(reviews): mount the review form on intent` | 2b | ~3 files | Smallest, zero shared surface, kills the most visceral complaint. Independent. |
| **2** | `feat(admin): search + filter the entities queue` | 3 | ~4 files | Fully self-contained (`app/admin/entities/**`). Parallelisable with PR 1. |
| **3** | `fix(saves): one save metaphor, one visible saved state` | 1 | ~8 files | Adds `data-tour` to the card control — must land **before** PR 4, which edits the same test file. |
| **4** | `fix(tour): make "we saw it, now write your note" visible` | 2a | ~5 files | Depends on PR 3 only for `tests/tester-tour-anchors.test.ts`. |
| **5** | `fix(listing): dead CTAs, wrong related, raw location slugs` | 4 (defects) | ~7 files | Pure defect fix, no layout change. Shippable immediately. |
| **6** | `feat(listing): route every type through the template system` | 4 (parity) | ~10 files | Sits on PR 5's `getCtaHref` + shared location labels. |
| **7** | `fix(discovery): one name, one definition for Products & Services` | 5 (code) | ~7 files + 1 migration | **GATE-DATA.** Ships the honest bin even before the data is corrected. |
| **8** | `chore(data): location_type correction pass` | 5 (data) | 1 script + report | **GATE-DATA.** Dry-run → founder CSV review → apply. |

**Do not merge 6 and 7 together** — both touch `/discover` adjacency and would produce a 400-line diff nobody reviews properly.

---

## PR 1 — Turnstile mounts on intent

### Files
- **New `components/entity-page/ReviewFormDisclosure.tsx`** (`'use client'`) — `useState(false)`, imports `ReviewForm` **directly**. Do not pass `ReviewForm` down as `children` from the server parent: a client child handed down as `children` still mounts, which is the exact thing being fixed. Trigger carries `data-tour="write-review"`, labelled "Write a review" / "Be the first to review". `useEffect` opens it when `window.location.hash` is `#review-body` or `#write-review` so deep links and the tour spotlight still land. Reuse the disclosure shape already in `ReportCorrectionForm.tsx:37,56-63`.
- **`EntityReviewsSection.tsx:232-241`** — swap `<ReviewForm>` for `<ReviewFormDisclosure>`. `canReview` at `:159` unchanged.
- **`ReviewForm.tsx:266`** — unchanged. `TurnstileWidget` stays exactly where it is; this changes *when the form mounts*, never whether submit is protected.
- **`lib/tour/targets.ts:100-106`** — `review_or_correction.selectors` becomes `['#review-body', '[data-tour="write-review"]', '[data-tour="report-correction"]']`. Order is load-bearing. `targets.ts` is **not** on the M4.13 do-not-touch list.

### Acceptance criteria
- Signed in as a non-owner who has not reviewed: **zero requests to `challenges.cloudflare.com`** and `TurnstileWidget`'s 200ms poll never starts, until the trigger is clicked.
- After clicking, the form is identical to today's; `createReviewAction` still verifies (`lib/actions/reviews/createReview.ts:29` and `lib/security/turnstile.ts` untouched).
- Tour step 5 still finds a target with the form closed.
- Sign-in / sign-up / forgot-password / `ClaimForm` untouched.

### Tests
- `tests/turnstile.test.ts` — source-text: `EntityReviewsSection.tsx` no longer contains `<ReviewForm`; the disclosure contains both `useState` and `<ReviewForm`; `ReviewForm.tsx` still contains `<TurnstileWidget />`.
- `tests/tester-tour-anchors.test.ts` — add the `[data-tour="write-review"]` ANCHORS entry.
- **New `e2e/review-form-intent.spec.ts`** — `page.route('**/challenges.cloudflare.com/**')` counter: 0 on load, ≥1 after click. The only test that proves the complaint is fixed.

**Note:** keep the button on zero-review listings rather than auto-opening — label it "Be the first to review". One tap is not friction; a captcha on load is.

---

## PR 2 — Admin entities search

### Files
- **New `lib/db/like.ts`** — move `escapeLikePattern` out of `app/api/listings/search/route.ts:39-41`; both call sites import it. Copying it a third time is how the `location_type` retyped-list bug happened.
- **New `lib/admin/entitySearch.ts`** (pure, node-testable): `ADMIN_ENTITY_STATUSES`, `parseAdminEntityParams`, `sanitizeAdminQuery`, `adminEntitiesHref`.
- **`app/admin/entities/page.tsx`** — `q` param; add the missing `.is('deleted_at', null)` at `:32-39`; `.or('name.ilike…,tagline.ilike…')` when `q.trim().length >= 2`; `.eq('status', …)` only when `status !== 'all'`; add an **"All"** tab to `STATUS_TABS` (`:43-47`) so draft/unpublished/flagged/archived become reachable for the first time; route **every** href at `:60-72` and `:151-175` through `adminEntitiesHref` so `q` survives tab and page clicks; q-aware empty state.
- **New `app/admin/entities/_components/EntitySearchInput.tsx`** (`'use client'`) — native `<input type="search">`. **Do not install `input`/`command`/`cmdk`**; `components.json` carries only badge/button/dialog/separator/sheet/skeleton. Debounce constants mirror `ListingCombobox.tsx:47-48` (`MIN_QUERY_LENGTH = 2`, `DEBOUNCE_MS = 250`). `router.replace` (not `push`). Deletes `page` on every keystroke. "Clear" button mirroring `SearchFilters.tsx:79-86`. `<p aria-live="polite">{count} matches</p>`.

### ⚠ Gotcha
PostgREST `.or()` takes a **comma-delimited string** — a query containing `,` `(` or `)` corrupts the filter expression (a parse break, not an injection). `escapeLikePattern` handles `%` `_` `\` only. `sanitizeAdminQuery` must additionally strip `,()`.

### Behaviour decision
When `q` is non-empty and no explicit `status` is in the URL, scope to **`all`**. A search that hides the answer because it is in the wrong tab is worse than no search; the Status column at `:127-129` keeps the result legible.

### Acceptance criteria
- "carter" finds the listing on **any page, any status** — not just the visible 25.
- `q` survives a status-tab click and Prev/Next.
- `?q=50%` and `?q=a,b` return sane results and never 400.
- Soft-deleted listings no longer appear.
- No new npm dependency.

### Tests
- **New `tests/admin-entities-search.test.ts`** — `sanitizeAdminQuery('50%')`, `('a_b')`, `('a,b(c)')`; `adminEntitiesHref` round-trips `q` across status and page; `parseAdminEntityParams` clamps `page`, rejects unknown `status`.
- Repoint any `escapeLikePattern` assertion in `tests/listings-search.test.ts` at `lib/db/like.ts`.
- **New `e2e/admin-entities.spec.ts`** — uses the existing `loginAsAdmin` fixture (`e2e/helpers/auth.ts:91`).

**Deferred:** `entity_type` / `trust_tier` selects — ship a `filters` slot so adding two `<select>`s (copying `SearchFilters.tsx:44-76`) is a 20-line follow-up. **No trigram index** — 257 rows, sub-millisecond seq scan; an index is a migration and therefore GATE-DATA for zero measured benefit.

---

## PR 3 — One save metaphor, one visible saved state — **D-1: Bookmark**

### `components/ui/save-icon-button.tsx`
- `Bookmark` in both states (`:74`/`:76`); saved renders `fill="currentColor"`. **Drop `BookmarkCheck`** — a different glyph is a weaker signal than a filled one.
- Container (`:66-70`) stops being byte-identical: unsaved `bg-black/50 text-white hover:bg-black/70`; saved `bg-amber-gold text-brand-black ring-2 ring-white/70` — a filled gold pill against a photo, legible at card size.
- Add `data-tour="save-listing"` (feeds PR 4).
- **Fix the silent rollback** (`:44-54`): add `failed` state. On non-401 failure, roll back *and* set `failed`; red ring ~4s, live region reads "Couldn't save. Try again." Today a 500 flips the icon back with zero explanation.
- **Fix the live region** (`:79-82`): it mounts containing `"{name} removed from saved"` for a listing that was never saved — on a 24-card grid that is 24 blocks of misleading text in the a11y tree. Seed with `''`; write only after a user-initiated toggle. **Same bug at `SaveButton.tsx:74-78`.**
- `justSaved` set **only in the click handler** (never from `initialIsSaved`, or every saved card pops on load) → `blacq-save-pop`, cleared on `animationend` or a 400ms timeout.

### `components/entity-page/SaveButton.tsx`
- `Heart` → `Bookmark` (`:107-110`, `:135-138`), filled when saved.
- **Fix the tailwind-merge override at its root.** `EntityPageHero.tsx:126` and `TemplateHero.tsx:155` pass `bg-white/20 hover:bg-white/30 backdrop-blur-sm` in `className`; `cn()` merges it *after* the saved-state `bg-amber-gold/20` at `:140`, so the saved background has never rendered in either hero. The durable fix is not reordering args — it is **taking the surface away from the caller**: add `surface?: 'hero' | 'bar' | 'light'`, and let `SaveButton` own both the unsaved *and* saved surface for each. Then no call site can collapse it again.
  - `EntityPageHero.tsx:123-127` → `className="size-11"` + `surface="hero"`
  - `TemplateHero.tsx:153-157` → `className="size-12"` + `surface="hero"`
  - `EntityQuickActionBar.tsx:76-81`, `:139` → `surface="bar"`
  - `app/account/saved/page.tsx:225` → `surface="light"`
- Saved on `hero`: `bg-amber-gold text-brand-black` — **solid, not `/20`**. `/20` over a photo is invisible even when it does render.
- Keep `data-tour="save-listing"` on **both** variants (`:98`, `:127`) — `tests/tester-tour-anchors.test.ts:51` asserts `minCount: 2`.
- **Use `variant='pill'` in the hero.** It has zero call sites today. A labelled "Save" / "Saved" pill beside the gold CTA is strictly more obvious than any icon, and the complaint is literally "the highlights aren't obvious enough". Icons stay in the quick-action bar and on cards where space is real. **Highest-impact single change in this item.**

### `app/globals.css`
Add next to `blacq-pin-pop` (`:203`), following the house pattern — motion lives **inside** the `no-preference` query (`:154`, `:175`, `:246`), never as a base rule with a `reduce` kill-switch (`.blacq-map-highlight` at `:199-215` is the legacy form; do not copy it):

```css
.blacq-save-pop { /* no animation in the base rule */ }
@media (prefers-reduced-motion: no-preference) {
  .blacq-save-pop { animation: blacq-save-pop 0.25s cubic-bezier(0.34,1.56,0.64,1) both; }
  @keyframes blacq-save-pop { 0%{transform:scale(1)} 45%{transform:scale(1.22)} 100%{transform:scale(1)} }
}
```

Reduced-motion users get the colour change, which is the actual signal; the pop is garnish.

**No toast library, no animation library.** The state change is on the control just touched, in the eye line, with a live region. A global toast is a new dependency plus a new z-index conversation against the `z-50` header and `z-40` tour rail.

### Acceptance criteria
- Saved vs unsaved distinguishable at card size **by colour alone**, not just glyph.
- The saved background actually renders in both heroes (regression-tested).
- One icon family across `EntityCard` → `SaveButton` → `EntityPlatformActivity`.
- A failed save shows a visible error and an accurate live-region message; never silently reverts.
- Live regions empty at mount.
- The pop never fires on load for already-saved cards; absent under `prefers-reduced-motion: reduce`.
- Gold-on-scrim and brand-black-on-gold both pass AA — verify with `e2e/contrast.spec.ts` / `scripts/measure-panel-contrast.ts`.

### Tests
**New `tests/save-controls.test.ts`** (source-text, the `tester-tour-anchors.test.ts` technique): both save files import `Bookmark` and neither imports `Heart`; neither live region is seeded with non-empty text; **`EntityPageHero.tsx`, `TemplateHero.tsx`, `EntityQuickActionBar.tsx` pass no `bg-` class to `SaveButton`** (the regression guard for the tailwind-merge bug); `globals.css` defines `blacq-save-pop` with no `animation:` in the base rule.
Plus **new `e2e/save-affordance.spec.ts`** — save from a card, assert `aria-pressed="true"` + saved class, reload, assert persistence, open the listing page, assert the hero control also reads saved.

---

## PR 4 — The tour tells you something happened — **D-2: gate stays**

Untouched, and this list is itself an acceptance criterion: `TourRailMount.tsx` · `witness.ts` · `verify.ts` · `app/api/tour/state/route.ts` · `submitReflection.ts` · `routes.ts` · **`steps.ts`** · `app/layout.tsx`.

### Files
- **`lib/tour/progress.ts`** — three pure, node-testable additions: `pendingReflectionCount(steps)`, `rowMarker(status): 'check' | 'pencil' | 'number'`, `attentionStep(prev, next): string | null` (mirrors the existing `announceTransition` at `:96-130` — same diff, different consumer).
- **`components/tour/useTourState.ts`** — expose `attention` on `TourStateHandle`, set inside `apply()` from `attentionStep(previous.current, snapshot)` *before* `previous` is overwritten (same ordering discipline as `:158-160`). **Not an optimistic tick** — derived from the server payload that just landed; the invariant at `:22-26` holds.
- **`components/tour/TourStepRow.tsx`** — the real fix. Add `const needsNote = step.status === 'reflect'` beside `done` (`:55`). Marker bubble (`:126-137`): done → gold `Check`; needsNote → **gold-ringed `Pencil`** on `border-amber-gold bg-amber-gold/10`; else the numeral. When `needsNote` and collapsed, render a visible amber **"Add your note"** chip after the title — the thing the founder never saw. `sr-only` at `:143` gains a third branch: `' — we can see it; add your note to finish'`.
- **`components/tour/TourRail.tsx`** — `useEffect(() => { if (attention) setOpenStep(attention) }, [attention])`. `currentStepKey` returns the *first* not-done step (`search_ran` on a fresh tour), so following the tour would never open the row that changed. This does not navigate and does not violate D-T3 — it opens an accordion in a panel already on screen. Header count (`:153`) keeps `{done}/{total}` — **never inflate `doneCount`** — and gains a second amber line: `1 step is waiting on your note`. Collapsed pill (`:159-171`) appends `· 1 note`. **`z-40` stays literally in the file** at `:161` and `:177`.

### Two consequences of PR 3's card anchor — call out in review, not regressions
1. `EVIDENCE_SELECTORS` (`useTourState.ts:79-81`) is derived from the target table, so a **card** save now fires the chase (`CHASE_DELAYS = [700,1600,3200]`) where today it fires nothing.
2. `resolveVisibleTarget` will now find a save control on `/discover`, so step 3's "Show me" spotlights the first card's bookmark instead of offering a trip. Genuine improvement.

### Limitations to state in the PR description
`verify.ts:116-132` requires `save.listings.owner_user_id !== userId`, so a tester saving **their own** listing will never tick — and `verify.ts` is untouchable, so the hint copy cannot say so. Tell the founder in words. A save still cannot reach `done` without ≥20 trimmed characters (`steps.ts:54-58`); after this PR the rail *says so, visibly*, which is the actual bug.

### Acceptance criteria
- Saving produces a **visible change in a collapsed rail within ~3.2s**: gold pencil marker, "Add your note" chip, row auto-expands to the textarea, header reads "1 step is waiting on your note".
- `doneCount` still only counts `status === 'done'`.
- Saving from a **discover card** fires the chase (it does not today).
- `z-40` still literally in `TourRail.tsx`; `<Suspense fallback={null}>` still in `app/layout.tsx`; document listeners still `{capture: true, passive: true}` calling no `preventDefault`.
- No do-not-touch file in the diff.

### Tests
- Extend `tests/tester-tour-progress.test.ts` — `pendingReflectionCount`; `rowMarker` over all four statuses; `attentionStep` (null on first load, returns the newly-`reflect` key, prefers `done` over `reflect`, null when nothing moved).
- Extend `tests/tester-tour-rail.test.ts` — source-text: `TourStepRow.tsx` branches on `'reflect'` **outside** the `{expanded && …}` block (grep the substring position — this is the exact defect); `TourRail.tsx` still contains `z-40`.
- Extend `tests/tester-tour-anchors.test.ts` — widen the `ANCHORS` map (`:36`, `:47-52`) to accept an array of providers so `[data-tour="save-listing"]` declares both `SaveButton.tsx` (`minCount: 2`) and `save-icon-button.tsx` (`minCount: 1`). Keep the two drivers at `:72-82` intact.
- `tests/tester-tour-state-route.test.ts` and `tests/tester-tour-reflection.test.ts` **must pass unchanged.** If either needs editing, a constraint has been violated.

---

## PR 5 — Listing-page defects

### Files
- **`components/entity-page/templates/cta.ts`** — extend `getCtaHref` to resolve event and job CTAs **before** falling through to `listing_details_business`: `entity.event → ticket_url ?? cta_url`; `entity.job → apply_url`. Root cause: events and jobs have **no `listing_details_business` row**, so `entityPage.ts:379-381` defaults `cta_type` to `'learn-more'` and `cta_url` to `null`, and both hero paths resolve to a dead `'#'`.
- **`EntityPageHero.tsx:23-26`** — delete `?? '#'`, call `getCtaHref(entity)`, render **no** `<a id="hero-cta">` when null. `cta.ts:5-10` already documents this contract; the shared hero never adopted it.
- **`EntityQuickActionBar.tsx:21-23`** — same duplicated dead link. Knock-on: the bar observes `#hero-cta` and returns early when absent (`:29-31`), so with no CTA the bar never appears. Acceptable for now; record it. A follow-up could observe the `<h1>`.
- **`lib/listings/entityPage.ts:163-172`** — related listings are picked by `category_id` alone, so an event's "You Might Also Like" is three businesses. Add `.eq('entity_type', raw.entity_type)`; if that returns fewer than 3 (the threshold `EntityRelatedDiscovery` hides below), re-query by category alone as a top-up. Two round trips only in the sparse case.
- **New `lib/listings/locationType.ts`** — single source for the six `location_type` labels. Today the same six values have **three** representations: proper labels in `TemplateInfoRail.tsx:21-28` (professional/creative only), `LOCATION_TYPES` in `facetConstants.ts:20-27`, and a **raw-slug fallback at `EntityAtAGlance.tsx:169`** — which is why an online-only business currently displays the bare word "virtual". Export `LOCATION_TYPE_LABEL` and `LOCATION_TYPE_NOTE` (the rail's variant where `physical` is `''`), typed `Record<LocationType, string>` — the exhaustive typing at `TemplateInfoRail.tsx:14-19` is what caught three dead pre-migration keys, so keep it. Repoint all three call sites.
- **`EntityEventDetails.tsx:28` / `EntityJobDetails.tsx:28`** — leave the `return null`; page-level gating moves to PR 6's templates so a missing details row can no longer produce a blank page.

### Acceptance criteria
- No listing page renders `href="#"` (grep-assertable).
- An event with a `ticket_url` shows a working "Get tickets" hero CTA.
- An event's related rail shows events, or nothing.
- An online-only business shows "Online only", never "virtual".
- The six labels exist in exactly one module.

### Tests
- **New `tests/cta-href.test.ts`** — `getCtaHref` for event/job/business/no-data; source-text: neither hero contains `?? '#'`.
- **New `tests/location-type-labels.test.ts`** — every `LocationType` has a non-empty label; `EntityAtAGlance.tsx` no longer contains `location_type.replace`; the rail and `facetConstants.ts` both import from `lib/listings/locationType`.
- Extend `tests/job-entity.test.ts` for the job CTA path.

---

## PR 6 — Template parity for every listing type — **D-4: events yes, jobs no**

`page.tsx:244-331` is a five-branch nested ternary that already fails to validate `[entityType]` (`:164` looks the listing up by slug alone) and silently relabels `service_provider` as "Professional" (`:172`, `TemplateHero.tsx:20-24`). Growing it to eight branches is how the events/jobs defects got in. **Registry, not a bigger ternary.**

### Files
- **New `lib/entity-page/template.ts`** — `TemplateKey = 'professional' | 'creative' | 'storefront' | 'event' | 'job'`; `templateFor(entityType)`. `professional`/`service_provider` → professional; `creative` → creative; `business`/`restaurant`/`vendor` → storefront; `event` → event; `job` → job. Exhaustive over `VALID_ENTITY_TYPES` (`lib/constants/listing.ts:7-16`), with a test that fails when a ninth type is added.
- **New `components/entity-page/templates/StorefrontTemplate.tsx`** — same spine as `ProfessionalTemplate`, **offerings-first**: `TemplateHero variant="storefront"` → `EntityAnchorTabs` → `TemplateInfoRail` → white two-column grid (`EntityOfferingsSection bare` / `TemplateStory` / `EntityAttributes bare` / `EntityLinks bare` + sticky `TemplateTrustPanel` aside) → `EntityMediaGallery` → `EntityVideoSection` → `TemplateInquiryBand` → `EntityReviewsSection` → `EntityUpcomingEvents` → `EntityAtAGlance` (`#visit`) → `EntityFaqSection` → `EntityCommunityConnection` → `EntityPlatformActivity` → `EntityRelatedDiscovery`. `Reveal` at the same five boundaries as `ProfessionalTemplate.tsx:64,99,103,122,126`.
- **`EntityOfferingsSection.tsx`** — add `bare?: boolean`. `EntityAttributes.tsx:7,14,20,22` and `EntityLinks.tsx:37,42,50,52` already have exactly this prop; copy that shape verbatim.
- **`TemplateHero.tsx`** — `variant` union gains `'storefront'`; `TYPE_LABELS` (`:20-24`) gains `business`, `restaurant`, `vendor`. Fix the `service_provider` → "Professional" relabel **here, in one place**, not in `page.tsx:172` as well.
- **New `EventTemplate.tsx` / `JobTemplate.tsx`** — `TemplateHero` (storefront variant) + details + `EntityAtAGlance` (when there is anything to show) + `EntityLinks` + `EntityMediaGallery` + `EntityVideoSection` + `EntityFaqSection` + `EntityPlatformActivity` + `EntityRelatedDiscovery`, all data-gated. **`EventTemplate` includes `EntityReviewsSection`; `JobTemplate` does not** (D-4). Both must render a coherent page when `entity.event` / `entity.job` is null, rather than today's near-blank.
- **`app/[citySlug]/[entityType]/[listingSlug]/page.tsx`** — `:168-173` and `:236-331` collapse to a lookup plus a `switch` over `templateFor(...)`. **Delete `EntityPageHero.tsx`** in the same PR once storefront ships — leaving two heroes is how the tailwind-merge bug survived.

### Deliberately out of scope
- **No `restaurant` template yet** — one `StorefrontTemplate` with a menu-aware offerings section covers it. Revisit when there are enough restaurants to judge.
- **`[entityType]` is still unvalidated** on the detail page (`:164`), so `/atlanta/anything/some-slug` renders. File it — SEO/canonical, not visual; mixing it in doubles the review surface.
- **No schema work.** `listing_details_professional` / `_creative` do not exist (those types write to `listing_details_business`), and events/jobs have no business row at all — which also makes them structurally uncertifiable under moderation-policy criterion 6. **Deliberate; do not change.**

### Acceptance criteria
- All 8 `VALID_ENTITY_TYPES` resolve to a template; none falls through.
- A `business` listing renders the immersive hero, anchor tabs, info rail, sticky trust aside, inquiry band and `Reveal` motion — visually the page the founder praised.
- Offerings appear **before** At-a-Glance on storefront pages.
- An event with no `listing_details_business` row renders a complete page with a working CTA and no empty sections.
- No new DB columns, no migration.
- CLS on a business page no worse than the current professional page.

### Tests
- **New `tests/entity-page-template.test.ts`** — `templateFor` total over `VALID_ENTITY_TYPES` (driven by the constant, not a hand-written list); `service_provider` and `professional` map to the same key; `business`/`restaurant`/`vendor` → storefront.
- Source-text: `StorefrontTemplate.tsx` contains `EntityAnchorTabs`, `TemplateInfoRail`, `TemplateInquiryBand`, `TemplateTrustPanel`, `Reveal`; `JobTemplate.tsx` does **not** contain `EntityReviewsSection`; `EventTemplate.tsx` does; `page.tsx` no longer contains `EntityPageHero`.
- **New `e2e/listing-parity.spec.ts`** — for one seeded listing of each type, assert the anchor-tabs nav exists and (where applicable) reviews render.
- Run `e2e/a11y.spec.ts` / `e2e/contrast.spec.ts` **against a business listing URL** — the new hero puts white text over a photo scrim on that page type for the first time.

---

## PR 7 — One name, one definition for Products & Services — **D-3: `location_type`** — **GATE-DATA**

### The blocker: the filter is single-valued end to end
`p_location_type` is a scalar in `ResolvedFacetParams` (`facets.ts:135`), passed scalar to the RPC (`:253`), applied with `.eq()` in the fallback (`:321`), typed as a single `z.enum` (`lib/validations/search.ts:43`), and single-select in `FacetSidebar.tsx:176`. **"virtual OR service_area OR traveling OR national OR hybrid" cannot be expressed in a URL today.**

### Files
- **New migration `<ts>_location_type_multi.sql`** — **GATE-DATA.** Add `p_location_types text[]` to `search_listings_faceted` and `facet_counts` (new overload or defaulted param; **keep the scalar** so nothing in flight breaks), applied as `location_type = ANY(p_location_types)`. Function-only, no table change, no data change — still a migration, still gated.
- **`lib/validations/search.ts:43`** — `location_type` becomes `csvArray` validated against `VALID_LOCATION_TYPES`, mirroring `price`/`attrs` (`:39`). A one-element CSV keeps existing single-value URLs working.
- **`lib/listings/facets.ts:135, 253, 321`** — `p_location_type` → `p_location_types: string[] | null`; fallback uses `.in('location_type', …)`.
- **`FacetSidebar.tsx:55,176`, `useFacetParams.ts:105`, `ActiveFilterChips.tsx:76-80`** — multi-select via the `getCsv`/`toggleCsv` helpers already present for `attrs`.
- **New `lib/discovery/avenues.ts`** — one definition per homepage avenue: label, href **and** the count predicate, from a single object. Today `TheAvenues.tsx:39` links `?type=service_provider` while `app/page.tsx:129` counts `service_provider + vendor` — a mismatch that can only exist because they live in different files. `products` becomes: label **Products & Services**, filter `location_type=virtual,hybrid,service_area,national,traveling`, count = the same predicate over the same published-listings scan at `app/page.tsx:117-126`.
- **`TheAvenues.tsx:39`, `app/page.tsx:126-133`** — both read `lib/discovery/avenues.ts`.
- **`DiscoverBanner.tsx:24-35,79`** — the banner is keyed on `?type` only. Add an avenue / `location_type` key path; collapse the duplicated `service_provider`/`vendor` entries into one avenue-keyed entry.
- **`facetConstants.ts:6`** — `service_provider` label `'Services'` → aligned with the owner-facing vocabulary.
- **`SubmitListingForm.tsx:22-30`** — owners currently never see the words "Products & Services" (it says "Service Provider"). Reword, and make the `location_type` question prominent — it is now load-bearing for discovery, which it was not before.

### Acceptance criteria
- One constant defines each avenue's label, href and count. `TheAvenues` and `app/page.tsx` **cannot** disagree.
- The Products & Services tile links to a URL whose result count **equals** the number on the tile.
- The bin returns results (post-PR 8; pre-PR 8 it honestly shows ~11).
- `?location_type=virtual` still works — no broken bookmarks.
- "Products & Services" reads consistently on the homepage tile, discover banner, facet sidebar, and submission form.

### Tests
- **New `tests/avenues.test.ts`** — the tile's href filter and its count predicate come from the same object (direct regression test for the mismatch); every avenue has a non-empty label and resolvable href.
- Extend `tests/search-api-filters.test.ts` and `tests/faceted-ownership.test.ts` for CSV `location_type` (one value, several, invalid, empty).
- Extend `tests/constraint-drift.test.ts` — assert the migration source declares `p_location_types` (this file already reads migration source text).
- Re-run `tests/near-you-location-params.test.ts` and `tests/search-radius-params.test.ts` — the RPC arg shape changed.

### Scope boundary — do NOT "fix" here
Browse does **not** exclude listings lacking city/coords/address; the `LEFT JOIN listing_details_business` is load-bearing (`20260811010000_search_radius_filter.sql:163-206`, fallback `facets.ts:313-322`, detail `entityPage.ts:121-127`). They *do* disappear from radius search (`:192-206`), the map (`app/api/map/listings/route.ts:54`), and city browse (RPC `:165`). **That is correct behaviour for a virtual business.**

---

## PR 8 — `location_type` correction pass — **GATE-DATA**

Seed reality: **368 `physical` / 5 `virtual` / 2 `hybrid` / 2 `service_area` / 2 `traveling`** out of 379 — while **65 of 254 published listings have no address and are still labelled `physical`**. The bin cannot be right until this runs.

Shape follows the two established patterns in this repo: `scripts/geocode-dry-run.ts` (reports, blocks, writes nothing) and `scripts/apply-seed-review.ts` (reads a founder-completed CSV, applies conservatively, emits an audit report, never blanks existing data). **Never an inline `UPDATE`.**

### Files
- **New `scripts/audit-location-type.ts`** (read-only) — reads every published, non-deleted listing plus its address fields and category; runs a **pure classifier** exported from `lib/listings/locationTypeAudit.ts` (`classify({hasStreetAddress, hasWebsite, hasPhone, categorySlug, currentLocationType}) → {suggested, confidence, reason}`) so it is unit-testable without a DB. Conservative: anything ambiguous is `confidence: 'review'` and never auto-changed. Minimum honest rule: *a published listing with no street address must not be `physical`.* Emits `docs/blacqlist/data/location-type-audit.csv` with `id, name, category, address?, current, suggested, confidence, reason, DECISION` — `DECISION` left empty for the founder. Writes nothing to the DB; prints counts by suggested value so the bin size is visible **before** agreeing to anything.
- **New `scripts/apply-location-type.ts`** — **GATE-DATA.** Applies **only** rows with an explicit `DECISION`. `--dry-run` is the default; `--apply` required to write. Batched, idempotent, reversible: writes `docs/blacqlist/data/location-type-rollback.csv` (`id, previous_value`) **before** the first update, and supports `--rollback <file>`. Emits an audit report. **Never touches `entity_type`.**
- **`scripts/data/listings-*.json`** — apply the same corrections to the seed corpus in the same PR, or local and prod diverge permanently.

### Acceptance criteria
- The audit script writes zero DB rows and produces a spreadsheet-readable CSV.
- The apply script refuses to run without `--apply` and without a completed `DECISION` column.
- A rollback file is produced before any write; `--rollback` restores exactly.
- After the pass, **no published listing is `physical` with a null street address.**
- The Products & Services tile count matches the discover result count, and both are non-trivial.

### Tests
- **New `tests/location-type-audit.test.ts`** — pure `classify` over: address + physical (keep), no address + physical (suggest/flag), already virtual (keep), traveling category with an address (review), missing everything (review). No DB, no network — the only part of PR 8 CI can gate.
- `pnpm test:seed-idempotent` must still pass if the seed JSON is edited.

**Classifier aggressiveness:** conservative. Auto-suggest only "published + no street address ⇒ not physical"; everything else goes to the review column.

---

## Gates

| Gate | Where | Notes |
|---|---|---|
| **GATE-DATA** | PR 7 migration (`p_location_types` on `search_listings_faceted` / `facet_counts`) | Function-only, no table or data change — still a migration, still gated. |
| **GATE-DATA** | PR 8 `apply-location-type.ts --apply` | Production row updates. Requires founder-completed CSV + rollback file. |
| **GATE-DEPLOY** | Promoting any PR from Preview to production | Founder. PRs 1–6 are code-only, no schema risk. |
| — | PRs 1–6 | No migration, no production write, no new npm dependency. |
| Not triggered | GATE-MODERATION / GATE-SPEND / GATE-COMMS / GATE-PUBLISH | Nothing here approves content, moves money, or sends mail. |

**Env note:** Turnstile appeared on Preview, so `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set there. No env change needed for PR 1 — `TurnstileWidget.tsx:90` already degrades to `null` without it, which is why CI and local dev never saw the problem.

---

## Things to tell the founder in words (no code can say them)

1. A tester who saves **their own** listing will never tick the tour step (`verify.ts:116-132` requires a non-owner save). `verify.ts` is untouchable under M4.13, and the step copy lives there too — so the hint cannot say so on screen.
2. Events and jobs are **structurally uncertifiable** today (moderation criterion 6 needs a business detail row they do not have). Deliberate; PR 6 does not change it.
3. The Products & Services bin will read honestly but small (~11) between PR 7 and PR 8. That is the correct intermediate state, not a regression.
