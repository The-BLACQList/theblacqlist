# Legal Pages & Discrimination-Risk Review

> **Disclaimer:** This is an informational risk-spotting review, **not legal advice**, and is **not a
> compliance certification.** The author is not a lawyer. Civil-rights and platform law is jurisdiction-
> specific and, on the central question below, actively unsettled and litigated. Nothing here should be
> relied on as a final statement of the law. A licensed attorney must review the pages — and, before any
> monetization, a civil-rights/constitutional litigation specialist must review the model — before launch.

_Reviewed: 2026-07-01 · Scope: `app/(public)/privacy|terms|cookies/page.tsx` read in full and reconciled
against the product's actual code, schema, and brand positioning · Trigger: founder request for red flags
and specifically **"can pro-white groups sue us for racism and win?"**_

## Relationship to the prior review

This document **complements — does not replace** `docs/blacqlist/legal/privacy-terms-compliance-review.md`
(2026-06-20 / 06-30). That review reconciled each policy claim to the data flows and resolved/deferred a set
of accuracy findings (deletion flow, portability wording, Stripe-not-live, controller identity, DMCA agent,
IP hashing, cookie banner, verification-doc purge). It is a good **compliance-accuracy** review.

It did **not** do two things this review adds:

1. A **civil-rights / discrimination-litigation** analysis. The prior review's only touch on this was a
   one-line note in *Standing limitations* that an attorney should look at "the Black-owned-business
   definition and editorial-discretion language (Terms §4)." That is the founder's headline question, and it
   deserves its own treatment — Part 1 below.
2. Three **page-level gaps** the prior round did not catch — the "usage data anonymized" contradiction,
   receipt card-data (PAN) redaction, and the absence of an arbitration / class-action waiver — Part 2 below.

Do not re-litigate the prior review's resolved items here; this picks up where it left off.

---

## Part 1 — Discrimination-lawsuit exposure (the headline question)

**Short answer.** *Can* an organized "anti-DEI" or "pro-white" group sue The BLACQList for racial
discrimination? **Yes** — and the platform's public "by and for the Black community" posture puts it squarely
in the profile these groups target. *Would they win?* **On the current model, no — the platform is
defensible.** But the risk is not zero, and there is **one specific, planned feature that flips a defensible
posture into a losable one: launching paid business features that only Black-owned businesses can buy.**

### Who actually sues, and why this platform fits the target profile

`[Inference]` Post-2023, well-funded litigation shops — most prominently **Edward Blum's American Alliance
for Equal Rights** and **America First Legal** — actively search for explicitly race-conscious *private*
programs to challenge. Their strategy is to find a program that conditions a benefit on race and manufacture
a plaintiff (often an association whose member was "ready and able" to apply but was ineligible by race). An
openly, proudly "by and for the Black community" venture that is **incorporated in Georgia** is exactly the
kind of defendant they seek. `[Inference]` The practical cost here is not only *losing* a suit — it is the
expense, distraction, and reputational drag of *being sued at all*, even in a suit you would ultimately win.

### The governing legal theory and precedent

- **42 U.S.C. § 1981** guarantees all persons "the same right … to make and enforce contracts" regardless of
  race. It is **race-neutral** — it protects white plaintiffs (settled since *McDonald v. Santa Fe Trail
  Transp. Co.*, 1976) and it reaches **private** actors (no "state action" requirement). This is the weapon
  of choice against private race-conscious programs. `[Research finding — statute + case law, general legal
  knowledge as of 2026-01; not re-verified against current reporters]`
- **_American Alliance for Equal Rights v. Fearless Fund Mgmt., LLC_ (11th Cir., 2024)** is the on-point
  precedent: the court enjoined a grant contest open only to Black-women-owned businesses as a **likely §1981
  violation.** Critically, the **Eleventh Circuit covers Georgia** — the BLACQList's home jurisdiction — so
  the most dangerous precedent is binding right where the LLC sits. `[Research finding — case law]`
- Backdrop: **_Students for Fair Admissions v. Harvard_ (2023)** did not itself govern private companies, but
  it emboldened the §1981 wave against private DEI/race-conscious programs. `[Research finding — case law]`

**Why the platform is still defensible: the model is materially different from Fearless Fund.** Fearless Fund
handed out **money** (a contract/benefit) based explicitly on the recipient's race. The BLACQList is a
**directory**, and the exposure is highly **asymmetric** depending on *who* is arguably excluded from *what*:

