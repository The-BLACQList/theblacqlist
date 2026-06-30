# Privacy & Terms — Compliance Review

> **Disclaimer:** This output is informational and does not constitute legal advice. Requirements vary by jurisdiction, business type, and product specifics. Consult a licensed attorney for guidance applicable to your situation before relying on any of the following.

_Reviewed: 2026-06-20 · Reviewers: Legal + Privacy agents · Scope: `/privacy`, `/terms`, `/cookies` reconciled against the product's actual data flows (code + schema)._

---

## Why this review exists

The live legal pages (`app/(public)/privacy|terms|cookies/page.tsx`) are **already substantive, well-drafted policies** — not placeholders. The risk in a directory that holds owners' verification documents and users' receipts is not "missing copy," it's **copy that promises something the product doesn't actually do** (or describes data handling inaccurately). This review maps each policy claim to the real implementation, rates the gaps, and routes the fixes. It does **not** certify compliance — open items and attorney review remain (see *Standing limitations*).

## Jurisdiction scope (pinned)

Per the founder decision on 2026-06-20, the launch posture is **US-focused / lean**:

- **Markets:** Georgia, Texas, Illinois (Atlanta, Houston, Chicago).
- **Governing law:** State of Georgia (already set in Terms §12).
- **State privacy law in scope:** **CCPA/CPRA** for California residents (the site is globally reachable; California visitors are realistic). Already addressed in Privacy §8.
- **Not targeted at the EU/UK at launch.** GDPR is **not** treated as an MVP blocker; a cookie-consent banner and EU data-subject-rights layer are logged as **future** items (Finding 7, ticket 099) rather than built now. This is a deliberate, documented risk acceptance for a US 3-city launch — revisit before any EU marketing or EU-targeted expansion.

---

## Findings (risk-rated)

Risk scale per `.claude/rules/compliance.md`: **High** = legal exposure / required by applicable law · **Medium** = strongly recommended / risk if a complaint is filed · **Low** = trust/defensibility.

### 1. Account deletion promised but no flow existed — **High** → RESOLVED this round
Privacy §7 ("If you delete your account… deleted within 30 days") and §8 ("Deletion") and Terms §11 ("delete your account at any time through your account settings") all promised deletion the product could not perform — there was no deletion flow, only an email channel. A right you advertise but cannot honor is the exposure.
**Resolution:** built an in-app deletion flow this round (Part B). The FK design already matched the data-handling spec, so the policy's *outcome* language (listings retained-but-unclaimed; anonymized aggregates kept) is now **true**.
→ **Backend/Frontend (done):** `lib/actions/account/deleteAccount.ts` + `app/account/settings/DeleteAccountSection.tsx`; lands the user on `/sign-in?deleted=1`.
→ **QA:** verify on staging — auth user gone, private receipts/saves removed, owned listing preserved-but-unclaimed, cannot sign back in.

### 2. Data portability promised but no export feature — **Medium**
Privacy §8 ("Portability: Request a copy of your data in a structured, machine-readable format") implies a self-serve export. None exists.
**Resolution (copy):** reword to an **email-request** right fulfilled manually ("contact us and we will provide a copy where technically feasible"), consistent with the §8 "email privacy@… within 30 days" mechanism. A real export feature is deferred.
→ **Backend (future):** self-serve data export. → Ticket: `docs/blacqlist/tickets/100-data-export.md`

### 3. Stripe listed as an active processor, but billing isn't live — **Low**
Privacy §6 lists Stripe ("Payment processing (subscription plans)"). Stripe is scaffolded only (placeholder price IDs; no billing flows). Listing a processor that isn't yet processing data slightly overstates the data flow.
**Resolution (copy):** qualify the Stripe row — "Payment processing — **when paid features become available**" — so the table reflects current reality without needing another revision at V1.

### 4. Controller identity incomplete — no legal entity name / postal address — **Medium** — ✅ RESOLVED (2026-06-30)
Privacy §1/§11 and Terms §14 identify "The BLACQList" and contact emails but **no legal entity name or mailing address.** A postal address is the norm for controller identity and is required in commercial email under CAN-SPAM (note: BLACQList currently sends only *transactional* email, which is exempt — but the address belongs in the policy regardless).
**Resolution (copy):** insert clearly-marked founder placeholders — `[CONFIRM: legal entity name]`, `[CONFIRM: mailing address]` — do **not** invent them.
→ **Founder action:** supply entity name + mailing address (and confirm corporate form).
→ **✅ Done:** entity = **The BLACQList, LLC**; mailing address = **3133 Maple Dr NE, Ste 240 #1130, Atlanta, GA 30305** (CMRA / Anytime Mailbox). Wired into Privacy §11 + Terms §14; "Last updated" bumped to June 30, 2026 on Privacy/Terms/Cookies. Placeholders removed.

