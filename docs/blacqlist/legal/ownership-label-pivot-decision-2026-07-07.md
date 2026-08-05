# Decision Record — Ownership Label Pivot (Black-Owned / Ally)

> **Disclaimer:** This output is informational and does not constitute legal advice. Requirements vary by jurisdiction, business type, and product specifics. Consult a licensed attorney for guidance applicable to your situation before relying on any of the following.

_Date: 2026-07-07 · Status: **Decided (product/legal direction); implementation prepared; production changes still gated.** · Related: [`legal-pages-and-discrimination-risk-review.md`](legal-pages-and-discrimination-risk-review.md), [`attorney-redline-2026-07-01.md`](attorney-redline-2026-07-01.md)_

---

## What changed

The BLACQList previously admitted **only** Black-owned businesses — a hard eligibility gate enforced at submission (the "majority Black-owned (≥51%)" attestation checkbox) and reinforced by "single criterion" copy.

**New model:** any business may join and buy the same paid tiers. Every business is labeled either **`Black-Owned`** or **`Ally`** (an Ally supports Black-owned businesses but is not itself majority Black-owned). The platform still centers and elevates Black-owned businesses — through **editorial ranking and presentation**, not exclusion.

## Why (the legal rationale)

This directly implements **Lever #2** of the 2026-07-01 discrimination-risk review, which found:

- The free directory is **defensible today** as First-Amendment editorial curation (cf. *303 Creative*, *Hurley*).
- The single move that flips a defensible posture into a **losable** one is offering **paid business features only Black-owned businesses can buy** — the 42 U.S.C. § 1981 fact pattern from *AAER v. Fearless Fund* (11th Cir. 2024), binding in Georgia where the LLC sits.
- The recommended fix, verbatim: _"are paid features **gated to Black-owned businesses**, or offered to **any business that wants to reach this audience**, with 'Black-owned' treated as **self-identified editorial content rather than a commerce-eligibility gate**? This is the crux."_

By opening the commercial surface to all businesses and treating "Black-owned" as a **self-identified editorial label** (that drives ranking, not access), the platform removes the race-based commerce gate while preserving its mission.

## The load-bearing invariant

> **Paid tiers and commercial access are open to every business regardless of ownership label. "Black-Owned" centering is editorial ranking/presentation only — it is never a paid benefit or a commerce-eligibility gate keyed to race.**

Any future change that gates a **paid** feature, a listing, or a purchasable benefit to `black_owned` only re-creates the *Fearless Fund* exposure and must go back to a civil-rights/constitutional litigation attorney before shipping. `[Needs professional review]`

## Decisions locked (this session)

| # | Decision |
|---|---|
| 1 | Non-Black-owned businesses are labeled **"Ally"** (not "Supporter" — that word is the community account role and is left untouched). |
| 2 | Ally businesses have **full commercial access**: they can list and buy the same paid Stripe tiers. The only difference is the label. Black-Owned is centered by **editorial default** (ranking/featuring). |
| 3 | Implemented now; the DB migration is **GATE-DATA** and the deploy is **GATE-DEPLOY** — both await founder approval. |

## What was built (implementation summary)

- **Schema:** authoritative `listings.ownership_label` column (`CHECK IN ('black_owned','ally')`, default `black_owned` so all existing rows are unchanged) — migration `supabase/migrations/20260707000000_listings_ownership_label.sql`. The faceted search RPC gained an `ownership` filter and a Black-Owned-first `ORDER BY` (editorial centering, placed after paid `is_featured`).
- **Onboarding:** the add-business Step-0 gate is now a Black-Owned / Ally choice; the final-step attestation is branch-conditional; `createListing` persists and validates the label.
- **Display/filter:** a distinct `OwnershipBadge` (separate from trust-tier) on cards + profile hero; an "Ownership" facet in the discovery sidebar; the admin entity view shows the label beside the attestation.
- **Copy:** About "Who We Feature" and Terms §4 rewritten to describe centering + the Ally label (Terms §4 marked `[Needs professional review]`).

## Founder decisions — resolved 2026-07-08

- **Owners may NOT change the ownership label after creation.** The label is set once at submission and is not owner-editable. Already enforced: `ownership_label` is written only in the create insert (`lib/actions/listings/createListing.ts`); no owner-facing update action reads or writes it, and `updateListingContent.ts` builds its update from an explicit field allowlist that excludes it. Platform/admin re-labeling remains available (Terms §4 reserves that right); if owner-initiated changes are ever added, they must require re-attestation.
- **Events keep the `black_owned` label.** Event listings center a Black-owned business or creator (the event attestation), so they carry `ownership_label = 'black_owned'` (submitted as a hidden field in `SubmitEventForm.tsx`).
- **Moderation posture** now verifies the **label matches reality** rather than rejecting non-Black-owned businesses (reflected in `.claude/rules/moderation-policy.md`).

## Still open — external sign-off

- **`[Needs professional review]`** — Terms §4 label-conditional warranty and the ownership definitions must be attorney-reviewed before production deploy.
- **`[Needs professional review]`** — Confirm the "Verified / BLACQList Certified" badge is **not** structured as a paid benefit gated by race (Finding 5 of the risk review) as monetization goes live.
