# Tester Tour — product spec

**Status:** approved for build · **Owner:** founder · **Written:** 2026-09-01

An invited tester walks the real product behind the coming-soon gate. Finishing unlocks a one-click **30-day Stripe-native Starter trial** on a listing they already own.

---

## 1. Why this exists

Going public without a finished board means the first honest read of the product comes from people using it, not from a checklist. The tour is that read.

It replaces the two things a soft launch normally does badly:

| Instead of | We get |
|---|---|
| "How did it go?" — impressions, recalled days later, shaped by politeness | Structured evidence rows, written by the server at the moment the page rendered |
| A thank-you note as the reward | A real 30-day Starter trial on their own listing |

The tour **ships before the public flip** and is therefore the instrument of the soft-launch period, not a post-launch growth feature. That was decided deliberately, and the cost — roughly a week, with the flip waiting on it — was accepted.

**What it is not.** It is not onboarding, not a product tour overlay, and not a growth loop. It is a research instrument with a paid-tier reward, scoped to 5–10 invited people and then switched off.

---

## 2. The six steps

The rail shows these in order. Four ask the tester to write something; two are un-gated progress ticks.

| # | `step_key` | What the tester does | Reflection required |
|---|---|---|---|
| 1 | `search_ran` | Runs a real search | **Yes** |
| 2 | `listing_opened` | Opens a listing **that is not theirs** | No |
| 3 | `listing_saved` | Saves a listing **that is not theirs** | **Yes** |
| 4 | `collection_browsed` | Opens a collection page | No |
| 5 | `review_or_correction` | Leaves a review, or submits a correction | **Yes** |
| 6 | `final_reflection` | Reflects on the whole walk | **Yes** |

**Why only four are gated.** The original design gated all six. Asking for twenty considered characters about *"you loaded a collection page"* is high tax and low signal — it is the step a tester abandons on, and abandonment costs the whole walk, not one answer. Steps 2 and 4 still produce their witness rows, so the **evidence is unchanged**; only the completion predicate and the rail copy differ.

**The reflection floor is 20 characters, trimmed.** Enforced in three places on purpose: the rail (so the tester sees it before submitting), the server action (so a client that skips the rail still meets it), and a database `CHECK` (so no future caller can bypass it at all). Twenty spaces is not a reflection.

**Steps 2 and 3 must exclude the tester's own listing** (`owner_user_id !== user.id`). Without that rule on `listing_saved`, a tester satisfies the step by saving their own listing and the evidence means nothing.

**Completion** = every *reflection-gated* step has a row with substantive text. Steps 2 and 4 contribute evidence but do not block completion. Completion sets `completed_at`; it does **not** grant the trial — finishing and claiming are two separate events, and a tester may finish and never claim.

---

## 3. Evidence — what counts, and what is refused

> **The single most important rule in this feature: nothing reads `analytics_events`.**

That table is client-writable by design, so a tester could POST six events from a browser console and "finish" the tour without using the product. Evidence comes only from:

- `tour_step_completions` — witness rows written by the **service role inside a real page render**;
- first-party `saves`, `reviews`, and `moderation_queue` rows.

The test suite enforces this with a Supabase double whose `from('analytics_events')` **throws**, plus a case that seeds a *complete forged set* of analytics events and asserts every step still reads `no_evidence`.

**A failed read is `read_failed`, never `no_evidence`.** These are different facts and the difference is the whole point: telling a tester who already searched to go and search is the failure mode that makes the instrument untrustworthy. Every step carries a distinct `retry` string so no code path can produce that message.

**A review counts in any status.** RLS forces newly-submitted reviews to `intake`, so filtering evidence by a published status makes step 5 permanently unreachable.

---

## 4. The reward, and the one thing that must not go wrong

A completed tour unlocks a **30-day Starter trial**, created through Stripe Checkout with no card required.

### 4.1 The trial must actually end

