# Ticket 079: Anthropic Claude API Integration and Prompt Infrastructure

## Status

Draft

## Phase

Phase 15: AI Assistant Foundations

## Priority

P3

## Feature Area

AI

## Context

Infrastructure ticket establishing the Anthropic Claude API client and prompt management system used by all AI features (Tickets 080 and 081). No UI — purely server-side infrastructure. All AI calls are server-side only; the API key is never exposed to the client bundle. AI features are gated behind a feature flag so they can be disabled without a code deploy. Default model is **`claude-haiku-4-5-20251001`** (Claude Haiku 4.5); Sonnet 5 (`claude-sonnet-5`) is reserved for low-frequency admin and Premium-tier agents. Prompt templates are stored in version-controlled code files, not the database, at MVP.

> **Model correction (2026-07-27).** This ticket previously specified `claude-opus-4-7`. That
> contradicted the Haiku 4.5 decision recorded in `monetization/pricing-unit-economics.md` and
> `production/production-roadmap.md` §3.4, and at roughly $15/$75 per 1M tokens would have been
> ~15× the input and output cost the unit-economics model is built on. Shipping the old value would
> have invalidated every margin figure in that doc. Default is now Haiku 4.5.

## User Story

As an engineer implementing AI features, I want a shared Anthropic client and prompt infrastructure, so that all AI features use a consistent interface, error handling pattern, and feature flag.

## Scope

- Install `@anthropic-ai/sdk` package
- `lib/ai/client.ts` — singleton Anthropic client using `ANTHROPIC_API_KEY` env var; throws at module load if key is missing in production
- `lib/ai/types.ts` — shared TypeScript types: `AIResponse<T>`, `AIError`, `AIFlag`, `PromptTemplate`
- `lib/ai/feature-flag.ts` — `isAIEnabled(): boolean` reads `NEXT_PUBLIC_AI_FEATURES_ENABLED` env var; defaults to `false` if unset
- `lib/ai/prompts/` — directory for prompt template files (one file per feature)
- `lib/ai/prompts/index.ts` — re-exports all prompt templates
- Standard AI call wrapper: `callClaude<T>(prompt: string, systemPrompt: string): Promise<AIResponse<T>>` — handles rate limit retry (1 retry with 2s delay), timeout (30s), and error normalization
- All AI errors caught and returned as `ActionResult` error — never throw from AI calls
- Add `ANTHROPIC_API_KEY` and `NEXT_PUBLIC_AI_FEATURES_ENABLED` to `environment-plan.md` (update the doc)

## Out of Scope

- Any AI feature UI (Tickets 080, 081)
- Prompt versioning database system (V2)
- Streaming responses (V2)
- Fine-tuning or custom models

## Dependencies

- Depends on: Ticket 002 (Supabase env setup — establishes pattern for env var management)
- Depends on: Ticket 001 (Next.js project init — package.json must exist)
- **Blocked by: Ticket 104 (AI cost guardrails).** 104 must ship before `ANTHROPIC_API_KEY` is set in
  any environment. This ticket builds the client that spends money; 104 builds the caps that bound it.

## UX Notes

Not applicable — no UI in this ticket.

## Design Notes

Not applicable — backend infrastructure only.

## Data Notes

No database tables required. AI responses are not persisted at MVP (suggestions are generated on-demand and cached with `unstable_cache`).

## API Notes

- No new API routes in this ticket
- Default model: `claude-haiku-4-5-20251001` — exported as `DEFAULT_MODEL` from `lib/ai/client.ts`,
  never hardcoded at call sites, so the cost decision lives in exactly one place
- Escalation model: `claude-sonnet-5` — permitted only for low-frequency admin agents and
  Premium-tier consumer agents; every use is a deliberate per-agent choice, never a default
- Max tokens: 1024 for suggestions, 512 for moderation flags
- Temperature: 0.3 for structured outputs (consistency over creativity)
- **Prompt caching:** all system prompts must be sent with `cache_control: { type: 'ephemeral' }`.
  `production-roadmap.md` §3.4 assumes a 70%+ cache hit rate on repeated agent calls, and the
  unit-economics model inherits that assumption — omitting it silently raises input cost.

## Implementation Notes

