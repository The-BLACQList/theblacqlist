# Community Spend: Data Sourcing & Methodology

**Status:** current as of commit `9e55a8e` (2026-08-16)
**Audience:** anyone who publishes, cites, or defends a BLACQList community-spend figure
**Companion:** [`flow-map-mvp-spec.md`](flow-map-mvp-spec.md) (what the feature is) — this file is where the numbers come from and what they mean.

Every dollar figure the product publishes about community spend traces back through this pipeline. If a number cannot be located in this document, it is not a number we publish.

**Maintenance contract:** if the pipeline changes, this file changes in the same PR. The same rule `/how-ranking-works` carries, for the same reason: a methodology page that has drifted from the code is worse than no methodology page, because it is quotable.

---

## 1. The pipeline, end to end

Five stages. There is no batch job, no cron, and no materialized view anywhere in this path.

```
user submits receipt   →   admin approves   →   spend_event   →   flow_nodes / flow_edges   →   published figures
(receipt_uploads)          (server action)      (one row)         (running totals)              (4 surfaces)
```

### Stage 1 — Submission

`lib/actions/spend/createReceiptSubmission.ts`. A signed-in user enters an amount, a purchase date, and either a directory listing or a free-text business name. A receipt image or PDF is optional (JPEG / PNG / WebP / HEIC / HEIF / PDF, 10 MB cap).

| Field | Source | Notes |
|---|---|---|
| `amount_cents` | user-entered dollars | `Math.round(dollars * 100)`. Must be > 0. |
| `purchase_date` | user-entered | The date on the receipt, **not** the submission date. |
| `listing_id` | directory selection | Optional. Null when the user typed a business name we do not have. |
| `aggregate_opt_out` | checkbox | Set once at submission. See §5. |
| `status` | fixed | `'pending_review'`. |
| `client_idempotency_key` | client | `UNIQUE` — a duplicate submission returns "already submitted" rather than a second row. |

Nothing at this stage reaches any public figure.

### Stage 2 — Admin review

Two terminal outcomes, both audit-logged:

- **Reject** (`lib/actions/spend/rejectReceipt.ts`) — status becomes `'rejected'`. **No aggregate row is ever written.** A rejected receipt contributes nothing, permanently.
- **Approve** (`lib/actions/spend/approveReceipt.ts`) — status becomes `'approved'` and the aggregate write happens synchronously, in the same request.

A receipt sitting at `'pending_review'` contributes nothing either. **Every published community figure is a figure about admin-approved receipts only.**

### Stage 3 — The spend event

One approved receipt produces exactly one `spend_events` row.

`spend_events` **has no `user_id` column, by design.** The link back to a person exists only as `receipt_upload_id`, and that link is severed on account deletion (§6). This is the table every community-wide total is summed from.

`city_id` is resolved at approval time from the linked listing's `city_id`. A receipt with no `listing_id` gets `city_id = null`.

### Stage 4 — The flow graph

`flow_nodes` and `flow_edges` are running totals, accumulated one approval at a time:

- a **business node** (`node_type = 'business'`, `entity_id = listing_id`)
- a **city node** (`node_type = 'city'`) when the listing has a city
- a **business → city edge** between them

`business → city` is the **only** edge the schema can express: `flow_nodes.node_type` has a `CHECK` permitting `'business' | 'city'` and nothing else. Any diagram implying business-to-business or city-to-city flow is drawing something the data does not contain.

**A receipt with no `listing_id` produces a spend event but no node and no edge.** It counts toward community-wide totals and toward nothing else. This is why the totals and the named tables can legitimately disagree.

### Stage 5 — Publication

Four surfaces read these tables. All five read paths use the service-role client:

