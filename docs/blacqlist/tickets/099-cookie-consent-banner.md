# Ticket 099: Cookie-consent banner (GDPR — EU only)

## Status

Deferred — out of MVP scope (US-focused launch). Activate before any EU marketing or EU-targeted expansion.

## Phase

Post-MVP / V1+

## Priority

P3 for US launch · **P1 if the EU/UK enters scope**

## Feature Area

Compliance / Privacy / Frontend

---

## Context

Vercel Analytics + Speed Insights run on every page (`app/layout.tsx`) with no consent gate. For the pinned **US-focused** launch this is acceptable: Vercel Analytics is cookieless and non-identifying, and CCPA does not require opt-in consent for it. Under **GDPR/ePrivacy**, non-essential analytics require prior consent, so a banner would be required the moment the product targets or markets to EU/UK users.

Risk rating: **Low** (US scope) / **High** (EU scope). Source: `docs/blacqlist/legal/privacy-terms-compliance-review.md`, Finding 7.

---

## User Story

As an EU visitor, I want to consent to (or reject) non-essential analytics before they run, so my privacy choices are respected under GDPR.

## Acceptance Criteria

- [ ] Banner appears on first visit with **Accept / Reject / Manage** — equally weighted choices.
- [ ] No non-essential analytics (Vercel Analytics/Speed Insights) load until the user accepts.
- [ ] Essential auth cookies are exempt and clearly labeled as such.
- [ ] Choice persisted; re-consent prompt on policy change.
- [ ] Reachable from the footer (“Cookie preferences”) to change later.
- [ ] Only shown to EU/UK visitors (geo-gated) unless a global default is chosen.

→ **Frontend**: implement the banner + analytics gating.
→ **Privacy**: confirm which technologies require consent before enabling.
