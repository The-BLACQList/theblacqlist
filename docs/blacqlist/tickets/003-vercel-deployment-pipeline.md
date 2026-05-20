# Ticket 003: Vercel deployment pipeline and preview environments

## Status

Draft

## Phase

Phase 0: Setup and Foundation

## Priority

P0

## Feature Area

Infrastructure

## Context

The BLACQList uses Vercel for hosting and CI/CD. Preview deployments on every PR are a core part of the product review workflow — brand team, community advisors, and product owners review UI changes in preview before they merge to production. Without this ticket, there is no staging environment for QA sign-off, no automatic deployment on merge to `main`, and no way to verify that environment variables are correctly set in production. This ticket creates the Vercel project and wires it to the Git repository. Source documents: `docs/blacqlist/architecture/tech-stack-decision.md` (Section 14), `docs/blacqlist/architecture/environment-plan.md` (Sections 2, 3, 4).

## User Story

As an engineer or product reviewer, I want every pull request to automatically generate a preview URL, so that I can review UI and behavior changes on a live deployment before approving a merge.

## Scope

- Create a Vercel project linked to the project Git repository
- Configure automatic preview deployments on every PR branch (Vercel default behavior when connected to GitHub/GitLab)
- Configure production deployment to trigger on merge to `main` branch
- Set all required environment variables in Vercel under "Preview" environment (staging values from `environment-plan.md`)
- Set all required environment variables in Vercel under "Production" environment (production values)
- Confirm preview deployment URL pattern is: `theblacqlist-pr-[number].vercel.app` (or project-specific slug)
- Add a `NEXT_PUBLIC_SITE_URL` environment variable set to `https://theblacqlist.com` in Production and `https://theblacqlist.vercel.app` in Preview
- Verify the first successful deployment to both Preview and Production environments
- Document the preview deployment URL pattern in the project README (a one-line note)

## Out of Scope

- Custom domain or DNS configuration (later ticket)
- Sentry source map upload integration (Ticket 004)
- Any product feature code
- Vercel cost monitoring and alerting (V1 task per `tech-stack-decision.md` Section 14)

## Dependencies

- Depends on: Ticket 001 — Next.js project initialization (the repository must exist to connect to Vercel)

## UX Notes

N/A — infrastructure ticket. The output of this ticket is a working deployment pipeline, not a user-facing screen.

## Design Notes

N/A — infrastructure ticket.

## Data Notes

N/A — no database interaction.

## API Notes

N/A — no API routes.

## Implementation Notes

**Vercel project setup steps:**

1. Go to `vercel.com/new`, import the Git repository
2. Framework preset: Next.js (auto-detected)
3. Root directory: `/` (project root)
4. Build command: `pnpm build` (or accept Vercel default `next build`)
5. Install command: `pnpm install`
6. Output directory: `.next` (Next.js default)

**Environment variables in Vercel dashboard:**

Set under "Preview" environment (all PRs):

| Variable                        | Value                                     |
| ------------------------------- | ----------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Staging Supabase project URL              |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Staging anon key                          |
| `SUPABASE_SERVICE_ROLE_KEY`     | Staging service role key                  |
| `NEXT_PUBLIC_SITE_URL`          | `https://theblacqlist.vercel.app`         |
| `AUTH_SECRET`                   | Generated with `openssl rand -base64 32`  |
| `NEXT_PUBLIC_SENTRY_DSN`        | Staging Sentry DSN (set after Ticket 004) |
| `RESEND_API_KEY`                | Resend test mode key                      |
| `RESEND_FROM_EMAIL`             | Staging sender address                    |

Set under "Production" environment only:

| Variable                        | Value                                               |
| ------------------------------- | --------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Production Supabase project URL                     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production anon key                                 |
| `SUPABASE_SERVICE_ROLE_KEY`     | Production service role key                         |
| `NEXT_PUBLIC_SITE_URL`          | `https://theblacqlist.com`                          |
| `AUTH_SECRET`                   | Different secret from staging (generate separately) |
| `NEXT_PUBLIC_SENTRY_DSN`        | Production Sentry DSN (set after Ticket 004)        |
| `RESEND_API_KEY`                | Production Resend key                               |
| `RESEND_FROM_EMAIL`             | `noreply@theblacqlist.com`                          |

**Stripe, Anthropic, Algolia variables** are NOT set now — they are added when their respective features are implemented (V1 and V2).

**Files to create or modify:**

- No new application files are required for this ticket
- The project root `README.md` (create if it does not exist) — add one-line note: "Preview deployments are generated automatically on every PR at `https://theblacqlist-[hash].vercel.app`"

**Key patterns:**

