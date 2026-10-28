# Ticket 143: Put Growth on sale, on its own, before Premium

**Phase:** V1.5 · **Priority:** P1 · **Status:** In review (draft PR, merge after the public flip)
**Depends on:** 105 / #256 (tier limits and downgrade hiding, extended to products and services), 136 / #257 (free month on a paid upgrade, must ship before Growth gets price IDs), #255 (owner Events tab)
**Gates:** none in this PR. No migration, no new dependencies, no env change. Restoring Growth's Stripe price IDs on prod `plans` is GATE-DATA and happens after the flip, on the founder's word.
**Decision record:** on 2026-10-28 the founder asked what the "standard package" (Growth, $49/mo, $470/yr) needs before it can be sold, and decided:

1. **Take the three failing lines off the Growth card:** search terms with 12 months of history, up to 5 team members, and support within 1 business day. None has a working feature or staffing behind it.
2. **Growth opens alone.** Premium stays Coming Soon.
3. **Downgrades hide products and services, never delete them.** Built in #256, not here.
4. **Collective insights come later** and stay off the card.
5. **Free features first, then Growth.**
6. **Remove the "Top search queries" panel** from owner analytics. It was always empty.
7. **The public flip has not happened.** Build as a draft and merge nothing until after the flip.

---

## Why

The Growth card promised eight things. Three had nothing behind them, and three more depend on features that are switched off. Every page that talks about plans also assumed Growth and Premium would open together, so restoring Growth's price IDs alone would have left copy saying "Growth and Premium are coming" next to a Growth card you could buy.

## Scope

In:

- **Growth card trim** (`lib/stripe/plans.ts`). Growth now lists five lines: Everything in Starter, up to 25 photos, a storefront for up to 25 products and services, up to 3 events at a time, and 1 job posting every 30 days. The `features.ts` keys for team members, priority support and advanced analytics stay, since ticket 107 needs them.
- **No "Top search queries" panel** on `/dashboard/pages/[entityId]/analytics`. Nothing writes `search_events.clicked_listing_id`, and owners have no read on `search_events`, so the panel was empty on every tier. It comes back with the feature.
- **"Growth opens alone" copy.** Every line below reads `isTierOpen()` (new in `lib/stripe/availability.ts`), which uses the same live `plans` data as the cards. Restoring Growth's price IDs flips the copy with no deploy.
  - `/pricing`: the subtitle, the FAQ ("What does Growth add?", "When is Premium available?"), the waitlist heading and the bottom CTA. The metadata is neutral.
  - `/for-business`: "Starter and Growth are open now. Premium opens once everything in it works."
  - `/for-vendors`: "Sell from your BLACQList page" when Growth is open; the current "not open yet" page and waitlist when it isn't.
  - `/marketplace`: the empty-state lines and the vendor CTA.
  - Add product / Add service (`AllowanceNotice`): a page with no storefront gets "Storefronts come with Growth" and a **See Growth** link to `/dashboard/upgrade` when Growth is open, and the waitlist otherwise.
  - The create actions' refusal (`assertCanAddMarketplaceItem`) says the same thing server side.

Out:

- The tester free-month copy (`app/api/tour/claim/route.ts`, `FreeMonthCard.tsx`). #257 rewrites both files.
- Hiding products and services after a downgrade. That's in #256.
- Premium. It stays closed, and its card renders no bullets.
- Restoring price IDs, the Customer Portal, and `FEATURE_MARKETPLACE_OPEN`. Those are the post-flip runbook below.

## Acceptance criteria

- Given Growth has no price IDs, when anyone visits `/pricing`, `/for-business`, `/for-vendors` or `/marketplace`, then the copy reads exactly as it does on main today, apart from the neutral pricing metadata.
- Given Growth has a monthly or annual price ID and Premium has neither, when a visitor opens `/pricing`, then the Growth card shows exactly five lines, the FAQ asks "When is Premium available?", and the waitlist offers only Premium and the add-ons.
- Given the same, when a Starter owner opens Add product, then the notice says storefronts come with Growth and links to `/dashboard/upgrade`.
- Given the same, when a Starter owner submits the create-product action directly, then the refusal names Growth and does not say selling isn't open.
- Given any tier, when an owner opens their analytics page, then there is no "Top search queries" panel.

## Before merge

This PR is built on main, and #256 is not on main yet. Once #256 merges, rebase this PR and add the Growth offer to the two places #256 creates:

- `makeRoom()` in `lib/stripe/planChecks.ts`: a Starter page at a limit gets "Upgrade to Growth" linking to `/dashboard/upgrade` when `isTierOpen(availability, 'growth')`.
- `hiddenLine()` in `lib/stripe/downgrade.ts`: the same link under the same condition. Update the "never promises an upgrade" test in `tests/downgrade.test.ts` so it only holds while Growth is closed.

Expect a small conflict in `app/dashboard/pages/[entityId]/analytics/page.tsx`, since both PRs edit it.

## Order to sell (after the flip, each step on the founder's word)

1. Free switch-ons first: site import, #253 partnerships, one real job then `FEATURE_JOBS_OPEN`. Confirm `FEATURE_PAID_POSTINGS` and `FEATURE_POSTING_SUBMISSIONS` in Vercel.
2. #256: prod migrations, Preview downgrade and restore check, merge.
3. #257: prod migration, founder approves the day-25 reminder copy, merge.
4. #255 owner Events tab: Preview as Growth and as Starter, merge.
5. This PR: rebase on main, Preview, merge.
6. Stripe: confirm the Growth prices are active, then restore them on prod `plans` with the M2.1 rollback UPDATE (`docs/blacqlist/ops/decision-log.md`, GATE-DATA). Growth only.
7. Customer Portal: add Growth only, live and test.
8. `FEATURE_MARKETPLACE_OPEN` and redeploy, so the storefront line is real.

## QA notes

- Run `npx tsc --noEmit`, `npx eslint app lib components` and `npx vitest run`.
- In test mode with only Growth's test price IDs synced, check `/pricing`, `/for-business`, `/for-vendors`, `/dashboard/upgrade` and Add product at 375px and 1280px.
- Test-card checkout to Growth (`4242…`): the webhook sets `listings.tier = 'growth'`; add a product, an event and a job.
