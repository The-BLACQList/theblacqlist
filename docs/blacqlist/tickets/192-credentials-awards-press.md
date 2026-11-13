# 192: Credentials, awards and press

**Status:** Planned — from the 184 plan, founder 2026-11-13. Not started. Own branch and draft PR off `origin/main` once 184 has merged; **no merge before Wed 18 Nov 2026** (launch merge freeze).
**Follows:** 184 (`EntityCredentialsSection`), 107 (the table pattern)
**Area:** business pages, the owner dashboard (`/dashboard/pages/[id]/credentials`)
**Gates:** GATE-DATA for the migration.

## Why

Trust the business brings with it, distinct from platform trust: licences and certifications for a professional, an award for a café, press mentions for a studio.

## Proposed shape

- `listing_credentials(id, listing_id fk cascade, kind license|certification|award|press, title ≤80, issuer ≤80, year int, url, sort_order, created_at, updated_at)`; RLS as `listing_faqs`; `set_updated_at`; index `(listing_id, sort_order)`.
- Starter+ (decided here; the registry entry is free today). URLs must be https; press links open in a new tab with `rel="noopener noreferrer"` (the component already does). No publication logos — licensing.
- The loader fills `entity.credentials` when allowed; the section groups by kind, as it does on the sample.

## Checks

- Migration test; URL validation; a year in the future is rejected.
