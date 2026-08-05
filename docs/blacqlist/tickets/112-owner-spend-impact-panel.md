# Ticket 112 — Owner spend-impact panel (Premium tier)

**Phase:** V1.5 · **Priority:** P2 · **Status:** Draft
**Depends on:** 105 (limit enforcement)
**Gates:** `canAccess(tier, 'spend_impact_panel')` — Premium only

---

## Why

This is the one Premium benefit **no competitor can copy**, because it runs on data only this
platform has: receipts, community spend, and the flow map. It converts the moat described in the
pitch ("a dollar-flow map that shows how money circulates through Black-owned businesses") into a
per-owner artifact worth paying for.

It also closes a loop that currently only points one way: consumers upload receipts and see their
own spend, but the business on the other side of that receipt learns nothing.

## Privacy constraint — read before designing

Receipt data is consumer PII, and the existing `/account/community-spend` surface is anonymized
aggregate for good reason. That property must not be weakened to build this:

- Owners see **aggregates only** — never an individual consumer, receipt image, or transaction
- **Minimum-cohort threshold**: suppress any figure derived from fewer than **5 distinct consumers**
  in the period. Show "not enough data yet", not a rounded number
- No cross-referencing that could re-identify (e.g. no aggregate so narrow it implies one person)
- Reuse the existing anonymized aggregation path from `/account/community-spend` rather than
  querying `receipt_uploads` directly

## Acceptance criteria

- Panel at `/dashboard/pages/[entityId]/impact` for Premium listings
- Metrics: attributed community spend over time, share of category spend in their city, repeat-visit
  rate, and how their listing contributes to the city flow map — each subject to the cohort threshold
- Every figure labeled with its basis and period. Receipt-derived numbers are **consumer-reported,
  not verified** — label them that way. Per the no-fabrication rule, an unmeasured figure renders as
  `[Unknown]` / "not enough data yet", never as zero and never as an estimate
- Links through to the public flow map for context
- Empty state is the common case at launch and must be genuinely useful — explain what the panel
  will show once receipt volume exists, rather than rendering empty charts
- Owner-facing copy explains the data source and its limits in plain language

## Out of scope

- Any individual-consumer visibility, ever
- Exporting consumer-level data
- Verified/POS-integrated revenue attribution
