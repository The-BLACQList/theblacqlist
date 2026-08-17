# Flow Map MVP Spec — The BLACQList

**Date:** 2026-05-11
**Last updated:** 2026-08-17 — §9 reopened (the V3 medium is an open question, not a settled 2D plan); §10 corrected
**Feature area:** Community Dollar Flow
**Phase:** MVP Foundation
**Status:** Active build

---

## 1. Problem Statement

The BLACQList community wants to see the collective impact of their spending at Black-owned businesses — not just as a personal stat, but as a living picture of how dollars circulate within the community. The flow map answers: "Where is our money going, and who benefits?"

---

## 2. MVP Scope

The PRD places the full interactive flow map at V3 (after minimum 500 community members and 6 months of transaction data). This MVP establishes the data foundation and a functional, privacy-safe public route that will grow into the full visualization.

### Must-Have (MVP)

| Feature                                                        | Route                           | Auth required           |
| -------------------------------------------------------------- | ------------------------------- | ----------------------- |
| National summary stats (total spend, businesses, transactions) | `/flow-map`                     | No                      |
| Top businesses by spend                                        | `/flow-map`                     | No                      |
| Top cities by spend                                            | `/flow-map`                     | No                      |
| Simple SVG network placeholder                                 | `/flow-map`                     | No                      |
| Personal impact section                                        | `/flow-map` (inline)            | Yes (graceful fallback) |
| Public summary API                                             | `/api/flow-map/summary`         | No                      |
| Personal impact API                                            | `/api/flow-map/personal-impact` | Yes                     |
| Entity impact placeholder                                      | `/flow-map`                     | Owner role (deferred)   |

### Explicitly Out of Scope (MVP)

- Interactive force-directed graph (requires d3/vis.js, meaningful data volume)
- City/category filter (placeholder shown)
- Time-period filter (placeholder shown)
- Business node opt-in campaign UI
- `flow_map_snapshots` computation (deferred — needs nightly job)
- `vendor_relationships` inference (V3)
- Embed option for external organizations (V3)

---

## 3. Data Model

### Tables (all created in migration `20260511000001_receipt_community_spend.sql`)

**`spend_events`** — The source-of-truth transaction log. Anonymized by design.

| Field               | Type                  | Notes                                 |
| ------------------- | --------------------- | ------------------------------------- |
| `id`                | uuid                  | PK                                    |
| `receipt_upload_id` | uuid FK SET NULL      | Link back to private receipt          |
| `listing_id`        | uuid FK SET NULL      | Which business received money         |
| `city_id`           | uuid FK SET NULL      | City of purchase                      |
| `amount_cents`      | integer NOT NULL      | Purchase amount                       |
| `purchase_date`     | date NOT NULL         | When the purchase happened            |
| `source`            | text                  | `'receipt_upload'` at MVP             |
| `aggregate_opt_out` | boolean DEFAULT false | Excluded from all public aggregations |
| `created_at`        | timestamptz           | Immutable                             |

**No `user_id` on `spend_events`.** User identity is stored on `receipt_uploads.user_id` only, never on the downstream spend event. This is the core privacy guarantee.

**`flow_nodes`** — Aggregated business/city nodes for the flow graph.

| Field                 | Type                              | Notes                        |
| --------------------- | --------------------------------- | ---------------------------- |
| `id`                  | uuid                              | PK                           |
| `node_type`           | text CHECK IN ('business','city') | Business or city aggregate   |
| `entity_id`           | uuid NOT NULL                     | `listings.id` or `cities.id` |
| `total_amount_cents`  | bigint DEFAULT 0                  | Running total                |
| `transaction_count`   | integer DEFAULT 0                 | Running count                |
| `last_transaction_at` | timestamptz                       | For recency sorting          |
| UNIQUE                | `(node_type, entity_id)`          | One node per entity          |

**`flow_edges`** — Directional connections between nodes.

| Field                | Type                               | Notes                        |
| -------------------- | ---------------------------------- | ---------------------------- |
| `id`                 | uuid                               | PK                           |
| `source_node_id`     | uuid FK CASCADE                    | Who spent (buyer city node)  |
| `target_node_id`     | uuid FK CASCADE                    | Who received (business node) |
| `total_amount_cents` | bigint DEFAULT 0                   | Aggregate flow               |
| `transaction_count`  | integer DEFAULT 0                  | Number of events             |
| UNIQUE               | `(source_node_id, target_node_id)` | One edge per pair            |

### Data Pipeline (MVP vs V3)