Stripe's default `trial_settings.end_behavior.missing_payment_method` is `create_invoice`. Under that default, a card-less trial reaching day 30 does **not** cancel — it invoices, fails to collect, and parks the subscription in `past_due`. `past_due` is a member of `KEEPS_ACCESS`, so that tester keeps Starter entitlements **forever**, and no `customer.subscription.deleted` event ever arrives to take them away.

There is no alarm for this state. It looks exactly like a paying customer whose card bounced.

So `missing_payment_method: 'cancel'` is not a preference — it is the only setting under which this feature is safe to ship. `assertTrialCancels()` throws **before** Stripe is called, turning a mistake into a 500 on one request rather than a permanent free tier. It also rejects a wrong `mode`, a wrong day count, and a `purpose` key in metadata.

`payment_method_collection: 'if_required'` is what lets a tester start without a card. The two settings only make sense together: **collecting no card is safe precisely because the end behaviour is cancel.** Never change one without the other.

### 4.2 Zero lines change in the webhook handler

Our sessions deliberately carry **no `purpose` key**, so `handleCheckoutSessionCompleted` does not take its early return (that branch belongs to one-off job-posting purchases). The session falls through to the ordinary subscription path, the tier is re-resolved from the live price, the tester lands on `starter`, and the trial-end cancellation arrives as a normal `customer.subscription.deleted`.

A test asserts `'purpose' in metadata === false` so this stays true.

### 4.3 The claim protocol

1. **Compare-and-set first, before Stripe is called.** `UPDATE tour_enrollments SET trial_granted_at = now() WHERE id = $1 AND trial_granted_at IS NULL RETURNING id`. The `RETURNING` is what makes a zero-row update *observable* — without it, a second claim looks identical to a first. Two concurrent claims produce **one 200 and one 409**, and Stripe is called exactly once.
2. **The claim block sits *after* the existing 422 guard** on the checkout route, so a null Starter price cannot burn the tester's one and only claim.
3. **A stable Stripe idempotency key**, `tour-trial:${enrollmentId}`. Without it, a lost response on retry creates a **second subscription** that the release-on-failure guard cannot see.
4. **Release on failure.** If Stripe throws, `trial_granted_at` is set back to NULL — carrying the same `.is('trial_granted_at', null)`-style guard so the release cannot clobber a concurrent winner.

Three partial unique indexes are the database backstop for the same properties: one live enrollment per tester, one trial per tester ever, one trial per listing ever. Two `CHECK` constraints make the bad states unrepresentable: a trial cannot exist without a completed tour, and a checkout session id cannot exist without a claim.

---

## 5. Security boundary

> **The absence of INSERT and UPDATE policies *is* the security control.** It is not an oversight to be tidied up later.

Both tour tables have **SELECT-only RLS**. A tester who could `UPDATE tour_enrollments` would set their own `completed_at` and `trial_granted_at` and mint a free Starter without walking anything. A tester who could `INSERT` into `tour_step_completions` would forge the six evidence rows directly.

**A future migration that adds a write policy to either table is reintroducing a free-subscription vulnerability, not tidying up.** Every write comes from the service role.

### Access is not identity

`?preview=<token>` is **door access, not identity**. The proxy already lets *any signed-in user* through the coming-soon gate, and the token is one shared 30-day secret with no per-tester revocation.

**The rail must never key off the preview cookie.** Enrollment is the `tour_enrollments` row and nothing else.

---

## 6. Surfaces to build

| Surface | Note |
|---|---|
| `lib/tour/witness.ts` | Service-role evidence written inside real page renders, deferred with `after()`. Never reads `analytics_events`. |
| `lib/tour/verify.ts` | A `TourReadResult<T>` union modelled on the existing `ReadResult`. Distinguishes `read_failed` from `no_evidence`. Owns `TOUR_STEP_COPY`, including each step's `retry` string. |
| `lib/actions/tour/submitReflection.ts` | A `useActionState` server action following the existing subscribe-action signature. The state API route is **GET-only**. |
| Claim / checkout route | §4.3 above. |
| `components/tour/{TourRailMount,TourRail,TourWitness,ClaimTrialButton}.tsx` | §7 below. |
| `app/admin/testers/` + `lib/actions/admin/manageTesterTour.ts` | Copies the existing admin-role action shape exactly, including the audit-log write. Verifies the tester **already owns** the listing at invitation time — a trial is worth nothing on a listing they cannot edit. |
| `FEATURE_TESTER_TOUR` | Zero hits repo-wide today. Added to the flag union and env map. Unset defaults to **on in preview, off in production**, which is correct. |

