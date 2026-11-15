# Ticket 210: Call it Shop, and fix the Marketplace hero line

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready
**Depends on:** none
**Gates:** none. No migration, no new dependency. Copy only, so it can ship before `FEATURE_MARKETPLACE_OPEN`. Merges on the founder's word.
**Decision record:** [Shop workshop](../design/marketplace-workshop-2026-11.md), Q8 A, plus the copy rules from the same doc.

## Why

- The founder picked "Shop" as the label (Q8 A).
- The `/marketplace` hero says "Products and services from verified Black-owned businesses." That breaks two rules. We never say "Verified", and the trust ladder doesn't verify ownership.

## Scope

In:
- **Public labels.** "Marketplace" becomes "Shop" everywhere a shopper sees it:
  - the footer link (`components/nav/public-footer.tsx`);
  - the page `<title>` and metadata on `/marketplace`, `/marketplace/products` and `/marketplace/services`;
  - breadcrumbs.
  The route stays `/marketplace`, so there are no redirects.
- **The hero subhead** in `app/(public)/marketplace/(index)/page.tsx`. Suggested line: "Products and services from Black-owned businesses, in one place." The founder picks the final words in the PR.
- **A sweep of the marketplace routes** for "verified", "all", "every", "only" and "100%" in shopper-facing strings. Fix any hits the same way.

Out:
- Admin labels. `/admin/marketplace` keeps "Marketplace".
- Any layout change. The new home is ticket 215.
- The cart. That's 225. The 2026-11-13 one-cart decision doesn't change this ticket.

## Checks

- The words "verified" and "Marketplace" don't appear in any shopper-facing string under `app/(public)/marketplace` or in the public nav and footer. A grep in CI or the PR description shows this.
- The footer link still goes to `/marketplace` and keeps its "soon" state while the flag is off.
- No em dashes or parentheses in the changed strings.
