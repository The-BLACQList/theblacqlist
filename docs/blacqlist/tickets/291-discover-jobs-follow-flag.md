# Ticket 291: Discover, Search and Cue Follow the Jobs Switch

**Status:** Built, PR open. Founder 2026-11-27: "I changed my mind for the final time. We'll take jobs off altogether." Asked about Discover the same day: "Hide them".

## Why

With `FEATURE_JOBS_OPEN` off, /jobs, /add-job and each job's own page show the "opening soon" cover, the sitemap drops them (`lib/features/opening-soon.ts`), and the plan lines drop jobs (ticket 289). Discover still offered a Jobs type, `?type=job` still listed job rows, and a published job could still turn up in plain results or in Cue's answers, then lead to a covered page.

## What Changed

All of it reads `isFeatureEnabled('jobsOpen')`. No migration.

| Where                                   | Jobs closed                                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `components/discovery/FacetSidebar.tsx` | New `showJobs` prop, off by default. The Jobs type is left out of the list. `ENTITY_TYPES` itself is unchanged (admin uses it).       |
| /discover and /discover/[city]          | Pass `showJobs` to the sidebar and the phone filter sheet.                                                                            |
| `lib/listings/facets.ts`                | `?type=job` comes back unresolved, so /discover, /search and Cue show the normal empty state. The plain browse query leaves out jobs. |
| `lib/services/search.ts` (/api/search)  | `?type=job` is a 400 with "Jobs are not open yet." Job rows are dropped from results.                                                 |
| `lib/listings/query.ts`                 | Job rows are dropped from results and from sponsored slots.                                                                           |
| `lib/ai/cue/data.ts`                    | Cue's lookups (search, meaning search, details) skip jobs.                                                                            |

With jobs open, everything works as before.

## Left As Is

- **Faceted search:** the search function in the database has no "leave out this type" option, so job rows are removed after the query. A page can then hold fewer rows than its size, but only if jobs are published. Founder check before launch: no published jobs in Admin → Entities.
- **Map:** shows only listings with a business location, which jobs don't have. No change.
- **Sitemap and job pages:** already covered by the jobs switch.
- **Cue's fixed help text** naming jobs: see ticket 289.

## Tests

`tests/discover-jobs-follow-flag.test.ts`:

- With jobs closed, `?type=job` is unresolved.
- With jobs open, it resolves as before.
- Other types are untouched.
- Source checks cover the sidebar default, both Discover pages, query.ts, the plain browse queries, /api/search and Cue.

The closed-type check and the source checks fail on the code before this ticket.

## To Go Live

Merge, together with the founder setting `FEATURE_JOBS_OPEN=false` in Vercel Production (ticket 289), then redeploy.
