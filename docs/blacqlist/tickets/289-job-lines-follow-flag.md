# Ticket 289: Plan Lines Follow the Jobs Switch

**Status:** Built, PR open. Founder 2026-11-27: "I changed my mind for the final time. We'll take jobs off altogether."

## Why

With `FEATURE_JOBS_OPEN` off, the site already closes jobs: /jobs and /add-job show the waitlist cover, the footer shows "Soon", the home jobs tile and the page hiring cards are hidden, and posting is refused (`lib/features/opening-soon.ts`). Only the plan lines ignored the switch, so Growth and Premium still sold "job postings every 30 days" that nobody could use.

## What Changed

| Where                                             | Jobs closed                                                                                                                                                                                                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `lib/stripe/plans.ts`                             | New `planFeatures(plan, { jobsOpen })`. Closed, the Growth and Premium job posting lines drop; "product, service, event, and job descriptions" becomes "product, service, and event descriptions"; "numbers for your events and jobs" becomes "numbers for your events". |
| `lib/stripe/planCompare.ts`                       | The "Job postings every 30 days" row drops; the same two rows are reworded; the group "Selling and Hiring" becomes "Selling".                                                                                                                                            |
| Plan cards on /pricing, /for-business and Upgrade | Read the lines through `planFeatures`.                                                                                                                                                                                                                                   |
| Compare table on /pricing and Upgrade             | Takes `jobsOpen`.                                                                                                                                                                                                                                                        |
| /pricing subtitle and FAQ                         | Job wording only when jobs are open.                                                                                                                                                                                                                                     |
| Cue's plan answer (`lib/ai/cue/owner/help.ts`)    | Uses the same lines as the cards.                                                                                                                                                                                                                                        |

With jobs open, every line is exactly as before.

## Left As Is

- Cue's fixed help text for analytics and writing help still mentions jobs. It answers owners about features, not plans, and changes with the next jobs ticket if needed.
- The terms and privacy text (counsel's list).
- Opening or closing jobs is still the env switch plus a redeploy. This ticket adds no new switch.

## Tests

`tests/plan-job-lines.test.ts`: no plan line, fine print, compare row or group title mentions jobs when closed; open, lines are unchanged; every page that prints plans reads the switch; every /pricing sentence that names jobs is behind it (fails on the old page).

## To Go Live

The founder sets `FEATURE_JOBS_OPEN=false` in Vercel Production, then this merges, so one deploy picks up both.
