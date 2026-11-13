# 196: Holiday and special hours

**Status:** Planned — from the 184 plan, founder 2026-11-13. Not started. Own branch and draft PR off `origin/main` once 184 has merged; **no merge before Wed 18 Nov 2026** (launch merge freeze).
**Follows:** 184 (`EntityHoursOverrides`, `OpenStatus` overrides, `lib/listings/hoursOverrides.ts`), 189 (JSON-LD)
**Area:** business pages, the owner editor (inside `#hours`)
**Gates:** GATE-DATA for the migration.

## Why

The number-one reason customers call. `OpenStatus` can only be wrong on a holiday today.

## Proposed shape

- `listing_hours_overrides(listing_id fk cascade, date, closed bool, open, close, label ≤60, created_at, updated_at, pk(listing_id, date))`; RLS as `listing_faqs`. All tiers — hours are basic.
- The loader fills `entity.hoursOverrides` with the next 30 days; `OpenStatus` and the Visit block already read them. JSON-LD gains `specialOpeningHoursSpecification` (189's builder).
- Past rows are purged by the existing cleanup-cron pattern.

## Checks

- Migration test; a closed override today shows "Closed today — {label}"; an open override changes today's hours; the list shows only the next 30 days.
