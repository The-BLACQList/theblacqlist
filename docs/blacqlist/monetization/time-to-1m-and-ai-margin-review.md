# Time to $1M and AI Margin Review — The BLACQList

**Last updated:** 2026-07-27
**Purpose:** Answers two founder questions — (1) at current state and pricing, how long to
$1,000,000, and (2) with all the planned AI capability, is the pricing model still conducive to
profit. Companion to `pricing-unit-economics.md`, which covers per-tier COGS and margin.

Every number is labeled per the no-fabrication rule: `[Research — source]` = sourced;
`[Assumption]` = modeled, not measured; `[Unknown]` = needs instrumentation.

**Read this first:** almost everything below is modeled. Billing is not live, so churn, CAC, and
LTV are all `[Unknown]`. These are planning inputs for deciding what to build and price — not
performance figures, and not for external use.

---

## 1. Starting position

`[Research — ops/status.md, mission-control manifest, git log]`

- ~254 curated published listings (151 ATL / 52 CHI / 51 HOU)
- Deployed, QA-signed-off MVP behind a "coming soon" gate; soft-launch GO recorded 2026-06-30
- 4-tier Stripe billing committed (`d32ba9d`, `feat/stripe-subscriptions-v1`), **not live in prod**
- Revenue recorded to date: **~$100–300/mo** `[Research — 2026-07-20 status check-in]`
- Blocking gate: attorney sign-off on legal pages

**Every timeline below counts from billing go-live, not from today.**

---

## 2. How long to $1,000,000

### Subscribers required

`[Assumption]` Blended ARPU depends on tier mix and annual adoption (annual is ~20% off, and at
~40% adoption drags effective ARPU by ~8%):

| Ladder | Mix (S/G/P) | Blended/mo | Blended/yr | **Subs for $1M ARR** |
|---|---|---|---|---|
| As built before 2026-07-27 | 75 / 20 / 5 | $29.00 | ~$320 | **~3,125** |
| Re-laddered (this change) | 45 / 35 / 20 | $45.50 | ~$502 | **~1,992** |

The re-laddered mix is the point of the 2026-07-27 entitlement change: **a 36% reduction in the
hardest thing the venture has to do, with no change to the $19/$49/$99 price points.**

### Listings required

`[Assumption]` Net free→paid conversion of **3%**. Cross-checked against the venture's own signal:
254 listings producing $100–300/mo implies 3–10 paying subs, i.e. **1.2–4% of listings** — so 3% is
consistent with observed behavior rather than borrowed from a benchmark.

At 3% and the re-laddered ARPU, $1M ARR needs **~66,000 listings**. Against 254 today that is a
**~260x** increase. **Distribution is the binding constraint — not price, and not margin.**

### Timelines

`[Assumption]` Three paths:

| Path | $1M cumulative | $1M ARR |
|---|---|---|
| Organic only (~10%/mo listing growth, no spend) | ~5.5 yrs | ~5.3 yrs — realistically never; sustaining 10%/mo for 5 years is a 400x that no directory achieves unaided |
| Funded operator (bulk import + city-by-city + light sales) | ~2.8–3.5 yrs | ~3.5–4.5 yrs |
| **Subs + sponsorship + boosts (recommended)** | **~2.5–3 yrs** | **~3–4 yrs** |

Illustrative year-3 composition of the recommended path: ~2,000 subs × $502 = ~$1.0M ARR, of which
subscriptions ~$770K, sponsorship ~$180K (≈30 concurrent sponsors × ~$500/mo), boosts ~$50K.

### Why sponsorship matters more than it looks

Sponsored Spotlight is **$299–999/mo** `[Research — monetization-spec.md, /for-sponsors]`.
Sponsorship revenue scales with **audience**, not with the 3% of listings that convert to paid, and
carries near-zero incremental COGS. It reaches six figures far earlier than subscriptions can. It
is also the natural home for consumer-AI cost — see §3.

### Why marketplace is not a near-term lever

At the reconciled **8%** take rate, $1M/yr of marketplace revenue requires **$12.5M GMV/yr**. The
stated V2 done-when target is **$10K total GMV** `[Research — ruthless-mvp-and-roadmap.md]`. That is
three orders of magnitude apart. Marketplace is a long-dated line — real, but not the path to the
first $1M.

### The constraint that actually sets the timeline