```typescript
// lib/ai/client.ts
import Anthropic from '@anthropic-ai/sdk'

let _client: Anthropic | null = null

export function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set')
  }
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return _client
}
```

```typescript
// lib/ai/feature-flag.ts
export function isAIEnabled(): boolean {
  return process.env.NEXT_PUBLIC_AI_FEATURES_ENABLED === 'true'
}
```

```typescript
// lib/ai/types.ts
export type AIResponse<T> = { data: T; confidence: number; reasoning?: string }
export type AIError = {
  error: string
  code: 'AI_DISABLED' | 'AI_TIMEOUT' | 'AI_RATE_LIMITED' | 'AI_ERROR'
}
export type AIResult<T> = AIResponse<T> | AIError
```

- `callClaude` must never throw — always return `AIResult<T>`
- Log all AI errors to Sentry with the prompt hash (not the full prompt, to avoid logging sensitive listing data)

## Acceptance Criteria

- [ ] `@anthropic-ai/sdk` installed and importable
- [ ] `getAnthropicClient()` returns a valid client when `ANTHROPIC_API_KEY` is set
- [ ] `isAIEnabled()` returns `false` when env var is unset or `'false'`; `true` when `'true'`
- [ ] `callClaude` returns an `AIError` with code `AI_DISABLED` when feature flag is off
- [ ] `callClaude` handles 30s timeout — returns `AIError` with code `AI_TIMEOUT`
- [ ] `callClaude` handles Anthropic rate limit — retries once after 2s, then returns `AIError` with code `AI_RATE_LIMITED`
- [ ] No AI code runs client-side — confirmed by bundle analysis
- [ ] `lib/ai/prompts/` directory exists with an `index.ts` re-export
- [ ] `DEFAULT_MODEL` is exported from `lib/ai/client.ts` and equals `claude-haiku-4-5-20251001`
- [ ] No call site passes a model string literal — grep for `claude-` outside `lib/ai/client.ts`
      returns no matches in `app/` or `lib/` (guards against a stale Opus/Sonnet default creeping back)
- [ ] System prompts are sent with `cache_control: { type: 'ephemeral' }`
- [ ] `callClaude` refuses to run when the ticket-104 limiter is absent — see Dependencies

## Failure States

| Failure                       | User-visible behavior                                                   |
| ----------------------------- | ----------------------------------------------------------------------- |
| Feature flag disabled         | AI features silently hidden from UI (callers check flag before calling) |
| API key missing in production | Server startup error — caught by monitoring, not exposed to users       |
| API timeout                   | AI feature degrades gracefully — UI shows fallback or hides AI section  |
| Rate limit exceeded           | Same as timeout — graceful degradation                                  |

## Edge Cases

- `ANTHROPIC_API_KEY` set to empty string: treat as unset — throw
- Feature flag read in a Server Component that is statically rendered: `NEXT_PUBLIC_AI_FEATURES_ENABLED` is baked in at build time — document this limitation

## Accessibility Notes

Not applicable — backend infrastructure only.

## QA Test Cases

| #   | Scenario                 | Role | Steps                                                         | Expected result                         |
| --- | ------------------------ | ---- | ------------------------------------------------------------- | --------------------------------------- |
| 1   | Feature flag off         | —    | Set NEXT_PUBLIC_AI_FEATURES_ENABLED=false; call isAIEnabled() | Returns false                           |
| 2   | Feature flag on          | —    | Set NEXT_PUBLIC_AI_FEATURES_ENABLED=true; call isAIEnabled()  | Returns true                            |
| 3   | Missing API key          | —    | Unset ANTHROPIC_API_KEY; call getAnthropicClient()            | Throws with clear error message         |
| 4   | callClaude with flag off | —    | Call callClaude with AI disabled                              | Returns AIError { code: 'AI_DISABLED' } |

## Security Notes

- `ANTHROPIC_API_KEY` is server-side only — never prefixed with `NEXT_PUBLIC_`
- AI prompts logged at debug level only; never log listing descriptions or user PII in AI error logs
- All AI calls are server-side (Server Actions or Route Handlers) — confirmed by lint rule or code review

## Completion Checklist

- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] `ANTHROPIC_API_KEY` documented in environment-plan.md
- [ ] Bundle analysis confirms no AI code in client bundle
- [ ] PR opened and linked to this ticket
