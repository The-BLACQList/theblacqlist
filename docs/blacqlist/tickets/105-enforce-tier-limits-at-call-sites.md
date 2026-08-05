# Ticket 105 — Enforce the new tier limits at every call site

**Phase:** Monetization (Phase 14) · **Priority:** P1 · **Status:** Draft
**Depends on:** 076 (tier upgrade flow), 078 (webhook)
**Related:** `lib/stripe/features.ts`, `monetization/time-to-1m-and-ai-margin-review.md`

---

## Why this is P1

The 2026-07-27 re-ladder rewrote `lib/stripe/features.ts` into a full entitlement map (26 gated
features + 11 per-field limits) and rewrote the `/pricing` copy to match. **Only one limit is
actually enforced in code today** — photos, in `lib/actions/dashboard/uploadMedia.ts`.

Until this ticket ships, the pricing page **promises differentiation the server does not enforce**.
That is worse than the flat ladder it replaced: a Starter customer can use Growth features, and the
ARPU gain the re-ladder was built for does not materialize. This ticket is what makes the ladder real.

## Current enforcement state

| Entitlement | Helper | Enforced? |
|---|---|---|
| Photos | `photoLimit` | ✅ `lib/actions/dashboard/uploadMedia.ts:48` |
| Analytics access | `canAccess(…, 'analytics')` | ✅ `app/dashboard/pages/[entityId]/analytics/page.tsx:101` |
| AI suggestions access | `canAccess(…, 'ai_suggestions')` | ✅ `app/dashboard/pages/[entityId]/ai-suggestions/page.tsx:66` |
| Review response | `canAccess(…, 'review_response')` | ✅ `lib/actions/owner/submitReviewResponse.ts:43` |
| Everything else (22 gates, 10 limits) | — | ❌ **declared but unwired** |

Note `priority_placement` has **no reader anywhere** — it was declared before the re-ladder and is
still unread, so moving it Starter→Growth had no runtime effect. It needs a real reader in search
ranking (see AC 3).

## Acceptance criteria

**1. Field limits enforced server-side, in server actions — never UI-only.** Use `isAtLimit(tier,
key, count)` so the null-means-unlimited branch is not re-derived per call site:

- `videos` — listing video add/update action (`20260622000002_listing_video.sql`)
- `faqs` — FAQ add action (`20260622000004_listing_faqs.sql`)
- `attributes` — attribute/tag assignment (`20260622000000_attributes_taxonomy.sql`)
- `products` — marketplace product **and** service creation, counted **combined** against one cap
- `events` — active event creation (`20260622000007_event_entity.sql`); cap counts *active* only
- `teamMembers`, `locations` — once tickets 107 and 110 land
- `descriptionChars` — listing description save; validate on the server, and show the remaining
  count in the editor so Free users see the cap before they hit it

**2. Feature gates enforced at the render and mutation boundary.** Every `GatedFeature` with a
consuming surface checks `canAccess` in the server component or server action — not in a client
component, and not by hiding a button. Gating the UI without gating the action is not a gate.

**3. `priority_placement` gets a real reader.** Apply it in the faceted search ranking RPC
(`20260622001_search_listings_faceted_rpc.sql`) so Growth+ listings sort above Starter and Free
within the same relevance band. Sponsored placement stays visually labeled and separate — this is
organic ranking weight, not an ad slot.

**4. `analyticsHistoryDays` bounds the query, not just the chart.** The owner analytics dashboard
must not fetch 365 days and render 30 — pass the tier's window into the query so a Starter customer
cannot read Growth-depth data from the network response.

**5. Downgrade behavior is defined and non-destructive.** When a subscription downgrades or lapses,
content over the new cap is **hidden, never deleted** — surplus photos/videos/FAQs/products become
inactive and are restored on re-upgrade. A billing lapse must never destroy an owner's content.
Add this to the webhook path (078) and cover it with a test.

**6. Every limit has a friendly typed error**, matching the existing photo-cap copy pattern:
"Your plan includes up to N X. Upgrade to add more." Never a raw 400/429.

## Out of scope

- Building the features that do not exist yet (107–112 cover those). This ticket wires the limits
  for surfaces that already exist and leaves hooks for the rest.
- AI quota enforcement — that is Ticket 104, which reads `aiQuota` from the same map.

## Test plan

Extend `tests/feature-gating.test.ts` (entitlement matrix already covered there) with **action-level**
tests: for each limited field, seed a listing at `limit - 1`, assert one more succeeds, assert the
next fails with the typed error. Add a downgrade test asserting hide-not-delete.
