# Ticket 135: Creators on the home page

**Phase:** V1.5 · **Priority:** P1 · **Status:** Needs approval (round-1 workshop first)
**Depends on:** 131 (creator type), 132 (sign-up path the invitation links to)
**Gates:** Design. Founder picks the Avenues tile layout and the creator photo at a round-1 workshop before build. No migration.
**Decision record:** `docs/blacqlist/features/creators-and-influencers.md`

---

## Why

`[Decision — founder, 2026-10-08]` Creators "should still be easy to find as a group. Maybe even a spot/band on the hero page to make it clear they are a group on our platform." Sign-up opens at launch with no invites, so the home spot has to look good with zero creators on day one.

## Scope

In:

- A "Creators" chip in `HomeHero`, linking to `/discover?type=creator`.
- A new Creators band after `TheAvenues`.
- A Creators tile in `TheAvenues`.
- A creator photo for the band, the Discover banner and the tile, from the kept photo library.

Out:

- A `/for-creators` page.
- New photos. Only the kept library is used.

## How it works

**Band.** New `components/home/CreatorsBand.tsx`, built like `FreshFinds.tsx`, placed after `TheAvenues` in `app/page.tsx`. Its data comes from one more query in the page's existing `Promise.all`.

| Published creators | Band shows |
|---|---|
| 4 or more | The newest creator cards and a "See all creators" link to `/discover?type=creator` |
| Fewer than 4 | A "Creators, get listed" invitation linking to `/add-business?as=creator` |

**Avenues tile.** Two options for the workshop:

- A. A seventh tile. "Six avenues" copy and the 6-column grid change to 7.
- B. The Creators tile replaces the coming-soon Jobs tile.

**Workshop.** Round 1 shows the band in both states, both tile options and a creator page, for founder picks, before any build.

## Acceptance criteria

- Given the home page, then the hero has a "Creators" chip that opens `/discover?type=creator`.
- Given fewer than 4 published creators, then the band shows the invitation and links to `/add-business?as=creator`; it never shows an empty grid.
- Given 4 or more published creators, then the band shows the newest creators and a link to all of them.
- Given the creator query fails, then the band falls back to the invitation and the rest of the page still loads.
- Given a phone width, then the band and tile stack cleanly with no sideways scroll.
- Given the tile, then the Avenues copy matches the number of tiles shown.

## Known limits

- Until creators sign up, the band is an invitation only.

## QA notes

- Browser (local): band with 0, 3 and 4 creators; failed query fallback; 375px and desktop.
- a11y: `pnpm test:a11y` on home; chip, band links and tile reachable by keyboard; photo has alt text or `alt=""` if decorative.
- Design critique pass (design-critic) on the workshop picks before build.
