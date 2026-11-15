# Ticket 225: The cart: one cart, many shops

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready
**Depends on:** 221
**Gates:**
- A migration (GATE-DATA), staging first.
- A new flag, `cart` → `FEATURE_CART`, added to `lib/env.ts` and to `CLOSED_BY_DEFAULT`, so it's off on every deployment, Previews included, until set.
- A Privacy pass: a cart shows what someone intends to buy.

**Decision record:**
- Founder, 2026-11-13, pick 2: one cart with many shops and one payment.
- Workshop S5, the end state.
- Round 3 board R3-2 for the layout.

## Why

"As easy as Amazon, but easier." One cart across every shop, so a shopper never re-enters an address or card for each maker.

## Scope

In:
- **Migration:**
  - `carts`: `id`, `profile_id` (unique, nullable), `updated_at`.
  - `cart_items`: `cart_id`, `variant_id`, `quantity` (1 to 20), `saved_for_later`, `added_at`. Unique on (`cart_id`, `variant_id`).
  - RLS lets the owner see only their own cart.
- **Signed out,** the cart lives on the device in localStorage (`lib/marketplace/cart/localCart.ts`), with variant ids and quantities only. At sign-in it merges into the database cart, taking the larger quantity and capping at stock.
- **Server reads** `lib/marketplace/cart/getCart.ts`:
  - joins to the purchasable view;
  - groups lines by shop;
  - computes shipping per shop from `shipping_profiles`: base, plus per extra item, and free over the threshold;
  - returns items, shipping and an estimated tax of "Calculated at checkout".
  - **Lines no longer purchasable are dropped,** and returned in a `removed` list. The UI shows "{item} sold out and was removed", or "is no longer available". Quantities above stock are lowered, with "{item} now has {n} left".
- **The page** `/cart`, as drawn on R3-2:
  - shop groups, each with items, quantity steppers, Remove, Save for later, "Ships in {n} to {m} business days", the shipping line and "Returns: {policy}";
  - a summary with items, shipping, tax at checkout and the total;
  - **Check out**;
  - an empty state: "Your cart is empty" with **Browse Shop**.
- **Add to cart,** an API route or server action used by 217, 218 and 219. It validates that the variant is purchasable and the quantity is within stock. It's rate-limited.
- **A cart icon with a count** in the Shop header, when the flag is on.
- **Privacy:** a line in the privacy policy, from `privacy-policy-marketplace-addendum.md` (220). The cart is deleted with the account, by CASCADE.

Out:
- Checkout (226), promo codes and gift options.

## Checks

- Unit tests for the shipping maths:
  - 1 item;
  - 3 items, where one extra-item charge applies;
  - over the free threshold;
  - mixing digital and physical, where digital adds no shipping.
- A variant set to 0 while it sits in a cart is dropped on the next read, with the notice shown.
- The merge at sign-in neither duplicates lines nor exceeds stock.
- With `FEATURE_CART` unset, every cart route returns 404 and no icon shows. This is checked on a Preview.
