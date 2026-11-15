# 192: Credentials, awards and press

**Status:** In PR — stacked on 110 (#341). Migration `20261123000000_listing_credentials.sql` not applied anywhere yet: staging needs the founder's OK, production is GATE-DATA. Until it is applied the page loader treats the missing table as "no items", and the dashboard page says it couldn't load them. What shipped: a new gated feature `credentials` at Starter (FEATURE_MIN_TIER 1), and the section registry gate moved from free to it. Owners add, edit, reorder (Move Up/Down) and remove items under Dashboard → Credentials; adding needs Starter, while editing, reordering and removing work on every plan. Below Starter the section is hidden and nothing is deleted (ticket 105 policy). A page holds at most 30 items whatever the plan (a bound, not a plan limit). The form refuses a year after the current one or before 1900, and any link that isn't https with a real host (no user:password, 500 characters max); the table's CHECKs mirror the form, except the future-year rule, which a CHECK can't read the clock for. RLS as `listing_faqs`. Press links open in a new tab with `rel="noopener noreferrer"`, and there are no publication logos. The section's band heading is now Title Case ("Awards & Press").
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
