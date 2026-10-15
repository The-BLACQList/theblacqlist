# Pricing Decisions, 2026-10-15

**Audience:** the founder, and anyone building billing, The Collective, or AI features.
**Status:** Decided by the founder on 2026-10-15. Nothing here is built yet.
**Last updated:** 2026-10-15

These decisions came out of the AI planning session that wired the real model (PR #235).

---

## 1. Business plans stay as they are

| Plan | Price | Change |
|---|---|---|
| Free | $0 | None |
| Starter | $19/mo | None |
| Growth | $49/mo | None |
| Premium | $99/mo | None |

Prices still come only from `lib/stripe/plans.ts`. The other pricing options discussed (B, D and E)
were turned down.

## 2. AI model: Claude Haiku 5.5 for every plan

- One model, `claude-haiku-5-5`, for every agent and plan (`MODEL_BY_TIER` in `lib/ai/agents.ts`).
- List price is $0.10 in and $0.50 out per million tokens. One suggestion costs a fraction of a cent.
- Spending is capped three ways: 10 per page per day, the plan's monthly allowance (`aiQuota`:
  Starter 10, Growth 100, Premium 500), and a monthly ceiling for the whole site
  (`AI_MONTHLY_CEILING_USD`).
- The real model stays off in prod until the privacy notice takes effect (earliest 2026-11-02).

## 3. New: a shopper membership at $4.99/mo

A paid plan for shoppers. Business plans stay separate.

**What it includes**

- Higher AI chat limits than free shoppers get
- The full Collective
- A private "your dollars" trail: where your own spending went
- A monthly impact report
- More saved lists
- Early access to new features

**Rules that don't change**

- Other shoppers only ever appear in aggregate (F-4 §2C). A member sees their own spending and nobody
  else's. Paying never unlocks another person's data.
- Every number comes from a real query (`no-fabrication.md`). If we can't measure it, the report
  doesn't show it.

**How we test it first**

- A waitlist on The Collective before anything is built or charged. Signups tell us whether to build it.
- No Stripe product, price or checkout until the waitlist shows demand and the founder says go.

**Needs review before launch** `[Needs professional review]`

- Privacy: the "your dollars" trail and impact report use a shopper's own spending. The privacy policy
  has to say so, and shoppers need a way to see and delete it.
- Auto-renewal: a monthly consumer subscription falls under state auto-renewal laws (for example
  California's). Clear terms before checkout, consent, a reminder where required, and online
  cancellation that is as easy as signing up.

## 4. Option C: Collective insights for owners, in Growth and Premium

When Growth and Premium open for purchase, they get Collective insights:

- **Gap finder:** what shoppers nearby look for that no business on the list offers
- **Supply lanes:** businesses on the list that could buy from each other
- **Neighborhood spend bands:** spending in an area, shown only as ranges
- **Trend history:** how those numbers change over time

**Rules**

- **B2B matching stays free.** Finding a supplier on the list is part of the mission, not a perk.
- **Revenue shows only as bands, and only if the owner opts in.** No business's exact revenue is
  ever shown to anyone else.
- **Paying never makes a dot bigger.** A business's size on the map reflects real activity, never
  its plan.
- Shoppers appear only in aggregate, same as above.

These features are added to the plan matrix in `lib/stripe/features.ts` when they are built. Until
then, no page or plan card mentions them (no unbuyable bullets).

---

## What happens next

1. Piece 3 of the AI plan: AI drafts in /add-business (ticket 128).
2. A waitlist for the shopper membership on The Collective (ticket to write).
3. Collective insights, specced and ticketed when Growth and Premium open.
