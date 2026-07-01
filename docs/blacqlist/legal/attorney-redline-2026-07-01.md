# Legal Review Redline — Privacy / Terms / Certification

**Date:** 2026-07-01
**Prepared for:** Founder + reviewing attorney
**Status:** ⛔ **DRAFT — nothing below is live.** No changes have been made to the Privacy, Terms, or Cookies pages or to the code. This document pairs each finding from counsel's review with a proposed fix for attorney sign-off. After approval, a separate pass wires the approved wording into the pages.

> **Disclaimer:** This output is informational and does not constitute legal advice. Requirements vary by jurisdiction, business type, and product specifics. Consult a licensed attorney for guidance applicable to your situation before relying on any of the following. Every item below is `[Needs professional review]`.

**Jurisdiction assumption:** US-only (no geo-blocking; no intended EU/UK users). Several items below depend on this — flag if it changes.

---

## Priority summary

| # | Issue | Severity | Type | Owner | Ready to wire? |
|---|---|---|---|---|---|
| 1 | Privacy §2 "anonymized" claim contradicts code | **High** | Copy fix | Me → attorney confirm | Yes (wording drafted) |
| 2 | Receipts stored with no card-number redaction | **Med-High** | Code gap + UI copy | Eng + me | Warning: yes · OCR: backlog |
| 3 | No arbitration / class-action waiver | Medium | New clause | **Attorney drafts** | No — placeholder only |
| 4 | Confirm DMCA registration is active | Medium | Verification | **Founder** | N/A |
| 5 | "BLACQList Certified" criteria undefined | Medium | Product + copy | **Founder/product** + attorney | No — needs definition |
| 6 | CCPA/CPRA + Global Privacy Control polish | Low-Med | Copy add | Me → attorney confirm | Yes (wording drafted) |
| 7 | GDPR-flavored language in a US-only product | Low | Copy trim | Me → attorney confirm | Yes (optional) |

The two items where **public text does not match the actual code** are #1 (a live misrepresentation → FTC §5 risk) and — inversely — #2 (a real gap the text does *not* claim, so not a misrepresentation, but a real exposure). #1 is the priority.

---

## 1. [HIGH] Privacy §2 says usage data is "stored in anonymized form" — the code contradicts it

**Why it matters:** A privacy policy that misstates how data is handled is actionable under **FTC Act §5 (deceptive practices)**, independent of any state privacy law. This is the highest-priority item because the live text is affirmatively inaccurate.

**Current — `app/(public)/privacy/page.tsx:74`:**
> Usage data (search queries, listings viewed, saves, clicks on calls-to-action) — **stored in anonymized form**

**The contradiction:** the `analytics_events` table retains `user_id`, so searches / views / saves / clicks **are linkable to the individual account internally.** Only the *public display* and the *community-spend aggregates* are anonymized (the policy correctly says so at §3 and §4 — lines 88–89, 108–113). Line 74 over-claims that the raw usage data is *stored* anonymously.

**Proposed reword (line 74):**
> Usage data (search queries, listings viewed, saves, clicks on calls-to-action) — associated with your account so we can operate the service and provide features such as recently-viewed and recommendations; this data is shown to business owners and displayed publicly only in aggregated or anonymized form.

