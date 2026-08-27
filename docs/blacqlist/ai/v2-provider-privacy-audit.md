# V2-Provider Gate 2 — Privacy Code Audit

**Date:** 2026-08-26
**Auditor:** ops session (`code-maintenance` scope), founder-reviewed at GATE-SPEND
**Gate under review:** V2-Provider gate **2 — Privacy review**, `docs/blacqlist/ai/ai-agent-roadmap.md:75`
**Gate wording, verbatim:** *"Code audit confirms no PII fields in any prompt assembly function."*
**Commit audited:** `main`, working tree clean of AI-layer changes, 2026-08-26 `[Measured — repo, 2026-08-26]`

**Verdict: PASS, with three findings — none of them a leak today, two of them ways a future edit leaks quietly rather than loudly.**

This audit is a prerequisite for the first real provider call. It does not clear gates 1, 5, or 6, and it does not authorize spend.

---

## 1 · Scope — what "any prompt assembly function" turned out to be

The gate asks about prompt assembly functions, plural. There are **three**, and they live in two files:

| Function | File | Role |
|---|---|---|
| `loadGenerateContext()` | `lib/ai/context.ts` | The **only** reader. Turns a `listing_id` into a `GenerateContext`. |
| `buildPromptVars()` | `lib/ai/provider.ts:121` | The **only** function that turns listing data into prompt variables. |
| `fillTemplate()` | `lib/ai/provider.ts:110` | Substitutes `{{placeholders}}`. Handles strings, knows nothing about listings. |

`mockContextOf()` (`provider.ts:136`) is a fourth shaper, but it feeds `lib/ai/mock-responses.ts`, which makes no network call. It is in scope for completeness and reads from the same `GenerateContext`, so it inherits the same allowlist. It is **not** in scope once the paid path is live, because the two branches are mutually exclusive at `provider.ts:253`.

**The audit surface is two files.** That is by design and `context.ts` says so in its own header: *"there is exactly one loader, its select lists are explicit, and the privacy audit (V2-Mock gate 2) is two files: this one and `buildPromptVars`."* An audit you can complete in one reading is an audit that gets re-run when someone changes something.

---

## 2 · The allowlist is enforced by the type system, not by prose

`GenerateContext` (`lib/ai/provider.ts:76–89`) is the safety plan's "Allowed in prompts" list expressed as a TypeScript interface:

```ts
export interface GenerateContext {
  listingName: string
  categoryName: string
  cityName: string
  tagline: string | null
  description: string | null      // sanitized + truncated before use
  pageViews30d: number
  ctaClicks30d: number
  saves30d: number
  shares30d: number
  pageViews7d: number
}
```

Two properties of this shape do the actual work:

1. **There is no index signature.** A field cannot arrive by spread, by `Object.assign`, or by a loosely-typed helper. Adding one is a deliberate edit to this interface, which is the moment the safety plan's column list gets re-read.
2. **Every member is a name, a place, a category, a sanitized excerpt, or an aggregate count.** No `phone`, `email`, `address_line_1`, `address_line_2`, `zip`, `owner_user_id`, `social_*`, `reviewer_display_name`, or session identifier — the exact set the safety plan (`:70–:82`) names as never allowed.

### Checked against the safety plan's two column lists

| Safety plan — **never allowed** (`ai-safety-and-approval-plan.md:70–82`) | Present anywhere in the prompt path? |
|---|---|
| Any `user_id` / `auth.users` reference | **No.** `GenerateInput.triggeredBy` carries the user id but is documented *"Logged for audit; never placed in a prompt"* (`provider.ts:94`) and is not read by `buildPromptVars`. |
| `profiles.email`, `profiles.display_name` | **No.** `profiles` is not selected in `context.ts`. |
| `listing_details_business.phone` / `.email` / `.address_line_1` / `.address_line_2` / `.zip` / `.social_*` | **No.** The only select against that table is `.select('description')` (`context.ts:64`). |
| Claim or verification document content | **No.** `claims` and verification tables are not selected. |
| Individual `spend_events` rows | **No.** `spend_events` is not selected. |
| Individual `analytics_events` rows | **No.** Analytics is read as five `.select('id', { count: 'exact', head: true })` queries (`context.ts:70, 77, 91, 99, 106`) — `head: true` returns **no rows at all**, only a count. This is the strongest form of the aggregate-only requirement: the row bodies never enter the process. |
| `reviews.reviewer_user_id` / `.reviewer_display_name` | **No.** `reviews` is not selected by `context.ts`. See finding C. |
| Session tokens, API keys, internal IDs beyond `listing_id` | **No.** |