- Vercel environment variable isolation: Production variables are set only under "Production" scope — they do not inherit to Preview by default. Confirm this in the Vercel dashboard.
- The `SUPABASE_SERVICE_ROLE_KEY` must be set as a server-only variable (without `NEXT_PUBLIC_` prefix) — Vercel exposes `NEXT_PUBLIC_` variables to the browser bundle; the service role key must never be in the browser bundle
- Build command override: use `pnpm build` explicitly so Vercel does not fall back to `npm build`

**Do not:**

- Enable "automatically expose System Environment Variables" if it would expose production database credentials to Preview environments
- Set `STRIPE_SECRET_KEY` with live mode keys (`sk_live_*`) anywhere except Production scope
- Set `ANTHROPIC_API_KEY` at all — V2 only; no value set at this phase

## Acceptance Criteria

- [ ] Vercel project exists and is connected to the Git repository
- [ ] A push to any branch automatically triggers a preview deployment and generates a unique preview URL
- [ ] A merge to `main` automatically triggers a production deployment
- [ ] The production deployment at the Vercel-assigned URL (before custom domain) renders the Next.js placeholder page from Ticket 001 without errors
- [ ] All Preview environment variables listed above are set in Vercel under the "Preview" scope
- [ ] All Production environment variables listed above are set in Vercel under the "Production" scope
- [ ] `NEXT_PUBLIC_SITE_URL` returns `https://theblacqlist.vercel.app` in a Preview deployment and `https://theblacqlist.com` in a Production deployment (verifiable via a `/api/debug` route that logs it server-side — to be removed after verification)
- [ ] The production Vercel deployment build log shows `pnpm build` as the build command (not `npm run build`)
- [ ] No `NEXT_PUBLIC_` environment variable contains the Supabase service role key value

## Failure States

| Failure                                                                       | User-visible behavior                                                                                                                                                                 |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build fails on Vercel due to missing environment variable                     | Build log shows `Error: Environment variable [NAME] is missing`; engineer adds the variable to the correct scope in Vercel dashboard and re-triggers the deployment                   |
| `pnpm` not found on Vercel builder                                            | Build fails with `command not found: pnpm`; engineer adds `ENABLE_EXPERIMENTAL_COREPACK=1` to Vercel environment variables or configures `package.json` `engines.pnpm` field          |
| Preview and Production share the same `SUPABASE_SERVICE_ROLE_KEY` by accident | Production data is accessible from preview deployments; engineer immediately rotates the production service role key in Supabase and updates the Production environment variable only |
| Production deployment triggers before all env vars are set                    | The deployment serves a broken page; engineer ensures all required variables are set before merging to `main` for the first time                                                      |

## Edge Cases

- Vercel may auto-detect the Next.js version and set a framework configuration that conflicts with `next.config.ts` — verify the build output and override the framework setting if needed
- If the Git repository uses a monorepo structure in the future, the root directory setting in Vercel will need to be updated — note this risk
- `AUTH_SECRET` must be different between staging and production — generating the same value for both is a security issue; generate separately with `openssl rand -base64 32`

## Accessibility Notes

- [ ] N/A — infrastructure ticket.

## QA Test Cases

| #   | Scenario                              | Role     | Steps                                                                                                  | Expected result                                                                                       |
| --- | ------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| 1   | Preview deployment on PR              | Engineer | Create a branch, push a trivial commit, open a PR against `main`                                       | Vercel posts a "Preview deployment ready" comment to the PR with a working URL                        |
| 2   | Production deployment on merge        | Engineer | Merge a PR to `main`                                                                                   | Vercel deployment log shows a successful production build; the production URL serves the updated page |
| 3   | Env var isolation                     | Engineer | In a Preview deployment, call `process.env.NEXT_PUBLIC_SUPABASE_URL` server-side via a temporary log   | Value matches the staging Supabase project URL, not the production URL                                |
| 4   | Service role key not in client bundle | Engineer | Download the Preview deployment's `.next/static` JavaScript bundle; search for any Supabase key prefix | No `eyJ` JWT prefix (Supabase key format) appears in the client-side bundle                           |

## Security Notes

- Production environment variables in Vercel are only visible to team members with admin access to the Vercel project — restrict team access accordingly
- The Supabase service role key bypasses all RLS — it must NEVER be set as a `NEXT_PUBLIC_*` variable in Vercel
- Rotate `AUTH_SECRET` immediately if it is ever accidentally committed to Git or shared outside the team
- Vercel automatically enables HTTPS for all deployments — HTTP is redirected to HTTPS; no additional TLS configuration is needed

## Completion Checklist

- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] All four states implemented (loading, empty, error, success) — N/A for infrastructure ticket
- [ ] Mobile tested at 375px — N/A for infrastructure ticket
- [ ] Keyboard navigation tested — N/A for infrastructure ticket
- [ ] Accessibility requirements met — N/A for infrastructure ticket
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