`[Assumption]` at 5% monthly churn (mid-point of the venture's own 2/5/8% model):

| Tier | LTV | Max CAC at 3:1 | Can a human sell it? |
|---|---|---|---|
| Starter $19 | $380 | **$120** | **No** — human-sold SMB CAC runs $300–800 |
| Growth $49 | $980 | $327 | Barely |
| Premium $99 | $1,980 | $660 | Yes |

**Starter is a self-serve-only product.** Any acquisition motion involving a human conversation has
to sell Growth or Premium to clear 3:1. Before the re-ladder, the pricing page funnelled everyone
into Starter — the one tier that cannot be acquired at a profit. That is the single biggest reason
the timeline was 4–5 years rather than 3.

**Implication for the plan:** self-serve claim → Starter is the volume engine; any outbound or
partner-led motion must lead with Growth. Do not build a sales motion around $19.

---

## 3. Is the pricing model still conducive to profit with all the AI?

**Yes on cost. No on strategy — and the strategy problem was the expensive one.**

### What was already right

`pricing-unit-economics.md` is correct for the surface it modeled: business-side AI, gated to paid
tiers, Haiku 4.5, token-bounded prompts, capped per listing — **<$0.10/sub/mo** against ~95–96%
gross margins. Nothing in this review contradicts that.

### The surface it did not model

`[Research — production-roadmap.md:791–919]` **10 of the ~22 planned agents are consumer-facing and
serve users who pay nothing**: 5 shopper (Find-It-For-Me, Support Local Tonight, Gift Finder, Event
Planner, Community Spend) and 5 companion (Life Shift Advisor, Everyday Basket Builder, Local Life
Concierge, Provider Matcher, Experience Builder). **Four run Sonnet 4.6** ($3/$15 per 1M) rather
than Haiku 4.5 ($1/$5 per 1M).

Three properties make this different from the business-side agents:

1. **No `listing_id`** — so the original ticket-104 limiter would never have fired for them.
2. **Reachable unauthenticated** — Find-It-For-Me triggers from the public `/discover` search bar.
3. **Cost scales with free traffic**, while revenue scales with the 3% who pay.

`[Assumption]` per-call cost with directory retrieval context (~15K in / ~1K out): Haiku ~$0.02,
Sonnet ~$0.06. Conversational agents (Life Shift, Experience Builder) run 6–10 turns with growing
context: **$0.30–0.80/session**.

### Sensitivity

`[Assumption]` at $1M ARR (~2,000 subs), Starter COGS baseline ~$1.00:

| Scenario | Consumer AI/mo | Added COGS/sub | Starter gross margin |
|---|---|---|---|
| Conservative — 5% of active consumers, once/mo | ~$200 | $0.10 | ~94% |
| Moderate — 25% adoption | ~$2,500 | $1.25 | ~88% |
| AI as the front door — NL search on `/discover` | ~$4,800 | $2.40 | ~82% |
| **Unauthenticated + uncapped abuse** | ~$20,000 | $10.00 | **~42%** |

**The margin holds in every realistic case.** The reason this still required action is the last
row: the downside is *unbounded*, and against a current base of $100–300/mo a single abuse day is
existential. The fix is caps, not price.

### The strategic problem

Before this change, AI was **given away to the side that doesn't pay and withheld from the side that
does**: consumer agents free and ungated on the more expensive models, while `ai_suggestions`
unlocked at Starter alongside everything else. AI therefore added COGS across the free base and
**zero ARPU** across the paid ladder.

Given §2 — that ARPU is what sets the timeline — the most expensive capability on the roadmap was
working *against* the $1M date. **AI generation volume is now a tier lever** (`aiQuota` in
`lib/stripe/features.ts`: Free 0 · Starter 10/mo · Growth 100/mo · Premium 500/mo), which is what
turns AI from a cost center into the reason Growth and Premium are worth their price.

### Attribute consumer-AI cost to sponsorship, not subscriptions

Provider Matcher and Find-It-For-Me are **recommendation surfaces**. A recommendation slot is
inventory — which is exactly what Sponsored Spotlight already sells at $299–999/mo. Consumer-agent
cost belongs against sponsorship revenue in the P&L, not against subscription margin. Modeled that
way the consumer agents are a **cost of goods for the ad product**, and they become a reason
sponsorship is worth more, rather than a drag on the ~95% subscription margin.

---

## 4. What changed on 2026-07-27

| Change | Where |
|---|---|
| Ladder rebuilt — 26 gated features across 3 paid tiers, plus per-field limits | `lib/stripe/features.ts` |
| AI quota became a tier lever (0 / 10 / 100 / 500 per month) | `lib/stripe/features.ts` (`aiQuota`) |
| Pricing copy rewritten to match the entitlements | `lib/stripe/plans.ts` |
| Entitlement matrix + monotonicity tests | `tests/feature-gating.test.ts` |
| Default model corrected `claude-opus-4-7` → Haiku 4.5 (~15x cost error) | `tickets/079-anthropic-api-integration.md` |
| Guardrails extended to consumer agents, unauthenticated callers, and a global spend ceiling | `tickets/104-ai-generation-rate-limit.md` |
| Marketplace take rate reconciled to 8% (proposed) | `monetization-spec.md`, `PRD.md`, `ruthless-mvp-and-roadmap.md` |

Prices did **not** change. No new Stripe products or prices are required.

---

## 5. What is still unknown, and how to close it

Do not report any of these until measured:

- **Churn** — from Stripe cancellations once billing is live. Model at 2% / 5% / 8% monthly.
- **CAC** — marketing spend ÷ paid conversions, split self-serve vs assisted.
- **LTV:CAC** — target ≥ 3:1; CAC payback < 12 months.
- **Actual free→paid conversion** — the 3% assumption above is the load-bearing number in every
  timeline. Instrument it first; if it lands at 1.5% the listing requirement doubles.
- **Actual tier mix** — the re-ladder's entire value rests on shifting mix toward Growth/Premium.
  Measure it at 30/60/90 days and re-ladder again if Growth is not winning.
- **Real AI cost per agent** — ticket 104 adds `cost_cents` to `ai_generation_requests` specifically
  so the `[Assumption]` figures in §3 can be replaced with measurements.

The `subscription-report` and `metrics-pull` ops skills already query Supabase subscription data —
extend them rather than building new reporting.

---

## Sources

- `monetization/pricing-unit-economics.md` (COGS, margin, break-even)
- `monetization/monetization-spec.md` (tiers, add-ons, take rate)
- `production/production-roadmap.md` §3.4 and :791–919 (agent roster, model assignments)
- `ai/ai-agent-roadmap.md` (AI state, phases, non-negotiables)
- `product/ruthless-mvp-and-roadmap.md` (V2 done-when targets)
- `lib/stripe/plans.ts`, `lib/stripe/features.ts` (canonical prices and entitlements)
- Anthropic pricing (Haiku 4.5 $1/$5 per 1M; Sonnet $3/$15 per 1M); Stripe (2.9% + $0.30)
