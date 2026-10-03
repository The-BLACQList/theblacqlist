# Ticket 114 — My Account A: "Your corner of The Collective"

**Phase:** V1.5 · **Priority:** P2 · **Status:** Ready to build
**Depends on:** none (no migration)
**Spec:** [page-workshop-2026-10-spec.md §1](../design/page-workshop-2026-10-spec.md#1-my-account-a-your-corner-of-the-collective)

---

## Why

The founder picked My Account A on 2026-10-03. The overview should show a shopper what they've done on the list, starting with their own place in The Collective, and put anything that needs them at the top.

## User story

As a signed-in shopper, when I open my account, I want to see my saves, reviews, receipts and my own spend with businesses on the list, so I know what I've done and what to do next.

## Acceptance criteria

- Given a pending claim, when I open `/account`, then "Needs your attention" is the first block below the greeting and links to the claim. Given no pending claim, the block is not rendered.
- The stat strip shows saved, reviews, approved receipts and approved spend from the existing queries. The spend label reads "Spent, approved receipts only".
- Given approved receipts, the Collective panel heading reads "You've spent ${total} with {n} businesses on the list."
  - `n` counts distinct matched `listing_id`s.
  - Unmatched spend shows as "${x} at places not on the list yet".
- The ego network shows up to 8 matched businesses (6 at 375px), each labeled "{category} · ${amount}" and linking to its listing page. The rest show as "+{k} more", which links to `/account/spending`.
- The SVG is `aria-hidden`. A visually hidden list gives the same businesses and amounts to screen readers.
- Given no approved receipts, the panel shows the empty state from the spec, with "Track a receipt". Given pending receipts, it adds "{n} receipts waiting for review."
- The Recently saved cards show "{Tier} · {Black-Owned or Ally}". The tier shows only when it is Claimed or higher.
- Non-owners see the claim prompt (button "Claim your business" → `/claim`). Owners keep the "Manage my page" block.
- The greeting no longer falls back to the email prefix.
- If any single query fails, only that section shows "Couldn't load this. Try again". The page still renders.
- The copy has no em dashes and says "spent", never "circulated". The spend-vocabulary test passes.

## Data

- **Reads only the signed-in user's rows**, under the existing RLS.
- Adds `listing_id` to the approved-receipts select, then one `listings` lookup (`id, name, slug, entity_type, category, city slug`) for the matched ids.
- Adds `trust_tier, ownership_label` to the saves select.
- No service-role client and no new tables.

## Privacy

This panel is the user's own data. Do not reuse the component on any public page. Public views stay behind the 5-person cohort rule.

## QA notes

- Test as a new user, a user with pending-only receipts, a user with more than 8 businesses, an owner, and a user with a pending claim.
- Check 375px and 1280px, keyboard, and VoiceOver on the Collective panel.
- Make sure the total matches `/account/spending` for the same user.

## Out of scope

Monthly charts, recommended/recently viewed content on the overview, and new nav groups. The nav rename to "The Collective" is in scope (spec Q5, approved 2026-10-03).
