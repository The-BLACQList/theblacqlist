# Ticket 124: Featured badge and copy say "earned"

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready
**Depends on:** 123
**Gates:** GATE-DEPLOY (ships in the same PR as 123)

---

## Why

Once Featured is earned (ticket 123), nothing on the site should describe it as something you can buy. The badge should say why a listing has it.

## Changes

- **Listing hero:**
  - The pill reads "Featured this week".
  - Under the badges, a line reads "Earned by the most saves, reviews, shares and visits among {Restaurants} this week. How Featured works", linking to `/how-ranking-works#featured`.
  - The line only shows when there's an award row. Seeded flags show the pill alone.
- **Cards** keep the short "Featured" pill.
- **How ranking works:**
  - Section 3 says how Featured is earned and that no plan, payment or sponsorship can buy it.
  - Section 6 adds "Featured is not for sale."
- **For sponsors:** City Spotlight sells a labeled Sponsored placement, not "featured placement".
- **About:** removes "They are featured first across the directory." The ownership label doesn't change the order of results.
- **Terms:**
  - Before: "How listings are presented, prioritized, and featured is an editorial decision."
  - After: "How listings are presented and prioritized is an editorial decision. The weekly Featured badge is earned by activity, as described on our How Ranking Works page."
  - Founder to review the Terms wording.
- **Plans:** the unused `featured_collection` and `homepage_featured` gates are removed from `lib/stripe/features.ts`, and the keys are removed from `seed.sql`.
- Sponsored stays exactly as it is: paid, labeled, and never on a keyword search.

## Acceptance criteria

- Given a listing that won its bucket this week, when someone opens its page, then they see "Featured this week" and the line naming its listing type.
- Given a listing still featured from seed data with no award, then it shows the pill without the line.
- No page offers Featured as part of a plan or a sponsorship.
- `tests/how-ranking-works.test.ts` pins the new copy.

## QA notes

- Check the hero line at 375px, and that it wraps cleanly under the badges.
- Check that the link is keyboard reachable with a visible focus ring.
