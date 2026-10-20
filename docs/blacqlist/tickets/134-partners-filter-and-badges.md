# Ticket 134: "Open to partnerships" filter and badges

**Phase:** V1.5 · **Priority:** P1 · **Status:** Done (2026-10-20). PR open, merges after the Oct 27 flip.
**Depends on:** 131 (column and RPC parameter), 132 (the switch owners turn on)
**Gates:** none. The RPC parameter ships in ticket 131's migration.
**Decision record:** `docs/blacqlist/features/creators-and-influencers.md`

---

## Why

`[Decision — founder, 2026-10-08]` Directory plus partner switches. Businesses need to find creators open to brand deals, and creators need to find businesses open to creator partnerships and sponsorships. Contact stays on each page's own contact button; The BLACQList makes no introductions.

## Scope

In:

- A Discover filter, "Open to partnerships" (`partners=1`).
- A badge on cards and on the page's info rail for pages with the switch on.

Out:

- Messaging, collab requests or introductions.
- "Looking for creators" posts.

## How it works

**Filter.** `partners=1` in the URL, passed to `search_listings_faceted` as `p_open_to_partnerships = true`.

| Need | Where |
|---|---|
| URL param | `lib/listings/discover-params.ts` |
| Sidebar + phone sheet | `FacetSidebar`, `MobileFilterSheet` |
| Active chip with remove | `ActiveFilterChips` |

Filter label: "Open to partnerships". It applies on change, lives in the URL and shows as a removable chip, like the other filters.

**How each side uses it:**

- Businesses: `/discover?type=creator&partners=1`.
- Creators: `/discover?partners=1` with any other type.

**Badge.** Text plus an icon, never color alone:

`[Decision — founder, 2026-10-20]` Final wording:

- Cards: "Open to partnerships". Creator cards: "Open to brand deals".
- Page info rail: "Open to creator partnerships and sponsorships". Creator pages: "Open to brand deals".

Shown on `EntityCard` and on the page's info rail. The wording lives in `lib/listings/partnerships.ts`.

**Empty state.** When filters are on and nothing matches, Discover shows "No results for these filters" with a "Clear filters" button (`DiscoveryGrid`, `filtersActive` from `hasFacetFilters`).

## Acceptance criteria

- [x] Given `/discover?partners=1`, then only pages with the switch on appear, across every type.
- [x] Given `/discover?type=creator&partners=1`, then only creators open to brand deals appear.
- [x] Given the filter is on, then an "Open to partnerships" chip shows and removing it clears `partners` from the URL.
- [x] Given a phone width, then the filter is in the filter sheet and works the same.
- [x] Given a page with the switch on, then its card and page show the badge with text a screen reader announces.
- [x] Given a page with the switch off, then no badge shows.
- [x] Given no pages match, then Discover shows the "No results for these filters" state with "Clear filters".

## Known limits

- The badge is self-declared; nothing checks a page actually sponsors or takes deals.

## QA notes

- Unit: `discover-params` parses and drops `partners` correctly; badge wording by type.
- Browser: filter on desktop and at 375px, chip removal, refresh keeps the filter, empty state.
- a11y: filter control reachable by keyboard with a visible label; badge has readable text, not an icon alone.

## Resolution (2026-10-20)

Built on branch `feat/partners-filter`. No migration: the column and the RPC parameter came with ticket 131.

- Filter: `partners=1` parses in `discover-params`, flows through `query.ts`, `facets.ts` and `services/search.ts` to `p_open_to_partnerships`, and shows as a sidebar checkbox (the phone sheet reuses the sidebar) and a removable chip.
- Badge: `open_to_partnerships` rides on the fail-soft `attachLevels` read, so a failed read shows no pill instead of an error page.
- Tests: `tests/partnerships.test.ts` (params and wording), `e2e/discover-filters.spec.ts` (chip, URL, two filters at once). The e2e "every card on ?partners=1 shows the badge" check skips when staging has no page with the switch on.
- Stale e2e fixed on the way: the Ownership sidebar test (control removed 2026-10-16, #243) and the category selector (category moved to the first pill).