```
[receipt_uploads] (private, user_id)
       ↓ admin approval
[spend_events] (anonymized, no user_id)
       ↓ incremental update in approveReceiptAction
[flow_nodes] (public aggregate per business/city)
[flow_edges] (public directional totals)
       ↓ (V3 nightly job)
[flow_map_snapshots] (precomputed graph JSON)
       ↓ (V3 anonymization pass)
[public visualization]
```

At MVP, `flow_nodes` and `flow_edges` are updated synchronously in the admin `approveReceiptAction`. No background job. No snapshot table. The flow map page queries `flow_nodes` directly.

### Personal Impact Query

Since `spend_events` has no `user_id`, personal impact is derived from `receipt_uploads`:

```sql
SELECT
  COUNT(*) AS receipt_count,
  COUNT(DISTINCT listing_id) AS unique_businesses,
  SUM(amount_cents) AS total_amount_cents,
  COUNT(*) FILTER (WHERE status = 'pending_review') AS pending_count
FROM receipt_uploads
WHERE user_id = auth.uid()
  AND (status = 'approved' OR status = 'pending_review')
```

Personal total = approved receipts only. Pending count shown as "under review."

### Entity Impact Query

```sql
SELECT total_amount_cents, transaction_count, last_transaction_at
FROM flow_nodes
WHERE node_type = 'business'
  AND entity_id = {listing_id}
```

Owner access gated at the page level (deferred to owner dashboard ticket).

---

## 4. Anonymization Approach

### What is Public

| Data                                         | Public?                         | Source                         |
| -------------------------------------------- | ------------------------------- | ------------------------------ |
| Total community spend (sum, no breakdown)    | Yes                             | `spend_events`                 |
| Transaction count                            | Yes                             | `spend_events`                 |
| Business node: name + total received + count | Yes                             | `flow_nodes` + `listings.name` |
| City node: city name + total spend + count   | Yes                             | `flow_nodes` + `cities.name`   |
| Flow edge: source→target + amount            | Only if `transaction_count ≥ 5` | `flow_edges`                   |

### What is Never Public

| Data                                 | Why                                                     |
| ------------------------------------ | ------------------------------------------------------- |
| Individual receipt amounts or dates  | Private to user + admin                                 |
| User identity on any spend record    | `spend_events` has no `user_id` by design               |
| Receipt images                       | Private storage; 15-min signed URL for owner/admin only |
| `receipt_uploads` rows               | RLS: authenticated = own rows only; anon = no access    |
| Opt-out spend                        | `aggregate_opt_out = true` excluded at query time       |
| Edges with fewer than 5 transactions | Threshold prevents pattern inference at MVP             |

### Future: Minimum Threshold Enforcement

At V3, the `flow_map_snapshots` computation enforces the 5-contributor minimum before writing graph JSON. At MVP, the `/api/flow-map/summary` route applies a `WHERE transaction_count >= 5` filter on `flow_edges` before returning them.

---

## 5. Public Views

### View 1: National Summary

- Total dollars circulated (from non-opt-out `spend_events`)
- Number of businesses supported (unique `listing_id` in `flow_nodes`)
- Number of transactions
- Time scope: all-time at MVP; time filter deferred

### View 2: Top Businesses

Table of business nodes ordered by `total_amount_cents DESC`. Columns: business name (linked to entity page), total spent, transaction count.

### View 3: Top Cities

Table of city nodes ordered by `total_amount_cents DESC`. Columns: city name, total spent, transaction count.

### View 4: Network Visualization (MVP Placeholder)

Simple SVG:

- Business nodes as circles, sized by `transaction_count`
- A central "Community" node
- Lines from community node to each business node (no `flow_edges` data required)
- If no data: "Be the first to contribute" empty state

V3 replaces this with an interactive force-directed graph once the data volume threshold is met.

### View 5: Personal Impact (Signed-In Only)

If user is authenticated:

- Total spent at Black-owned businesses (sum of approved receipts)
- Number of businesses supported (distinct listing_id on approved receipts)
- Receipts pending review (count)
- CTA to submit more receipts

If user is not authenticated:

- "Sign in to see your personal impact" prompt

### View 6: Entity Impact (Owner Only — Placeholder)

CTA card: "Own a business on The BLACQList? See your impact stats on your owner dashboard."
Links to `/for-business`.

---

## 6. UI Structure

