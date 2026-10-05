# Ticket 128: AI drafts and category help on /add-business

**Phase:** V2 · **Priority:** P2 · **Status:** Blocked on gates
**Depends on:** 126 (and 127 for reading imported text)
**Gates:** GATE-SPEND, safety-plan exception, privacy policy and Terms update, the six AI launch gates. Behind `FEATURE_AI_ONBOARDING`, off by default.
**Decision record:** [add-business-workshop-2026-10.md](../design/add-business-workshop-2026-10.md)

---

## Why

The founder wants owners to describe the business in their own words and get drafts they can adjust, for a page that ranks well in search and the right category (or a proposed new one). AI help is free for every new owner, with caps. No model is wired today: there is no AI SDK, `callRealProvider()` throws (`lib/ai/provider.ts:201`), AI is Starter and up only (`lib/stripe/features.ts:35`) but new pages start on Free, and the ticket 104 caps are not built.

## How it works

When the flag is on, the ticket 126 flow gets drafts after "Save my draft". When 127 is on, the AI also reads the imported about text. Nothing saves until the owner taps "Use this". Each draft is an editable card with Use this, Shorter, Warmer and Try again.

**One assistant call per action.**

| Input | Rule |
|---|---|
| The owner's words | Through `sanitizeForPrompt`, capped at 500 characters |
| Business name | Yes |
| City name | Yes |
| Category candidates | Names from the rules matcher |
| Anything personal (email, phone, address, owner name) | Never in a prompt |

| Output (zod plus `validateOutput`) | Limit |
|---|---|
| Category | An id from the candidate list, or a proposed new name with its parent group |
| Tagline | 120 characters or less |
| About section | 100 to 300 characters (the Free cap) |
| Search title | 60 characters or less |
| Search description | 160 characters or less (and at least 40, same as ticket 126) |

**Where it plugs in:**

- Through the `generate()` seam in `lib/ai/provider.ts`, with an audit row in `ai_generation_requests` written first (`listing_id` is nullable there). No `ai_suggestions` row, because owners apply drafts inline.
- The "no second caller that skips ownership" rule becomes: ownership is the signed-in owner of this draft, or the signed-in user before a draft exists.
- A new prompt template, plus a test that every placeholder gets a value (audit finding A).

**Caps, free for every new owner:** about 5 drafts per page, about 20 a day per owner, a monthly spending ceiling and a kill switch. These use a limiter that fails closed (the ticket 104 pieces). The general limiter fails open, so it must not be reused here.

**When AI has no good answer,** or a cap is hit, or the call fails: quietly fall back to rules matching and simple drafts, with one line saying so.

## Acceptance criteria

- Given `FEATURE_AI_ONBOARDING` is off, then no AI call is made and the flow behaves exactly as ticket 126.
- Given the flag is on and a mock provider, when the owner taps "Save my draft", then they see category, tagline, about, search title and search description cards, and nothing is saved until "Use this".
- Given any generation, then an `ai_generation_requests` row is written before the call.
- Given the owner's text contains an instruction like "ignore previous instructions", then `sanitizeForPrompt` neutralizes it before the prompt.
- Given a prompt is assembled, then it contains no email, phone, street address or owner name.
- Given the model returns a category id not in the candidate list, then it is rejected and rules matching is used.
- Given output over a length limit, or a banned pattern, then `validateOutput` rejects it and the fallback line shows.
- Given a sixth draft on one page, or a daily or monthly cap, or the kill switch on, then the limiter refuses (fails closed) and the fallback shows with one line.
- Given the model proposes a new category, then the owner can edit the name, and the ticket 126 `category_requests` path runs.
- Given a Free owner, then AI help works (free with caps).
- Given the pricing page, then there are still no AI lines on any plan until the switch is on.

## Gates

- **GATE-SPEND:** model choice, API key and the monthly ceiling. No real calls before this clears.
- **Safety-plan exception** for owner text and category proposals in `docs/blacqlist/ai/ai-safety-and-approval-plan.md` `[Needs professional review]`.
- **Privacy policy update** (add Anthropic as a processor; Turnstile is also missing) and a Terms line that owners are responsible for the text they approve `[Needs professional review]`. The 14-day notice clause applies.
- **The six AI launch gates** in `docs/blacqlist/ai/ai-agent-roadmap.md:68-78`:

| # | Gate |
|---|---|
| 1 | Approval workflow tested |
| 2 | Privacy review (no PII in any prompt assembly function) |
| 3 | Rate limiting implemented (the roadmap says 10 per listing per 24 hours, this ticket uses tighter caps, see plan conflicts) |
| 4 | Audit log verified |
| 5 | Owner approval UI complete |
| 6 | `ANTHROPIC_API_KEY` ready in Vercel staging, not in the codebase |

- No migration expected. If audit columns are needed, that is its own GATE-DATA.

## QA notes

- Tests for the mock provider path, cap enforcement that fails closed, and output validation (length and banned patterns).
- Test that every prompt placeholder is filled.
- No real calls until GATE-SPEND clears.
- Walk the mock path as a barber, a food truck, a lawyer, a candle maker and henna (the no-match case, where the fallback line must show).