| Surface | Exposure | Why |
|---|---|---|
| **Consumer side** — anyone browsing, searching, saving, submitting receipts | **Very low** | Verified in code: signup has **zero race gating**; non-Black "allies" are explicitly welcome as users (brand strategy: "Welcome as users"). No consumer is denied *service* by race → the Title II / public-accommodation theory has almost nothing to bite on. |
| **The directory itself** — which businesses get listed/curated | **Low & defensible** | A curated "list of Black-owned businesses" is **expressive/editorial activity protected by the First Amendment** (cf. *303 Creative v. Elenis*, 2023; *Hurley*). Terms §4 already frames it as "an editorial directory… Listing inclusion is an editorial decision." `[Inference]` That framing is a genuine legal asset — preserve and strengthen it. |
| **Paid, race-gated business features** — the danger zone | **This is where a suit becomes winnable against you** | The moment a business **pays you** for a listing/promotion/premium tier and that paid product is available **only** to Black-owned businesses, you have moved from "editorial speech" to **"refusing to contract with someone because of the owner's race"** — the exact §1981 theory Fearless Fund won on. `[Inference]` The First Amendment shield weakens once money changes hands for a commercial service. |

### The trigger event

`[User-provided fact / code-verified]` Stripe subscription tiers (**Standard $29 / Premium $79/mo**) are
**built but not live** (`lib/stripe/plans.ts`, `app/api/stripe/create-checkout-session/route.ts`; Privacy §6
says "when paid features become available"). Paid features currently gate *analytics / priority placement /
AI suggestions* — not listing access — and **no code restricts paid tiers by owner race.** But the entire
directory is, by design, Black-owned businesses only. So when billing goes live, the practical effect is that
**a paid commercial product is offered only to businesses of a particular owner race** — which is the §1981
fact pattern. `[Needs professional review]`

The **"Verified / BLACQList Certified" badge** is a second §1981 touchpoint if it ever becomes a paid or
contractual benefit gated by race (see Part 2, Finding 5). Its verification criteria are currently undefined.

### Verdict and required action

`[Inference]` **Defensible today** (free directory, open consumer access, editorial curation). **The single
most important legal decision in this venture is how paid features and the "Certified" badge are structured
relative to owner race — and that decision must be made with a civil-rights / constitutional litigation
attorney (post-*SFFA* / post-*Fearless Fund*) BEFORE billing is switched on.** `[Needs professional review]`
This is not a checkbox; it is the gating legal question for monetization.

### ✅ ANSWERED — 2026-08-27

**The gating question above went to counsel and came back clean.** `[Observed — founder, 2026-08-26]`

> **Question asked:** can a platform that centers Black-owned businesses run paid tiers without creating a
> §1981 exposure?
> **Answer: clean — no conditions.** Paid tiers **as designed** are approved. Nothing carries into the
> marketplace cart build as a constraint.

Recorded in `docs/blacqlist/ops/decision-log.md` under *"2026-08-26 — E1 · §1981 / paid tiers — RECORDED —
clean, no conditions."* Closes ops ledger `2.3` and `4.0b`.

⚠ **Three things this answer does not do, stated so the clearance is not read wider than it is:**

1. **It is labeled `[Observed]`, not `[Decision]` or `[Measured]`.** The founder stated the answer in session
   and declined to produce the written response, so **no attorney letter exists in this repo**. The reader of
   this document is seeing a relayed answer, not the source.
2. **"As designed" is load-bearing.** What was cleared is the structure this document describes as the safe
   one: `lib/stripe/plans.ts:23-26` sells every tier to every business at the same price regardless of the
   ownership label, and there are **zero ownership checks on the checkout path.** The rule at
   `.claude/rules/moderation-policy.md` — *"do not make a paid tier, placement, or badge contingent on the
   `Black-Owned` label"* — is **part of the cleared design and stays binding.** Gating a paid product by
   owner race would put the platform back on the *Fearless Fund* fact pattern **outside the scope of this
   answer**, and would need a fresh referral.
3. **The badge touchpoint is not covered.** Part 2 Finding 5 — undefined "Verified / BLACQList Certified"
   criteria — was flagged here as a *second* §1981 surface if the badge ever becomes a paid or contractual
   benefit. Certification is currently automatic and free (six computed criteria, no human grant), which is
   why it is not implicated. **It becomes implicated the moment it is sold.** `[Needs professional review]`
   still applies to Finding 5 on its own terms.

**Also not covered:** the tax + payout model for marketplace checkout (ops referral **E5**, CPA + attorney),
which gates *going live* with checkout rather than building it. And the arbitration/class-waiver question at
Part 2 Finding 3, which is a different theory entirely.

### Two traps to avoid

