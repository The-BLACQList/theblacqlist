# Ticket 280: Site Tour for First-Time Visitors

**Status:** Merged #417 (`def4a2c`), 2026-11-25. Step 3 on small windows: ticket 285. Behind `FEATURE_SITE_TOUR`, closed by default on every deployment, Previews included.

## Why

The founder asked for a tour for first-time visitors (2026-11-21): it asks whether they own a Black-owned business, shows them the parts of the site that matter to them, can be quit at any time and taken again later, and feels a little cinematic. Look A, the 14 picks, the words and the build were approved on 2026-11-24.

This is not the Tester Tour, which stays an invite-only research tool. Anyone on a live Tester Tour never gets this one.

## What It Does

| Part | What happens |
| --- | --- |
| First visit | The welcome opens on its own only when the first page a visitor ever sees is the home page or For Business. Any other first page gets a small Take the Tour prompt, once (DR-013). |
| Shopper path | Ask Cue, Cue's Answer, Explore the Map, Read The BLACQLight, The Collective, end card. |
| Owner path | Search Your Business Name, Add Your Business, The Collective (Live), Start Free, end card. |
| Quit | X, Esc, End Tour or Not Now, during any move. A one-line note says how to take it again. It never opens on its own again. |
| Take it again | My Account menu (signed in) and the footer, for 30 days after the first visit. |
| Reload | Picks up at the same step, in the same tab. |
| Reduced motion | Instant cuts; every card still comes up. |

A step shows only when what it needs is on: Cue (`aiAssistant`), published stories, The Collective's cover, and for the owner's Collective step `ownerReceiptReview` too. Step counts follow.

## Held

In the step table but never shown, waiting on the founder: the sample Page (both paths) and Save (DR-018's Save line). Claim Your Page goes to sign-in first when signed out (founder, 2026-11-24).

## Where It Lives

- `lib/site-tour/`: steps, words, memory, routes, geometry, CSV totals. No DOM, all unit tested.
- `components/site-tour/`: `SiteTourMount` (server gate, in the root layout), `SiteTourLauncher` (decides whether to open), `SiteTour` (loaded only when something opens it), `parts`, `dom`, `TakeTheTourLink`.
- `components/home/AiGuide.tsx`: sends window events the tour listens for. The bar works the same with the tour off.
- `lib/actions/site-tour/seen.ts`: for a signed-in member, keeps the earliest first-visit date in `user_metadata.site_tour_seen_at`. No migration and no table.
- `/api/admin/analytics/site-tour/export`: daily totals as a CSV, linked from Admin → Analytics.

This device remembers the first path, first visit, ended and completed dates (`blq-site-tour-v1`). This tab remembers where a running tour is (`blq-site-tour-run-v1`). No message or search text is sent with any tour event.

## Choices Worth Knowing

- After Stop, step 1 comes back with Next instead of Try an Example. The words are step 1's own.
- Cue has 12 seconds, then the tour moves on.
- Opening a business, or Keep Chatting, ends the tour and goes there (DR-020).
- View Transitions are not used: the cover crossfade does the same in every browser.
- A member with no date on the account counts as a first-time visitor.
- With storage off the tour never opens on its own, because it could never remember the answer.

## Checks

- `tests/site-tour.test.ts`, `tests/site-tour-anchors.test.ts`.
- `e2e/site-tour.spec.ts`, 25 tests. It skips unless the tour is on for that server: the config doesn't turn it on, because it would open over every other spec's first page.

## Known Problems

- **Phone keyboard:** no `visualViewport` handling, so on step 1 the keyboard can cover the bar or the sheet. Not tested on a real phone.
- **Very small windows:** Creative's reviews found steps where the sheet leaves little or nothing lit.
- **Open accessibility failures in the design:** AX5-05 (DR-022, proposed) and AX6-01 (a scroll exception the founder has not seen). Neither is built.
- **Chapter label:** "Start with a Search" passes the Title Case guard; the founder approved "Start With a Search" (DR-015). Founder to decide.

Built to Creative's V31 drawings: the founder approved Look A (DR-007) and specific decisions, not V31 as a whole.

## Before the Flag Goes On

1. Walk both paths on a Preview with the flag on, desktop and phone.
2. Production, signed out: searching a known business name finds it, and the example ask returns a real Detroit answer.
3. Starter can be bought.
4. The owner's Collective step needed 278 (#413, merged 2026-11-24): check it on real data.
5. Decide the known problems above; test the keyboard on a real phone.
6. The coming-soon page is off (it doesn't use up a first visit).
