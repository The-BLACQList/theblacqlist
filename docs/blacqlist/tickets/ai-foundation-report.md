# AI Foundation — Build Report

**Date:** 2026-05-11  
**Status:** Foundation complete — no provider connected

---

## What Was Built

### Data Model

| Table | Description |
|---|---|
| `ai_suggestions` | AI-generated content rows awaiting human approval. Includes `suggestion_type`, `agent_type`, `suggestion_text`, `status` lifecycle (pending → approved → applied / rejected / expired), `reviewed_by`, `applied_at`. |
| `ai_generation_requests` | Audit log for every AI generation call (mock or real). Logs `provider`, `model`, token counts, `status`, `error_message`. Full prompt text is **never** stored. |

**Migration:** `supabase/migrations/20260511000004_ai_foundation.sql`

RLS:
- `ai_suggestions`: owners can SELECT their own listing's pending, approved, and applied suggestions
- `ai_generation_requests`: no public policy — admin access via service role only

---

### Agent Definitions (17 agents across 3 categories)

All 17 agents defined and specified in `docs/blacqlist/ai/ai-feature-spec.md`.

**Shopper-side (5):** Find-It-For-Me, Support Local Tonight, Gift Finder, Event Planner, Community Spend  
**Business-side (7):** Page Builder, Listing Optimizer, SEO & Visibility Coach, Social Caption, Marketplace Merchandising, Review Response, Analytics Explainer  
**Admin/platform (5):** Directory Curator, Verification Support, Collection Builder, Guide Writer, Social Media Agent

---

### Files Created

| File | Description |
|---|---|
| `docs/blacqlist/ai/ai-feature-spec.md` | Full spec for all 17 agents: purpose, inputs, outputs, privacy constraints, phase |
| `docs/blacqlist/ai/ai-agent-roadmap.md` | Phase map: Foundation → V2 Mock → V2 Provider → V3 Autonomous; 6 phase gates before real API |
| `docs/blacqlist/ai/ai-safety-and-approval-plan.md` | Approval workflow, privacy guardrails, output validation, GDPR notes, open risks |
| `supabase/migrations/20260511000004_ai_foundation.sql` | Creates `ai_suggestions` and `ai_generation_requests` tables with RLS |
| `lib/ai/prompts.ts` | 11 prompt template constants (string only — no API calls); `AGENT_PROMPT_MAP` lookup |
| `lib/ai/checklist.ts` | Rule-based 12-check page optimization function; zero external dependencies; returns score + grade |
| `app/dashboard/pages/[entityId]/ai-suggestions/page.tsx` | Owner-facing AI suggestions page: checklist score + item list + AI placeholder |
| `app/admin/ai-tools/page.tsx` | Admin AI tools page: system status + 4 stat cards + suggestions table + prompt library |

### Files Modified

| File | Change |
|---|---|
| `components/dashboard/DashboardSidebar.tsx` | Added "AI Suggestions" nav item to page-specific nav (after Analytics) |
| `components/admin/AdminSidebar.tsx` | Added "AI Tools" nav item (uses `Sparkles` icon from lucide-react) |

---

## Page Optimization Checklist (No AI Required)

The checklist in `lib/ai/checklist.ts` scores 12 attributes of a listing against its current data. Zero external calls. Computed entirely from data already fetched for the owner dashboard.

| Check | Category | Weight |
|---|---|---|
| Tagline present | Required | 8 |
| Description ≥ 100 chars | Required | 12 |
| Logo/profile image uploaded | Required | 10 |
| Cover image uploaded | Recommended | 8 |
| Gallery image present | Recommended | 6 |
| CTA configured | Recommended | 10 |
| Phone or website present | Recommended | 8 |
| Business hours set | Recommended | 8 |
| Social link present | Engagement | 6 |
| Service listed | Engagement | 8 |
| Meta title set | SEO | 8 |
| Meta description set | SEO | 8 |

Score ≥ 80 → "Strong" (green). Score ≥ 50 → "Good" (amber). Score < 50 → "Needs work" (red).

---

## Prompt Templates (No API Calls)

11 templates stored in `lib/ai/prompts.ts`. All are string constants with `{{variable}}` placeholders. No API calls, no model invocations.

Templates defined:
1. `LISTING_DESCRIPTION` — business description (150–250 words)
2. `SEO_TITLE` — meta title (≤60 chars)
3. `SEO_DESCRIPTION` — meta description (140–160 chars)
4. `SOCIAL_CAPTION_INSTAGRAM` — Instagram caption (≤150 chars + hashtags)
5. `SOCIAL_CAPTION_FACEBOOK` — Facebook post (≤280 chars)
6. `SOCIAL_CAPTION_X` — X/Twitter post (≤280 chars)
7. `REVIEW_RESPONSE` — review response draft (≤300 chars)
8. `ANALYTICS_SUMMARY` — 30-day performance narrative
9. `COLLECTION_SUGGESTION` — collection membership suggestion
10. `GUIDE_SECTION` — city guide section draft
11. `SOCIAL_POST_ADMIN` — admin social announcement