### 5. No DMCA designated-agent contact — **Medium** — ✅ RESOLVED (2026-06-30)
Terms §8 (Intellectual Property) asserts IP rights and a §5 takedown right but names **no DMCA agent or copyright-takedown process.** A designated agent registered with the U.S. Copyright Office is what preserves the DMCA safe harbor for user-generated content (reviews, photos, listings).
**Resolution (copy):** add a copyright/DMCA notice block to Terms §8 with a `notice@` contact and `[CONFIRM: DMCA agent + USCO registration]`.
→ **Founder/Legal action:** register a designated agent with the USCO. → Ticket: `docs/blacqlist/tickets/102-dmca-designated-agent.md`
→ **✅ Done:** designated agent = **The BLACQList, LLC**, USCO Registration No. **DMCA-1074879** (registered 2026-06-30). Terms §8 now names the agent + registration + `notice@theblacqlist.com` + mailing address; placeholder removed. _Non-blocking follow-ups: USCO status flips active once payment clears; attorney final read._

### 6. "We collect your IP address" overstates retention — **Low (accuracy, favorable)**
Privacy §2 lists "IP address" under automatically-collected log data. In reality the app stores IP **only as a SHA-256 hash** (`analytics_events.ip_address`) and Sentry scrubs IP/email/phone before events leave the app (`lib/observability/sentry-scrub.ts`). The current wording understates the product's own privacy posture.
**Resolution (copy):** clarify that IP is used transiently and stored only in **hashed/anonymized** form.

### 7. Analytics on, no cookie-consent banner — **Low (US-lean) / would be High under GDPR**
Vercel **Analytics + Speed Insights** run on every page (`app/layout.tsx`) with no consent gate. For the pinned US scope this is acceptable (Vercel Analytics is cookieless and non-identifying; CCPA does not require opt-in consent). Under GDPR it would require prior consent.
**Resolution:** none for MVP (documented risk acceptance). Cookie page updated to name Speed Insights alongside Analytics for accuracy.
→ **Frontend (future, EU only):** consent banner gating non-essential analytics. → Ticket: `docs/blacqlist/tickets/099-cookie-consent-banner.md`

### 8. Security plan documents a 90-day verification-doc purge that isn't implemented — **Medium**
`docs/blacqlist/architecture/security-and-privacy-plan.md` states verification documents are "auto-purged 90 days after decision." No purge job exists; verification docs persist indefinitely in the private `verification-docs` bucket. **The live Privacy Policy does not promise this purge**, so there is no policy contradiction — but the gap between the security plan and reality should close, and we must **not** add a 90-day promise to the policy until the job exists.
**Resolution:** policy left silent on a specific purge window (truthful). Build the purge.
→ **Backend (future):** scheduled job to purge `verification-docs` 90 days post-decision. → Ticket: `docs/blacqlist/tickets/101-verification-doc-purge.md`

---

## Copy changes applied this round (A2)

| Page | Section | Change |
|---|---|---|
| Privacy | §2 | IP described as hashed/anonymized, not raw-collected (Finding 6) |
| Privacy | §6 | Stripe row qualified "when paid features become available" (Finding 3) |
| Privacy | §7/§8 | Deletion = in-app **and** email; portability = email-request "where technically feasible" (Findings 1, 2) |
| Privacy | §11 | Legal-entity + mailing-address `[CONFIRM]` placeholders (Finding 4) |
| Privacy | header | "Last updated" → June 20, 2026 |
| Terms | §8 | Copyright/DMCA designated-agent notice block + `[CONFIRM]` (Finding 5) |
| Terms | §14 | Legal-entity + address `[CONFIRM]` placeholder (Finding 4) |
| Terms | header | "Last updated" → June 20, 2026 |
| Cookies | §2 | Name Vercel **Speed Insights** alongside Analytics (Finding 7 accuracy) |
| Cookies | header | "Last updated" → June 20, 2026 |

---

## Deferred items (tracked, not lost) — A3

| Ticket | Item | Risk | Owner |
|---|---|---|---|
| `099-cookie-consent-banner.md` | GDPR cookie-consent banner gating analytics | Low (US) / High (EU) | Frontend — only if EU enters scope |
| `100-data-export.md` | Self-serve "download my data" export | Medium | Backend |
| `101-verification-doc-purge.md` | 90-day verification-doc purge job | Medium | Backend |
| `102-dmca-designated-agent.md` | Register DMCA designated agent (USCO) + wire takedown intake | Medium | Founder/Legal |

## Founder `[CONFIRM]` inputs needed before launch

1. **Legal entity name** (e.g., "The BLACQList LLC") and **corporate form**.
2. **Mailing address** for the policy contact blocks.
3. **DMCA designated agent** name + USCO registration (ticket 102).

## Standing limitations (per `compliance.md`)

- This is a **review, not a compliance guarantee.** Items above are flagged "resolved / deferred / consult-attorney," never "compliant."
- The pages should receive a **licensed-attorney review** before public launch — especially the liability cap (Terms §10), the Black-owned-business definition and editorial-discretion language (Terms §4), and the CCPA section (Privacy §8).
- Verify each regulatory reference against its current version at launch — privacy/platform rules change.
