# 196: Holiday and special hours

**Status:** In PR — stacked on 195 (#345). Migration `20261127000000_listing_hours_overrides.sql` not applied anywhere yet: staging needs the founder's OK, production is GATE-DATA. Until it is applied the page shows only the weekly hours (the read is fail-soft), Dashboard → Special Hours says it couldn't load, and the expiry cron reports the purge as skipped. What shipped: `listing_hours_overrides` (pk listing + date; closed with no times, or open with both "HH:MM" times, closing after opening; reason 1–60 or null; RLS as `listing_faqs`), every plan, business pages only. Dashboard → Special Hours (also linked from the Hours card): add a date as Closed All Day or Open, Different Hours, with an optional reason; edit (including moving it to another date) and remove. Dates run from today to a year ahead, up to 60 upcoming. The loader reads yesterday through 31 days ahead and the page narrows it to the next 30 days in the viewer's time zone, so `OpenStatus` and the Visit block (both from 184) use them. JSON-LD gains `specialOpeningHoursSpecification` (one entry per date; closed is 00:00–00:00). The daily expiry cron deletes rows more than two days past. **Two changes from the proposed shape:** the editor is its own dashboard page (`/dashboard/pages/[id]/special-hours`) with a link from the `#hours` card rather than a panel inside it, since that card saves through the shared Finish form; and an open day can't run past midnight, because the open/closed status has no overnight rule (the form says to end at 11:59 PM).
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