---

## What Remains Manual / Not Yet Built

| Item | Status | Phase |
|---|---|---|
| Real AI API calls | Not built — no provider connected | V2 Provider |
| Mock suggestion generation UI | Not built | V2 Mock |
| Approve / Reject action buttons | Not built | V2 Mock |
| "Apply to listing" button | Not built | V2 Mock |
| `lib/ai/provider.ts` wrapper | Not built | V2 Mock |
| `lib/ai/mock-responses.ts` | Not built | V2 Mock |
| `lib/actions/ai/generateSuggestion.ts` | Not built | V2 Mock |
| Suggestion expiry job (7 days) | Not built | V2 |
| Rate limiting (10/listing/24h) | Not built (required before V2 Provider) | V2 |
| `ai_agent_runs` table | Not built | V3 |
| Autonomous background agent jobs | Not built | V3 |
| Admin suggestion approve/reject UI | Not built | V2 Mock |

---

## Privacy Risks

| Risk | Severity | Current mitigation |
|---|---|---|
| PII in prompts via listing description field (phone/email typed into description) | High | Prompt assembly must strip email/phone patterns — function not yet written; gate 2 of V2 phase requires privacy code audit |
| Review text passed to provider — reviewer identity leaked | Medium | Review Response Agent spec explicitly excludes reviewer display_name and user_id; not enforced in code until prompt assembly is written |
| User_id included in AI audit log | Low | `ai_generation_requests.created_by` stores operator user_id (admin or owner who clicked generate), not the end-user being analyzed |
| Verification documents passed to AI | Low | Verification Support Agent spec explicitly excludes documents — metadata only; enforced at spec level |
| Spend data at individual level | Medium | Community Spend Agent spec requires aggregates only — not enforced in code until agent is built |

**Action required before V2 Provider:** Full privacy code audit of all prompt assembly functions (phase gate 2).

---

## Future Provider Integration Plan

### Phase gates (must all pass before first real API call)

1. `ai_suggestions` table + RLS in production ✓ (migration 20260511000004)
2. Privacy code audit — confirm zero PII in prompt assembly functions ✗ (not yet written)
3. Rate limiting: 10 requests/listing/24h ✗ (not yet implemented)
4. `ai_generation_requests` audit log writing on every call ✗ (provider.ts not yet built)
5. Approval UI complete — owner must click Approve then Apply ✗ (not yet built)
6. `ANTHROPIC_API_KEY` in Vercel staging environment ✗ (not configured)

### When gates are cleared

1. Build `lib/ai/provider.ts` with mock fallback
2. Add `lib/ai/mock-responses.ts`
3. Build `lib/actions/ai/generateSuggestion.ts`
4. Add approval UI to `/dashboard/pages/[entityId]/ai-suggestions`
5. Test full lifecycle: generate → pending → approve → applied
6. Set `ANTHROPIC_API_KEY` in Vercel staging
7. Enable real generation for SEO Coach first (lowest risk agent)
8. Monitor `ai_generation_requests` for token usage and errors

---

## Approval Workflow Design

```
Owner or admin triggers generation
  → lib/ai/provider.ts :: generate()
    → INSERT ai_generation_requests (before suggestion)
    → INSERT ai_suggestions (status = 'pending')
  → Owner sees suggestion in /dashboard/pages/[entityId]/ai-suggestions
    → Clicks "Approve"
      → status → 'approved'
    → Clicks "Apply to [field]"
      → listing field updated
      → status → 'applied', applied_at set
    → Clicks "Reject"
      → status → 'rejected' (retained for audit)
  → After 7 days without action
    → Scheduled job sets status → 'expired'
```

**No content is ever published without the owner clicking Apply.** This is enforced at the Server Action layer — the apply action verifies `listing.owner_user_id = auth.uid()` independent of RLS.

---

## Next Recommended Tickets

1. **Build `lib/ai/provider.ts` and mock responses** — mock generation function + `lib/ai/mock-responses.ts` with sample outputs per agent type
2. **Build `lib/actions/ai/generateSuggestion.ts`** — server action that calls provider, inserts audit + suggestion rows, enforces rate limit
3. **Owner approval UI (V2 Mock)** — Approve / Reject / Apply buttons on `/dashboard/pages/[entityId]/ai-suggestions`
4. **Suggestion expiry job** — Supabase Edge Function or cron that sets `status = 'expired'` for pending suggestions > 7 days old
5. **Privacy code audit** — review all prompt assembly functions; verify zero PII before V2 Provider phase
6. **Rate limiting** — max 10 AI generation requests per listing per 24 hours
7. **Admin suggestion review UI** — allow admin to approve/reject suggestions from the admin AI Tools page
8. **Connect Anthropic API (V2 Provider)** — update `lib/ai/provider.ts` to call API when `ANTHROPIC_API_KEY` is set; deploy SEO Coach first
