# Pricing Unit Economics — The BLACQList

**Last updated:** 2026-07-01
**Purpose:** Cost-and-margin rationale behind the 4-tier subscription pricing. Fills the gap the
`monetization-spec.md` left (it defined tiers but no COGS/margin/break-even). Method follows the
whole-9 venture-studio `pricing-unit-economics` playbook.

Every number is labeled per the no-fabrication rule: `[Research — source, date]` = sourced;
`[Assumption]` = modeled, not measured; `[Unknown]` = needs instrumentation.

---

## Tiers (canonical)

| Tier | Monthly | Annual | Annual vs 12× monthly |
|---|---|---|---|
| Free | $0 | $0 | — |
| Starter | $19 | $182/yr | 20.2% off |
| Growth | $49 | $470/yr | 20.1% off |
| Premium | $99 | $950/yr | 20.0% off |

Annual is set to whole-dollar amounts that each round to **20% off** (`annualSavingsPct` in
`lib/stripe/plans.ts`). Whole-9 target for annual discount is 15–20% `[Research — subscription-membership-track.md]`.

---

## Cost model

### Fixed monthly platform cost (amortized across all paid subs)
`[Research — business/care-plans-and-ops.md; architecture/tech-stack-decision.md, 2026]`

| Service | Now | At scale |
|---|---|---|
| Supabase Pro | $25 | $25+ (egress/storage scale) |
| Vercel Pro | ~$20 | ~$20 |
| Sentry | $0 (free tier) | ~$26 |
| Resend | $0 (≤3k emails/mo) | $20 (50k) |
| Domain | ~$1.25 | ~$1.25 |
| **Total** | **~$46** | **~$92** |

Use **~$90/mo** as the conservative fixed-cost figure.

### Variable cost per paid subscriber (monthly billing)

| Driver | Starter $19 | Growth $49 | Premium $99 | Source |
|---|---|---|---|---|
| Stripe (2.9% + $0.30) | $0.85 | $1.72 | $3.17 | `[Research — Stripe, 2026]` |
| AI (Haiku 4.5, gated Starter+, capped) | <$0.10 | <$0.10 | <$0.10 | `[Assumption]` — mock today; $1/$5 per 1M on token-bounded prompts ≈ $0.0025/gen |
| Photo storage/egress | ~$0.02 | ~$0.03 | ~$0.05 | `[Assumption]` — Supabase ~$0.021/GB/mo; 10/20/50 photos |
| Transactional email | negligible | negligible | negligible | `[Assumption]` |
| **COGS (typical)** | **~$1.00** | **~$1.90** | **~$3.55** | |

**Business-side AI is not a margin threat.** It is in mock mode today (no provider connected), gated
to paid tiers, and — when live — runs Claude Haiku 4.5 on short, token-bounded prompts, so it costs
cents/paid-listing/mo. The only genuinely uncapped per-listing driver is **Premium's photos**, which
is why Premium carries a hard cap of 50 (see Guardrails).

### Consumer-side AI — the surface this table does not cover

`[Research — production-roadmap.md:791–919]` The table above models the **business** agents only.
**10 of the ~22 planned agents are consumer-facing and serve free users** (5 shopper + 5 companion),
and **four run Sonnet 4.6** ($3/$15 per 1M) rather than Haiku. Their cost has three properties the
per-subscriber model above cannot represent:

1. They have **no `listing_id`**, so a per-listing cap never fires for them.
2. Find-It-For-Me is reachable **unauthenticated** from the public `/discover` search bar.
3. Cost scales with **free traffic**; revenue scales with the ~3% of listings that pay.

`[Assumption]` ~15K in / ~1K out with retrieval context ⇒ Haiku ~$0.02/call, Sonnet ~$0.06/call;
multi-turn conversational agents $0.30–0.80/session.

**Do not amortize this into the per-subscriber COGS above.** Consumer agents are recommendation
surfaces, and a recommendation slot is inventory — the same inventory Sponsored Spotlight sells at
$299–999/mo. Model consumer-AI spend as **cost of goods for the sponsorship product**, not as a
drag on subscription margin. Full analysis and sensitivity table:
`monetization/time-to-1m-and-ai-margin-review.md` §3.

---

## Gross margin & break-even

| Tier | Price/mo | COGS/mo | **Gross margin** | Contribution margin |
|---|---|---|---|---|
| Starter | $19 | ~$1.00 | **~95%** | ~$18 |
| Growth | $49 | ~$1.90 | **~96%** | ~$47 |
| Premium | $99 | ~$3.55 | **~96%** | ~$95 |

All tiers clear the whole-9 SaaS gross-margin band (floor 50%, strong 70–80%)
`[Research — FINANCE_ASSUMPTION_STANDARDS.md]` by a wide margin.

