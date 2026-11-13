# 184: Test Business 123 — the fully filled Premium sample page, one per template

**Status:** Building on `feat/184-example-page` (worktree `../theblacqlist-example-page`, cut from `origin/main` `0375333`). PR 1A ready for a draft PR; **no merge before Wed 18 Nov 2026** (launch merge freeze).
**Follows:** 105 (tiered page features), 154 (Now hiring), 134 (partnerships badge), messaging (hero Message button, 2026-11-13)
**Area:** business pages (`/example/*`), the section registry the click-to-fill editor (188) will reuse
**Gates:** none for 1A. No migration, no env change, no production writes; the route answers 404 on production. Phases 2–9 carry their own gates (see "What comes after").

## Why

The founder wants to redesign the owner editor so an owner fills in an interactive, fully loaded example page: click a missing or demo area, fill it with our tools, or get an upgrade prompt. Step one is to *see* what the top tier (Premium, $99/mo) looks like with every feature filled — "Test Business 123" — on staging/Preview, one page per template, each feeling like the business's own website.

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
- **Value-adds for PR 1B** (from the menu in the plan): facts line, mini map, richer JSON-LD, gallery captions, updates feed, photo albums, menu/rate-card PDF, credentials & press, founder spotlight, highlights & process, holiday hours. **Stubs only:** 197 menu-item photos/tags, 198 service-area list, 199 pinned review quote, 200 sticky desktop mini header, 201 custom subdomain, 202 brand accent (not selected; stubbed so it stays visible).

`[Decision — agent, 2026-11-13]` (recorded for review, change if wrong):
- **Sample trust tier is `verified`, never `certified`.** Certification is earned (`lib/stripe/features.ts` header); a sample wearing the badge would be a fabricated trust signal.
- **Team headshots are initials avatars, not stock faces.** Neither licence carries a model release, and a stranger labelled "Head barista" implies endorsement, which the Pexels licence forbids.
- **Logos are first-party monograms** (`public/images/example/logo-*.png`, drawn as SVG paths and rendered with sharp), so no third-party mark appears on the sample.
- **Demo videos are Blender Foundation open movies** (CC BY 3.0: Big Buck Bunny on YouTube and Vimeo, Sintel), credited in the banner and in `docs/blacqlist/design/example-image-licenses.md`.
- **Coupons render after At a Glance, not before it** (deviation from the plan's §1f, which had Coupons between the info rail and At a Glance). On the built page a deal strip above the hours and address pushed "where and when" below the fold on a phone; the registry and all three templates agree on the new order and `tests/entity-page-sections.test.ts` pins it.
- **Links are held, buttons are not.** `ExampleLinkGuard` cancels every link that would leave the sample (the business's site, tel:, mailto:, related cards, sign-in) with a short note; the banner's variant switcher and in-page anchors still work. Save and Share are rendered `inert` so they look real and never call `/api/saves` or `track()`. The hero Message button shows; the composer is not mounted.

## What ships in 1A

- **Route** `app/example/[variant]/page.tsx` + `app/example/page.tsx` (index) + `app/example/layout.tsx` (robots `noindex, nofollow`, link guard). `force-dynamic`; `notFound()` on production or an unknown variant. `app/robots.ts` disallows `/example/`. Sitemap untouched; `proxy.ts` untouched (the founder passes the coming-soon gate with the usual cookie or a signed-in session).
- **Render mode** `EntityRenderMode = 'live' | 'example'` on `EntityTemplateProps`; `TemplateHero` holds Save/Share and reads the cover through the scoped resolver `lib/listings/exampleAssets.ts` (`coverImage.ts` is unchanged; live covers still refuse stock paths).
- **Section registry** `lib/entity-page/sections.ts`: every section with its template list, plan gate (`feature`/`flag`/`limit`/`requiresClaimed`), editor link and `isFilled`; `TEMPLATE_SECTION_ORDER`; `minTierFor` derived from `FEATURE_MIN_TIER`; `applyTierGates`; `visibleSections`. `SectionMark` (`data-section`) wraps every section in the three templates — the hook for the Playwright spec and for ticket 188.
- **New optional `EntityPageData` fields** (`logo`, `team`, `coupons`, `booking`, `locations`, `shop`, `hiring`) and their display-only components (`EntityLogo`, `EntityTeamSection`, `EntityCouponsSection`, `EntityBookingSection`, `EntityLocationsSection`, `EntityShopSection`). `undefined` means "the loader does not provide it yet", so **live output is unchanged** (pinned by the legacy-shape test).
- **Fixtures** `lib/example/fixtures/{shared,storefront,professional,creative,index}.ts`, deterministic for an injected clock; **photos** 44 WebP in `public/images/example/` with `lib/example/photoCredits.ts` and `docs/blacqlist/design/example-image-licenses.md` (1:1 with the folder, test-enforced).
- **Tests:** `tests/entity-page-sections.test.ts`, `tests/example-fixtures.test.ts`, `tests/example-assets.test.ts`, `tests/example-copy.test.ts`, `tests/example-route.test.ts`; `e2e/example-page.spec.ts`; `/example/storefront` added to `e2e/a11y.spec.ts`.

## Out of scope (recorded)

- A public spend-impact section (112 is dashboard-only by founder decision).
- `/example` on production (new ticket if wanted: remove the 404, re-check licences, review seed-data-plan §10 naming).
- Ticket 188, the click-to-fill editor (`mode='edit'`), which reuses `ENTITY_SECTIONS`, `SectionMark`, `isFilled`, `editor.href` and `minTierFor`.

## What comes after

PR 1B (`feat/184-example-page-1b`, stacked): the value-add sections above, display-only, plus ticket stubs 197–202. Then 185 (logo on page, logo editor, cover upload, meter fixes), 189 (facts line, captions, JSON-LD live), 190 (mini map live), 186 (shop on the profile), 107, 108, 109, 110, 191–196 (one table each), 187 (staging seed). Each is its own branch and draft PR off `origin/main`; migrations are staging-first with founder confirmation, production at GATE-DATA.

## Verification

- `pnpm typecheck`, `pnpm lint`, `pnpm test:unit` green on the branch.
- `pnpm dev`: `/example/storefront|professional|creative` render every section in registry order; `/example/nope` is a 404; the banner, noindex meta and link guard behave; no requests to `/api/saves`, `/api/analytics` or `/rest/v1` from the sample page.
- Vercel Preview: founder walks the three variants on desktop and iPhone.
- An existing live listing on Preview renders the same sections as before (legacy-shape test + manual spot check).
