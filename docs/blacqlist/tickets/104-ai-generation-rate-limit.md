# Ticket 104 — AI generation rate limit (pre-AI-launch margin guardrail)

**Phase:** AI (Phase 15) · **Priority:** P2 · **Status:** Draft
**Gate:** must ship **before** any live AI provider (`ANTHROPIC_API_KEY`) is connected.
**Related:** `docs/blacqlist/monetization/pricing-unit-economics.md` (guardrails), `docs/blacqlist/ai/ai-agent-roadmap.md`

---

## User story

As the platform, I want AI generation capped per listing per day, so that a single owner cannot run
up an unbounded LLM bill and erode the ~95% subscription gross margin once AI is live.

## Why

AI is in mock mode today (no provider), so there is no live spend. When a provider is connected,
AI generation becomes the only per-listing cost that could scale without bound. The roadmap already
specifies the cap (`ai-agent-roadmap.md`: "Max 10 AI generation requests per listing per 24 hours,
enforced at the service layer") but it is **not built**. This ticket builds it.

## Acceptance criteria

- A server-side limiter blocks AI generation once a listing reaches **10 successful generations in a
  rolling 24 hours**. Enforced in the service layer (not UI-only) — the same discipline as the photo
  and review-response gates in `lib/stripe/features.ts` usage.
- Count is per `listing_id` (the billable unit), not per user or per IP.
- Only **successful** generations count against the cap; mock-mode calls do not consume budget.
- On limit hit: return a typed, friendly error ("You've reached today's AI limit for this listing —
  try again tomorrow"), not a raw 429.
- AI remains gated to **Starter+** (`canAccess(tier, 'ai_suggestions')`) — the cap is in addition to,
  not instead of, tier gating.
- Default model is **Claude Haiku 4.5**; Sonnet 5 is reserved for low-frequency admin agents.
- The counter uses the existing `ai_generation_requests` table (already records `request_tokens` /
  `response_tokens` / `status` / `created_at` / `listing_id`) — count rows where
  `status = 'succeeded'` and `created_at > now() - interval '24 hours'` — or an Upstash Redis counter
  if a rate-limit service is added. Pick the DB-counter path first (no new dependency).

## Out of scope

- Per-tier differentiated AI limits (all paid tiers share the 10/day cap for now).
- Metered/overage billing for AI (revisit if usage data later shows demand).

## Notes

This is a **cost-control guardrail**, not a feature. It is cheap to build and must land before the
provider is switched on — retrofitting it after a bill spike is the failure mode it prevents.