| Safety plan — **allowed** (`:55–:68`) | Actually supplied? |
|---|---|
| `listings.name`, `.tagline` | Yes — `context.ts:51` |
| `categories.name`, `cities.name` | Yes — joined at `context.ts:51` |
| `listing_details_business.description`, excerpt ≤ 500, no contact info | Yes — `context.ts:64`, truncated at `MAX_DESCRIPTION_CHARS = 500` and contact-redacted by `sanitizeForPrompt` |
| Aggregated analytics counts | Yes — five head-count queries |
| `listings.status`, `price_range`, `cta_type`, `listing_hours`, `reviews.rating` aggregate | **Allowed but not used.** Narrower than the policy permits, which is the correct direction to be wrong in. |

**The loader is narrower than the policy.** Five permitted fields are simply not read. Nothing in this audit asks for them to be added.

---

## 3 · Selects are explicit — there is no `select('*')` in the path

```
context.ts:51    .select('id, name, tagline, categories ( name ), cities ( name )')
context.ts:64    .select('description')
context.ts:70    .select('id', { count: 'exact', head: true })
context.ts:77    .select('id', { count: 'exact', head: true })
context.ts:91    .select('id', { count: 'exact', head: true })
context.ts:99    .select('id', { count: 'exact', head: true })
context.ts:106   .select('id', { count: 'exact', head: true })
```
`[Measured — repo grep, 2026-08-26]`

A `select('*')` against `listings` would pull `meta_title`, `meta_description`, and ownership columns into memory next to the prompt builder; against `listing_details_business` it would pull **phone, email, both address lines, zip, and every `social_*` column** — the entire never-allowed list in one call. No such select exists in this path. `context.ts` notes it deliberately omits `owner_user_id` *"even though the caller has already used that column to prove ownership."*

---

## 4 · Inbound is sanitized; outbound is refused, not cleaned

`lib/ai/sanitize.ts` is not part of prompt assembly but is the reason `description` — the one free-text, owner-typed field in the allowlist — is safe to include.

**Inbound (`sanitizeForPrompt`, applied to every string in `buildPromptVars`):**
`stripHtml` → `redactContactPatterns` → word-boundary truncate. `EMAIL_PATTERN` and `PHONE_PATTERN` are documented as *"deliberately loose — a false positive costs one refused generation the owner can retry; a false negative publishes a contact detail."* `PHONE_PATTERN` is written not to match a bare 4-digit year or a price. That asymmetry is the right one and should not be tightened for tidiness.

**Outbound (`validateOutput`):** rejects on `empty | too_long | refusal | contains_email | contains_phone`. A rejected response **never becomes a suggestion** — `provider.ts:261` closes the audit row `failed` and returns, with no branch that writes a suggestion row. `rejectionCode()` returns `output_rejected:${reason}`, and *"the offending text is never stored, so there is no path from a failed generation back to the content that failed."*

The distinction matters for the paid path: inbound text is *cleaned*, outbound text is *refused*. A model that echoes a phone number does not get quietly scrubbed and shown to an owner as a suggestion — the whole generation is thrown away.

---

## 5 · Nothing logs prompt or response text

```
grep -rn "console\." lib/ai/
lib/ai/sanitize.ts:32   * There is no `console.log` in this file and there must not be one: …
lib/ai/provider.ts:42   * No `console.*`. The strings moving through here are …
```
`[Measured — repo grep, 2026-08-26]`

**Two comments asserting there must not be a `console.*`, and zero actual `console.*` calls anywhere in `lib/ai/`.** This satisfies the safety plan's logging table (`:105–:109`): full prompt text ✗, full response text ✗.

The one place a provider exception could carry request content is the `catch` at `provider.ts:254`, which calls `closeFailed('provider_error')` and stores a **fixed string**, not the error. Comment: *"No error detail is stored: a provider exception can carry request content."* ⚠ **This is the single line most likely to be "improved" during paid-path debugging.** An SDK error object from a real API call can contain the assembled prompt. It must stay a fixed code.

---

## 6 · The module is server-only, and the caller — not RLS — is the authorization

