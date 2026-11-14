# Shop workshop, rounds 1 and 2

**Audience:** the founder and whoever builds Shop next.
**Last updated:** 2026-11-13 (one-cart amendment)
**Canvas:** https://claude.ai/artifact/9ypmE6xcUjGU8miaVxWJBk (Version 21, private to the founder until shared)

The founder's brief, 2026-11-07: Shop should be as easy and as wide as Amazon. Cue matches a shopping list to Black-owned options. Shoppers see the Black-owned brands on the shelves of the stores they already use. The goal is to be "your first shop for easy black owned shopping."

Shop is the public Marketplace (`/marketplace`). It stays behind `FEATURE_MARKETPLACE_OPEN`, which opens at release item 15, after Growth is on sale (item 14). Nothing in this doc changes that order.

> **Amended 2026-11-13: one cart.** `[Decision — founder, 2026-11-13]`, decision-log entry of that date. Shop becomes a real marketplace, built now behind `FEATURE_CART` and live only after a CPA and an attorney sign off.
> - **One cart, one payment, many shops.** Vendors ship and deliver. The fee is 8%.
> - **Seller products are bought on BLACQList only.** There's no "Buy on their site". Directory brands keep Where to buy with no buy button.
> - **Physical products use real uploaded photos only.** There's an attestation, a provenance check, founder review of each seller's first 3 products, then spot checks.
> - **Sold-out items are hidden everywhere** and come back on restock.
> - **Physical and digital products** are both allowed.
>
> **What this changes below:**
> - S3 E keeps its layout, but a seller item gets a real buy box instead of the outbound Buy row.
> - S2 B's "Ships to you" group becomes add-to-cart.
> - S5's cart is now built.
> - The copy rule "The cart only ever appears as a Future flag" is retired.
> - "The shopper buys on the shop's own site" now applies to directory items only.
>
> The round 3 boards on the canvas draw the new screens. Build tickets are 220 to 229, and the workshop tickets were renumbered 183 to 192 → 210 to 219.

## Answers before round 1

`[Decision — founder, 2026-11-07]`

| Topic | Answer |
|---|---|
| What's in the catalog | Growth and Premium sellers' products, **plus** a curated directory of Black-owned brands we don't sell for, each with "Where to buy" |
| Grocery | Brand stockist lists first. The shopper picks "My stores" once. Retailer APIs and live shelf checks come later |
| Buying | Design the one-cart end state, and show today's link-out version beside it |
| How a list goes in, v1 | Type or paste it, chat with Cue, or reorder a saved list. No photo of a paper list in v1 |

## Picks

`[Decision — founder, 2026-11-08]` Round 1 picks came in as a pasted line. S3 needed a second round. In round 2 the founder first said "I do like C", then corrected it to **E**. E is the final pick.

