# AI Agent Roadmap — The BLACQList

**Date:** 2026-05-11  
**Status:** Foundation phase active

---

## Phase Overview

| Phase | Timeline | What changes |
|---|---|---|
| **Foundation** | Now (pre-V2) | Data model, checklist, prompt templates, placeholder UI — no AI API calls |
| **V2 Mock** | V2 sprint start | Hardcoded mock suggestions in UI; approval workflow exercised end-to-end |
| **V2 Provider** | V2 mid-sprint | Anthropic API connected; real generation; audit log live |
| **V3 Autonomous** | V3 sprint | Background agent jobs; `ai_agent_runs` table; continuous curation |

---

## Phase 1: Foundation (Current)

**What is built:**
- `ai_suggestions` and `ai_generation_requests` tables (migration 20260511000004)
- `lib/ai/checklist.ts` — rule-based page completeness checker (12 checks, 100-point scale)
- `lib/ai/prompts.ts` — prompt template constants (no API calls)
- `/dashboard/pages/[entityId]/ai-suggestions` — owner-facing checklist + suggestion placeholder
- `/admin/ai-tools` — admin status page + suggestion review table placeholder

**What does NOT exist yet:**
- No calls to Anthropic or any other AI provider
- No mock suggestions seeded (table is empty)
- No approval action buttons (coming in V2 Mock)
- `ANTHROPIC_API_KEY` not set in any environment

**Gates to proceed to V2 Mock:**
1. `ai_suggestions` table in production schema
2. RLS policy verified: owners see only their own listing's suggestions
3. Owner dashboard AI Suggestions page accessible and rendering checklist correctly
4. Admin AI Tools page accessible and rendering stat cards

---

## Phase 2: V2 Mock Mode

**What changes:**
- `lib/ai/mock-responses.ts` added — hardcoded mock suggestion payloads per agent type
- Server Action `lib/actions/ai/generateSuggestion.ts` created — calls mock provider, inserts row into `ai_suggestions`
- "Request suggestion" buttons added to owner AI Suggestions page (triggers mock generation)
- Approval UI added: "Approve" / "Reject" buttons on each suggestion row
- Admin AI Tools page shows real suggestion rows from the table

**Agent types active in mock mode:**
- `listing_optimizer` (Listing Optimizer)
- `seo_coach` (SEO & Visibility Coach)
- `social_caption` (Social Caption — Instagram only in mock)
- `analytics_explainer` (Analytics Explainer)

**Mock provider behavior:**
- `lib/ai/provider.ts` exports `generate(input)` — in mock mode returns a hardcoded response matching the agent type
- `generate()` always inserts a row into `ai_generation_requests` with `provider = 'mock'`
- No network call; deterministic output for testing

**Gates to proceed to V2 Provider:**
All 6 gates must be cleared:

| Gate | What is verified |
|---|---|
| 1. Approval workflow tested | Owner can approve → applied, reject → rejected; states persist correctly |
| 2. Privacy review | Code audit confirms no PII fields in any prompt assembly function |
| 3. Rate limiting implemented | Max 10 AI generation requests per listing per 24 hours enforced at service layer |
| 4. Audit log verified | Every mock generation creates a `ai_generation_requests` row |
| 5. Owner approval UI complete | No suggestion status changes without explicit owner or admin action |
| 6. `ANTHROPIC_API_KEY` env var ready | Set in Vercel staging environment; not in codebase |

---

## Phase 3: V2 Provider Integration

**What changes:**
- `lib/ai/provider.ts` updated: `generate()` calls Anthropic Messages API when `process.env.ANTHROPIC_API_KEY` is set; falls back to mock if not set
- `ai_generation_requests.provider` flips from `'mock'` to `'anthropic'`
- `request_tokens` and `response_tokens` populated from API response
- Error handling: failed API calls set `status = 'failed'`; no suggestion row created on failure
- Rate limiting: Redis (Upstash) or DB-based counter enforcing 10 requests/listing/24h

**Model selection:** Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) for all suggestion agents — lowest cost, sufficient quality for short-form copy. Switch to Sonnet for guide writing and analytics summaries.

**Agent deployment order (V2 provider):**

| Priority | Agent | Rationale |
|---|---|---|
| 1 | SEO & Visibility Coach | Highest owner value; bounded output (title + description) |
| 2 | Listing Optimizer | Drives page completeness improvements |
| 3 | Social Caption | High-frequency, low-risk use case |
| 4 | Analytics Explainer | Low PII risk; delights owners |
| 5 | Review Response | Moderate risk (review text as input); requires careful testing |
| 6 | Page Builder | Complex multi-field output; requires creation flow integration |
| 7 | Marketplace Merchandising | Depends on marketplace being in active use |
| 8 | Support Local Tonight | Shopper-side; requires good listing density |
| 9 | Gift Finder | Shopper-side; requires marketplace products |
| 10 | Directory Curator | Admin background job; higher complexity |
| 11 | Collection Builder | Depends on collection editorial workflow |
| 12 | Social Media Agent | Admin; lower urgency |
| 13 | Verification Support | Admin; sensitive — requires additional review |
| 14 | Guide Writer | Admin; depends on guide editor integration |

---

## Phase 4: V3 Autonomous Agents

**What changes:**
- `ai_agent_runs` table added (V3 migration)
- Supabase Edge Functions or cron jobs trigger agents on schedule (nightly, weekly)
- Directory Curator runs nightly; flags low-quality listings automatically
- Collection Builder runs weekly; surface suggestions for admin collections
- Social Media Agent drafts posts for newly verified listings automatically
- All autonomous runs logged in `ai_agent_runs` with full input/output/token audit

**V3 agent operations:**

| Agent | Frequency | Trigger |
|---|---|---|
| Directory Curator | Nightly 01:00 UTC | Cron job — all published listings |
| Collection Builder | Weekly Sunday 03:00 UTC | Cron job — all active collections |
| Social Media Agent | On event | Webhook — listing trust_tier changes to 'verified' |
| Community Spend | On demand | User-initiated from spend dashboard |
| Find-It-For-Me | On demand | User search query |
| Event Planner | On demand | User-initiated CTA |

---

## Agent × Phase Matrix

| Agent | Foundation | V2 Mock | V2 Provider | V3 |
|---|---|---|---|---|
| Find-It-For-Me | — | — | — | ✓ |
| Support Local Tonight | — | — | ✓ | — |
| Gift Finder | — | — | ✓ | — |
| Event Planner | — | — | — | ✓ |
| Community Spend | — | — | — | ✓ |
| Page Builder | — | ✓ | ✓ | — |
| Listing Optimizer | Checklist only | ✓ | ✓ | — |
| SEO & Visibility Coach | — | ✓ | ✓ | — |
| Social Caption | — | ✓ | ✓ | — |
| Marketplace Merchandising | — | — | ✓ | — |
| Review Response | — | ✓ | ✓ | — |
| Analytics Explainer | — | ✓ | ✓ | — |
| Directory Curator | — | — | ✓ | ✓ (automated) |
| Verification Support | — | — | ✓ | — |
| Collection Builder | — | — | ✓ | ✓ (automated) |
| Guide Writer | — | — | ✓ | — |
| Social Media Agent | — | — | ✓ | ✓ (automated) |

---

## Dependency Map

```
Foundation
  ↓ (ai_suggestions table live + approval workflow working)
V2 Mock
  ↓ (all 6 gates cleared)
V2 Provider (Haiku/Sonnet)
  ↓ (marketplace active + spend data flowing)
V3 Autonomous
```

No phase can be skipped. The gates exist to prevent PII exposure and ensure the approval workflow is exercised before real AI content reaches users.