**No `"use client"` anywhere in `lib/ai/`** `[Measured — repo grep, 2026-08-26]`. `lib/ai/provider.ts` and `lib/ai/context.ts` are each imported by exactly one file — `lib/actions/ai/generateSuggestion.ts`, a server action. This satisfies the safety plan's requirement that the provider module *"must not be imported in any `"use client"` component."*

Writes in `generate()` use `createServiceClient()`, so **RLS is not protecting these writes — the caller's ownership check is.** Three layers are in place in `generateSuggestion.ts` `[Measured — repo, 2026-08-26]`:

| Line | Check |
|---|---|
| `:34` | `isFeatureEnabled('aiBeta')` — the dark-launch gate, already wired |
| `:54` | `.eq('owner_user_id', owner.user.id)` — the signed-in user owns this listing |
| `:60` | `canAccess(listing.tier, 'ai_suggestions')` — the tier entitlement |

⚠ **Standing constraint for the paid path:** do not add a second caller of `generate()` that skips `:54`. There is currently one caller; that is the safest number.

---

## 7 · Findings

None of the three is a leak in the shipped code. Two are ways a *future* edit leaks without failing.

### Finding A — 10 supplied variables vs 19 template placeholders, and `fillTemplate` fails silent 🟡

`buildPromptVars()` returns **10** keys. The template corpus in `lib/ai/prompts.ts` contains **19** distinct real placeholders `[Measured — repo grep, 2026-08-26]`:

> `candidate_listings`, `category_name`, `city_name`, `collection_description`, `collection_name`, `cta_clicks_30d`, `description_excerpt`, `existing_listing_names`, `featured_listing_names`, `guide_tone`, `listing_name`, `page_views_30d`, `page_views_7d`, `rating`, `review_text`, `saves_30d`, `shares_30d`, `tagline`, `trust_tier`

`fillTemplate` does `vars[key] ?? ''` (`provider.ts:111`). That substitution is **correct for privacy** — the alternative, leaving a literal `{{tagline}}` in the text, is an instruction to a model to talk about the marker — but it means an unsupplied placeholder produces **an empty string, not an error**.

**Today this is safe**: only the five registered agents in `AI_AGENTS` can reach `generate()`, and every placeholder in their five templates is among the 10 supplied. Verified by inspection.

**The risk is the sixth agent.** Whoever registers `review_response` will find its template wants `review_text` and `rating`, which `GenerateContext` does not carry. The failure mode is a **blank-filled prompt that generates plausible nonsense**, not a crash — and the fix under time pressure is to add `review_text` to `GenerateContext`, which is exactly the edit that needs the safety plan re-read (reviewer identity must be excluded). `agentsWithUnroutedTemplates()` checks only the opposite direction — agents with no template — so it will not catch this.

**Recommendation** `[Recommendation]`: before registering agent 6, add a unit test asserting that every placeholder in each registered agent's template has a key in `buildPromptVars({...})`. It is a handful of lines against data already in the repo, and it converts a silent blank into a red test. **Not a blocker for the five-agent go-live** — the five are verified today.

### Finding B — `AGENT_PROMPT_MAP` routes 11 agent types; only 5 are registered 🟢

`AGENT_PROMPT_MAP` covers `listing_description`, `seo_coach_title`, `seo_coach_description`, `social_caption_instagram`, `social_caption_facebook`, `social_caption_x`, `review_response`, `analytics_explainer`, `collection_builder`, `guide_writer`, `social_media_admin` — **11**. `AI_AGENTS` registers **5**.

The six unregistered types are unreachable: `generate()` takes an `AgentDefinition`, and definitions come only from `AI_AGENTS`. **This is documentation of intent, not dead-code risk**, and it is the mechanism behind finding A. Recorded so the count difference is not mistaken for a bug later.

### Finding C — `MAX_REVIEW_CHARS` is exported and consumed nowhere 🟢

```
grep -rn "MAX_REVIEW_CHARS" app lib components e2e tests
lib/ai/sanitize.ts:40:export const MAX_REVIEW_CHARS = 1000
```
`[Measured — repo grep, 2026-08-26]`

The safety plan allows `review_text` in prompts **for the Review Response Agent only, with reviewer identity excluded** (`:67`). That agent is not built, `reviews` is not selected by `context.ts`, and so the "reviewer identity excluded" condition currently has **no enforcement anywhere** — it does not need one, because no review text reaches a prompt. The constant is a placeholder waiting for its agent. ⚠ It must not be read as evidence that review handling is already safe.

---

