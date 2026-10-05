# Ticket 125: "Help me choose" guide on /add-business

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready
**Depends on:** none
**Gates:** GATE-DEPLOY (no migration). Part 5b, more than one category, is a separate PR with its own GATE-DATA.

---

## Why

Owners get stuck on step 1 of `/add-business`. They have to pick a listing type and one of 25 categories with about 170 subcategories, and many aren't sure where they fit. The founder asked on 2026-10-05 for something that sorts owners by their answers to a few questions.

## How it works

- Step 1 opens with a short guide above the listing type, name and category fields. It is open when no category is picked yet, and "Skip, I'll pick myself" closes it. Nothing below it is hidden.
- Two plain questions:
  1. **What do customers come to you for?** 13 answers, such as Food and drink; Hair, beauty and self-care; Help with money, law or business; Things I make or sell.
  2. **Where do they get it?** A place they visit, I come to them, Online or shipped, Pop-ups and markets.
- Then **Which fits best?** shows 4 categories, the ones that fit the "Where" answer first, with the rest behind "More options".
- Or the owner types what they do. "barber", "lawyer", "food truck" and "candles" each find the right subcategory. It matches category names plus common words.
- Picking one fills the listing type, the category and subcategory, and the location type on step 2. A "Why we suggested this" line explains it, and every field stays editable.
- How the listing type is suggested, first match wins:
  1. Pop-ups and markets → Vendor
  2. A category the discover Type chips already map (Food → Restaurant, Legal and Professional → Professional, Creative and Photography → Creative), so the guide and the directory agree
  3. "Things I make or sell" → Vendor
  4. "I come to them" → Service Provider
  5. Otherwise Business
- Rules only, no AI. All answers, category lists and search words live in one file, `lib/categories/sorting-guide.ts`.

## Acceptance criteria

- Given an owner on step 1 with no category, the guide is open, and `#name` is still visible below it.
- Given they type "barber", the first suggestion is Barber Shops. Picking it sets Business, Beauty & Grooming → Barber Shops.
- Given Food and drink → Pop-ups and markets, Food Trucks is suggested first. Picking it sets Vendor, Food & Dining → Food Trucks, and Traveling / mobile on step 2.
- Given they type "lawyer", picking Law & Legal Services sets Professional.
- Given Things I make or sell → Online or shipped → Candles & Home Fragrance, the type is Vendor and step 2 is Online / virtual.
- Given a top-level pick that has subcategories, the subcategory is left blank and the guide says to pick one.
- Given the owner searched instead of answering "Where", the location type they already chose is kept.
- "Skip, I'll pick myself" closes the guide, and the type grid and category selects work as before.
- A guide pick saves to the draft like any other field.

## Left open on purpose

- **More than one category** is part 5b: a `listing_categories` join table, search and count changes, and editing categories after creation. It needs a migration and its own GATE-DATA.
- The answer wording and which categories sit under each answer. The founder reviews these on the Preview.
- Events and Jobs. They list through their own forms, so the guide never suggests them.

## QA notes

- Unit: `tests/sorting-guide.test.ts` checks every slug in the guide against `supabase/seed.sql`, the "Where" order, the search cases and the type rules. If a category is renamed, the build fails.
- At runtime, a slug that isn't in the live category tree is skipped, never shown blank.
- On the Preview, walk the guide as a barber, a food truck, a lawyer and a candle maker at 375px and 1280px. Do one walk with the keyboard only.