| Surface | File | Auth | Freshness | What it shows |
|---|---|---|---|---|
| `/flow-map` | `app/(public)/flow-map/page.tsx` | public | ISR, 1 hour | Community totals, top 10 businesses, top 10 cities, network graph |
| `/api/flow-map/summary` | `app/api/flow-map/summary/route.ts` | public | ISR, 1 hour | Same, as JSON, plus up to 50 edges |
| `/api/community-spend` | `app/api/community-spend/route.ts` | public | ISR, 1 hour | Community totals + top nodes, no edges |
| `/account/community-spend` | `app/account/community-spend/page.tsx` | signed-in | request-time | Community aggregates (not the viewer's own rows), top 8 each |
| `/` (homepage) | `app/page.tsx` | public | request-time | Community totals only |

`/api/flow-map/personal-impact` is a different thing entirely and is documented in §4.

---

## 2. What we count, and what we call it

### The definition

**One receipt, approved by an admin, is one unit of measured spend. It is counted once.**

A dollar enters this dataset when a person reports paying it to a Black-owned business and an admin approves that receipt. Nothing follows the dollar after that. What the business pays its supplier, its staff, or its landlord is not observed, not modeled, and not estimated.

So the figure we publish is a **one-hop total**: consumer → business, summed. It is not velocity, not a multiplier, and not a measure of how many times a dollar changed hands.

### Why we do not call it "circulation"

"Circulation" in economics means a dollar being re-spent — counted on each hop as it moves through a community. We measure one hop. Publishing a one-hop sum under a word that means multi-hop velocity overstates the finding, and it is the kind of overstatement that gets checked the first time the number matters.

The schema makes this concrete: it cannot represent multi-hop flow **even in principle**. `flow_nodes.node_type` carries a `CHECK` permitting `'business' | 'city'` and nothing else, so `business → city` is the only edge that exists (§1, Stage 4). There is no business-to-business edge to accumulate, because there is no business-to-business data.

**`[Decision — founder, 2026-08-16]`** Published figures are labeled for what they measure — *spent with Black-owned businesses*, *directed to Black-owned businesses*. **"Circulation" remains the mission language** in the product vision, the PRD, the pitch and the partner materials, where it describes what the platform is *for*. It does not label a number.

### The vocabulary, in one table

| Say this | Not this | Because |
|---|---|---|
| spent with Black-owned businesses | circulated | one hop, not velocity |
| reported spend | verified spend | an admin approved a receipt; nothing reconciled it against a processor |
| tracked purchases | transactions | "transaction" implies a payment record we do not hold |
| businesses supported | businesses reached | we know money was reported to them, not what it did for them |

### The claim that is not ours

`PRD.md:66` and `product-vision.md:36` carry an external, third-party statistic about how long a dollar circulates in the Black community relative to other communities. That figure is **macro-economic research, not a BLACQList measurement**, and its sourcing has never been verified in this repo `[Unknown]`.

It must never appear beside one of our figures in a way that implies we measured it, and it should not be repeated in public materials until someone has traced it to a primary source. → **`[Needs professional review]`** for the sourcing question before it is used in press or partner materials again.

### What each published figure actually means

| Figure | Computed as | Excludes |
|---|---|---|
| Total dollars spent with Black-owned businesses | `SUM(amount_cents)` over **all** `spend_events` where `aggregate_opt_out = false` | Pending, rejected, opted-out |
| Tracked purchases | `COUNT(*)` of the same rows | Same |
| Unique businesses | `COUNT(DISTINCT listing_id)` of the same rows, nulls dropped | Receipts with no directory listing |
| Top businesses / cities | `flow_nodes` rows with `transaction_count >= 5`, ordered by `total_amount_cents`, limit 10 (8 on the account page) | Anything under the threshold — **but not opted-out spend, see §5** |
| Edges | `flow_edges` rows with `transaction_count >= 5`, limit 50 | Same |

Three properties worth stating plainly, because each one is a way a reader could over-read a number:

1. **Amounts are self-reported.** An admin reviews the receipt; nothing reconciles it against a payment processor. A figure here is "what the community reported and an admin accepted," never "what was transacted."
2. **Coverage is opt-in and partial.** This measures receipts people chose to upload. It is not a sample designed to represent anything, and it should never be extrapolated to total community spend.
3. **Totals are cumulative from launch,** not windowed. There is no date filter on any published total.

---

## 3. The privacy method

### The k-anonymity threshold

`AGGREGATE_MIN_TRANSACTIONS = 5` (`lib/spend/aggregate-privacy.ts`). A named business or city appears beside a dollar figure only once 5 or more distinct transactions are behind it. The constant is interpolated into the on-page copy, so the number in the promise and the number in the query cannot drift apart. `tests/aggregate-privacy.test.ts` pins that on all four surfaces.

**What the threshold gates:** every figure that pairs a *name* with a *number* — the business tables, the city tables, and the edges.

**What it deliberately does not gate:** the community-wide totals. Those are one sum across everything reported and name no one; suppressing them would cost the headline figures and buy no privacy. That absence is pinned by a test so a future change cannot quietly "harden" it to zero.

### RLS posture

As of migration `20260815010000`, `spend_events`, `flow_nodes` and `flow_edges` have **RLS enabled and no SELECT policy at all**. Anon and authenticated clients get zero rows; the tables are readable only by the service role, server-side.

Before that migration all three carried `TO anon, authenticated USING (true)`, which meant the threshold was enforced in application queries over a table anyone could read around with the publishable key. `receipt_uploads` was never in that state — it has always been owner-only.

---

## 4. Personal impact is a separate pipeline

`/api/flow-map/personal-impact` and the personal panel on `/flow-map` do **not** read `spend_events`. They read `receipt_uploads` filtered to `user_id = auth.uid()`, because `receipt_uploads` is the only table in this system with a `user_id`.

Consequences, all of them intentional:

- Personal totals count **approved** receipts; pending receipts are surfaced as a separate count, not folded into the total.
- Personal figures carry **no threshold** — it is your own data, shown only to you.
- Personal figures **ignore `aggregate_opt_out`**. Opting out withholds your spend from community figures; it does not hide it from you.
- Personal and community numbers will not reconcile, and are not meant to.

---

## 5. Known gaps — read this before citing the opt-out

Two findings, both measured against `9e55a8e`, both unresolved at the time of writing. They are recorded here rather than left for rediscovery.

### 5.1 The opt-out does not reach `flow_nodes` or `flow_edges`

`/flow-map` tells the community: *"Users can opt out of community aggregates at any time."*

The opt-out is honored on `spend_events` — every community-wide total filters `.eq('aggregate_opt_out', false)`. It is **not** honored on the flow graph. `approveReceipt.ts` upserts the business node, the city node and the edge without checking the flag, and neither `flow_nodes` nor `flow_edges` has a column to carry it.

So an opted-out receipt is excluded from the anonymous headline sums and **included** in the named per-business and per-city totals. That is the inverse of the intended protection: the opt-out fails in exactly the place where a name sits next to a dollar figure.

The threshold still applies, so no single opted-out receipt is individually exposed. The gap is that opted-out spend is silently counted in a figure the user was told it would be withheld from.

### 5.2 "At any time" is not currently supported

`aggregate_opt_out` is written once, at submission, and there is no code path anywhere in `app/`, `lib/` or `components/` that updates it. There is no account setting, no per-receipt toggle, and no path to withdraw spend that has already been aggregated. Today the flag is a submission-time choice, not a revocable preference.

**Both are corrections to make, not language to soften.** Fixing 5.1 is a code change plus a recompute of existing node and edge totals, which is a GATE-DATA decision of its own; fixing 5.2 is an update path plus a decision about what "withdraw" means for spend already summed into a node. Until both land, do not cite the opt-out sentence as fully implemented.

### 5.3 Node and edge upserts are not concurrency-safe

`upsertFlowNode` and `upsertFlowEdge` are read-modify-write: select the current total, add, write back. Two approvals touching the same node in the same instant can lose an increment. Nothing guards this today. At current approval volume it is unlikely; it is not impossible, and it is silent when it happens.

### 5.4 Freshness

Both public JSON endpoints and `/flow-map` are `revalidate = 3600`. A figure read from them can be up to an hour behind the database. `/account/community-spend` and the homepage compute at request time and are current. Nothing here is real-time.

---

## 6. Retention and deletion

On account deletion (`lib/actions/account/deleteAccount.ts`):

- `receipt_uploads` rows **CASCADE** and are removed, along with the stored receipt images.
- `spend_events` **survive**, de-linked: `receipt_upload_id` is `ON DELETE SET NULL`. They carry no `user_id`, so what remains is an anonymous amount, date, listing and city with no path back to a person.

This is the behavior the Privacy Policy §7 states — contributed aggregates are not retroactively removed. It is a deliberate position, and it is the correct one to describe to a user asking what happens to their receipts: the receipts go, the anonymous dollar figure stays.

---

## 7. Provenance summary

| Claim | Source of truth |
|---|---|
| Only write path into the aggregate graph | `lib/actions/spend/approveReceipt.ts` |
| Submission validation and limits | `lib/actions/spend/createReceiptSubmission.ts` |
| Schema, indexes, RLS | `supabase/migrations/20260511000001_receipt_community_spend.sql` |
| Current RLS posture | `supabase/migrations/20260815010000_spend_aggregate_rls_close_anon_read.sql` |
| Threshold constant and helpers | `lib/spend/aggregate-privacy.ts` |
| Guards on all of the above | `tests/aggregate-privacy.test.ts` |
| Deletion behavior | `lib/actions/account/deleteAccount.ts`, Privacy Policy §7 |