**Why reword rather than anonymize the table:** `analytics_events.user_id` powers **shipped, user-facing features** — recently-viewed (`/account/activity`), recommendations (`/account/recommended`), and owner-facing per-listing analytics. Dropping `user_id` would break those. The accurate, defensible position is: *we store it linked to your account for these stated purposes, and only publish it in aggregate/anonymized form.* (If the business would rather truly anonymize, that's a product decision that removes those features — flag for discussion.)

**Owner:** Me (copy) → **attorney confirm the reworded sentence is accurate + sufficient.**

---

## 2. [MED-HIGH] Receipt images stored with no card-number redaction

**Why it matters:** Uploaded receipts can contain a full card number (PAN). There is **no OCR/masking before storage** (`lib/actions/spend/createReceiptSubmission.ts` uploads the image as-is; grep for redaction/mask/PAN = none). Storing PANs pulls the platform into **PCI-DSS scope** and creates **CPRA "sensitive personal information" (financial)** exposure. Note most retail receipts already truncate the PAN to last-4 (merchants are required to), so the realistic risk is a user uploading an unusual receipt or a non-receipt image — but the gap is real.

**Not a misrepresentation:** the Privacy Policy does **not** claim receipts are redacted, so there is no deceptive-statement problem here (unlike #1). This is a security/compliance gap, not a copy contradiction.

**Proposed — two parts:**

- **(a) Ship now — receipt-uploader warning (copy).** Add a visible note on the receipt upload UI:
  > **Only the merchant, date, and total are needed.** Please don't upload full card numbers — black them out first, or upload a receipt that only shows the last 4 digits.

  → **Frontend:** add the warning to the receipt upload form (`app/account/receipts/new/`). Low effort; reduces the chance a PAN is ever uploaded.

- **(b) Backlog — server-side PAN masking.** An OCR + card-number-detection step that masks/rejects images containing a full PAN before storage, or blocks the upload. This is real engineering; **recommend post-launch backlog** with a documented risk acceptance for soft launch (low volume, warning in place).

→ **Backend/Eng:** ticket the OCR/masking step. → **Owner:** me (warning copy in the batch) + eng backlog.

---

## 3. [MED] No arbitration clause / class-action waiver

**Why it matters:** A standard risk-management tool is absent. Terms **§12 (`app/(public)/terms/page.tsx:298`) is "Governing Law" only** — it names a forum but includes no mandatory arbitration or class-action waiver.

**I am not drafting binding arbitration language.** Enforceable arbitration/class-waiver clauses are jurisdiction-specific, heavily scrutinized (FAA + state law, unconscionability, notice/consent), and a genuine business decision (they limit users' rights and have trade-offs). This is for counsel.

**Placeholder to insert (structure only — counsel finalizes the binding text):**
> **[CONFIRM — counsel to draft: Dispute Resolution / Arbitration.** A standard clause typically covers: (i) binding individual arbitration of disputes; (ii) a class-action and class-arbitration waiver; (iii) a ~30-day opt-out window from first acceptance; (iv) carve-outs for small-claims court and IP/injunctive relief; (v) the arbitration provider, rules, seat, and cost allocation. Draft to the governing-law jurisdiction and current FAA/state-law standards.]**

**Owner:** **Attorney drafts.** Once provided, I insert the exact wording as a new Terms section.

---

## 4. [MED] Confirm the DMCA agent registration is actually active

**Why it matters:** Safe-harbor protection depends on a **currently-registered** designated agent. Terms §8 publishes Reg. No. **DMCA-1074879** (submitted 2026-06-30, pay.gov tracking `283O6ROF`, status was "Payment Processing"). Counsel flagged the number's format as unusual for a USCO record and the registration as unconfirmed. Publishing an unconfirmed registration number is itself a small risk.

**Action (founder):** Verify the registration shows **active** for **The BLACQList, LLC** in the **U.S. Copyright Office DMCA Designated Agent Directory** (dmca.copyright.gov → search the directory) once payment clears. If the displayed record ID differs from `DMCA-1074879`, update Terms §8 to match the directory exactly.

**Owner:** **Founder** (USCO directory check). No code change until confirmed.

---

## 5. [MED] "Verified / BLACQList Certified" criteria are undefined

**Why it matters:** "Certified" appears in `for-business/page.tsx`, `terms/page.tsx:72`, and `status-badge.tsx` (tiers: `unclaimed` → `claimed` → `verified` → `certified`), but **the criteria are not defined publicly.** If consumers rely on "BLACQList Certified" / "certified Black-owned" and it's inaccurate, that's a **consumer-protection / false-advertising** angle. It also **feeds the §1981 question** directly: if "Certified" becomes a paid or gated benefit tied to a protected characteristic, that raises a distinct legal issue.

**Proposed — needs a product + legal decision first (not something I can define unilaterally):**
- Define, publicly, what each tier means and how it's earned — e.g. *Claimed* (owner verified they control the listing), *Verified* (identity/ownership corroborated), *Certified* (higher bar: [criteria TBD]). The current moderation policy (`.claude/rules/moderation-policy.md`) sets internal review bars but no public criteria.
- **Decide explicitly:** is "Certified" ever a **paid** benefit? If yes → route through counsel for the §1981 analysis before launch.

**Owner:** **Founder/product** defines criteria + the paid-vs-free question → attorney reviews → I then draft the public copy (a short "What our trust tiers mean" section or `/certification` page).

---

## 6. [LOW-MED] CCPA/CPRA completeness + Global Privacy Control (GPC)

**Why it matters:** No mention of honoring **Global Privacy Control (GPC)** opt-out signals, which CPRA treats as a valid opt-out request. Receipts/spend data are **"sensitive personal information"** under CPRA. Likely under CPRA applicability thresholds today, but worth getting right as the platform scales. The existing **"we do not sell your data"** statement is **accurate** per the code (good — keep it).

**Proposed add (to the rights / California section of `privacy/page.tsx`):**
> **Opt-out preference signals.** We honor browser-based opt-out preference signals, including the **Global Privacy Control (GPC)**, where required by applicable law. We do not sell your personal information or share it for cross-context behavioral advertising.

**Owner:** Me (copy) → attorney confirm (and confirm current CPRA-threshold applicability).

---

## 7. [LOW] GDPR-flavored language in a US-only product

**Why it matters:** `privacy/page.tsx:277–278` uses EU/GDPR-flavored phrasing — **"Portability"** and **"lodge a complaint with a data protection supervisory authority."** For a US-only product this is harmlessly over-inclusive, but it implies a scope you don't serve.

**Proposed (optional trim — US-appropriate):**
- **Keep** the portability right (good practice, and some US states grant it).
- **Adjust** the complaint line:
  > **Complaint:** You may lodge a complaint with the relevant regulator — for example, the California Privacy Protection Agency or your state Attorney General.

**Important conditional:** if the product ever serves **EU/UK** users, this is no longer optional — you'd need a **cookie-consent banner** (even for cookieless Vercel Analytics), a lawful basis, and the full GDPR rights set. Flag before any EU launch.

**Owner:** Me (copy) → attorney confirm.

---

## What happens after sign-off

1. Attorney reviews this redline; founder returns: the approved §2/§6/§7 wording, the **drafted arbitration clause** (#3), and the **Certified criteria + paid/free decision** (#5).
2. Founder confirms the **DMCA registration is active** (#4).
3. A follow-up pass then wires the approved copy into `app/(public)/privacy|terms|cookies/page.tsx`, adds the receipt-uploader warning (#2a), bumps "Last updated," tickets the OCR backlog (#2b), and flips the corresponding findings in `privacy-terms-compliance-review.md`.
4. **Nothing goes live before that sign-off.**

_Cross-reference: `docs/blacqlist/legal/privacy-terms-compliance-review.md` (prior findings, incl. the now-resolved entity/address/DMCA items)._
