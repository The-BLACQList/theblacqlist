# Ticket 166: After a receipt is counted, "Your spend joined the map" and a share card

**Phase:** V1.5 · **Priority:** P1 · **Status:**
- Part A: Ready.
- Part C: blocked on open question O3 and a Privacy agent review.

**Depends on:** 164, and 167 for the "See it on the map" ring. Before 167, the button goes to `/flow-map` with no ring.
**Gates:** GATE-DEPLOY. No migration for Part A, or for Part C if O3 is A.
**Decision record (founder, 2026-10-31):** Screen 5 **A + C**. "After approval, A + C. We do want people to be able to share it." Q13 **gold ring and You tag**.

---

## Why

This is the moment the feature exists for. Tying the receipt to a spot on the map makes it feel real, and sharing it spreads the word.

## Scope

In:

- **Part A: `/account/receipts/[id]/counted`.** Owner-only; anyone else gets a 404. The screen shows:
  - the amount, the business name and its category chip;
  - a gold ring;
  - the line "Your spend joined the map";
  - the button "See it on the map", which opens `/flow-map?you=1` with the business selected and your gold ring and You tag (167).

  Waiting or needs-a-fix receipts redirect to My receipts. The counted email (165) and the Counted row in My receipts both link here.
- **Part C: a share card** on the same screen. If O3 is A (lean):
  - **"Share" button:** opens the phone's share sheet through `navigator.share`, with Copy as the fallback (same pattern as `components/entity-page/ShareButton.tsx`).
  - **Shared text:** "I shopped at [Business] and added my receipt to The Collective on The BLACQList." plus the business page link.
  - **"Include the amount" switch:** off by default.
  - **Nothing is stored,** and no public page is made.
  - **Opt-in:** share only for businesses that have opted in to showing their name in The Collective. For other businesses, the text drops the name and links to `/flow-map`.

Out:

- Image cards (O3 B).
- Public receipt pages.

## Acceptance criteria

- Given my counted receipt, the screen shows the amount, the business and the ring, and "See it on the map" opens the map focused on that business.
- Given someone else's receipt id, the page is a 404.
- Given the share switch is off, the shared text has no amount.
- Given a business that hasn't opted in, the shared text doesn't name it.
- Given a desktop browser with no share sheet, Share copies the text and says "Copied".
- Given reduced motion, the ring appears without animating.

## Failure states

| Failure | Result | Recovery |
|---|---|---|
| Receipt read fails | "We couldn't load this receipt." | Back to My receipts |
| Share cancelled | Nothing | None |
| Copy refused | The text shows selected | Copy it by hand |

## Tests

- Unit tests for the share text builder (amount on and off, opted in or not) and the owner check.
- Preview at 375px and 1280px.
