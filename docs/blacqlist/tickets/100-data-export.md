# Ticket 100: Self-serve data export ("download my data")

## Status

Deferred — MVP fulfills portability via manual email request.

## Phase

Post-MVP / V1

## Priority

P2

## Feature Area

Compliance / Privacy / Backend

---

## Context

The Privacy Policy (§8) grants a **portability** right. For MVP this is honored as an **email request** fulfilled manually within 30 days (`privacy@theblacqlist.com`), and the copy now says "in a structured, machine-readable format **where technically feasible**." A self-serve export is the durable fix — it removes manual toil and makes the right verifiable.

Risk rating: **Medium**. Source: `docs/blacqlist/legal/privacy-terms-compliance-review.md`, Finding 2.

---

## User Story

As a registered user, I want to download a copy of my personal data, so I can exercise my portability right without contacting support.

## Acceptance Criteria

- [ ] Authenticated "Export my data" action in Account → Settings.
- [ ] Generates a structured export (JSON and/or CSV) of the user's own rows: profile, saves, reviews, receipt records (metadata; receipt images by signed link), spend records.
- [ ] Excludes other users' data and internal/admin fields.
- [ ] Delivered via a time-limited signed download link or email.
- [ ] Rate-limited; action logged (no PII in logs).

→ **Backend**: build the export action + serializer.
→ **QA**: verify export contains only the requesting user's data.
