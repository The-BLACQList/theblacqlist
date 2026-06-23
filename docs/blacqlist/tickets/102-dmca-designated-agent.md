# Ticket 102: Register a DMCA designated agent

## Status

Deferred — founder/legal action; Terms now reference the process with a `[CONFIRM]` placeholder.

## Phase

Pre-launch (founder action) / V1

## Priority

P2

## Feature Area

Compliance / Legal

---

## Context

Terms of Service §8 now includes a copyright/DMCA notice block describing how to send an infringement notice (to `notice@theblacqlist.com`) and stating we act on valid notices and terminate repeat infringers. To preserve the **DMCA safe harbor** for user-generated content (reviews, photos, listings), the operator should **register a designated agent with the U.S. Copyright Office** and surface that agent's details. The Terms carry a `[CONFIRM: DMCA designated agent…]` placeholder until this is done.

Risk rating: **Medium**. Source: `docs/blacqlist/legal/privacy-terms-compliance-review.md`, Finding 5.

---

## User Story

As a copyright holder, I want a clear, registered channel to report infringing content, so my notices are handled under the DMCA — and as the operator, I want the safe harbor that registration provides.

## Acceptance Criteria

- [ ] Founder registers a DMCA designated agent with the U.S. Copyright Office (DMCA Designated Agent Directory).
- [ ] `notice@theblacqlist.com` (or a dedicated inbox) is monitored, with an intake/triage process.
- [ ] A repeat-infringer policy is documented internally.
- [ ] Replace the `[CONFIRM: DMCA designated agent…]` placeholder in Terms §8 with the registered agent's name/contact.

→ **Founder/Legal**: complete USCO registration and confirm agent details.
→ **Frontend**: replace the Terms placeholder once details are confirmed.