- **Don't over-rely on the Georgia forum/choice-of-law clause (Terms §12) for this risk.** `[Inference]` It
  binds *users who agreed to the Terms*; a Blum-style plaintiff is typically a **third party who never signed
  up**. And a choice-of-law clause cannot waive **non-waivable state civil-rights protections** — e.g.,
  **California's Unruh Civil Rights Act**, which reaches online businesses serving Californians and carries
  statutory damages. Because businesses and consumers are nationwide, a plaintiff can forum-shop.
- **Don't add race-based *consumer* gating to "fix" anything.** The open-to-all-consumers design is the
  platform's strongest shield. Keep it.

### Levers to raise with counsel (options to discuss — explicitly not recommendations)

`[Needs professional review]` — for the attorney conversation, not decisions to make unadvised:
1. Strengthen the **editorial/expressive-purpose** framing (a stated First Amendment mission behind the curation).
2. Decide the structural question: are paid features **gated to Black-owned businesses**, or offered to **any
   business that wants to reach this audience**, with "Black-owned" treated as self-identified editorial
   content rather than a commerce-eligibility gate? This is the crux.
3. Keep consumer access fully open (already the case).
4. Define and document the **"Certified" criteria** (also a consumer-protection issue — Finding 5).
5. Obtain a **written legal opinion** before flipping on paid, race-gated features.

---

## Part 2 — Page-level red flags

Risk scale (consistent with `.claude/rules/compliance.md`): **High** = legal exposure / required by law ·
**Medium** = strongly recommended / risk if a complaint is filed · **Low** = trust / defensibility.

