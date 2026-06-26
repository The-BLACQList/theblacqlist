# Editorial Review Guide — Admin Reference

> **For internal use only.** This guide is for The BLACQList admin team when reviewing listing submissions and claims.

---

## What We Are

The BLACQList is an **editorial directory**. Every listing inclusion decision is an editorial judgment — the same way a publication decides what to cover. This framing is intentional and legally significant. Listing approvals and rejections are editorial decisions, not commercial transactions.

This means:
- We have full discretion to approve or reject any submission that does not meet our criteria.
- Rejections do not need to be justified to the submitter beyond the neutral reason we provide.
- Never communicate a rejection reason that mentions the submitter's race, ethnicity, or personal characteristics. Rejection reasons should always describe the *listing*, not the *person*.

---

## Eligibility Criteria

A listing is eligible for The BLACQList if it meets **all three** of the following:

| Criterion | Definition |
|---|---|
| **Majority Black-owned** | Black or African American individual(s) hold ≥51% ownership interest |
| **Operational control** | Black owner(s) actively manage the business — not a passive investor or silent partner arrangement |
| **Currently operating** | The business is actively serving customers — not closed, on indefinite hiatus, or pre-launch only |

Entity type and category do not affect eligibility. A restaurant, a professional services firm, a creative, and a vendor all qualify if the ownership/control criteria are met.

---

## Reviewing a Submission

When a listing reaches `status = pending`, it appears in the admin queue at `/admin/entities`. Open the detail page to review.

### What to check

1. **Ownership attested** — The detail page shows whether the submitter checked the ownership attestation at submission. A `✗ Not attested` flag means the form was submitted via an older path (pre-attestation feature) or via admin/import. Treat these with higher scrutiny.

2. **Business information completeness** — Does the listing have a name, description, category, and contact information? Incomplete listings should be rejected with the "Incomplete information" reason and invited to resubmit.

3. **Basic verifiability** — Can you find any public evidence this business exists? A quick web search for the business name + city is sufficient for most submissions. If nothing comes up and the listing has no website or social links, use "Unverifiable information."

4. **Duplicate check** — Search `/admin/entities` for the business name. If a published listing already exists for this business, reject with "Duplicate listing."

5. **Active status** — If the business appears to be permanently closed (closed social pages, closed website, Google Maps shows "permanently closed"), reject with "Appears inactive."

### What NOT to check

- Do not investigate or verify the owner's race or ethnicity directly. The submission attestation + Terms of Service establishes the legal record of eligibility. Your role is to verify the *listing* (completeness, accuracy, active status), not to adjudicate race.
- Do not ask submitters to provide proof of race or ancestry.
- Do not reject a listing because the owner's name or profile does not appear to be a person of color. Appearance-based assumptions are not appropriate and create legal risk.

---

## Rejection Reasons — Approved Language

Always use one of the approved reason codes. These are available as presets in the admin rejection form.

| Code | Admin label | Text sent to submitter |
|---|---|---|
| `EDITORIAL_CRITERIA` | Does not meet editorial focus | "This submission does not meet our current editorial guidelines." |
| `INSUFFICIENT_INFO` | Incomplete information | "We need more information to review this listing. Please resubmit with complete details." |
| `DUPLICATE` | Duplicate listing | "A listing for this business already exists in our directory." |
| `INACTIVE` | Appears inactive | "We were unable to verify that this business is currently active." |
| `INACCURATE` | Unverifiable information | "The information provided could not be verified. Please ensure all details are accurate and resubmit." |

You may edit the preset text to add specifics (e.g., "A listing for **Busy Bee Cafe** already exists"), but do not change the core framing. Never add language that implies the submitter's race, background, or identity is the reason for rejection.

### What to never say

Do not reject with language like:
- "Your business does not appear to be Black-owned."
- "We cannot verify the race or ethnicity of the owner."
- "This business does not qualify based on ownership background."

These phrases expose the platform to unnecessary legal risk and are also unnecessary — the approved reason codes cover every legitimate rejection scenario without naming race.

---

## Escalation

If a submission is unclear — for example, a business that appears to be a partnership or franchise and ownership is not obvious — escalate to the editorial lead rather than rejecting unilaterally.

If a submitter contacts support to dispute a rejection:
- Do not provide additional detail beyond the reason already sent.
- Do not reopen the review on the basis of the dispute alone.
- Escalate to the editorial lead if the submitter provides new information (e.g., documentation of ownership structure).

---

## Claim Reviews

Claim reviews verify that the person submitting the claim is the legitimate owner or authorized representative of an already-listed business. The editorial eligibility of the listing is not re-evaluated during the claim review — it was assessed at submission.

For claims, focus on:
- Is the claimant's contact info (email, phone) consistent with the business?
- Did the claimant provide a verification document (if required)?
- Is the claimant's stated role (owner/manager/authorized agent) plausible for the business size?

Claim approval grants `owner` access and sets `trust_tier = 'claimed'`. This unlocks the owner dashboard, analytics, and the ability to publish/unpublish.
