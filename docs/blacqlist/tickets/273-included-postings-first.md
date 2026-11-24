# Ticket 273: Included Job Postings Before $9.99

**Status:** In review. Not merged.

## Why

Founder, 2026-11-24: "Let's make sure accounts whose subscription level gives them job postings are directed there first before asking them to pay 9.99 for something they already have included with their subscription."

Growth includes 1 job posting every 30 days and Premium includes 3. Submitting already spent an included posting before opening checkout. These gaps remained:

| Gap | Who it hit |
|---|---|
| The plan was read only from pages. Page tiers are copied from the subscription when Stripe or the owner changes something, so a paying owner could have pages that all read Free | An owner who deleted or moved their covered page, then added a new one: asked for $9.99 |
| Checkout could open without the price having been shown | Anyone whose page could not read the allowance, or whose last included posting was used in another tab |
| The allowance showed only on the last step of Post a Job | Every owner with a plan |
| A used-up allowance did not say when the next posting opens | Growth and Premium owners deciding whether to pay or wait |

## The Rule

1. **The plan counts from both places.** The higher of the live subscription (active, trialing or past due) and the page tiers. A comped page still counts with no subscription.
2. **A doubt never becomes a charge.** If the subscription can't be read, or its plan can't be named and no page carries one, submitting stops with an error.
3. **Included first.** An included posting is always spent before checkout, whatever the page showed.
4. **No checkout on an unseen price.** If there is a charge the page didn't show, the server returns the price and "Nothing has been charged. Check the price before you submit." The next press goes to checkout.

## What Owners See

| Case | Line | Button |
|---|---|---|
| Growth, posting unused | Included with your Growth plan. No charge. | Submit for Review |
| Premium, 1 used | Included with your Premium plan. No charge. 2 of 3 postings left. | Submit for Review |
| Growth, used | You've used the posting included with your Growth plan. Your next one opens Dec 3. Posting now is $9.99 for 30 days. | Pay and Submit |
| Free, Starter | $9.99 for 30 days. (The draft job page also links to plans with included postings) | Pay and Submit |
| Cost not readable | We'll show the cost before you pay anything. | Submit for Review |

The line now shows on every step of Post a Job, and the draft job page uses the same one. The dashboard says when the next posting opens and the price once the allowance is used.

## Changes

- `lib/stripe/jobPostings.ts`: `ownerPlanTier` reads subscriptions too; `JobQuota.nextOpensAt`
- `lib/listings/jobPriceLine.ts`, `lib/listings/jobEntryPoints.ts`: the lines above
- `lib/services/listings/submitJobForReview.ts`: the `chargeShown` check, passed through `postJob.ts` and `submitListingForReview.ts`
- `PostJobWizardInner.tsx`, `PublishSection.tsx`, the edit page: show the line, send `chargeShown`

No migration, no Stripe change, no price change.

**Also affected:** the event allowance uses the same plan read, so the owner in the first gap gets their events back as well.

## Tests

`tests/included-postings-first.test.ts` (new), plus `job-posting-purchase`, `post-job-action`, `post-job-price-line` and `jobs-entry-points`.

## Not Covered

- **A checkout opened before an upgrade** stays payable for up to 24 hours. An owner who upgrades and then pays in the old tab is charged.
- **Two submissions at the same moment** can both count as included. This costs the owner nothing, and it was there before.
- **Refunds:** there is still no refund handling in the code.
- Re-listing a closed job is unchanged. It never charges.
- The signed-in pages were checked by rendered-markup tests, not by hand in a browser.
