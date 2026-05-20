# Flow Map Foundation — Build Report

**Date:** 2026-05-11
**Feature area:** Community Dollar Flow — `/flow-map` route
**Status:** Complete — 0 TypeScript errors, 0 lint errors

---

## What Was Built

### Data Model

**Tables (pre-existing from migration `20260511000001_receipt_community_spend.sql`):**

All four tables were already in place from the receipt/community-spend beta build. No new migration required.

| Table | Role in Flow Map |
|---|---|
| `spend_events` | Source-of-truth anonymized transaction log. No `user_id` by design. |
| `flow_nodes` | Running aggregate per business/city entity: `total_amount_cents`, `transaction_count`, `last_transaction_at`. UNIQUE on `(node_type, entity_id)`. |
| `flow_edges` | Directional money flow between nodes. Currently empty at MVP (wired in `approveReceiptAction` but city attribution is pending). |
| `receipt_uploads` | Private per-user receipt store. Only table with `user_id`. Used for personal impact queries. |

**Personal Impact Data Source:**

`spend_events` has no `user_id` by design. Personal impact is computed from `receipt_uploads WHERE user_id = auth.uid() AND status = 'approved'`. This is the correct privacy-preserving approach — user identity is never in the public data pipeline.

**Data Pipeline (MVP):**

```
receipt_uploads (private, has user_id)
  → admin approves (approveReceiptAction)
    → spend_events INSERT (no user_id — anonymous)
    → flow_nodes UPSERT (running totals per business)
  → /flow-map page reads flow_nodes + spend_events directly
```

No background jobs. No `flow_map_snapshots` table at MVP. Queries run against live tables with service client.

---

### API Routes

| File | Method | Auth | Cache | Purpose |
|---|---|---|---|---|
| `app/api/flow-map/summary/route.ts` | GET | Public | 1 hour ISR | National totals, top businesses, top cities, edges (≥5 tx threshold) |
| `app/api/flow-map/personal-impact/route.ts` | GET | Auth-required | None | User's personal aggregated impact from approved receipts |

**Privacy enforcement in `/api/flow-map/summary`:**

- Queries `spend_events WHERE aggregate_opt_out = false` — opt-outs excluded at the DB level
- Returns edges only where `flow_edges.transaction_count >= 5` — prevents individual pattern inference
- No `user_id` in any response field (not present in `spend_events` or `flow_nodes`)
- No receipt files, raw amounts, or purchase dates in public responses

**Personal impact endpoint:**

- `createClient()` auth check — 401 if no session
- Uses `serviceClient` to query `receipt_uploads` (bypasses RLS for server action) filtered by `user_id = user.id`
- Returns aggregated totals only — no raw receipt rows exposed in response

---

### Components

| File | Purpose |
|---|---|
| `components/flow-map/FlowSummaryCards.tsx` | Three stat cards: total circulated / businesses supported / transactions. Pure display component. |
| `components/flow-map/FlowNodeTable.tsx` | Ranked list of business or city nodes with progress bars proportional to spend. Optional link to entity page. |
| `components/flow-map/FlowMapNetwork.tsx` | Server-side SVG network visualization. Business nodes as circles orbiting a central "Community" node. Sized by transaction count. No d3 or client JS. |

All three are Server Components (no `"use client"` directive).

---

### Public Route

| Route | File | Auth |
|---|---|---|
| `/flow-map` | `app/(public)/flow-map/page.tsx` | Public (personal impact section auth-gated inline) |

**Page sections:**

1. **Hero** — Headline stat (total $ circulated if data exists, else "Where does our money go?"), CTA to submit receipt
2. **Summary cards** — `FlowSummaryCards` with total, businesses, transactions. Empty state hero card if no data yet.
3. **Network SVG** — `FlowMapNetwork` with up to 8 business nodes. Shows "No flow data yet" empty state.
4. **City/category filter placeholder** — Disabled filter buttons with "Coming soon" badge
5. **Top businesses + top cities** — Two `FlowNodeTable` components in a responsive grid
6. **Personal impact section** — Three states: (a) signed out → sign-in prompt, (b) signed in no receipts → submit CTA, (c) signed in with receipts → stats + top businesses
7. **Entity impact placeholder** — CTA card for business owners linking to `/for-business`
8. **Privacy notice** — Explains anonymization, 5-transaction threshold, opt-out

**Performance:**

- `export const revalidate = 3600` — page revalidates every hour via ISR
- All data fetching is server-side (no client-side useEffect or fetch)
- Service client used for public data; session client used for auth check only

---

## Anonymization Model

