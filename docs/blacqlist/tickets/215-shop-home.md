# Ticket 215: The Shop home, search first with a list tray

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready
**Depends on:** 210, 211. The "Shop my list" button needs 218, and until then it's hidden.
**Gates:** no migration. Behind `FEATURE_MARKETPLACE_OPEN`.
**Amended 2026-11-13 (one cart):**
- Seller cards read from the 221 purchasable view, so sold-out items never appear.
- "Ships to you · {price}" links to the product page.
- A small cart icon with a count joins the Shop header when `FEATURE_CART` is on, from 225.
- Add to cart on cards waits for a round 3 pick; it's not in v1.
**Decision record:** S1 B (founder, 2026-11-08). The founder's list inputs for v1: type or paste, chat with Cue, or reorder a saved list.

## Why

This page is the "first shop" front door. The search bar and departments make it wide, and the list tray is where the list starts.

## Scope

In, as drawn on S1-B:
- **The department bar** under the header, in this order: Grocery & pantry, Produce, meat & seafood, Beauty & hair, Clothing & shoes, Home & kitchen, Kids & baby, Health & wellness, Services. It scrolls sideways with no scrollbar, and the active department has `aria-current`.
- **The hero:** "Black-owned, starting with dinner." The body: "Groceries, produce and meat, then clothes, beauty and home. Start with your list and Cue does the looking."
- **Department rails.** Product cards mix seller and directory items, and each rail has "See more", which goes to the department page from 216. Each card shows:
  - a cutout image;
  - the department chip, name and "Made by {brand} · {city}";
  - one of three how-you-get-it lines: "{range} at stores", "Ships to you · {price}" or "Near you · {distance}".
- **The list tray,** on the right at 1024px and up:
  - "What's on your list?" with a textarea, where typing and pasting both work;
  - quick starts, which prefill the textarea: Cookout for 12, This week's groceries, Wash day;
  - **Shop my list**;
  - the Cue AI note;
  - "Chat with Cue instead";
  - "Reorder a saved list", shown only when signed in with saved lists.
- **The working list:**
  - lives on the device in localStorage, as one list of up to 30 lines;
  - is shared with "Add to my list" on product pages (217);
  - lives in `lib/marketplace/workingList.ts`.
- **On a phone,** the tray becomes a bottom bar with **Shop my list** and **Add items**, which opens the tray as a sheet.
- **The four states:**
  - loading: skeleton rails;
  - an empty department rail: hidden from the home page;
  - couldn't load: "We couldn't load this just now" with Try again;
  - success.

Out:
- Matching the list, which is 218. Until 218 merges, **Shop my list** and the quick starts are hidden behind `FEATURE_AI_ASSISTANT`, and the tray shows the working list only.
- Personalized rails.

## Checks

- No sideways page scroll at 375px. Only the department bar scrolls.
- A directory card never shows a single price, only the range with "at stores".
- No "Black-owned" badge on any card.
- The working list survives a reload, and an item added on a product page shows in the tray.
- Keyboard: tab order runs header, department bar, search, rails, tray. Every control has a visible amber focus ring.
