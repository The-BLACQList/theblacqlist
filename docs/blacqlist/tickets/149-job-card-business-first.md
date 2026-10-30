# Ticket 149: The job card, business first

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready
**Depends on:** none (first of the Jobs redesign; merge before 150, 154)
**Gates:** none. No migration, no new dependency. Jobs stays covered (`FEATURE_JOBS_OPEN=false`); `e2e/opening-soon.spec.ts` must still pass.
**Decision record (founder, 2026-10-30, `docs/blacqlist/design/jobs-workshop-2026-10.md`, screen 2):**

1. **Card B, business first.** Top: business mark and name with the place. Then the role title. Then fact chips: pay, kind of work (teal, Jobs only), Remote if remote. Foot: "Closes {date}".
2. **One card everywhere.** The same component is used on the board, in search and on the business page.
3. **"Black-owned" is never a card label** (founder, 2026-10-16). "Unpaid" for volunteer.
4. **Teal `#1f7e94` (text ink `#176679`) is used only for the kind-of-work chip and Jobs eyebrows.**

---

## Why

Today a job renders through the generic `EntityCard` as a listing: no pay, no kind of work, no closing date, and no business. The founder picked a card that answers "who, what, how much, until when" without a click.

## Scope

In:

- **`components/jobs/JobCard.tsx`** (new). Props are a `JobCardData` type (`types/index.ts`): `id`, `href`, `title`, `businessName`, `businessLogoUrl | null`, `place` (city, state, or "Remote"), `employmentType`, `workplaceType`, `salaryMin/Max/Period`, `closesAt | null`.
- **Pay string helper.** Add `formatJobPay()` to `lib/listings/jobPosting.ts`. Output "$18–$22 an hour", "$65,000–$80,000 a year", "$20 an hour" (single figure), "Unpaid" for volunteer. En dash in ranges, no spaces around it, no em dash. Do not change `formatSalary` (JSON-LD and the job page use it until 151). Add period words to `JOB_SALARY_PERIOD_META` as a new `phrase` field ("an hour", "a day", "a week", "a month", "a year").
- **Data for the card.** Jobs do not carry `listing_details_job` in `NESTED_SELECT` (`lib/listings/query.ts`). Add `attachJobCardData(rows)` next to `attachEventStartDates`, same fail-soft pattern: one extra query on `listing_details_job` (type, workplace, pay, closes_at, `hiring_listing_id`) and one on the hiring listing (name, logo, city). A failure leaves the card without chips, never throws. Call it from `queryListings` when `type === 'job'` and from the search result mapper in `lib/services/search.ts` for hits with `entity_type = 'job'`.
- **Render switch.** `DiscoveryGrid` and the search result list render `JobCard` when `entity.entityType === 'job'`; every other type is unchanged.
- **Business name fallback.** Job with no `hiring_listing_id` (all jobs created before 152): show the job listing's own name as the business line is wrong, so show the place only and put "Hiring business not set" nowhere. The top line is then just the place. Assumption, flag for review.
- **Closed look.** If `closesAt` is in the past the foot reads "Closed {date}" and the card is dimmed. (Closed roles leave the board in 155, but the card can still appear on the business page for a day.)

Out:

- Board filters (150), job page (151), "Now hiring" block (154), the closes_at sweep (155).
- Saving/bookmarking a job from the card.

## Acceptance criteria

- Given a published job with pay $18–$22/hour, full-time, remote, closing 15 Nov 2026, when its card renders, then it shows the business mark and name with the place on top, the title, chips "$18–$22 an hour", "Full-time" (teal) and "Remote", and the foot "Closes Nov 15".
- Given a volunteer job, then the pay chip reads "Unpaid".
- Given a job with no `closes_at`, then the foot is omitted (no "Closes" text).
- Given a job with no hiring business, then the card renders with the place on top and no empty logo box.
- Given any card, then the words "Black-owned" and "Ally" do not appear, and no em dash appears.
- Given the teal color, then it is applied to the kind-of-work chip only; the pay and Remote chips use neutral tokens.
- Given the detail query fails, then the card still renders title and place and the page does not error.
- Given a search for a job, then the hit renders the same `JobCard` as the board.
- Mobile 375px: one column, title wraps to at most 2 lines, chips wrap, whole card is one link with a 44px-or-taller hit area. 1280px: card width follows the grid (2 to 3 across), same content.
- A11y: one link per card (title is the link text, card is clickable via the stretched-link pattern), chips are text not color alone, logo has `alt=""` because the name is next to it, focus ring visible.

## States

Loading: `JobCardSkeleton` with the same box shape (logo circle, two text bars, three chip pills, foot bar); exported for 150. Empty and error: owned by the board (150). Closed: described above.

## Data note

No migration. Reads `listing_details_job` and the hiring `listings` row through the existing anon read policies (published only; an unpublished hiring business gives no name, the card falls back to place only).

## Tests

- Unit (`tests/job-card.test.ts`): `formatJobPay` for range, single, no pay, volunteer, each period, en dash present, no em dash; place builder (city/state, Remote, none).
- Unit: `attachJobCardData` returns rows unchanged when the query errors.
- Component render test for `JobCard` with and without a closing date and hiring business, asserting no "Black-owned" text.
- Playwright: none new. `e2e/opening-soon.spec.ts` unchanged and green with the flag off.

## QA notes

Seed three jobs on staging: paid hourly remote, salaried on-site, volunteer with no closing date. Check board, `/search?q=...` and a business page. Check at 375px and 1280px. Search for "Black-owned" and "—" in rendered card text.
