# Ticket 154: Where Jobs shows up (home, dashboard, business page)

**Phase:** V1.5 · **Priority:** P2 · **Status:** Ready
**Depends on:** 149 (card for "Now hiring"), 150 (board for the tile's link), 152 (the Post a job destination). The tile must not go live before `FEATURE_JOBS_OPEN` is turned on.
**Gates:** none. No migration, no new dependency. Everything here is behind `isFeatureEnabled('jobsOpen')`, so merging changes nothing for visitors while Jobs is covered.
**Decision record (founder, 2026-10-30, screen 6):** Entry B, visible. The home Avenues Jobs tile turns on (live count of open roles) once Jobs is open; the dashboard shows "Post a job" with postings left; a business page shows "Now hiring" with its open roles.

---

## Why

Jobs is hidden today: `components/home/TheAvenues.tsx` marks the tile `hidden: true` with `comingSoon: true` and a hardcoded count of 0 (`avenue.key === 'jobs' ? 0 : ...`). No owner surface mentions it and a business page never shows its roles.

## Scope

In:

- **Home tile.** In `TheAvenues.tsx` remove the hardcoded `hidden: true` and drive it by `jobsOpen`: shown only when the flag is on, linking to `/jobs`, with the live count of open roles (`closes_at` null or future, `status = 'published'`). Add `jobs` to `AvenueCounts` and to the counts query that feeds `counts` (find it where `TheAvenues` gets its props in `app/page.tsx`). Count of 0 reads "No open roles yet" and still links to the board. The grid already handles 5 or 6 tiles (`tileSpan`, `lg:grid-cols-5/6`); recheck the section eyebrow "One index, five avenues" which must become "six" when the tile shows. Remove `comingSoon` for jobs.
- **Dashboard "Post a job".** Assumption: the existing Publish card (`components/dashboard/PublishSection.tsx`) is per listing, so there is no dashboard-wide Publish area. Add a "Post a job" card to the overview `app/dashboard/page.tsx` (component `components/dashboard/PostJobCard.tsx`) for users who own at least one published business: shows "Post a job" button to `/add-job` and the line "{n} of {limit} included postings left" from `jobQuotaFor` (free/Starter, limit 0: "Each role is {JOB_POSTING_PRICE_DISPLAY} for 30 days"). Hidden when `jobsOpen` is off or `postingSubmissions` is off. If the quota read fails, show the button with no count.
- **Business page "Now hiring".** New `components/entity-page/EntityNowHiring.tsx` rendered by the business templates under the main details when the business has open roles; heading "Now hiring", up to 3 `JobCard`s, "See all {n} roles" link to `/jobs` filtered by that business if more (assumption: add a `business` param to 150's parser in this ticket, one line). Data: `getOpenRolesForBusiness(listingId)` in `lib/listings/jobs.ts` (published, not closed, `hiring_listing_id = id`). Hidden entirely when there are none (no empty state) or the flag is off.
- Update `lib/features/opening-soon.ts` only if needed so that the tile and block do not appear in the `/soon` cover path.

Out:

- Email or notification when a role is posted, a "Jobs" item in the main nav, jobs on the map, jobs in the footer.
- The role-by-role dashboard list (the existing page editor covers it).

## Acceptance criteria

- Given `FEATURE_JOBS_OPEN=false`, when I load the home page, then there is no Jobs tile and the eyebrow reads "One index, five avenues" (unchanged).
- Given the flag on and 4 open roles, then the home shows a Jobs tile with "4 open roles" linking to `/jobs`; with 1 role it reads "1 open role"; with none "No open roles yet".
- Given the flag on, when a business owner opens the dashboard, then they see "Post a job" and "1 of 1 included postings left" (Growth), "0 of 1 left" after using it, and the price line for Free.
- Given a user with no published business, then the dashboard does not show the card.
- Given a business with 2 open roles, then its page shows "Now hiring" with 2 job cards; with none, the block is absent; with a closed role only, the block is absent.
- Given a business with 5 open roles, then 3 cards show and "See all 5 roles" links to the filtered board.
- Mobile 375px: tiles two across, Jobs tile last and full-width if odd; dashboard card full width, button 48px; Now hiring cards one column. 1280px: six tiles in one row; Now hiring up to 3 across.
- A11y: tile is one link with the count in its accessible name; "Now hiring" is an `h2` in a `section aria-labelledby`; cards follow 149 rules.
- No em dashes; "Black-owned" does not appear on the cards or tile.

## Failure states

| Failure | User sees | Recovery |
|---|---|---|
| Count query fails | Tile shows "Find your next role" with no number | Click through to the board |
| Quota read fails | Dashboard card without the count | Button still works |
| Open-roles query fails | "Now hiring" block omitted, page unaffected | None needed |

## Data note

No migration. Count and list are read queries on `listings` + `listing_details_job`. Cache the home count with the same revalidate window as the other avenue counts.

## Tests

- Unit: counts mapper includes `jobs` only when the flag is on; tile label for 0, 1, n; `getOpenRolesForBusiness` excludes closed and unpublished.
- Playwright: with the flag off the home page has no Jobs tile (extend `e2e/opening-soon.spec.ts` assertion, must still pass); with the flag on (new spec) the tile links to `/jobs`.

## QA notes

Flip `FEATURE_JOBS_OPEN` on a staging preview only. Check five-vs-six tile layout at 375, 768 and 1280. Confirm the dashboard count after posting through 152.
