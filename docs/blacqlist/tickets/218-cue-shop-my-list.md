# Ticket 218: Cue shops a list, with results grouped by where you buy

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready
**Depends on:** 169 (Cue chat), 211, 213, 214, 215
**Gates:** no migration. Behind `FEATURE_MARKETPLACE_OPEN` and `FEATURE_AI_ASSISTANT`.
**Amended 2026-11-13 (one cart):**
- **The tools.** `search_products` and `match_list` return seller items from the 221 purchasable view only, so Cue never suggests a sold-out item. `match_list` reads the variant stock.
- **The Ships to you group** reads "{n} shops · one cart, one payment". Each item has **Add to cart**, with the variant picked inline if there's more than one, and the group has **Add these to cart**. This needs 225.
- **The guard.** Cue never says it bought anything, and never adds to the cart itself. The shopper taps. Uses the existing monthly ceiling, kill switch and audit log (138/128).
**Decision record:**
- Founder, 2026-11-07: Cue matches a shopping list to Black-owned options.
- S2 B (2026-11-08), grouped by where you buy.
- Q3 B, no gap logging.
- Q6 A, free with a daily limit. Membership raises it once the $4.99 membership exists.
- The States board: loading, no match, limit reached.

## Why

This is the core job: "here's my list, show me the Black-owned way to buy it."

## Scope

In:
- **Two Cue tools** in `lib/ai/cue/tools.ts`. The server owns both, and they return public fields only.
  - `search_products`:
    - takes words, a department, a how-you-get-it filter, and the shopper's store ids and point;
    - returns up to 8 seller or directory products, each with its how-you-get-it options.
  - `match_list`:
    - takes up to 30 list lines;
    - for each line, returns the best match and up to 2 swaps, each tagged `in_your_stores` (with the store id), `ships`, or `near_you` (a seller with pickup near the point);
    - may return `choices` for a vague line, like "bread" giving Sandwich loaf, Cornbread mix or Rolls, or `none`.
- **The guard.** Cue may only name products and brands a tool returned during that message, the same rule as listing names in 169. Add a test for a made-up brand name.
- **The page** `/marketplace/list`, opened by **Shop my list**:
  - the loading state: "Cue is checking your list, one item at a time." with "{k} of {n} checked", and rows fill in as they stream back;
  - the H1 "Your list, by where you'll buy it", with a summary line like "1 store stop · 2 shops ship to you · 1 nearby · 2 still open", "My stores: {names}", and **Edit list**;
  - groups, in this order:
    - **In your stores:** one block per store, with Directions and "Stock lists come from the brand and can be out of date."; each item has its "Reported by the brand · updated {date}" line, the range, and **Swap**;
    - **Ships to you:** "{n} shops · one cart, one payment", with the subtotal; each item has **Add to cart**, per the 2026-11-13 amendment;
    - **Near you:** the shop, its distance and hours, with "See price in shop";
    - **Still open:** a choice row ("Which kind of bread?" with options and "Skip this one"), or a no-match row: "We don't have this one yet." with "Cue shows items from our listings.", **Suggest a brand** and **Remove from list**.
  - On a phone, the groups stack and each one collapses.
- **No stores picked.** The In your stores group says "Pick your stores to see Black-owned brands on their shelves." with **Pick stores**. The 214 sheet opens once, before the first results.
- **The daily limit** sits in `lib/ai/cue/limits.ts`, as list checks per visitor per day. The default is 10, and the founder can change it.
  - When it's reached: "Cue is at its limit for today. Your list stays here. Try again tomorrow or browse by department."
  - The membership raise is a TODO until the membership ships.
- **Q3, no gap logging.**
  - Unmatched lines are not written anywhere.
  - Check what `ai_generation_requests` keeps. If it stores the prompt text, store a line count for list checks instead.
- **Chat with Cue.** On Shop pages, the Cue chat also gets `search_products`, so "Chat with Cue instead" works for shopping questions.

Out:
- Cue adding to the cart on its own. The shopper always taps.
- A photo of a list.
- Saving the list, which is 219. The signed-out save prompt also comes in 219.

## Checks

- A 5-line fixture list on staging streams 5 rows, and its summary counts add up to 5.
- A line with no match shows the no-match row, and the DB holds no copy of that line afterwards. Check `ai_generation_requests` and any log table.
- The guard drops a reply that names a brand no tool returned. A unit test covers this.
- The 11th list check in a day shows the limit state, and the working list is unchanged.
- The kill switch or ceiling falls back to department browsing, with the list kept.
- Reduced motion: the loading bars stay still. Screen reader: "{k} of {n} checked" is in a polite live region.