```
/flow-map
├── Hero: "The Community Dollar Flow" + total spend stat
├── Summary cards: $ circulated / businesses / transactions
├── [Network SVG visualization]
├── Top businesses (table/list)
├── Top cities (table/list)
├── [Auth gate] Personal impact section
│   ├── If signed in: personal stats + CTA
│   └── If signed out: sign-in prompt
├── Entity impact placeholder
└── Privacy notice footer
```

### City/Category Filter Placeholder

A filter UI shell (non-functional at MVP) shows "Filter by city" and "Filter by category" selectors in disabled state with a "Coming soon" badge. This establishes the visual structure without requiring backend filtering logic.

---

## 7. API Endpoints

### `GET /api/flow-map/summary` — Public

Response:

```json
{
  "data": {
    "total_amount_cents": 12500000,
    "total_transactions": 847,
    "unique_businesses": 134,
    "top_businesses": [
      {
        "entity_id": "...",
        "name": "...",
        "slug": "...",
        "total_amount_cents": 45000,
        "transaction_count": 12
      }
    ],
    "top_cities": [
      {
        "entity_id": "...",
        "name": "Atlanta",
        "total_amount_cents": 320000,
        "transaction_count": 89
      }
    ],
    "edges": [
      {
        "source_node_id": "...",
        "target_node_id": "...",
        "total_amount_cents": 15000,
        "transaction_count": 8
      }
    ]
  }
}
```

Cache: ISR 1 hour (`revalidate = 3600`)

### `GET /api/flow-map/personal-impact` — Auth-gated

Response:

```json
{
  "data": {
    "total_amount_cents": 87500,
    "unique_businesses": 6,
    "approved_receipt_count": 12,
    "pending_receipt_count": 2,
    "top_businesses": [
      {
        "listing_id": "...",
        "name": "...",
        "slug": "...",
        "amount_cents": 22000,
        "receipt_count": 3
      }
    ]
  }
}
```

---

## 8. Privacy Tests Required

1. **`/api/flow-map/summary` returns no `user_id` fields** in any response node or edge
2. **`/api/flow-map/summary` excludes edges with `transaction_count < 5`**
3. **`/api/flow-map/personal-impact` with no auth → 401**
4. **`/api/flow-map/personal-impact` with wrong user → sees only own data** (RLS enforced via `createClient()`)
5. **`spend_events` table has no `user_id` column** (schema-level privacy guarantee)
6. **`receipt_uploads` inaccessible to anon/other users** (RLS policy test)
7. **Opt-out records excluded** from all aggregate totals

---

## 9. Future Graph Visualization Plan

**The medium for the V3 map is an open question, not a settled one.** An earlier version of this section named a 2D force-directed graph (`@visx/network` or plain SVG with client-side positioning) as the plan. That was written before the graph had a shape worth choosing a medium for, and it is deliberately held open until it does.

### 9.1 The prerequisite is the graph's shape, not the renderer

`flow_nodes.node_type` is constrained to two values:

```sql
-- 20260511000001_receipt_community_spend.sql:63
node_type text NOT NULL CHECK (node_type IN ('business', 'city')),
```

and a business belongs to exactly one city — `listings.city_id` is a single FK — so the approval path writes exactly one outgoing edge per business (`lib/actions/spend/approveReceipt.ts:173-175`). The resulting topology is a **forest of stars**: a few city hubs, N business leaves each, no edge between any two leaves, and no path longer than one hop.

That shape is planar by construction. It has no crossings to untangle, no depth to encode, and no occlusion that rotation would resolve — so it cannot distinguish between candidate mediums. Choosing one against it would be choosing on taste rather than on the data.

`flow_edges` is already general: a plain `(source_node_id, target_node_id)` pair with a `UNIQUE` on it, needing no change. **The only structural blocker is the `CHECK` on `node_type` plus the write path that decides which edges get drawn** — one constraint and one function, not a redesign.

The leading candidate for a second edge class is `business → category`. `listings.category_id` is `uuid NOT NULL REFERENCES categories(id)` (`20260510000000:277`), so the data already exists on every listing and no new user input is required. It is the first candidate that gives a business two outgoing edges, which creates paths between cities that have none today. It is **not scheduled here** — it is a schema decision, and it belongs at GATE-DATA alongside the `flow_nodes`/`flow_edges` recompute rather than inside a rendering section.

### 9.2 The test the medium has to pass

Recorded before the shape is known, so the answer cannot be written to fit a preference. A third dimension earns its cost only if at least one of these holds at the time the decision is taken:

