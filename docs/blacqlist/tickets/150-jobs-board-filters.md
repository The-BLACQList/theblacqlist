# Ticket 150: The Jobs board with Where and Kind of work filters

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready
**Depends on:** 149 (job card, skeleton). 152 sets `city_id` on new jobs; until then the Where filter only lists Remote plus cities that exist on jobs.
**Gates:** none. No migration, no new dependency. Still covered by `FEATURE_JOBS_OPEN=false`.
**Decision record (founder, 2026-10-30, screen 1):**

1. **Board A.** Header with "Post a job", filter chips that apply on tap: **Where** (Remote plus each city with open roles) and **Kind of work** (full-time, part-time, contract, internship, volunteer). Cards in a grid, 1 column on a phone, 2 to 3 on a computer.
2. **Filters live in the URL** and survive a refresh.
3. **Four states**, copy fixed below.
4. **Subhead** "Open roles at Black-owned businesses" stays (23 Oct site-copy rule).
5. **Temporary chip** added as a sixth Kind of work chip. `[Decision — founder, 2026-10-30]`
6. **H1 is "Jobs".** The old "Black-Owned Business Jobs" goes; the eyebrow above it is dropped so the page does not say "Jobs" twice. `[Decision — founder, 2026-10-30]`

---

## Why

`app/(public)/jobs/page.tsx` takes only `page`. There is no way to narrow by place or kind of work, the error state has no retry and no filters, and the empty state does not tell owners where to start. The `/soon/jobs` cover already promises "Filter by city and kind of work".

## Scope

In:

- **URL params** `where` (`remote` or a city slug) and `type` (`full-time|part-time|contract|internship|volunteer|temporary`, comma list allowed). Validate with zod in `lib/validations/jobs.ts`; unknown values are dropped, not errors. Reset `page` when a filter changes.
- **`components/jobs/JobFilters.tsx`** (client). Two chip groups using `useSearchParams` + `router.replace` (pattern from the dashboard filters in `frontend.md`). A chip is a toggle button with `aria-pressed`. Active chips show a count line "Showing {n} roles" in an `aria-live="polite"` region. "Clear filters" appears when any filter is active.
- **Where options** come from a server query: distinct cities of open published jobs plus Remote when any open job is remote. Add `getJobFilterOptions()` in `lib/listings/jobs.ts` (new). Only cities with at least one open role are shown.
- **Query.** Extend `queryListings` call for `type: 'job'` with the two filters. Remote means `workplace_type = 'remote'`; a city means the listing `city_id`. Because the faceted RPC knows neither, filter by id set: fetch matching `listing_id`s from `listing_details_job`, then pass them in. If that proves clumsy with pagination totals, fall back to a dedicated `queryJobs()` in `lib/listings/jobs.ts` using the same `NESTED_SELECT` and `LISTINGS_PAGE_SIZE`. Builder decides, and notes it in the PR. Open roles only: `closes_at IS NULL OR closes_at > now()`.
- **Kind of work set.** Six chips: Full-time, Part-time, Contract, Internship, Volunteer, Temporary (founder, 2026-10-30). Labels come from `JOB_EMPLOYMENT_TYPE_META`.
- **States** (copy exact):
  - Empty, no filters: "No open roles right now" / "Roles appear once businesses post them and our team approves them." Owners (signed in with a business) see a "Post the first one" link to `/add-job`; others see "Browse businesses". The existing `postingSubmissions` gate on the link stays.
  - Loading: 6 `JobCardSkeleton`s in the same grid, chips shown disabled-looking but not hidden. Suspense fallback replaces `<DiscoveryGrid isLoading />`.
  - Error: "We couldn't load jobs just now" with a **Try again** button (`router.refresh()`), filters kept in the URL and visible.
  - No match: "No roles match these filters" with **Clear filters**.
- Header: H1 "Jobs" (founder, 2026-10-30; replaces "Black-Owned Business Jobs", no separate eyebrow), subhead, "Post a job" button (top right on 1280px, full-width under the subhead on 375px).

Out:

- Search box on the board, sorting options, saved searches, job alerts.
- Cron/closing logic (155).

## Acceptance criteria

- Given `/jobs?type=volunteer`, when the page loads, then only volunteer roles show and the Volunteer chip is pressed.
- Given I tap "Remote" then "Part-time", then the URL becomes `/jobs?where=remote&type=part-time` and the grid updates without a full reload.
- Given I reload or share that URL, then the same filters apply.
- Given filters that match nothing, then I see "No roles match these filters" and tapping "Clear filters" returns to `/jobs` with all open roles.
- Given no open roles at all, then I see "No open roles right now" and the owner link as above.
- Given the query throws, then I see "We couldn't load jobs just now", **Try again** reloads, and the chips and URL are unchanged.
- Given a role whose `closes_at` is in the past, then it does not appear.
- Given `?type=nonsense`, then it is ignored and the page shows all roles (no 400).
- Mobile 375px: chips scroll in a single horizontal row per group inside their own `overflow-x-auto` container, page body does not scroll sideways, chip hit area at least 44px high. 1280px: groups sit inline above the grid, 3 columns.
- The H1 reads "Jobs" and the page never shows "Black-Owned Business Jobs". The document `<title>` and metadata description follow the same wording.
- A11y: groups are `role="group"` with a visible label ("Where", "Kind of work"); chips reachable by Tab and toggled with Space/Enter; focus stays on the chip after tap; count change announced politely.

## Data note

No migration. Reads `listing_details_job`, `listings`, `cities`. `listing_details_job` has no index on `closes_at`; at the current volume this is fine. 155 reconsiders it.

## Tests

- Unit (`tests/jobs-filters.test.ts`): param parsing (valid, unknown dropped, comma list, `where=remote`), URL builder resets `page`.
- Unit: `getJobFilterOptions` returns only cities with open roles and adds Remote only when present.
- Playwright (`e2e/jobs-board.spec.ts`, runs with `FEATURE_JOBS_OPEN=true` set for that spec only): filter by kind updates URL; clear filters; no-match state. Existing `e2e/opening-soon.spec.ts` must still pass with the flag off (`/jobs` still shows the cover).

## QA notes

Test on staging with at least: one remote, one Atlanta on-site, one volunteer, one expired. Check back/forward buttons after toggling chips. Kill the network to see the error state and Try again.
