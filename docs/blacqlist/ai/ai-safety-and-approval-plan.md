# AI Safety and Approval Plan — The BLACQList

**Date:** 2026-05-11  
**Status:** Active — enforced from foundation phase forward

---

## Core Principles

1. **No auto-publish.** AI-generated content is never applied to a listing, posted publicly, or sent to a user without explicit human approval.
2. **No PII in prompts.** Prompts assembled server-side must not include email addresses, phone numbers, user IDs, reviewer identities, full addresses, or any data that identifies a natural person.
3. **No provider calls before approval.** The Anthropic API (or any other provider) is not called until the V2 Provider phase gates are cleared. Until then, only mock responses are used.
4. **Audit trail required.** Every AI generation attempt — including mock — must produce a row in `ai_generation_requests` before a suggestion row is created.
5. **Suggestions expire.** Unreviewed suggestions become `expired` after 7 days and are no longer surfaced to owners or admins. They are retained in the database for audit but cannot be applied after expiry.

---

## Approval Workflow

### State Machine

```
created
  → status: 'pending'
    → [owner or admin clicks Approve] → status: 'approved'
      → [owner clicks Apply to listing] → status: 'applied'
        → listing field updated; applied_at set
    → [owner or admin clicks Reject] → status: 'rejected'
      → rejection retained; never deleted
    → [7 days pass with no action] → status: 'expired'
      → no further action possible
```

### Who Can Take Each Action

| Action                      | Owner                                     | Admin                | System            |
| --------------------------- | ----------------------------------------- | -------------------- | ----------------- |
| Approve suggestion          | ✓ (own listing only)                      | ✓ (any)              | —                 |
| Reject suggestion           | ✓ (own listing only)                      | ✓ (any)              | —                 |
| Apply suggestion to listing | ✓ (own listing only)                      | —                    | —                 |
| Expire suggestions (7 days) | —                                         | —                    | ✓ (scheduled job) |
| View suggestions            | ✓ (own listing, pending/approved/applied) | ✓ (all)              | —                 |
| Delete suggestions          | —                                         | ✓ (super_admin only) | —                 |

**Owners can never apply someone else's listing suggestion.** The apply action verifies `listing.owner_user_id = auth.uid()` at the service layer, not just in RLS.

---

## Privacy Guardrails

### Prompt Assembly Rules

Prompt assembly functions in `lib/ai/` must follow these rules for every agent:

**Allowed in prompts:**

- `listings.name`
- `listings.tagline`
- `listings.status` (published/claimed/etc.)
- `categories.name`
- `cities.name`
- `listing_details_business.description` (excerpt, max 500 chars — no contact info)
- `listing_details_business.price_range`
- `listing_details_business.cta_type`
- Aggregated analytics counts (total numbers only, e.g., `page_views_30d = 142`)
- `listing_hours` (is_open flag or day/time ranges)
- `reviews.rating` (aggregate: average rating, count only)
- `review_text` for Review Response Agent only — reviewer identity excluded

**Never allowed in prompts:**

- Any user_id or auth.users reference
- `profiles.email`, `profiles.display_name` (owner identity)
- `listing_details_business.phone`
- `listing_details_business.email`
- `listing_details_business.address_line_1`, `address_line_2`, `zip`
- `listing_details_business.social_*` (private handle data)
- Any claim or verification document content
- Individual spend_events rows (only aggregates)
- Individual analytics_events rows (only aggregates)
- `reviews.reviewer_user_id`, `reviews.reviewer_display_name`
- Session tokens, API keys, internal IDs beyond listing_id

### Server-Side-Only Prompt Construction

Prompts are assembled in `lib/ai/provider.ts` (server module). This file:

- Must not be imported in any `"use client"` component
- Must not accept raw user input without sanitization
- Must not log the assembled prompt text (PII risk)
- Must strip any fields not in the allowlist before passing to provider

### What IS Logged in `ai_generation_requests`

| Field              | Logged | Notes                                                        |
| ------------------ | ------ | ------------------------------------------------------------ |
| `agent_type`       | ✓      | Which agent ran                                              |
| `prompt_version`   | ✓      | Template key used                                            |
| `model`            | ✓      | Model identifier                                             |
| `provider`         | ✓      | 'anthropic' or 'mock'                                        |
| `request_tokens`   | ✓      | Token count (no prompt text)                                 |
| `response_tokens`  | ✓      | Token count (no response text)                               |
| `status`           | ✓      | 'completed' or 'failed'                                      |
| `error_message`    | ✓      | Error type only — never stack trace with data                |
| `listing_id`       | ✓      | Which listing triggered the request                          |
| `created_by`       | ✓      | Which user triggered it                                      |
| Full prompt text   | ✗      | Never logged — PII risk                                      |
| Full response text | ✗      | Not logged — stored as `ai_suggestions.suggestion_text` only |

---

## Provider Integration Plan (Deferred to V2)

### Prerequisites (All must be true before first real API call)

