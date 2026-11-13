# 184: Test Business 123 — the fully filled Premium sample page, one per template

**Status:** PR 1A #325 and PR 1B #329 (stacked), rebased on `origin/main` `9c8844c` (#328 deals). Merge as one deploy before the launch freeze (D-1 Mon 16 Nov to the end of the D0 watch Tue 17 Nov) or after it, never inside it; founder go 2026-11-13.
**Follows:** 105 (tiered page features), 154 (Now hiring), 134 (partnerships badge), messaging (hero Message button, 2026-11-13)
**Area:** business pages (`/example/*`), the section registry the click-to-fill editor (188) will reuse
**Gates:** none for 1A or 1B. No migration, no env change, no production writes; the route answers 404 on production. Phases 2–9 carry their own gates (see "What comes after").

## Why

The founder wants to redesign the owner editor so an owner fills in an interactive, fully loaded example page: click a missing or demo area, fill it with our tools, or get an upgrade prompt. Step one is to _see_ what the top tier (Premium, $99/mo) looks like with every feature filled — "Test Business 123" — on staging/Preview, one page per template, each feeling like the business's own website.

Today the public page shows a section only when its data exists, and the only tier check on the page is a taller hero for Premium. Several features we sell at Growth and Premium have **no public section and no table at all** (team members, coupons, booking requests, multi-location); the logo is stored but never rendered; marketplace products show only at `/vendors/[slug]`. A fully filled Premium page cannot be produced from today's code, so this ticket builds the sample from fixtures and the registry that the later tickets fill in for real.

## Decision record

`[Decision — founder, 2026-11-13]`:

- **One example per template:** Storefront (café with merch, `restaurant`), Professional (`professional`), Creative (`creative`), all named "Test Business 123".
- **Build the missing features fully** afterwards — tables, RLS, actions, editors and public sections (107, 108, 109, 110, 185, 186, 189–196) — not display-only stand-ins.
- **Both** a code-fixture route (`/example/[variant]`, no DB writes, visible on Vercel Preview) **and** a staging seed of real listings (187).
- **Photos:** free-licence stock (Unsplash/Pexels) downloaded into the repo with a licence record.
- **Community spend panel:** owner dashboard only for now (112). No public spend section — out of scope here.
- **Multi-location:** one Premium subscription covers up to 3 locations; extra locations inherit the primary's tier (110).
- **`/example/*` is Preview/staging only;** 404 on production.
- **Value-adds for PR 1B** (from the menu in the plan): facts line, mini map, richer JSON-LD, gallery captions, photo albums, menu/rate-card PDF, credentials & press, founder spotlight, highlights & process, holiday hours. **Stubs only:** 197 menu-item photos/tags, 198 service-area list, 199 pinned review quote, 200 sticky desktop mini header, 201 custom subdomain, 202 brand accent (not selected; stubbed so it stays visible). The updates feed on the menu became main's Happening now posts (#326) while 1B was in flight; see the decision record.

`[Decision — agent, 2026-11-13]` (recorded for review, change if wrong):