| # | Finding | Severity | Evidence | Recommended fix | Status |
|---|---|---|---|---|---|
| 1 | **Privacy policy says usage data is "stored in anonymized form" — the code contradicts it.** | **High** | Privacy §2 (`privacy/page.tsx:74`) claims searches/views/saves/CTA-clicks are "stored in anonymized form." But `analytics_events` retains **`user_id`** (`lib/supabase/types.ts`; `app/api/analytics/event/route.ts:93`), so those events **are** individually linkable internally. Only the *public* Circulation-Map display is anonymized. A public privacy representation that doesn't match the implementation is an **FTC Act §5 "deceptive practice"** exposure. | Either (a) reword §2 to the truth — e.g., "stored linked to your account and displayed publicly only in aggregated/anonymized form" — or (b) strip `user_id` from `analytics_events`. Wording fix is the fast path. | **NEW** — not caught by prior review (which only addressed IP hashing, its Finding 6). |
| 2 | **Receipt images stored unredacted — may contain full card numbers (PAN).** | **Med-High** | The "community spend" feature stores uploaded receipt images in the private `receipts` bucket (`app/api/upload/route.ts`) with no OCR/masking/redaction (`grep` for redact/scrub/mask in upload path → none). Retail receipts can show full or partial card numbers. Storing PAN pulls the app into **PCI-DSS scope** and the images are **CPRA "sensitive personal information"** (financial). Policy doesn't *claim* redaction, so it's a gap, not a misrepresentation — but a real one. | Mask/blur card digits on upload, or require pre-redacted uploads, or run server-side detection to reject images containing PAN. Then state the handling in Privacy §4. | **NEW** — adjacent to ticket 101 (verification-doc purge), but distinct (that's about deletion timing, not PAN redaction). |
| 3 | **No arbitration clause / class-action waiver in the Terms.** | **Medium** | `terms/page.tsx` §12 sets Georgia governing law and exclusive Georgia jurisdiction but contains **no mandatory-arbitration or class-action-waiver provision** — the standard consumer-platform tool for capping mass-litigation exposure. | Have counsel weigh adding a mandatory-arbitration + class-waiver clause (with the usual carve-outs, e.g., California public-injunction *McGill* issues). Note it helps against **user** disputes; it does **not** stop the third-party associational §1981 plaintiff in Part 1. | **NEW.** |
| 4 | **DMCA registration number needs confirmation.** | **Medium** | Terms §8 (`terms/page.tsx:226-229`) publishes "Registration No. **DMCA-1074879**." Ticket 102 shows it was **submitted 2026-06-30** (pay.gov tracking 283O6ROF) — so it's real, **not fabricated** — but the ticket itself flags "confirm active in USCO directory once payment clears," and the `DMCA-#######` format is **unusual for an actual USCO record identifier.** Publishing an unconfirmed/mis-formatted reg number weakens the very safe-harbor it's meant to secure. | Confirm the registration is **active** in the USCO public directory and that the published number **is the USCO record ID** (not the pay.gov tracking or an internal ref). Correct the page if the identifier differs. | Refines prior **Finding 5** (which marked this "✅ Done"); treat as **verify-before-launch**. |
| 5 | **"Verified / BLACQList Certified" criteria are undefined.** | **Medium** | Terms §2/§4 reference "Verified"/"BLACQList Certified" badges and a ≥51% Black-ownership standard, but the claim flow (`components/claim/ClaimForm.tsx`, `lib/actions/claims/createClaim.ts`) is **attestation + manual admin review** with **no defined ownership-verification standard**; brand docs explicitly flag "What does verification mean? Needs documentation." Two risks: **consumer-protection / false-advertising** (consumers direct spend based on "certified Black-owned"; if certification is lax and wrong, that's actionable), and it **feeds the Part 1 §1981 question** if the badge becomes a gated/paid benefit. | Write a documented verification standard (what evidence, who reviews, how often, what the badge asserts). Coordinate with the Part 1 attorney review. | **NEW** (operational gap surfaced by brand docs). |
| 6 | **CCPA/CPRA completeness.** | **Low-Med** | Privacy §8 addresses CCPA rights and truthfully states "we do not sell" (code-verified — no ad networks/data sale). But there's **no mention of honoring Global Privacy Control (GPC) signals**, and receipts/spend are **CPRA "sensitive personal information"** without the corresponding SPI disclosures. Likely under CCPA business thresholds today, but revisit as scale/revenue grow. | Add GPC-honoring language + an SPI disclosure when thresholds approach; keep the accurate "we do not sell." | Extends prior review's CCPA note. |
| 7 | **GDPR-flavored language implies EU scope while the product is US-only.** | **Low** | Privacy §8 uses "supervisory authority" / portability (GDPR framing). Product and launch posture are **US-only** (prior review pinned GA/TX/IL). Harmless over-inclusion **unless** EU marketing begins — then a **cookie-consent banner** (even for cookieless Vercel Analytics) and an EU data-subject-rights layer are required. | No MVP change needed; already tracked as ticket 099. Don't market to the EU without building it. | Consistent with prior **Finding 7**. |

---

## Part 3 — What's solid (stated honestly)

Honesty cuts both ways; these are genuine strengths, several **code-verified** this session:

- **Consumer access is fully open** — no race gating at signup (`app/(auth)/sign-up/page.tsx`). This single
  design choice defuses most public-accommodation / consumer-facing discrimination risk.
- **Privacy claims that match the implementation:** "we do not sell data" / no behavioral ads (no ad-network
  code); **httpOnly** auth cookies (Supabase SSR + Sentry cookie scrub); **row-level security** across tables
  (`supabase/migrations/…rls…`); **IP hashed / not retained raw** (rate-limiter holds IP in memory only;
  Sentry strips it; not written to the DB).
- **Terms §4 editorial-directory framing** is legally smart and worth reinforcing (see Part 1).
- **18+ only, consistently** across pages → no COPPA exposure.
- The three pages are **well-drafted, internally consistent, and cross-linked** — this is a strong starting
  point, which is precisely why the *accuracy* gaps in Part 2 matter.

---

## Part 4 — Prioritized action list

1. ~~**Before switching on paid features:** engage a **civil-rights / constitutional litigation attorney** on
   the §1981 / *Fearless Fund* structure of paid tiers and the "Certified" badge (Part 1).~~ ✅ **DONE —
   answered clean, no conditions, 2026-08-27** `[Observed — founder, 2026-08-26]`. See *"✅ ANSWERED"* in
   Part 1 for the three limits on that clearance. **The badge half is not covered** — certification is
   automatic and free today, so it is not implicated; it becomes implicated the moment it is sold, and
   Finding 5 keeps its own `[Needs professional review]` tag.
2. **Fix the "anonymized" wording** in Privacy §2 (or anonymize `analytics_events`) — Finding 1. *Fast, high-value.*
3. **Implement receipt PAN redaction / handling** and reflect it in Privacy §4 — Finding 2.
4. **Decide on arbitration + class-action waiver** with counsel — Finding 3.
5. **Confirm the DMCA registration is active** and the published number is the USCO record ID — Finding 4.
6. **Document the "Verified / Certified" verification standard** — Finding 5 (coordinate with #1).
7. **CCPA/CPRA polish** — GPC signals + SPI disclosure as thresholds approach — Finding 6.

---

## Standing limitations

- This is a **review, not a compliance guarantee.** Findings are flagged "fix / verify / consult-attorney,"
  never "compliant."
- The pages require a **licensed-attorney review before public launch** — and, distinctly, the **monetization
  model requires a civil-rights specialist's opinion before billing goes live** (Part 1).
- Case-law references (*Fearless Fund*, *§1981*, *303 Creative*, *SFFA*, *Unruh Act*) are stated from general
  legal knowledge as of the author's training and are **not re-verified against current reporters**; counsel
  must confirm current status and application to these facts.