**Break-even on fixed cost:** ~$90/mo ÷ contribution margin ⇒ **~5 Starter, ~2 Growth, or ~1
Premium** subscriber covers all fixed platform cost. Every paid sub beyond that is ~95% profit.

**Annual billing improves margin further** — one Stripe fee per year instead of twelve — and lowers
churn `[Research — subscription-membership-track.md]`, which is why annual is discounted, not penalized.

---

## LTV / CAC — not yet measurable

`[Unknown]` — churn rate and customer-acquisition cost are not instrumented yet (billing isn't live).
Once subscriptions run, instrument:
- **Churn** from Stripe subscription cancellations (target: model at 2% / 5% / 8% monthly).
- **CAC** from marketing spend ÷ paid conversions.
- **LTV** = ARPU ÷ monthly churn; target **LTV:CAC ≥ 3:1**, **CAC payback < 12 mo**
  `[Research — whole-9 pricing-unit-economics]`.

The `subscription-report` / `metrics-pull` ops skills already query Supabase subscription data — extend
them to compute these once there is live data. **Do not report churn/LTV/CAC numbers until measured.**

---

## Margin guardrails (the "profitable including AI" answer)

1. **Premium photo hard cap = 50** (`TIER_LIMITS.premium.photos` in `lib/stripe/features.ts`). Reads
   as "unlimited" to owners but bounds the one real storage/egress tail.
2. **Per-tier AI quota** (`aiQuota` in `lib/stripe/features.ts`): Free 0 · Starter 10/mo ·
   Growth 100/mo · Premium 500/mo, with a 10/listing/24h burst sub-cap. Required **before any live
   AI provider is connected** — Ticket 104. Default model Haiku 4.5 (`DEFAULT_MODEL` in
   `lib/ai/client.ts`); Sonnet is a deliberate per-agent escalation, never a default.
   This cap is both a cost guardrail and the pricing lever that differentiates Growth and Premium.
3. **Consumer-agent caps** — per `user_id` (20/day), per IP for unauthenticated callers (5/day), and
   a per-session turn cap on conversational agents. Ticket 104. Without these the per-listing cap
   leaves the entire consumer surface unbounded.
4. **Global monthly spend ceiling with kill-switch** — alert at 80%, auto-disable non-admin AI at
   100%. Note the existing `NEXT_PUBLIC_AI_FEATURES_ENABLED` flag is **baked in at build time** and
   is therefore not usable as an incident control; Ticket 104 adds a server-side runtime flag.
5. **Dunning is handled**: the payment-failed email + `past_due` grace (tier retained during retries)
   already shipped, covering the typical 5–15% monthly card-failure rate `[Research — subscription-membership-track.md]`.

---

## Conclusion

Pricing is **profitable at every tier** — ~95% gross margin, break-even at ~1–5 paid subs — and AI
does not change that. No price increase was required for profitability; the $99 Premium tier was added
to match the documented spec, anchor the lineup, and capture top-end willingness to pay. The open work
is **measuring** churn/CAC/LTV once billing is live, not adjusting the price points.

**Update 2026-07-27.** Two things this conclusion did not account for, neither of which changes a
price point:

- **Profitable per subscriber ≠ profitable fast enough.** Margin was never the constraint; blended
  ARPU is, because it sets how many subscribers $1M requires. With every gated feature unlocking at
  Starter, Growth and Premium had no reason to exist and the ladder behaved like a $19 product with
  two decoy prices. The 2026-07-27 entitlement re-ladder raises modeled blended ARPU from ~$320/yr
  to ~$502/yr — cutting subscribers needed for $1M ARR from ~3,125 to ~1,992 — **with prices
  unchanged**. See `time-to-1m-and-ai-margin-review.md`.
- **The AI cost model covered only half the agent roster** (see the consumer-side section above).

The original claim stands where it was scoped: per-tier margin is healthy and AI does not threaten
it. The corrections are about ARPU and about which AI surface gets counted.

---

## Sources

- `business/care-plans-and-ops.md`, `business/pricing-and-packaging.md`, `business/market-research.md` (cost anchors)
- `architecture/tech-stack-decision.md` (infra costs, Anthropic/Haiku decision)
- `docs/blacqlist/ai/ai-agent-roadmap.md`, `ai/ai-feature-spec.md` (AI model, gating, planned cap)
- whole-9 venture-studio: `pricing-unit-economics` skill, `subscription-membership-track.md`, `FINANCE_ASSUMPTION_STANDARDS.md`
- Stripe pricing (2.9% + $0.30); Anthropic Claude pricing (Haiku 4.5 $1/$5 per 1M; Sonnet 5 $3/$15 per 1M)