- **Sample trust tier is `verified`, never `certified`.** Certification is earned (`lib/stripe/features.ts` header); a sample wearing the badge would be a fabricated trust signal.
- **Team headshots are initials avatars, not stock faces.** Neither licence carries a model release, and a stranger labelled "Head barista" implies endorsement, which the Pexels licence forbids.
- **Logos are first-party monograms** (`public/images/example/logo-*.png`, drawn as SVG paths and rendered with sharp), so no third-party mark appears on the sample.
- **Demo videos are Blender Foundation open movies** (CC BY 3.0: Big Buck Bunny on YouTube and Vimeo, Sintel), credited in the banner and in `docs/blacqlist/design/example-image-licenses.md`.
- **No coupons section of our own; the sample shows main's Deals.** Main merged coupons and deals (#328, part G) while 1A was open. 1A dropped its `EntityCouponsSection`/`CouponItem`/`coupons` and samples main's `EntityDeals` and `deals` (`PublicDeal`) in main's slot, right after At a Glance (where 1A had already moved coupons, so "where and when" stays above the fold on a phone). Registry id `deals`: gate `coupons` feature + `coupons` flag as main's loader does, capped at `DEALS_ON_MAX`, editor `/edit#deals` (the Deals card on the Services tab). On the sample the section sits in an `inert` wrapper, so Copy code cannot record `deal_code_copied` for a listing that does not exist. The sample deals pass main's `parseDeal` (test-enforced).
- **No updates feed or announcement bar of our own** (1B, revised 2026-11-13). While 1B was in flight main merged Happening now posts (#326: `listing_posts`, `HappeningNowBanner`, the `/dashboard/pages/[id]/posts` manager, `TierLimits.activePosts`, flag `happeningNow`), which covers the plan's updates feed. 1B dropped its `EntityAnnouncementBar`, `EntityUpdatesSection`, `ListingUpdate` and `lib/listings/updates.ts` and samples `happeningNow: PublicPost[]` instead, rendered by the example route above the hero exactly as the live route does (without the `POST_VIEW` event). The registry's `happening-now` entry gates on main's flag and cap. Ticket 191 is closed as shipped by #326.
- **1B sections are ungated for now.** Every 1B registry entry of our own gates `{}` with a comment naming the ticket (189, 190, 192–196) that decides its tier (`happening-now` is main's feature and carries main's `happeningNow` flag and `activePosts` cap); no `GatedFeature` or `TIER_LIMITS` key was added, so pricing is not changed by a display-only PR. The map is example-only until 190; captions are example-only until 189.
- **1B editor links use `page()` routes, not `edit()` anchors.** The anchors test pins every `edit('<anchor>')` to a card `lib/listings/editTabs.ts` lists (main's tabbed edit page, #324, opens the tab a `/edit#card` link names); the anchors for highlights, credentials and the rest arrive with their tickets.
- **Links are held, buttons are not.** `ExampleLinkGuard` cancels every link that would leave the sample (the business's site, tel:, mailto:, related cards, sign-in) with a short note; the banner's variant switcher and in-page anchors still work. Save and Share are rendered `inert` so they look real and never call `/api/saves` or `track()`. The hero Message button shows; the composer is not mounted.

## What ships in 1A

- **Route** `app/example/[variant]/page.tsx` + `app/example/page.tsx` (index) + `app/example/layout.tsx` (robots `noindex, nofollow`, link guard). `force-dynamic`; `notFound()` on production or an unknown variant. `app/robots.ts` disallows `/example/`. Sitemap untouched; `proxy.ts` untouched (the founder passes the coming-soon gate with the usual cookie or a signed-in session).
- **Render mode** `EntityRenderMode = 'live' | 'example'` on `EntityTemplateProps`; `TemplateHero` holds Save/Share and reads the cover through the scoped resolver `lib/listings/exampleAssets.ts` (`coverImage.ts` is unchanged; live covers still refuse stock paths).
- **Section registry** `lib/entity-page/sections.ts`: every section with its template list, plan gate (`feature`/`flag`/`limit`/`requiresClaimed`), editor link and `isFilled`; `TEMPLATE_SECTION_ORDER`; `minTierFor` derived from `FEATURE_MIN_TIER`; `applyTierGates`; `visibleSections`. `SectionMark` (`data-section`) wraps every section in the three templates — the hook for the Playwright spec and for ticket 188.
- **New optional `EntityPageData` fields** (`logo`, `team`, `booking`, `locations`, `shop`, `hiring`) and their display-only components (`EntityLogo`, `EntityTeamSection`, `EntityBookingSection`, `EntityLocationsSection`, `EntityShopSection`). Deals are main's (`deals`, `EntityDeals`, #328). `undefined` means "the loader does not provide it yet", so **live output is unchanged** (pinned by the legacy-shape test).
- **Fixtures** `lib/example/fixtures/{shared,storefront,professional,creative,index}.ts`, deterministic for an injected clock; **photos** 44 WebP in `public/images/example/` with `lib/example/photoCredits.ts` and `docs/blacqlist/design/example-image-licenses.md` (1:1 with the folder, test-enforced).
- **Tests:** `tests/entity-page-sections.test.ts`, `tests/example-fixtures.test.ts`, `tests/example-assets.test.ts`, `tests/example-copy.test.ts`, `tests/example-route.test.ts`; `e2e/example-page.spec.ts`; `/example/storefront` added to `e2e/a11y.spec.ts`.

## What ships in 1B

Display-only, from the fixtures. Every new field is optional on `EntityPageData` and `undefined` means "the loader does not provide it yet", so **live output is unchanged** (the legacy-shape test strips the 1B fields as well).

- **Page contract** (`types/index.ts`): `details.founded_year`, `details.price_range`, `details.accepts_reservations`; `images[].album`; `team[].isFounder`; `credentials`, `documents`, `highlights`, `hoursOverrides`.
- **Hero:** `EntityFactsLine` ("Est. 2014 · $$ · Takes reservations", `lib/listings/facts.ts`) under the name.
- **Happening now** (main's `HappeningNowBanner`, #326) above the hero on every sample, from `entity.happeningNow`: three posts per variant inside main's rules (Premium cap 5, ≤ 30 days, headline ≤ 80, body ≤ 200). The button links go through `/api/happening-now/[postId]` and the link guard holds them.
- **Visit block** (`EntityAtAGlance`): `EntityLocationMap` (client, `next/dynamic`, `maplibre-gl` loaded lazily in `LocationMapCanvas`, every pin via `lib/listings/locationPins.ts`, `fitBounds`, a server-rendered address + "Open in Maps" fallback) and `EntityHoursOverrides` (next 30 days, `lib/listings/hoursOverrides.ts`); `OpenStatus` reads today's override ("Closed today — Thanksgiving").
- **Highlights & process** `EntityHighlightsSection`: an icon grid for `kind='highlight'`, numbered steps for `kind='step'`; icons from the `highlightIcons.ts` allow-list (unknown names fall back to Sparkles). Storefront after Story ("Why choose us"), Professional after Services ("How it works"), Creative after Capabilities ("How a commission works").
- **Documents** `EntityDocumentsRow`: download pills in the heading of Offerings, Services and Capabilities (`TemplateSectionHeading` grew an `actions` slot).
- **Credentials, awards & press** `EntityCredentialsSection`: a band after Reviews on Storefront; in the aside under the trust panel on Professional and Creative (the sticky wrapper moved from `TemplateTrustPanel` to the aside so the two stick together).
- **Gallery** (`EntityMediaGallery`): album chips (All plus one per album, with counts) when photos sit under two or more albums, filtering the grid, the lightbox and its counter; captions from `alt` on hover and under the lightbox image, example mode only. `lib/listings/galleryAlbums.ts`.
- **Founder spotlight** (`EntityTeamSection`): the `isFounder` member first, as a two-column card with the Owner label and the bio's first line as a pull quote (`lib/listings/team.ts`).
- **Registry:** new ids `facts`, `happening-now`, `map`, `hours-overrides`, `highlights`, `documents`, `credentials`, `albums`. `logo`, `facts`, `map`, `hours-overrides`, `documents` and `albums` are **nested marks** (rendered inside a parent section) and `happening-now` is a **route mark** (rendered by the route above the template, as on a live page): registered, never in `TEMPLATE_SECTION_ORDER`, so `visibleSections` never lists them and the Playwright order check skips them.
- **JSON-LD:** `buildJsonLd` moved verbatim from the listing page to `lib/listings/jsonLd.ts` with an injectable base URL; `tests/jsonld.test.ts` pins the output and records two quirks for 189. The sample pages render it, so a Preview URL goes straight into Google's Rich Results test.
- **Fixtures:** facts on all three; 3 happening-now posts; 2 hours overrides within 30 days of the visit; 4 highlights (café) or 4 steps (consultancy, studio); 1 PDF each; 4–5 credentials; an album on every photo (4 per variant); one founder per team.
- **Tickets:** 185–196 written up from the plan (planned, not started), 188 reserved, stubs 197–202; `ticket-index.md` rows for all of them.
- **Tests:** `tests/{entity-location-map,gallery-albums,highlight-icons,hours-overrides,jsonld,team}.test.ts`; `tests/entity-page-sections.test.ts` (nested marks, the documents row, the albums chip row); `tests/example-fixtures.test.ts` (every 1B section filled per template, dates relative to the injected clock); `tests/example-route.test.ts` (JSON-LD on the sample); `e2e/example-page.spec.ts` (nested marks present, order check over top-level sections, the happening-now band and its "+N more", map or its fallback).

## Out of scope (recorded)

- A public spend-impact section (112 is dashboard-only by founder decision).
- `/example` on production (new ticket if wanted: remove the 404, re-check licences, review seed-data-plan §10 naming).
- Ticket 188, the click-to-fill editor (`mode='edit'`), which reuses `ENTITY_SECTIONS`, `SectionMark`, `isFilled`, `editor.href` and `minTierFor`.

## What comes after

After 1A and 1B merge (one deploy, before the launch freeze or after the D0 watch): 185 (logo on page, logo editor, cover upload, meter fixes), 189 (facts line, captions, JSON-LD live), 190 (mini map live), 186 (shop on the profile), 107, 109, 110 (108 shipped on main as Deals, #328), 192–196 (one table each; 191 shipped as #326), 187 (staging seed). Each is its own branch and draft PR off `origin/main`; migrations are staging-first with founder confirmation, production at GATE-DATA.

## Verification

- `pnpm typecheck`, `pnpm lint`, `pnpm test:unit` green on the branch.
- `pnpm dev`: `/example/storefront|professional|creative` render every section in registry order; `/example/nope` is a 404; the banner, noindex meta and link guard behave; no requests to `/api/saves`, `/api/analytics` or `/rest/v1` from the sample page.
- Vercel Preview: founder walks the three variants on desktop and iPhone.
- An existing live listing on Preview renders the same sections as before (legacy-shape test + manual spot check).
