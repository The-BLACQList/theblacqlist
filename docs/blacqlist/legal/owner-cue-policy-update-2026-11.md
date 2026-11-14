# Privacy Policy Update: Cue on the Owner Dashboard (Draft for Review)

> **Disclaimer:** This output is informational and does not constitute legal advice. Requirements vary by jurisdiction, business type, and product specifics. Consult a licensed attorney for guidance applicable to your situation before relying on any of the following.

_Drafted: 2026-11-13 · Status: **DRAFT. Counsel review to follow. The feature is already on in production** (see O1)._

_Covers: ticket 203, the owner Cue on `/dashboard` (PR #331, merged as 6317682). Jurisdiction scope is the one pinned on 2026-06-20 in `privacy-terms-compliance-review.md`: US-focused, CCPA/CPRA for California visitors, GDPR not an MVP blocker._

Every piece of legal text in this change is **[Needs professional review]**. User-facing copy avoids em dashes (founder voice rule).

---

## 1. What the feature does

| Point | How it works (PR #331) |
|---|---|
| Who can use it | Signed-in owners with at least one page. Behind `FEATURE_OWNER_CUE` (on in production since 2026-11-13). |
| What is sent to Anthropic | The owner's message (up to 300 characters) and up to twelve earlier turns from the same chat. The names, kind, plan and status of the owner's pages. When Cue looks at a page: city, category, tagline, up to 500 characters of About, counts (photos, services, days with hours, extra buttons), main button type, and which checklist items are missing. |
| Redaction | Messages and page text go through `sanitizeForPrompt` with the owner's name terms (emails, phones, street addresses, the owner's name) and `stripLinks`. A redaction failure stops the request; nothing unredacted is sent. Page names go as they are. |
| What Cue never reads | Customer messages, visitors, page views or saves, receipts, payment details, other owners' pages. Every read is the caller's own pages (RLS plus `owner_user_id`). |
| Drafts | About, search title, search description. Made through `requestSuggestion`, the same path as AI writing help: a pending suggestion that counts toward the page's monthly drafts and expires like other dashboard suggestions. Nothing reaches the page until the owner chooses Use this and confirms. |
| What is kept | One `ai_generation_requests` row per message: agent `owner_cue`, model, provider, token counts, outcome code, `created_by` the owner, `listing_id` null. No text. The chat itself is in the browser tab only (`sessionStorage`), cleared by Clear chat or closing the tab. |
| Limits | 20 messages an hour and 100 a day per owner, 20% of the monthly AI call budget, the shared ceiling and kill switch. |

## 2. Changes in this PR

The new text sits inside the existing `isNext` blocks, which are the live text since the October 16 update. The effective date in `POLICY_UPDATE` is untouched.

**Privacy Policy** (`app/(public)/privacy/PrivacyPolicy.tsx`)
- Section 3, uses: one new bullet linking to `#owner-cue`.
- Section 3: a new subsection, "Cue on your dashboard (business owners only)", between the visitor Cue paragraph and receipt reading. It covers what is sent, redaction, what Cue never sees, that drafts need the owner's click, what is kept, and that it is optional.
- Section 6, providers table: the Anthropic row adds the owner Cue.
- Section 7, Data Retention: one new bullet.

**Other**
- `lib/legal/policyUpdate.ts`: `PRIVACY_PROVIDERS_UPDATE.postedOnLabel` moves to November 13, 2026, so "Last updated" is accurate.
- `components/dashboard/OwnerCue.tsx`: the panel's Privacy link now goes to `/privacy#owner-cue` instead of `#ai-writing-help`.
- `tests/owner-cue.test.ts`: pins the section, the link, and the uses, providers and retention lines.

**Terms of Service:** no change. The existing AI writing help terms already say AI drafts can be wrong and are the owner's to check.

## 3. Findings

| # | Finding | Rating | State |
|---|---|---|---|
| O1 | The feature was switched on in production before this text was posted. Owners who used it before this merges sent messages to Anthropic under a policy that described AI writing help and the visitor Cue, but not this chat. The data sent is the same kind (owner-typed text and page facts, redacted, not stored), and drafts used the already-disclosed writing help path. Counsel to say whether that gap needs any notice beyond posting this text | **High** | Consult attorney |
| O2 | Policy must say a third party (Anthropic) receives the owner's messages and page facts | **High** | Drafted in this PR. Unverified by counsel. |
| O3 | Anthropic's commercial terms for our account (training use, retention) are still `[VERIFY BEFORE POSTING]` in the AI writing help section. This section points to that contract rather than repeating a claim | **High** | Unverified. Requires confirmation. |
| O4 | The audit row is tied to the owner's account (`created_by`) for rate limiting. Same footing as writing help and receipt reading: `ON DELETE SET NULL` on account deletion, which the retention bullet states | **Low** | Matches code |
| O5 | Page names are sent unredacted. A sole proprietor's page name can be their own name. The policy says so, matching the writing help wording | **Low** | Disclosed |
| O6 | Notice: Section 10 promises 14 days' email notice for material changes. This adds a new optional use the owner starts, like receipt reading (R5 in `receipt-reading-policy-update-2026-11.md`). Counsel to say whether a "we've updated" email is needed | **Medium** | Consult attorney |

## 4. Merge gate

1. Founder approves the wording. Because the feature is already live (O1), the recommendation is to post this text now rather than wait for counsel, then make any changes counsel asks for.
2. If it merges on a later day, change `PRIVACY_PROVIDERS_UPDATE.postedOnLabel` to that day.
3. Counsel reviews O1, O3 and O6.

## 5. Implementation handoffs

→ **Frontend**: none beyond this PR.
→ Ticket: `docs/blacqlist/tickets/203-owner-cue.md`
