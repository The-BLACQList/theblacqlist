# Ticket 216: Department pages, sidebar filters with chips on a phone

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready
**Depends on:** 211. The "In your stores" filter needs 213 and 214, and stays hidden until both merge.
**Gates:** no migration. Behind `FEATURE_MARKETPLACE_OPEN`.
**Amended 2026-11-13 (one cart):**
- Seller items come from the 221 purchasable view only. Counts and filters never include a sold-out, unapproved or suspended item.
- Add a **Digital** option under How you get it, for seller items whose `product_kind` is `digital`.
**Decision record:** S6 A (founder, 2026-11-08). The States board, Empty department.

## Why

Browsing by department is how Shop feels wide when a shopper has no list.

## Scope

In, as drawn on S6-A:
- **The route** `/marketplace/d/[department]`, plus Services, which links to the existing `/marketplace/services`.
- **The header:**
  - breadcrumb `Shop / {department}`;
  - H1;
  - the count line: "{n} products from {m} Black-owned brands";
  - Sort, with Most saved as the default, and Newest and Price low to high.
  If there's no saved count yet, Most saved falls back to Newest.
- **The sidebar,** at 1024px and up, with three groups. Each option shows its count:
  - **How you get it:** Ships to you, In your stores, Near you;
  - **Type:** the department's types from `lib/marketplace/departments.ts`;
  - **Price:** Under $15, $15 to $35, Over $35. A directory item counts in a band when its range overlaps that band.
  Filters apply on change, show as chips above the grid that can each be removed, and include **Clear all filters**. Filter state lives in the URL.
- **On a phone:** a **Filters** button with the active count opens a sheet. Active filters show as chips that scroll sideways.
- **The grid** uses the 215 cards.
- **States:**
  - Empty department: "Nothing in {department} yet." with "Know a brand that belongs here?", **Suggest a brand** and **Browse other departments**;
  - filters with no results: "No products match these filters" with Clear filters;
  - loading: a skeleton that matches the card grid;
  - couldn't load: Try again.
- **Suggest a brand.** A small form takes the brand name, a link and an optional note, and writes to the existing contact or suggestion inbox. Use what `/add-business` suggestions use today. No new table.

Out:
- Saved counts, if no save exists yet. Use Newest and leave a TODO.
- Custom price ranges.

## Checks

- Every filter combination survives a reload and a shared link.
- An unknown filter value in the URL returns the unfiltered page, not an error.
- Counts match the grid for each filter, with a test on fixture data.
- The phone chip row scrolls on its own, and the page never scrolls sideways at 375px.
