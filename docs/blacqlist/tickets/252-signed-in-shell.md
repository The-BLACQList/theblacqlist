# Ticket 252: One Signed-In Menu, Business First

**Status:** PR open, 2026-11-21. Builds on 251 (merged #376). Waiting on the founder's OK to merge.

## Why

The founder (2026-11-21): "I don't like that the dashboard for a business owner and their my account page are so separate... owner dashboard is burried in the my account page and I don't really see how the analytics and such are going to fit."

Before this ticket there were two menus:
- **My Account:** a light card. Owners got a single "My Business" link near the bottom of it.
- **Dashboard:** a separate black sidebar. Each page's tools sat in a second "This page" list that only showed on page addresses.

On phones, one menu became a sideways-scrolling strip and the other a plain black block. Sign-in always landed on My Account, and the site header never linked to the business side.

The founder chose "One shell, business first" (AskUserQuestion), then picked mockup A, Dark Rail: "I like A and I like the admin page".

## What Changed

- **`lib/nav/rail.ts`** (new): the menu model shared with admin.
  - Items, groups, and badges (waiting work) kept apart from counts (plain numbers).
  - Longest-match current item; `exact` for Home and Overview.
  - Group totals, and reading the saved open/closed state.
- **`components/nav/NavRail.tsx`** (new): the black rail from 251, made generic.
  - Desktop (lg and up): a sticky rail.
  - Below lg: a bar with a Menu button that opens the same menu in a drawer.
  - Admin now uses it too (`AdminSidebar` is a thin wrapper), so both sides look and behave the same.
  - Admin's breakpoint moves from md to lg to match.
- **`lib/account/shellNav.ts`** (new): what the signed-in menu holds.
  - **Owners** (order and names from the founder's second pass, below):
    - **You** first. It starts closed for owners so it does not push the business tools down.
    - **Your Business:** the page switcher, then Home, Edit Page, Insights, Messages, Plan.
    - The page's tools, grouped by job:
      - **What You Offer:** Products, Services, Offerings, Events, Bookings.
      - **Photos and Updates:** Photos and Media, Happening Now, Highlights, Team.
      - **Hours and Trust:** Special Hours, Locations, Get Verified, Credentials, Documents, Receipts to Verify.
    - Then Account.
  - **Members:** You (Overview, Messages, Saved, Reviews, Claims, Recently Viewed, Recommended, The Collective), then Account (Settings, Admin for admins).
  - Flagged tools (Happening Now, Bookings, Receipts to Verify, Messages) still follow their flags.
- **`components/account/SignedInShell.tsx`** and **`PageSwitcher.tsx`** (new):
  - **Page switcher.** Owners get it at the top, showing the page's initials, its name and its plan. It lists their other pages, "All My Pages" and "Add Another Page".
  - **Switching pages.** Picking a page while on a tool keeps you on that tool for the new page. The choice is remembered (`blacq-page` cookie) so Home (253) and the menu agree.
  - **Members** get an "Own a Business?" card with Claim My Business and Not Listed Yet? Add It.
  - **Footer:** your name and Sign Out.
- **`lib/account/shellData.ts`** (new): one set of parallel reads for the menu, used by both layouts.
- **`app/account/layout.tsx`** and **`app/dashboard/layout.tsx`** both render `SignedInFrame`, the same menu on both. Every address is unchanged.
- **Sign-in:** owners land on `/dashboard`; members still land on `/account`. A `next=` address still wins.
- **Header:** one **My Account** menu (a button that opens a list; Esc or a click outside closes it). It holds My Business (owners only), Account Overview, Saved, Messages and Settings. Sign Out and Admin stay outside it. In the phone menu the same links sit under a "My Account" heading. Saved moved into this menu (it was its own header link, M1, 2026-10-15).
- **Report a Problem button:** on /account and /dashboard at lg and up it sits just past the rail (`lg:left-72`) instead of over Sign Out.
- **Removed:** `components/account/AccountNav.tsx` and `components/dashboard/DashboardSidebar.tsx`.

### Second Pass (founder, 2026-11-21)

The founder, on the first Preview:
- "Not just BLACQList. Always The BLACQList."
- "Put the you section before the your business section."
- "we need something better than "Page Tools" and "More Page Tools"." Picked "By job" (AskUserQuestion).
- "In the menu, have My Business as a dropdown under My account." Picked the top header (AskUserQuestion).
- "the side bar panel needs to be more on brand. the bracket highlight looks too AI design for my taste and the text words look terrible."

What changed:
- **Rail look** (`components/nav/NavRail.tsx`, admin too):
  - **Current page:** a small gold dot, the node from the gold Q, and white text. This replaces the grey box and gold side bar.
  - **Group names:** Jost tracked caps, like the header wordmark. The group you are in turns gold.
  - **Rail top:** the gold Q and where you are ("My Business", "My Account", "Admin"), set the same way. The header right above already reads THE BLACQLIST, so the rail no longer repeats a mixed-weight "BLACQList". The phone bar shows the words without a second Q.
  - **Ground:** the header's near-black with a hairline edge, instead of pure black.
- **Page switcher:** moved under the Your Business heading. It has an outline only, with gold initials in a gold outline (no filled tile, no glass).
- **The current item scrolls into view** when the menu is long.
- **Signed-in copy says "The BLACQList":** /dashboard and /dashboard/pages subtitles, the empty state ("Create Your Page on The BLACQList"), the product and service forms, the spending pages, and the dashboard tab titles. A site-wide sweep is its own ticket.

## Tests

- **`tests/signed-in-shell.test.ts`** (new) covers:
  - menu groups for a member, an owner, an owner whose pages could not be read, and an admin;
  - flags off; Messages hidden when messaging is off; every address listed once;
  - page choice (address, then cookie, then newest; only owned pages);
  - initials;
  - longest match and exact items; the active group; waiting totals; saved state;
  - no em dashes; both layouts use the shell.
- **`tests/admin-nav-groups.test.ts`** and **`tests/admin-pending-counts.test.ts`** now read the shared rail.
- **Pointed at `lib/account/shellNav.ts`:** the tests for the page tools (team, documents, special hours, bookings, highlights, locations, credentials), Happening Now, the Collective rows and OwnerCue.
- **`tests/auth-confirm-flow.test.ts`:** owners land on /dashboard; a safe `next` still wins.
- **`e2e/owner-dashboard.spec.ts`:**
  - Stale editor selectors fixed while here: the save bar reads "Publish Changes" (Title Case, 205), and Contact sits under the "Contact & Buttons" tab.
  - A member sees no business tools and gets the claim card.
  - An owner sees Home, Edit Page, Insights, Plan and the page switcher, and Products and Services under What You Offer.
- **`tests/saved-way-back.test.ts`:** the My Account menu (owner and member lists, Messages off, which inbox).

## Verification

Local, staging data, 2026-11-21:

- **Unit tests:** 5556 passed. Typecheck and lint are clean.
- **Playwright** (owner-dashboard, account-surfaces, admin-entities, a11y, contrast, keyboard-a11y): 63 passed, 1 flaky (ticket 185 logo upload, passed on retry), 3 failed. None of the three come from this ticket:
  - **098 listing contrast:** the "Owner" label on a team card (`bg-gold/20` with amber 11px text, `EntityTeamSection.tsx`, ticket 107). Logged as a follow-up.
  - **TA-11 and TA-12:** the editor's save bar stays disabled after the test fills a field. These specs are not in CI and the editor is untouched here. Logged as a follow-up.
- **Screenshots** (one-off spec, not committed) at 1280, 1024 and 375:
  - member /account, member /dashboard (no pages), admin /admin;
  - owner /dashboard and /account/saved;
  - the page switcher, a page tool (Team marked, Page Tools opened), and the phone drawer for a member and an owner.
  - No sideways scroll anywhere.
  - Owners land on /dashboard after sign-in.
  - At 1024 the header uses its phone menu, so the extra "My Business" link does not crowd it.

Second pass, 2026-11-21: unit tests 5559 passed; typecheck and lint clean. Playwright (same specs): 48 passed. The three failures existed before this change: TA-11 and TA-12 (above), and TA-24, where the listing page has no "Save this business" button for the test. TA-24 fails the same way with this change stashed. Logged as a follow-up. Screenshots: owner on Products at 1280 (What You Offer open, Products marked with the dot), the header menu, the phone bar and drawer, the phone site menu, and admin.

## Not in This Ticket

- Business Home numbers and the Insights restyle (253).
- The account overview's "Your business" block is unchanged. Owners now reach their business from the top of the menu. A later pass can trim it once Home (253) is in.
- The public site header still sits above the phone menu bar.
