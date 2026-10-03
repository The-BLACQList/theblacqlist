# Page workshop: My Account, For Business, The BLACQLight, The Collective band

**Audience:** founder and whoever builds these pages next.
**Last updated:** 2026-10-03
**Canvas:** https://claude.ai/artifact/FR7u4PbpommxxnefUyYqp2 (private to the founder until shared)

## Picks

`[Decision — founder, 2026-10-03]` "My account: A / For Businesses: A / The Blacqlight: A / The collective: C with the proposed changes."

| Page | Picked | What it is |
|---|---|---|
| My Account | **A · Your corner of The Collective** | A personal welcome with your own spend line ("You've spent $X with N businesses on the list"), then Recently saved, Your activity, Your contributions, and a free "Claim your page" prompt |
| For Business | **A · Documentary** | Photo-led story ("Your page. Your story. Your customers."), three steps (find, show it's yours, make it yours), the trust ladder (Unclaimed, Claimed, Verified, Certified), and plans with a monthly/annual switch |
| The BLACQLight | **A · Cover story** | A large lead story up top, then More stories and a From the directory strip. Goes with the shared article page board |
| Homepage band | **C · Join The Collective** | Joining comes first: "Track a receipt" is the gold button, "See The Collective" is the second button |

Not picked: Account B (the ledger), Business B (anatomy of your page), BLACQLight B (the index), Bands A and B.

## Band C: shipped as copy

Applied to the code on branch `feat/nav-the-collective` (not committed yet):

- `components/home/ImpactBand.tsx`: eyebrow "The Collective", heading "Join The Collective.", new body, Track a receipt as the main button, empty state "The Collective is waiting on its first dollar."
- The related renames: the footer "Flow Map" link is now "The Collective", and the dead "Community Impact" link (`/impact`, never built) is gone. The `/flow-map` page title, badge, heading and intro now say The Collective, and the two receipt pages say "add your spend to The Collective".
- Under the Black-Owned/Ally pivot, the `/flow-map` heading now reads "spent with businesses on the list". `tests/spend-vocabulary.test.ts` was updated to match. It still guards the "spent", not "circulated", wording.

## Copy facts to keep right when building

- **Certified** is automatic: Verified, 5 or more published reviews, an average of 3.5 or better, 90 days since the earliest approved claim, and complete business details (`.claude/rules/moderation-policy.md`). The canvas first said "6 reviews, 4.0, 90 days on the list". That was wrong and has been fixed on the canvas.
- **The Collective** shows shoppers only in aggregate (F-4 §2C). Say "spent", never "circulated".
- Plan prices on the For Business board are workshop values. Read them from `lib/stripe/plans.ts` when building. Unbuyable plans still show as "Coming Soon".

## Not decided / next

The three page concepts are design direction only. Nothing is built. Building them should start from a spec and tickets (per page: sections, data each section reads, empty and loading states, mobile layout), then a draft PR per page.
