# 182: A close-up of the Silo in the home Collective band

**Status:** Draft PR, merges on the founder's word.
**Follows:** 181 (the band's new place on the home page)
**Area:** the home page

## Why

The band was built before The Collective opened: four decorative dots and three plain numbers. The founder wants "dots and connects, almost like a close up of a section of the silo. Communicate the point without including every single dot."

The picks are in `docs/blacqlist/design/collective-band-2026-11.md`.

## What changes

- The four decorative dots are gone. A crop of the Silo takes their place: four floors, nine clusters of business dots, lines from the Shoppers floor to a business, and two gap squares. It sits to the right on desktop and on top on phones.
- The lines grow in steps with real purchases, and never pass the real business count.

  | Purchases   | Lines |
  | ----------- | ----- |
  | 0           | 0     |
  | 1 to 9      | 3     |
  | 10 to 49    | 8     |
  | 50 to 199   | 14    |
  | 200 or more | 20    |

- Small gold pulses travel along the lines: one at 3 lines, up to five at 20.
- New line under the heading: "Every receipt puts another dollar on the map. Together we can see where our money goes."
- The totals read spent, purchases and businesses, with singular labels ("1 purchase", "1 business"). This fixes "1 tracked purchases".
- At $0 the totals give way to "Waiting on its first dollar." and "Add a receipt and be the first in."
- A small "Pause motion" control stops the pulses. The workshop board didn't show it. Motion that runs longer than five seconds needs a way to stop it (WCAG 2.2.2), and the Silo has the same control. It works with no client JavaScript.
- With reduced motion on, the pulses hold still and the pause control goes away.

The Silo's honesty rules stay. Lines run only from the Shoppers floor to a business, never business to business. Shoppers are never a dot. A gap never claims dollars leave.

## Not in this ticket

- The covered band for when The Collective is closed. It stays as it was.
- Any new home query. The steps read the totals the band already has.
- Which business a line lands on. The art is a sample of the shape, not a map of real businesses.

## Checks

- At 320, 375, 768, 1024, 1280 and 1920px, for no purchases, one, a few and plenty: no sideways scroll and all text readable.
- With reduced motion on, the still dots show and the pause control is gone.
- Tab reaches "Pause motion" with a visible ring, and Space stops and restarts the pulses.
- `tests/collective-closeup.test.ts` covers every step, the cap, stable output, and that every line starts on the Shoppers floor.
- `tests/spend-vocabulary.test.ts` still passes.
- The covered band still shows on the Vercel preview.
- Still owed: a look at the moving pulses on a real iPhone.
