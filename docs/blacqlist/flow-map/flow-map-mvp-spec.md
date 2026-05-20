# Flow Map MVP Spec — The BLACQList

**Date:** 2026-05-11
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

| Feature | Route | Auth required |
|---|---|---|
| National summary stats (total spend, businesses, transactions) | `/flow-map` | No |
| Top businesses by spend | `/flow-map` | No |
| Top cities by spend | `/flow-map` | No |
| Simple SVG network placeholder | `/flow-map` | No |
| Personal impact section | `/flow-map` (inline) | Yes (graceful fallback) |
| Public summary API | `/api/flow-map/summary` | No |
| Personal impact API | `/api/flow-map/personal-impact` | Yes |
| Entity impact placeholder | `/flow-map` | Owner role (deferred) |

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

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `receipt_upload_id` | uuid FK SET NULL | Link back to private receipt |
| `listing_id` | uuid FK SET NULL | Which business received money |
| `city_id` | uuid FK SET NULL | City of purchase |
| `amount_cents` | integer NOT NULL | Purchase amount |
| `purchase_date` | date NOT NULL | When the purchase happened |
| `source` | text | `'receipt_upload'` at MVP |
| `aggregate_opt_out` | boolean DEFAULT false | Excluded from all public aggregations |
| `created_at` | timestamptz | Immutable |

**No `user_id` on `spend_events`.** User identity is stored on `receipt_uploads.user_id` only, never on the downstream spend event. This is the core privacy guarantee.

**`flow_nodes`** — Aggregated business/city nodes for the flow graph.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `node_type` | text CHECK IN ('business','city') | Business or city aggregate |
| `entity_id` | uuid NOT NULL | `listings.id` or `cities.id` |
| `total_amount_cents` | bigint DEFAULT 0 | Running total |
| `transaction_count` | integer DEFAULT 0 | Running count |
| `last_transaction_at` | timestamptz | For recency sorting |
| UNIQUE | `(node_type, entity_id)` | One node per entity |

**`flow_edges`** — Directional connections between nodes.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `source_node_id` | uuid FK CASCADE | Who spent (buyer city node) |
| `target_node_id` | uuid FK CASCADE | Who received (business node) |
| `total_amount_cents` | bigint DEFAULT 0 | Aggregate flow |
| `transaction_count` | integer DEFAULT 0 | Number of events |
| UNIQUE | `(source_node_id, target_node_id)` | One edge per pair |

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

| Data | Public? | Source |
|---|---|---|
| Total community spend (sum, no breakdown) | Yes | `spend_events` |
| Transaction count | Yes | `spend_events` |
| Business node: name + total received + count | Yes | `flow_nodes` + `listings.name` |
| City node: city name + total spend + count | Yes | `flow_nodes` + `cities.name` |
| Flow edge: source→target + amount | Only if `transaction_count ≥ 5` | `flow_edges` |

### What is Never Public

| Data | Why |
|---|---|
| Individual receipt amounts or dates | Private to user + admin |
| User identity on any spend record | `spend_events` has no `user_id` by design |
| Receipt images | Private storage; 15-min signed URL for owner/admin only |
| `receipt_uploads` rows | RLS: authenticated = own rows only; anon = no access |
| Opt-out spend | `aggregate_opt_out = true` excluded at query time |
| Edges with fewer than 5 transactions | Threshold prevents pattern inference at MVP |

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
      { "entity_id": "...", "name": "...", "slug": "...", "total_amount_cents": 45000, "transaction_count": 12 }
    ],
    "top_cities": [
      { "entity_id": "...", "name": "Atlanta", "total_amount_cents": 320000, "transaction_count": 89 }
    ],
    "edges": [
      { "source_node_id": "...", "target_node_id": "...", "total_amount_cents": 15000, "transaction_count": 8 }
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
      { "listing_id": "...", "name": "...", "slug": "...", "amount_cents": 22000, "receipt_count": 3 }
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

The V3 full dollar-flow map will replace the SVG placeholder with an interactive force-directed graph using a lightweight library (candidate: `@visx/network` or plain SVG with client-side positioning). Requirements before upgrade:

| Threshold | Why |
|---|---|
| ≥ 500 community members | Privacy — distinguishable nodes need anonymization buffer |
| ≥ 6 months of data | Meaningful edges; patterns not dominated by early contributors |
| ≥ 30 business nodes with 5+ transactions | Enough nodes to make the graph visually meaningful |
| `flow_map_snapshots` table populated | Graph pre-computed server-side; not computed on request |
| `anonymized_community_nodes` pass implemented | Ensures <5 threshold enforced before data reaches client |

---

## 10. Known Limitations

- **City attribution missing at MVP** — `approveReceiptAction` doesn't yet set `city_id` on `spend_events` or create city `flow_nodes`. This is noted in the receipt report and should be wired in a follow-up.
- **`flow_edges` are empty at MVP** — The approval flow creates business flow_nodes but not edges. Edges require city attribution to create meaningful source→target pairs.
- **No time filtering** — All-time totals only.
- **No category filtering** — `spend_events` has no category field at this schema version.
- **Network SVG is decorative at MVP** — It renders business nodes but doesn't represent actual flow edges (since edges are empty). V3 replaces with real force-directed graph.
