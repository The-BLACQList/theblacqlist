# Ticket 104 — AI cost guardrails (pre-AI-launch margin protection)

**Phase:** AI (Phase 15) · **Priority:** P1 · **Status:** Draft
**Gate:** must ship **before** any live AI provider (`ANTHROPIC_API_KEY`) is connected.
**Blocks:** Ticket 079 (Anthropic client)
**Related:** `docs/blacqlist/monetization/pricing-unit-economics.md` (guardrails),
`docs/blacqlist/monetization/time-to-1m-and-ai-margin-review.md` (consumer-surface analysis),
`docs/blacqlist/ai/ai-agent-roadmap.md`

---

## Scope change (2026-07-27)

This ticket originally capped generations per `listing_id` only. That covers the **business** agents
and leaves the larger surface uncovered: **10 of the ~22 planned agents are consumer-facing**
(5 shopper + 5 companion, `production-roadmap.md:791–919`) and **have no `listing_id` at all**, so
the original limiter would never fire for them. Four of those agents run Sonnet 4.6 — roughly 3× the
input and output cost of Haiku — and they serve **free** users, so their cost lands entirely on
subscription margin. Find-It-For-Me is triggered from the public `/discover` search bar, meaning it
is reachable **unauthenticated**.

Priority raised P2 → P1. The steady-state cost is modest in every realistic adoption scenario; the
reason this is P1 is that the **downside is unbounded** and the current revenue base is ~$100–300/mo.

## User story

As the platform, I want every path that can call a paid LLM to be bounded — per listing, per
consumer, per IP, and in aggregate — so that no owner, no visitor, and no abusive script can run up
an unbounded bill and erode the ~95% subscription gross margin.

## Acceptance criteria

### 1. Business-agent cap (original scope, retained)
- A server-side limiter blocks AI generation once a listing reaches its **tier quota** in a rolling
  30-day window. Enforced in the service layer, not UI-only.
- Count is per `listing_id` (the billable unit).
- Only **successful** generations count; mock-mode calls do not consume budget.
- Quotas come from `aiQuota(tier)` in `lib/stripe/features.ts` — **not** a hardcoded constant.
  Starter 10/mo · Growth 100/mo · Premium 500/mo · Free 0.
  (Supersedes the flat "10 per listing per 24h" in `ai-agent-roadmap.md`; that doc needs updating.)
- A daily burst sub-cap of **10/listing/24h** still applies within the monthly quota, so a single
  day cannot drain a Premium monthly allowance.
- AI remains gated to Starter+ (`canAccess(tier, 'ai_suggestions')`) — quota is in addition to, not
  instead of, tier gating.

### 2. Consumer-agent caps (new — the gap this ticket now closes)
- **Authenticated consumers:** cap per `user_id` per rolling 24h. Default **20 agent calls/day**.
- **Unauthenticated callers:** cap per IP (and per session where available) per rolling 24h. Default
  **5 agent calls/day**, deliberately low — an anonymous visitor gets a taste, then is asked to sign in.
- Conversational agents (Life Shift Advisor, Experience Builder) additionally cap **turns per
  session** (default 10) — an unbounded conversation is the single most expensive shape, because
  context grows with every turn.
- Consumer caps are enforced in the same service layer as the business cap; no agent may call the
  Anthropic client without passing through a limiter.

### 3. Global spend ceiling and kill-switch (new)
- A **monthly platform-wide spend ceiling** measured from `ai_generation_requests` token columns
  priced at the model's published rates. Default ceiling: **$500/mo**, configurable via env.
- At **80%** of ceiling: alert the ops channel (reuse the existing incident/alert path).
- At **100%**: automatically disable all non-admin AI — flip the same code path as
  `NEXT_PUBLIC_AI_FEATURES_ENABLED=false` — and page. Degradation must be graceful, matching the
  existing "AI feature hidden / fallback shown" failure behavior in Ticket 079.
- A **manual kill-switch** that takes effect without a deploy. The existing flag is
  `NEXT_PUBLIC_*`, which is **baked in at build time** and therefore unusable as an incident
  control — this ticket must add a server-side runtime flag (DB row or env read at request time).

### 4. Cost observability
- Every AI call records `model`, `request_tokens`, `response_tokens`, `cached_tokens`, and computed
  `cost_cents` in `ai_generation_requests` (extend the table; it already carries token columns).
- A `subscription-report`-style ops query surfaces spend per model, per agent, and per tier, so the
  `[Assumption]` cost figures in `pricing-unit-economics.md` can be **replaced with measurements**
  per the no-fabrication rule.

## Out of scope

- Metered/overage billing for AI (revisit once usage data shows demand — quotas first, billing later).
- Per-agent cost attribution beyond the model/agent/tier breakdown above.

## Notes

This is a **cost-control guardrail**, not a feature. Every limit above is cheap to build and must
land before the provider is switched on — retrofitting after a bill spike is the exact failure mode
it prevents. The per-tier quota also does double duty as a **product lever**: `aiQuota` is what makes
Growth and Premium worth their price rather than photo-count upsells (see
`time-to-1m-and-ai-margin-review.md`, Part 3).