## 8 · Adjacent finding — not privacy, but it belongs at GATE-SPEND ⚠

**`aiQuota()` is defined and unit-tested, but is called by no application code.**

```
grep -rn "aiQuota" app lib components e2e tests
lib/stripe/features.ts:279:export function aiQuota(tier: string | null): number | null
tests/feature-gating.test.ts:5,194,196,197,198,199,209   (assertions only)
```
`[Measured — repo grep, 2026-08-26]`

The per-tier monthly quota — `free: 0 · starter: 10 · growth: 100 · premium: 500` — **exists as a value and is not enforced on the generate path.** The only ceiling actually applied today is `RATE_LIMIT_PER_LISTING_24H = 10` in `provider.ts`.

This corrects a claim in the working plan, which described the monthly quota as *"already enforced by `aiQuota()`"*. It is defined, not enforced.

**Why it matters at the gate and not before:** in mock mode an unenforced quota costs nothing. On real models the per-listing 24h limit is the *only* thing between the flag flip and the bill, and it is per **listing** — an owner with 12 listings has a 120-generation daily ceiling, not 10. The bill scales with listing count, not with subscription tier.

**Recommendation** `[Recommendation]`: enforce `aiQuota()` in `generateSuggestion.ts` — count the owner's `ai_generation_requests` rows for the current billing month across all their listings and refuse over the tier limit — **in the same PR as the paid path**, before `ANTHROPIC_API_KEY` is set anywhere. This is a spend control, so it is the founder's call at GATE-SPEND, not an assumption to code around.

---

## 9 · Gate 2 verdict

**PASS.** No PII field appears in any prompt assembly function. The allowlist is enforced by a type with no index signature; the loader's selects are explicit and narrower than policy permits; analytics is read `head: true` so row bodies never enter the process; inbound free text is sanitized and outbound text is refused rather than cleaned; nothing logs prompt or response text; the module is server-only with a single, ownership-checking caller.

Findings A and C are **not blockers** for the five-agent go-live. Finding A becomes a blocker the moment a sixth agent is registered. The section 8 spend finding is a blocker for **GATE-SPEND**, not for this gate.

### V2-Provider gate board after this audit

| # | Gate | State |
|---|---|---|
| 1 | Approval workflow tested | ⚠ **Founder walk** — Preview: generate → approve → lands in `meta_title`; generate → reject → stays rejected; both survive reload |
| 2 | **Privacy review** | ✅ **CLEARED — this document** |
| 3 | Rate limiting implemented | ✅ `RATE_LIMIT_PER_LISTING_24H = 10`, enforced at the top of `generate()`, `countRecentRequests()` **fails closed** (returns the limit on a read error rather than assuming zero) |
| 4 | Audit log verified | ✅ Row inserted `status: 'pending'` **before** the suggestion, closed `completed`/`failed` — a paid call that fails is never the invisible half of the bill |
| 5 | Owner approval UI complete | ⚠ **Founder walk** — confirm no suggestion status changes without explicit owner or admin action |
| 6 | `ANTHROPIC_API_KEY` ready | ☐ **Founder** — **Preview scope first** (Preview is bound to staging, which is what the gate's "staging environment" wording means here). Production only after the walk. |

Gates 1 and 5 are behavioral and cannot be cleared by reading code — per the standing verification rule, a green build is not a done-when.

---

## 10 · What must not change when the paid path is wired

Carried forward into the implementation PR as review criteria:

1. `closeFailed('provider_error')` stores a **fixed code**, never the caught error. An SDK error can carry the assembled prompt.
2. No `console.*` is added anywhere in `lib/ai/`.
3. `validateOutput()` and `sanitizeForPrompt()` are not relaxed, and the rule that **rejected output never becomes a suggestion** holds.
4. `GenerateContext` gains no field without re-reading the safety plan's column lists, and never gains an index signature.
5. No second caller of `generate()` that skips the `owner_user_id` check.
6. The audit row is still written **before** the provider call.
7. `request_tokens` / `response_tokens` are populated on the completed row — the input to the *measured* cost model Wave F `5.3` requires, and currently `[Unknown]` because no real call has run.

---

**Related:** `docs/blacqlist/ai/ai-safety-and-approval-plan.md` · `docs/blacqlist/ai/ai-agent-roadmap.md` (Phase 2 → 3 gates) · `board-checkpoints.md` ledger `4.3` · `.claude/rules/data-privacy.md`
