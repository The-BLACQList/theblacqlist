# Ticket 152: Post a job in four steps

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready
**Depends on:** 149 (the card, reused as the live preview). Merge 153 right after; until 153 lands, step 4 redirects to the existing dashboard page.
**Gates:** none in this PR: no migration, no new dependency. GATE-MODERATION unchanged (every role is reviewed). `[Needs professional review]` for the pay fields (Q4). Still covered by `FEATURE_JOBS_OPEN=false`; `/add-job` is also behind `postingSubmissions`.
**Size note:** the biggest of the set (about 6 to 8 hours). Reviewer should read it in this order: schema, server action, steps, preview.
**Decision record (founder, 2026-10-30, screen 4, Q1, Q3, Q4):**

1. **Four steps:** 1 The role, 2 Pay and place, 3 How to apply, 4 Review, with a live card preview.
2. **The hiring business is picked in step 1.**
3. **The Black-owned / Ally radio is gone** (Q3). The business already carries its label.
4. **Pay range and period are required unless the role is volunteer** (Q4). `[Needs professional review]` Pay-transparency laws vary by state and city. Counsel confirms the field set. Do not claim compliance in copy.
5. **Closing date defaults to 30 days after the role goes live** (Q1); the poster can set their own.
6. **Step 4 shows the price before submit:** "Uses 1 of your N included postings" ($0) or "$9.99 for 30 days".

---

## Why

`components/listings/SubmitJobForm.tsx` is one long form that only makes a draft. The poster then has to find the dashboard editor and press "Submit for review", which is where they first learn the price. The hiring business can only be linked later, the pay is optional, and the form asks a Black-owned/Ally question the business page already answers.

## Scope

In:

- **Stepper UI** in `components/jobs/post/`: `PostJobWizard.tsx` (client, one `react-hook-form` + zod form across steps), `StepRole.tsx`, `StepPayPlace.tsx`, `StepApply.tsx`, `StepReview.tsx`, `JobPreview.tsx` (renders `JobCard` from 149 from current form values). `SubmitJobForm.tsx` is deleted once the wizard replaces it; `app/add-job/page.tsx` renders the wizard. Progress "Step 2 of 4". Back keeps values. Draft values saved to `localStorage` key `draft-post-job` and cleared on success (pattern in `frontend.md`).
- **Step 1, The role.** Hiring business (select of the signed-in user's published business listings; one business is preselected; none shows "You need a published business page first" with a link to `/add-business`), job title (`name`), one-line summary (`tagline`, 10 to 120), category, kind of work (full-time, part-time, contract, temporary, internship, volunteer; no "Select one" default), where it's done (on-site, hybrid, remote).
- **Step 2, Pay and place.** Pay minimum, maximum, period (hour/day/week/month/year). For non-volunteer all three are required; max at least min; two decimals; helper text "Roles with a pay range get more applicants." Volunteer hides the pay fields and shows "Shown as Unpaid". Place: city and state default from the hiring business; hidden for remote. Closing date (optional date input) with helper "If you leave this blank we close it 30 days after it goes live."
- **Step 3, How to apply.** Apply link or email, at least one. Description (20 to 2000).
- **Step 4, Review.** Summary of every field with an Edit link per step (returns to that step), the live card preview, the price line, one primary button. Price line logic: call `jobQuotaFor` server-side when the page loads. Included posting left: "Uses 1 of your {limit} included postings ({used} used)". None left and the user is paid tier: "You've used all {limit} included postings. This one is {JOB_POSTING_PRICE_DISPLAY} for 30 days." Free/Starter: "{JOB_POSTING_PRICE_DISPLAY} for 30 days." Price text always comes from `lib/stripe/jobPostings.ts`, never typed in a component. Button label: "Submit for review" (included) or "Pay and submit" (paid). Under it: "Our team reviews every role before it goes live. This usually takes 3 to 5 business days."
- **One server action** `postJobAction` in `lib/actions/listings/postJob.ts`. Validates with the shared zod schema (`lib/validations/postJob.ts`, used by the client too), then: (1) creates the draft by calling the job branch of the existing create logic (extract it from `createListing.ts` into `lib/services/listings/createJobDraft.ts` so both use it); (2) sets `hiring_listing_id` from the picked business and verifies the user owns that business server-side; (3) sets `city_id` from the hiring business (jobs have none today, which is why the board has no Where data); (4) derives `ownership_label` and the attestation from the hiring business instead of the form; (5) calls the same ladder as `submitListingForReviewAction` (grandfather, `hasPaidJobPosting`, `jobQuotaFor`, `grantIncludedJobPosting` or `createJobPostingCheckoutSession`). Extract that ladder into `lib/services/listings/submitJobForReview.ts` so the dashboard button and this action share it. Returns `{ listingId, outcome: 'included' | 'checkout', checkoutUrl? }`.
- **On success:** included goes to `/dashboard/pages/{id}/posted` (ticket 153; fall back to `/dashboard/pages/{id}` until 153 merges); paid redirects to Stripe.
- **Server validation** for pay: reject a non-volunteer job with no min, max or period (`VALIDATION_ERROR`, field errors). Keep the DB CHECKs as they are.
- Keep the 10 per hour `listing_submit` rate limit and the `postingSubmissions` guard.

Out:

- The confirmation page (153), the closes_at default being stamped (155 does that at approval; this ticket only shows the helper text), the sweep.
- Editing a role after submit (dashboard `JobDetailsSection` unchanged; it should also stop showing the ownership radio if it does, check).
- Posting on behalf of a business the user does not own.
- Changing prices or Stripe config.

## Acceptance criteria

- Given a signed-out visitor, when they open `/add-job`, then they go to `/sign-in?next=/add-job` (unchanged).
- Given I own two published businesses, when I start, then step 1 lists both and I must pick one before Next is enabled.
- Given I choose Volunteer, then the pay fields are hidden and I can continue; the preview chip reads "Unpaid".
- Given I choose Full-time and leave pay empty, then Next on step 2 shows an inline error on each missing field and does not advance.
- Given a Growth plan with 1 included posting unused, when I reach step 4, then I see "Uses 1 of your 1 included postings" and the button "Submit for review"; after submit the listing is `pending` with a $0 `entitlement` ledger row.
- Given a free plan, then step 4 shows the price from `JOB_POSTING_PRICE_DISPLAY` and "Pay and submit" sends me to Stripe Checkout.
- Given I change the pay in step 2 then return to step 4, then the preview and summary match.
- Given I press Back from step 3 to step 2, then my values are still there. Given I reload mid-way, then the draft returns from localStorage.
- Given the server rejects (rate limit, not owner of the business, Stripe not configured), then I stay on step 4 with an error banner and my input is intact.
- Given no radio or text asks about Black-owned or Ally anywhere in the flow.
- Mobile 375px: one column, Back and Next in a bar at the bottom (thumb zone), preview collapses into an "See how it looks" disclosure above the summary on step 4 and a small peek card under the step fields; targets at least 44px; correct keyboards (`inputMode="decimal"` for pay, `type="email"`, `type="url"`). 1280px: form left, sticky preview right.
- A11y: each step is a `fieldset` with a `legend`; step heading receives focus when the step changes; errors use `aria-describedby` and a summary with `role="alert"`; progress is text ("Step 2 of 4"), not color only; every input has a visible label; required marked with `*` and a legend.

## Failure states

| Failure | User sees | Recovery |
|---|---|---|
| Not signed in | Redirect to sign-in with return to `/add-job` | Sign in, draft restored |
| Validation | Inline field errors, step stays | Fix and continue |
| Rate limit (10/hour) | "You've posted a lot just now. Try again in a little while." | Wait |
| Stripe price missing | "Paid job postings are not available yet. Please try again later." | Draft is saved; retry from dashboard |
| Network error on submit | Banner with Try again, input kept | Retry (action is safe to retry: it reuses the draft created in this attempt via a client-generated idempotency key) |
| Business no longer published | Step 1 error "Pick a published business" | Choose another |

## Edge cases

- Poster is on a paid tier but the quota read fails (`ReadResult` error): treat as unknown, show the price line "We'll show the cost after you submit" and let the server decide. Never claim "included" without a successful read.
- Double press on the final button: the button disables during submit, and the idempotency key prevents two drafts.
- Closing date in the past: rejected. Closing date more than 90 days out: allowed, assumption (flag).
- Whitespace-only title: trimmed, then rejected.

## Data note

No migration. Writes `listings` (draft, `trust_tier: 'unclaimed'` as today, `city_id` new), `listing_details_job` (including `hiring_listing_id`, which `createListing.ts` never set), `job_posting_purchases` (through the existing helper). RLS unchanged.

## Tests

- Unit (`tests/post-job-schema.test.ts`): pay required for non-volunteer, optional for volunteer, max below min fails, period required with any figure, apply link or email required, closing date past fails.
- Unit (`tests/post-job-action.test.ts`): not the owner of the business is refused; included path writes an entitlement row; checkout path returns a URL; ownership label comes from the business; `city_id` copied.
- Existing `tests/job-posting-purchase.test.ts` and `tests/job-status-guard.test.ts` must still pass after the ladder extraction.
- Playwright (`e2e/post-job.spec.ts`, flag on): complete four steps as a seeded Growth owner on a phone viewport; free owner reaches the Stripe redirect (stub the checkout call). `e2e/opening-soon.spec.ts` green with the flag off.

## QA notes

Staging only, Stripe test mode. Run with a Growth owner (included), a Growth owner with the posting already used (paid), a Free owner (paid), and a user with no business. Confirm the pending job appears in the admin queue with the right business. `[Needs professional review]` Send the pay field set to counsel before the first real posting.
