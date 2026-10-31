# Ticket 161: The Collective first look, three steps then the map

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready
**Depends on:** none. 167 replaces the map below the steps; either order works.
**Gates:** GATE-DEPLOY. No migration, no new dependency. `/flow-map` stays behind `FEATURE_COLLECTIVE_OPEN` (off in prod).
**Decision record (founder, 2026-10-31):** Screen 1 **B, three steps, then the map**. Q1 **Add a receipt**. Q6 waitlist on **The Collective page only**. See `docs/blacqlist/design/collective-workshop-2026-10.md`.

---

## Why

Most people who open The Collective have never heard of it. Today the page opens on totals and the network map, and doesn't explain where the numbers come from or how to join in.

## Scope

In:

- **Top of `/flow-map`, three short steps in one row** (stacked at 375px):
  1. "Shop at a business on the list."
  2. "Add a receipt."
  3. "Your spend joins the map."

  Each step has an icon and one line, with no em dashes. Then one filled button, followed by the map and the total.
- **Three states for the button and the line under it:**
  - `out`, signed out: "Sign in to add a receipt", which opens `/sign-in?next=/account/receipts/new`.
  - `new`, signed in with no receipts: "Add your first receipt".
  - `has`, signed in with receipts: "Add a receipt", plus a quiet "My receipts" link and your counted total.
- **The $4.99 waitlist stays on this page only.** Remove it from `components/account/CollectivePanel.tsx` and any `/account` page that shows it.
- **Copy says "spent", never "circulated".**

Out:

- The map itself (167).

## Acceptance criteria

- Given a signed-out visitor, the three steps show above the map, and the button reads "Sign in to add a receipt" and returns them to the form after sign-in.
- Given a signed-in member with no receipts, the button reads "Add your first receipt".
- Given a member with receipts, the button reads "Add a receipt", and "My receipts" and their counted total show.
- Given any `/account` page, no $4.99 waitlist shows.
- Given 375px, the steps stack, the page doesn't scroll sideways, and the button is at least 44px tall.
- Given a keyboard user, the order is steps, then button, then map.

## Failure states

| Failure | Result | Recovery |
|---|---|---|
| The receipt count read fails | Show the `new` state | Refresh |

## Tests

- Unit test for the state picker (`out` / `new` / `has`).
- Lint, typecheck and unit tests. Preview at 375px and 1280px for all three states. Previews read staging data.
