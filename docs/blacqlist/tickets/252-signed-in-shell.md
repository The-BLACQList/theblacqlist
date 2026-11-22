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
  - **Owners:**
    - **Your Business:** Home, Edit Page, Insights, Messages, Plan.
    - **Page Tools:** Products, Services, Events, Photos and Media, Happening Now, Offerings, Team, Receipts to Verify, Get Verified.
    - **More Page Tools:** Highlights, Special Hours, Locations, Bookings, Credentials, Documents.
    - Then You and Account.
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
- **Header:** owners get a "My Business" link (desktop and phone menu), next to My Account.
- **Report a Problem button:** on /account and /dashboard at lg and up it sits just past the rail (`lg:left-72`) instead of over Sign Out.
- **Removed:** `components/account/AccountNav.tsx` and `components/dashboard/DashboardSidebar.tsx`.

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
  - An owner sees Home, Edit Page, Insights, Plan and the page switcher, and Products and Services under Page Tools.

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

## Not in This Ticket

- Business Home numbers and the Insights restyle (253).
- The account overview's "Your business" block is unchanged. Owners now reach their business from the top of the menu. A later pass can trim it once Home (253) is in.
- The public site header still sits above the phone menu bar.