| # | Criterion | Status today |
| --- | --- | --- |
| 1 | **Intra-layer edges exist** (business↔business, city↔city), forcing crossings no 2D layout can remove | **Fails** — every edge is business-to-attribute |
| 2 | **Three or more independent grouping axes** must be shown at once, and dropping one loses a question the page exists to answer | **Fails** — two axes at most: place and kind |
| 3 | **Measured overplotting** at real production node and edge counts | `[Unknown]` — not measurable until the site is public |

If all three still fail when the question is re-taken, the answer is 2D — most likely a layered/Sankey-shaped layout, since `category → business → city` is a flow between attribute layers, which is the structure that shape was invented for.

### 9.3 The constraint that binds any medium

`app/globals.css` treats motion as **opt-in, not opt-out**: animation lives inside `@media (prefers-reduced-motion: no-preference)` (`:154`, `:174`, `:247`), with `:211` handling `reduce`. The page default is static.

Any `requestAnimationFrame` loop inverts that, because it runs until code stops it — which binds a 2D force simulation exactly as much as a WebGL scene. Whichever medium is chosen inherits the obligation to honour reduced motion explicitly, rather than receiving it from the stylesheet's default. `components/motion/Reveal.tsx` is the hand-rolled precedent to match.

### 9.4 Data thresholds before any upgrade

| Threshold | Status |
| --- | --- |
| ≥ 500 community members | `[Unknown]` — needs a production read |
| ≥ 6 months of data | `[Unknown]` — needs a production read |
| ≥ 30 business nodes with 5+ transactions | `[Unknown]` — needs a production read |
| Graph pre-computed server-side, not per request | **Not built.** An earlier version of this table named a `flow_map_snapshots` table as though it were a component that existed; there is no such table and no migration for one. This is a requirement, not a shipped piece. |
| k-anonymity bound enforced before data reaches the client | **Met — by a different mechanism than the one this table once named.** There is no `anonymized_community_nodes` pass. The bound is `AGGREGATE_MIN_TRANSACTIONS = 5` (`lib/spend/aggregate-privacy.ts:32`), applied per query in `app/api/flow-map/summary/route.ts` and `app/api/community-spend/route.ts`. |

### 9.5 Other documents that still assume the earlier plan

Correcting this section leaves three tracked documents describing the superseded one. They are recorded here rather than edited, so that a reader who lands on one of them knows to come back — and so the fixes are taken deliberately, not folded into a documentation pass about something else.

| Document | What it still says | Why it matters |
| --- | --- | --- |
| `docs/blacqlist/architecture/api-contract.md:4370` | *"No flow map endpoints are active at MVP, V1, or V2."* | Two are live today: `app/api/flow-map/summary/route.ts` and `app/api/community-spend/route.ts`. |
| `docs/blacqlist/architecture/api-contract.md:4487` | The k-anonymity bound is *"enforced in the service layer before writing to `flow_nodes` or `flow_edges`, not at query time."* | The shipped enforcement is the opposite — at query time, per request. A stale claim about **where a privacy control lives** is the most costly kind to leave standing. |
| `docs/blacqlist/production/production-roadmap.md:705, :1065` | The `FlowMapNetwork` upgrade is stated as a force-directed graph. | Presupposes the medium this section is holding open. |

The api-contract entries describe endpoints still deferred to V3, so nothing shipped depends on them being wrong — but the second one should be corrected before anyone designs against it.

---

## 10. Known Limitations

Two entries below were resolved and two had reasons expire. They are corrected rather than deleted, because the correction is the useful record — a limitation that quietly disappears reads as though it was never real.

- ~~**City attribution missing at MVP**~~ — **Resolved.** `approveReceiptAction` sets `city_id` on the `spend_event`, creates the city `flow_node`, and writes the `business → city` edge (`lib/actions/spend/approveReceipt.ts:126-136`, `:173-175`).
- ~~**`flow_edges` are empty at MVP**~~ — **Resolved** by the same change. Edges are written on every approval that resolves a city.
- **No time filtering** — All-time totals only. `/flow-map` accepts `city` and `category` search params; there is no date parameter and no time-bounded query.
- **No category filtering *in `spend_events`*** — the conclusion has changed, the underlying fact has not. `spend_events` still has no category column, but `/flow-map` filters by category by narrowing `listings` on `listings.category_id` before aggregating. Category filtering ships; it just does not read from `spend_events`.
- **Network SVG is decorative** — still true, for a different reason than originally given. `components/flow-map/FlowMapNetwork.tsx` arranges the top business nodes around a synthetic "Community" centre and never reads `flow_edges` at all. The original reason ("since edges are empty") stopped being true once edges started being written; the SVG simply does not draw them. Section 9 covers the replacement.