| Screen | Picked | What it is |
|---|---|---|
| S1. Shop home | **B · Search bar first, list in a side tray** | Dark header with a "Pick your stores" chip, then a department bar that scrolls sideways (Grocery & pantry, Produce, meat & seafood, Beauty & hair, Clothing & shoes, Home & kitchen, Kids & baby, Health & wellness, Services). Hero line: "Black-owned, starting with dinner." Department rails of product cards. On a computer a list tray sits on the right: "What's on your list?", quick starts (Cookout for 12, This week's groceries, Wash day), **Shop my list**, the Cue AI note, "Chat with Cue instead" and "Reorder a saved list". On a phone the tray becomes a bottom bar with **Shop my list** and **Add items** |
| S2. List results | **B · Grouped by where you buy** | "Cue checked 5 items". The heading reads "Your list, by where you'll buy it", with a summary line: 1 store stop · 2 shops ship to you · 1 nearby · 2 still open. Groups: **In your stores** (one block per store, with Directions and a Swap on each item), **Ships to you** (each shop opens on its own site today), **Near you** (local shops with distance and hours), and **Still open** (items that need a choice, or that we don't have yet). On a phone each group stacks and collapses |
| S3. Product page | **E · The shop is the first row** | No separate buy box. The hero keeps "From [price]", **Add to my list** and **See where to buy**. The rest of the page is Where to buy, with tabs: Your stores, Other stores near you, Online. **A seller item opens on the Online tab, and the seller's own shop is the top row**, with its price, a **Buy** button that opens their site, and a "Future · Add to cart" flag. **A directory item opens on Your stores.** Stockist rows read "Reported by the brand · updated {date}" and have Directions plus "Tell us it's not there". A picked store that isn't on the brand's list shows "Ask {store} to carry it". There's a map on the right, and a "Later" note about live shelf checks. On a phone, the price range sits under the title and **Add to my list** sits in a bottom bar |
| S4. My stores | **B · One-time sheet** | A sheet is asked once, before the first list results: "Pick your stores. Choose the stores you already shop at. We'll check them first for Black-owned brands." It has a ZIP field, then nearby stores with distances and **Save my stores**, plus "Not now". After that a store chip sits in the header, and the shopper can change stores in their account |
| S6. Department page | **A · Sidebar filters, chips on phone** | Breadcrumb `Shop / {department}`, the heading and a count line ("[148] products from [36] Black-owned brands"), and Sort: Most saved. The sidebar groups are How you get it (Ships to you, In your stores, Near you), Type, and Price bands, each with counts, plus Clear all filters. Active filters show as chips. On a phone there's a Filters button with a count, and the filters show as chips that scroll sideways |
| S7. Saved lists | **A · List of lists** | Every list gets the same weight. Each one shows its item count, when it was last shopped, any repeat ("Weekly · Sun"), a "Since last week" line (new options, stores no longer listed) and **Shop this list again** |

Not picked:
- S1 A (list first) and C (rails with a bottom list bar)
- S2 A (a row per item) and C (a card per item)
- S3 A (one page, two buy panels), and B as drawn. S3 C (buy row up top) and D (sticky buy rail) from round 2
- S4 A (inline on results)
- S6 B (chip bar everywhere)
- S7 B (weekly list up front)

S5 (Buying) had only one board, with no pick to make. It shows the future cart beside today's list by store, as the end state for release item 38.

How E plays out by product type:

| Product type | Hero | Where to buy opens on | Top row |
|---|---|---|---|
| Seller item (a Growth or Premium storefront product) | From [$34.00] · Add to my list · See where to buy | **Online** | The seller's shop · price · **Buy** opens their site · Future · Add to cart |
| Directory item (a brand we don't sell for) | Price range from the brand · Add to my list · See where to buy | **Your stores**, or Online if the shopper hasn't picked stores | The nearest picked store that carries it |

## Questions settled

`[Decision — founder, 2026-11-08]`

| # | Question | Answer |
|---|---|---|
| Q1 | How a brand gets into the directory | **C · Both.** We list a brand only from a source we can point to, such as the brand's own site, press, or a public list. The brand attests to claim and edit its entry. `[Needs professional review]` Counsel should confirm the source rule for describing a brand as Black-owned |
| Q2 | Price on directory items | **B · A price range from the brand.** Copy: "[$6 to $8]" and "Price range from the brand. Stores set their own prices." On cards: "[$6 to $8] at stores" |
| Q3 | Log list items we couldn't match | **B · No.** Unmatched items are not stored or counted. A shopper can still tap Suggest a brand, which is a separate form they choose to send |
| Q4 | Who adds stockists | **A · The brand or the owner adds them, and the founder reviews them** before they show |
| Q5 | When sign-in is needed | **A · Only to save a list.** Shopping a list, picking stores and browsing work signed out. Signed-out store picks stay on the device |
| Q6 | Cue list limits | **A · Free with a daily limit, and membership raises it.** The $4.99 shopper membership isn't live yet, so v1 ships the free limit only |
| Q7 | Affiliate links | **A · Later, after legal review.** No affiliate links or tracking parameters in v1. Outbound links keep the existing CTA click count only |
| Q8 | Nav label | **A · "Shop".** The route stays `/marketplace` |
| Q9 | How many stores a shopper can pick | **C · No cap** |

## States (come with the picks)

All of these are drawn on the States board.

- **Empty department:** "Nothing in {department} yet." Body: "Know a brand that belongs here?" Actions: **Suggest a brand** and **Browse other departments**.
- **No match for one item:** the row reads "We don't have this one yet." with "Cue shows items from our listings." and two actions, **Suggest a brand** and **Remove from list**. Nothing is logged (Q3).
- **Cue limit reached:** "Cue is at its limit for today. Your list stays here. Try again tomorrow or browse by department." Action: **Browse by department**.
- **Stockist may be out of date:** after 90 days without a brand update the row shows "Not updated in 3 months" in amber. When a shopper taps "Tell us it's not there", they see "Thanks. We'll check with {brand}." The row stays, and its date turns amber for everyone until the brand updates it.
- **No stores picked:** the In your stores group says "Pick your stores to see Black-owned brands on their shelves." with **Pick stores**. The other groups still fill.
- **Signed out, saving a list:** "Sign in to save this list and shop it again next week. Your 5 items stay right here while you sign in." Actions: **Create free account**, **Sign in**, **Not now**.
- **Loading, Cue checking the list:** "Cue is checking your list, one item at a time." with a "2 of 5 checked" count. Rows fill in as each item comes back. With reduced motion on, the bars stay still.
- **Couldn't load:** the same pattern as the rest of the site: "We couldn't load this just now" with Try again. The list stays.

## Copy facts to keep right when building

- **Never use these:** "Verified", "confirmed", "all", "every", "only", "100%", or "Cue buys". Cue finds and matches. The shopper buys a seller item in the BLACQList cart, and buys a directory item at a store or on the brand's own site.
- No Black-owned badge on products. Count lines and subheads may say "Black-owned brands", under the 23 Oct site-copy rule. Ally is not named.
- **The current `/marketplace` hero says "Products and services from verified Black-owned businesses."** That line breaks the rule above and changes in ticket 210.
- No em dashes and no parentheses in visible strings. Ranges use "to": "$6 to $8", "2 to 4 days".
- Stock lists: "Stock lists come from the brand and can be out of date." Every stockist row carries "Reported by the brand · updated {date}".
- Outbound: "Opens their site in a new tab." Every outbound link opens a new tab and has an external-link icon.
- ~~The cart only ever appears as a "Future" flag until release item 38 ships.~~ Retired 2026-11-13: the cart is built now behind `FEATURE_CART`. With the flag off, seller items aren't purchasable, so they don't show at all.
- Cue shows its mark, never a sparkle icon. Every Cue surface carries the AI note: "Cue uses AI to answer from our listings and can get things wrong."
- Gold `#c4a065` is used on dark backgrounds only. Interactive elements use amber `#8f6600`. Prices use tabular figures.

## Build implications

- **New data:**
  - a brand directory, with a source and a claim plus attest flow (Q1);
  - directory products with a price range (Q2);
  - stores and stockists, with a review status and reports (Q4);
  - each shopper's picked stores (Q9: no cap; Q5: on the device until sign-in);
  - saved shopping lists (S7).
  Every one is a migration, and every migration goes through GATE-DATA, staging first.
- **Cue:**
  - needs two new tools, `search_products` and `match_list`;
  - its guard must allow product and brand names that a tool returned during that message, the same rule as listing names in ticket 169;
  - stays on Haiku 5.5, behind `FEATURE_AI_ASSISTANT` and the existing ceiling and kill switch.
- **Privacy:**
  - picked stores and saved lists say roughly where a shopper lives and what they buy;
  - both need a Privacy agent pass and a line in the privacy policy before they ship;
  - unmatched list items are not stored (Q3).
- **Legal:**
  - the directory names brands that aren't customers, and stockist rows name real retailers;
  - counsel should confirm the source rule (Q1) and how we name retailers on stockist rows;
  - affiliate links stay out until legal review (Q7).
- **What stays the same:** storefronts are still Growth-only (ticket 105), and products on pages below Growth stay hidden.

## Later, not in these tickets

- ~~Cart, checkout, orders and payouts (release item 38).~~ Moved into scope 2026-11-13, as tickets 220 to 229.
- Live shelf checks and retailer APIs. The "Later" note on the product page holds this place.
- Raising the Cue limit with membership. This waits for the $4.99 shopper membership.
- Affiliate links (Q7).
- Photo of a paper list.

## Next

Tickets 210 to 229 in [../tickets/](../tickets/). Workshop tickets 183 to 192 were renumbered 210 to 219 on 2026-11-13, because main had used 183 to 203. Each ticket gets one PR in a worktree from `origin/main`, after the D0 watch, and every migration goes to staging first.

**Build order, amended 2026-11-13:**
1. 220, the legal drafts. Docs only; starts now.
2. 210, copy only.
3. 211 and 221, the catalog data.
4. 222 and 223, sell-ready products with photo review.
5. 224, seller payouts.
6. 225 and 226, cart and checkout.
7. 227 and 228, fulfilment and after-sale.
8. 212 to 214, directory claims, stockists and my stores.
9. 215 to 219, the pages and Cue.
10. 229, the rehearsal and go-live gate.
