# Privacy Policy and Terms Update: Reading a Receipt Photo (Draft for Review)

> **Disclaimer:** This output is informational and does not constitute legal advice. Requirements vary by jurisdiction, business type, and product specifics. Consult a licensed attorney for guidance applicable to your situation before relying on any of the following.

_Drafted: 2026-10-31 · Reviewers: Legal + Privacy agents · Status: **DRAFT. Merge only after counsel review, together with switching `FEATURE_RECEIPT_READ` on in production.**_

_Covers: ticket 163, "Read my receipt for me" on `/account/receipts/new` (PR #290). Jurisdiction scope is the one pinned on 2026-06-20 in `privacy-terms-compliance-review.md`: US-focused, CCPA/CPRA for California visitors, GDPR not an MVP blocker._

Every piece of legal text in this change is **[Needs professional review]**. User-facing copy avoids em dashes (founder voice rule).

---

## 1. What the feature does

| Point | How it works (PR #290) |
|---|---|
| Consent | A checkbox, **unticked by default**. Nothing goes to Anthropic unless the shopper ticks it. |
| What is sent | The receipt photo, scaled down and re-encoded, which drops EXIF and GPS. No account name, email or id. |
| What comes back | Business name, total, date (shown, marked "From your photo", editable). Phone and ZIP from the receipt are used only to match a listing, never shown or stored. |
| What is kept | One `ai_generation_requests` row: account id, time, outcome code, token counts. Not what was read. `created_by` is `ON DELETE SET NULL`. |
| Limits | 10 reads per shopper a day, 20% of the monthly AI call budget, the shared ceiling and kill switch. |
| Off switch | `FEATURE_RECEIPT_READ`, closed by default on every deployment. |

## 2. Changes in this PR

The new text sits inside the existing `isNext` blocks, which are the live text since the October 16 update. **The effective date does not change** (`POLICY_UPDATE` in `lib/legal/policyUpdate.ts` is untouched).

**Privacy Policy** (`app/(public)/privacy/PrivacyPolicy.tsx`)
- Section 3, uses: one new bullet linking to `#receipt-reading`.
- Section 3: a new subsection, "Reading your receipt (only if you ask)", under the AI writing help and Cue text. It covers what is sent, what comes back, what is kept and that it is optional.
- Section 4, Receipt and Spend Data: one new bullet for the read. The opt-out wording pinned by `tests/opt-out-copy.test.ts` is unchanged.
- Section 6, providers table: the Anthropic row adds receipt reading.
- Section 7, Data Retention: one new bullet.

**Terms of Service** (`app/(public)/terms/TermsOfService.tsx`)
- Section 7, Receipt and Spend Data: one new paragraph. It says the read is optional and can be wrong, says the shopper's receipt promises cover filled-in fields, and may be paused or turned off without notice. ("At any time" is avoided in this section, because `tests/opt-out-copy.test.ts` guards it against an opt-out promise.)

## 3. Findings

| # | Finding | Rating | State |
|---|---|---|---|
| R1 | Policy must say a third party (Anthropic) receives the receipt photo, and that it is opt-in | **High** | Drafted in this PR. Unverified by counsel. |
| R2 | A receipt photo can show other people's data (a cashier's name) and partial card numbers. The policy says so plainly. Counsel to confirm that is enough, and whether to tell shoppers to cover anything before they upload | **Medium** | Consult attorney |
| R3 | The in-app hint in PR #290 says "They don't use it to train their models." The policy does not repeat it, because Anthropic's current commercial terms for our account are still `[VERIFY BEFORE POSTING]` in the AI writing help section. Counsel to confirm the hint against the contract, or the hint changes | **High** | Unverified. Requires confirmation. |
| R4 | CCPA/CPRA: Anthropic acts as a service provider under contract. Same footing as the October update | **Medium** | Unverified. Requires confirmation. |
| R5 | Notice: this adds a new use of data the shopper chooses, rather than changing an existing use. Counsel to say whether a "we've updated" email is needed, or whether posting the text before the flag goes on is enough | **Medium** | Consult attorney |
| R6 | "Last updated" lines (`PRIVACY_PROVIDERS_UPDATE.postedOnLabel`, `TERMS_PAID_PLANS.postedOnLabel`) are not changed here, because the merge day isn't known. Set both to the merge day when this merges | **Low** | To do on merge |

## 4. Merge gate

1. Counsel signs off on R1 to R5 (or asks for changes, made here first).
2. Set the two "Last updated" labels to the merge day (R6).
3. Merge this PR and PR #290's stack.
4. Then switch on `FEATURE_RECEIPT_READ` in production. The text must be live before the box is.

## 5. Implementation handoffs

→ **Docs**: none beyond this PR.
→ **Frontend**: if counsel changes R3, update the hint in `components/spend/ReceiptReadOptIn.tsx` (PR #290).
→ Ticket: `docs/blacqlist/tickets/163-read-receipt-photo.md` (in docs PR #282)