**Already built** (`1117aaa`, `d1691e0`): the schema, `lib/tour/steps.ts`, `lib/tour/trial.ts`, and 39 tests.

---

## 7. The rail

The rail mounts in the **root layout**, which sets every constraint on it:

- `getTourState` wraps its whole body in try/catch and every read destructures `error`. **The rail throwing takes down every page on the site.**
- `TourRailMount` returns null on flag-off → signed-out → not-enrolled, **in that order, before the client chunk is referenced** — so a visitor who is none of these pays nothing.
- `z-40`, under the `z-50` header.
- Route hiding uses **prefix** matching. This is deliberately unlike the existing chrome gate, which matches by exact equality — `/admin` has children.
- The layout path loads **only** the enrollment and its six completion rows. The derived `saves` / `reviews` reads run **only** in the API route, or every page view sitewide pays for them.

### Render-mode changes — three pages, three different changes

| Page | Change |
|---|---|
| Search | Gains a `<TourWitness>` inside its existing Suspense boundary. Declares nothing new. |
| Listing | Drops its dead `revalidate = 3600`; calls `recordTourWitness` inline beside the existing page-view tracking. |
| Collection | Drops its dead `revalidate = 3600`; gains a Suspense-isolated `<TourWitness>`; and — separately, ungated by the tour — emits the `COLLECTION_VIEWED` event that is currently declared but never emitted. |

Both `revalidate` values are **already dead**, because the public header reads cookies in the root layout on every route. Removing them makes the code honest about what it does; it changes no behaviour.

---

## 8. Two consequences to plan around, not discover

1. **A trialing tester's listing gets `tier: 'starter'` on the live public site**, and the search tie-break ranks by tier — so it **outranks free listings for 30 days**. Acceptable at tester scale, but **do not read early search placement as a signal** during the soft launch.
2. **The rail adds a second `auth.getUser()` per request sitewide** while the flag is on — a network round-trip, not a JWT decode. Acceptable at tester scale; it is a reason the flag goes off when the tour ends.

---

## 9. Test plan

Beyond the 24 trial tests and 15 migration tests already written:

| File | Proves |
|---|---|
| `tester-tour-claim.test.ts` | The claim precedes the Stripe call (ordered call log); two concurrent claims → one 200, one 409, session created **once**; release fires on a Stripe throw and carries its guard; the idempotency key is stable. |
| `tester-tour-evidence.test.ts` | **The anti-forgery centrepiece.** A complete forged `analytics_events` set still yields `no_evidence` on every step; the double's `analytics_events` read throws; `read_failed` never renders the action copy; a review in **any** status counts; the SQL `step_key` CHECK list matches `TOUR_STEPS`. |
| `tester-tour-render-mode.test.ts` | Source-text assertions: search still declares no `revalidate`; listing and collection no longer declare one they cannot honour. |
| `tester-tour-rail.test.ts` | Returns null at each of the three gates without doing the more expensive step; **throws nothing when every read fails**; the prefix route-hiding table; `z-40` and nothing ≥ 50. |
| `feature-flags.test.ts` (amend) | `FEATURE_TESTER_TOUR` deleted in `beforeEach`; `'testerTour'` added to the full-list assertion. |

---

## 10. Done when

One real tester completes all four gated steps on the real site, claims the trial, and the Stripe dashboard shows the subscription `trialing` **with cancel-on-missing-payment-method**.

## 11. Retiring it

When the soft-launch cohort is finished: unset `FEATURE_TESTER_TOUR`, which removes the rail and the claim route without deploying different code. The evidence rows stay — they are the research output. Trials already granted are **real subscriptions and are not undone** by switching the flag or dropping the tables; cancel those deliberately in Stripe.