| Data | Exposure | Mechanism |
|---|---|---|
| Individual buyer identity | Never public | `spend_events` has no `user_id` column |
| Receipt images | Owner + admin only | Private storage bucket; 15-min signed URL |
| Per-user receipt details | Owner only | RLS: `receipt_uploads.user_id = auth.uid()` |
| Opt-out records | Excluded from all aggregates | `WHERE aggregate_opt_out = false` at every query |
| Edges with < 5 transactions | Excluded from public API | `WHERE transaction_count >= 5` in `/api/flow-map/summary` |
| Business names + spend totals | Public | Via `flow_nodes` + `listings.name` join |
| City names + spend totals | Public | Via `flow_nodes` + `cities.name` join |

---

## Public Views Implemented

| View | Implemented | Notes |
|---|---|---|
| National summary stats | ✅ | Total spend, businesses, transactions |
| Top businesses | ✅ | Table with progress bars, linked to entity pages |
| Top cities | ✅ | Table with progress bars |
| Network SVG visualization | ✅ | Placeholder — business nodes orbit community center |
| City/category filter | Placeholder | UI shell only; filter logic deferred |
| Personal impact (signed-in) | ✅ | From approved `receipt_uploads` |
| Personal impact (signed-out) | ✅ | Sign-in prompt |
| Entity impact (owner) | Placeholder | CTA to `/for-business`; owner dashboard deferred |

---

## Tests Needed

### Privacy Tests (P1)

| # | Test | Expected |
|---|---|---|
| 1 | `GET /api/flow-map/summary` — inspect all JSON keys | No `user_id` in any node, edge, or summary object |
| 2 | `GET /api/flow-map/summary` — create edge with `transaction_count = 4` | Edge not returned in response |
| 3 | `GET /api/flow-map/summary` — create edge with `transaction_count = 5` | Edge returned |
| 4 | Submit receipt with `aggregate_opt_out = true`, approve it | Amount not included in `total_amount_cents` |
| 5 | `GET /api/flow-map/personal-impact` with no session cookie | `401 AUTH_REQUIRED` |
| 6 | `GET /api/flow-map/personal-impact` with user A's cookie | Only user A's receipts returned |
| 7 | Query `spend_events` table schema | Confirm no `user_id` column exists |
| 8 | Anon client SELECT on `receipt_uploads` | Returns 0 rows (RLS blocks anon access) |

### Functional Tests (P2)

| # | Test | Expected |
|---|---|---|
| 9 | Visit `/flow-map` with no spend data | Hero shows "Where does our money go?", empty state cards, "No flow data yet" SVG |
| 10 | Visit `/flow-map` with approved receipts | Summary cards show real totals; network SVG shows business nodes |
| 11 | Visit `/flow-map` signed out | Personal impact shows sign-in prompt |
| 12 | Visit `/flow-map` signed in with receipts | Personal impact shows stats + top businesses |
| 13 | Visit `/flow-map` signed in, no receipts | Personal impact shows "Submit a receipt" CTA |
| 14 | City/category filters | Buttons render as disabled; no errors on click |

### Edge Cases (P3)

| # | Test | Notes |
|---|---|---|
| 15 | `flow_nodes` with `listing_id` deleted | `businessMap` lookup returns "Unknown Business" — no 500 |
| 16 | User deletes account | `receipt_uploads` cascade deletes; personal impact returns zeros |
| 17 | Very large amount (> $1M) | `formatDollars` with `maximumFractionDigits: 0` — no cents shown |
| 18 | SVG with 0 nodes | "No flow data yet" empty state — no empty SVG rendered |

---

## Known Limitations

- **City attribution missing** — `approveReceiptAction` does not yet set `city_id` on `spend_events` or create city flow_nodes. City table in flow map will be empty until wired.
- **`flow_edges` are empty at MVP** — The approval workflow creates business nodes but not edges. Edges need source→target pairs (typically community/city → business). Wire in follow-up.
- **No time filtering** — All-time totals only. No period selector (Q, Y, all time).
- **No category filtering** — `spend_events` has no category field in this schema version.
- **SVG is decorative** — Business nodes shown but edges are cosmetic (spoke from center). Real flow edges deferred until enough data exists.
- **`/api/flow-map/summary` route exists but page queries DB directly** — The page doesn't call the API route. Both query patterns are correct; the API route is available for external consumers.

---

## Next Ticket Recommendations

| Priority | Work |
|---|---|
| P1 | Wire city attribution in `approveReceiptAction` — query `listings.city_id` on approval, upsert city `flow_node`, set `spend_events.city_id` |
| P1 | Create `flow_edges` on approval — after business + city nodes exist, create/upsert edge between city_node → business_node |
| P2 | Time period filter on `/flow-map` (30d / 90d / 1y / all) — needs `spend_events.purchase_date` index + filter param |
| P2 | Add `/flow-map` link to public nav |
| P3 | V3 force-directed graph — replace SVG placeholder when 500+ members + 30+ nodes exist |
| P3 | `flow_map_snapshots` table + nightly computation job |