- [ ] All 6 V2 Mock phase gates cleared (see ai-agent-roadmap.md)
- [ ] `ANTHROPIC_API_KEY` added to Vercel staging environment
- [ ] Rate limiting implemented: 10 requests per listing per 24 hours
- [ ] Privacy code audit completed: confirm no PII in any prompt assembly function
- [ ] Error handling verified: failed API calls do not create partial suggestion rows
- [ ] Mock mode fallback confirmed: if API key is absent, `generate()` falls back to mock without error

### Integration Architecture

```
Server Action / Route Handler
  → lib/ai/provider.ts :: generate(input: GenerateInput)
    → if ANTHROPIC_API_KEY set: call Anthropic Messages API
    → if not set: return mock response from lib/ai/mock-responses.ts
    → INSERT into ai_generation_requests (before suggestion creation)
    → INSERT into ai_suggestions (status = 'pending')
    → return suggestion_id
```

### Model Selection

| Use case                                          | Model                       | Rationale                      |
| ------------------------------------------------- | --------------------------- | ------------------------------ |
| SEO copy, captions, short suggestions             | `claude-haiku-4-5-20251001` | Lowest cost, adequate quality  |
| Descriptions, analytics summaries, guide sections | `claude-sonnet-4-6`         | Better quality for longer copy |
| Review responses                                  | `claude-haiku-4-5-20251001` | Bounded output, simple task    |

### Environment Variable

```bash
ANTHROPIC_API_KEY=sk-ant-...   # server-side only; never NEXT_PUBLIC_
```

This variable is already documented in `docs/blacqlist/architecture/security-and-privacy-plan.md` under "Secret Management" as a planned V2 server-side secret.

### Rate Limiting Plan

Before connecting the real provider, implement per-listing rate limiting:

- Counter: `ai_generation_requests` count WHERE `listing_id = X AND created_at > now() - interval '24 hours'`
- Limit: 10 requests per listing per 24 hours
- Enforcement: checked at service layer before `generate()` is called
- Response on limit exceeded: `429 Too Many Requests` with `code: 'AI_RATE_LIMIT_EXCEEDED'`
- Admin override: service role bypasses per-listing limit for admin-triggered agents

---

## Content Safety Guardrails

### Input Sanitization

Before assembling any prompt:

1. Strip HTML tags from all text fields
2. Truncate description to 500 chars maximum
3. Truncate review text to 1000 chars maximum
4. Remove any detected email patterns (`@` check) from free-text fields
5. Remove any detected phone patterns from free-text fields

### Output Validation

After receiving a suggestion from the provider:

1. Reject responses with length > 2000 characters (model hallucination signal)
2. Reject responses that appear to be error messages (start with "I cannot", "I'm unable")
3. Reject responses containing detected email or phone patterns (PII leak from model)
4. If rejected: set `ai_generation_requests.status = 'failed'`; do not create suggestion row

### Prohibited Output Types

The system must never apply AI-generated content that:

- Claims to represent a specific person (fabricated testimonials)
- Makes unverifiable factual claims about the business (medical claims, legal claims, guarantees)
- Contains competitor mentions
- Contains pricing commitments that override the owner's actual pricing

These are caught at the approval step — owners and admins are responsible for reviewing content before applying.

---

## Approval UI Requirements (V2 Mock)

When approval UI is built in V2 Mock phase, the following UX rules apply:

1. Each suggestion displayed with its full text, agent type, and generation date
2. "Approve" and "Reject" are separate buttons — no single "Apply" shortcut
3. After Approve, a second confirmation ("Apply to listing?") is required before the field is updated
4. Rejection optionally captures a reason (free text, max 200 chars) — stored in `ai_suggestions.metadata`
5. Applied suggestions show a success state: "Applied to [field name] on [date]"
6. Expired suggestions displayed in a muted "Archived" section — no action buttons
7. Owner cannot approve suggestions from another owner's listing (enforced server-side)

---

## GDPR and Data Retention

- Suggestions for a listing are deleted when the listing is deleted (`ON DELETE CASCADE`)
- Suggestions tied to a deleted user via `reviewed_by` set to NULL (`ON DELETE SET NULL`)
- `ai_generation_requests` retained indefinitely for audit (no user data in columns, only listing_id and user_id of operator)
- If a user requests data deletion: their `created_by` reference in `ai_generation_requests` is set to NULL; suggestion rows they triggered are retained (listing data, not personal data)
- Prompt text is never stored — only the output suggestion text is retained

---

## Open Risks

| Risk                                          | Severity | Mitigation                                                                   |
| --------------------------------------------- | -------- | ---------------------------------------------------------------------------- |
| Owner applies AI copy without reading it      | Medium   | Approval step requires two-click confirm; copy shown in preview              |
| Model hallucinates false business claims      | Medium   | Output validation + human review required before apply                       |
| PII leaks into prompts via free-text fields   | High     | Server-side sanitization + code audit gate before V2 Provider                |
| API cost overrun                              | Medium   | Per-listing rate limit; token logging in audit table                         |
| Reviewer identity leaks via review text       | Medium   | Review Response Agent strips reviewer identity before prompt assembly        |
| Prompt injection via listing name/description | Low      | Prompt template structure limits injection surface; output length validation |
