# Ticket 092: Vercel Production Deployment Configuration

## Status
Draft

## Phase
Phase 18: Production Deployment and Post-Launch Hardening

## Priority
P0

## Feature Area
Deployment

## Context
Configures the Vercel project for production launch: custom domain, SSL, production environment variables, analytics, and speed insights. After deployment, runs the 10-item smoke test checklist from `deployment-plan.md` to confirm the platform is functional before announcing launch. Depends on Ticket 091 (production Supabase) for the environment variables to be available.

## User Story
As the engineering lead, I want the production application deployed to the custom domain with correct configuration, so that the platform is publicly accessible and monitored from day one.

## Scope
- Connect production Supabase env vars to Vercel production environment (not preview, not development)
- Configure custom domain: `theblacqlist.com` and `www.theblacqlist.com` (www → apex redirect or vice versa)
- Verify SSL certificate provisioned (automatic via Vercel)
- Set `NEXT_PUBLIC_APP_URL` to `https://theblacqlist.com`
- Enable Vercel Web Analytics on production project
- Enable Vercel Speed Insights on production project
- Verify preview deployments still work on non-production branches (staging branch should use staging Supabase vars)
- Run the 10 smoke tests from `deployment-plan.md` immediately after deployment
- Confirm no `localhost` or staging references appear in production responses

## Out of Scope
- DNS transfer or registrar changes (pre-requisite — handled outside this ticket)
- Monitoring setup (Ticket 094)
- Seed data (Ticket 093)

## Dependencies
- Depends on: Ticket 003 (Vercel pipeline — project already exists)
- Depends on: Ticket 091 (production Supabase project + env vars)

## UX Notes
Not applicable — infrastructure configuration ticket.

## Design Notes
Not applicable.

## Data Notes
Not applicable.

## API Notes
Not applicable — no new API routes.

## Implementation Notes
- Vercel custom domain: Settings → Domains → Add domain
- DNS: add CNAME pointing `www` to `cname.vercel-dns.com`; Vercel auto-provisions apex record
- Environment variables: Vercel dashboard → Settings → Environment Variables → set for Production environment only
- Required production env vars (from `environment-plan.md`):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `NEXT_PUBLIC_APP_URL` = `https://theblacqlist.com`
  - `RESEND_API_KEY`
  - `SENTRY_DSN`
  - `NEXTAUTH_SECRET` (if applicable)
  - All other vars from environment-plan.md marked as "production required"
- Smoke tests: run from `deployment-plan.md` — document pass/fail for each

## Acceptance Criteria
- [ ] `https://theblacqlist.com` loads the homepage with correct content
- [ ] `https://www.theblacqlist.com` redirects to apex (or apex redirects to www — pick one, be consistent)
- [ ] SSL certificate is valid (green lock in browser)
- [ ] `NEXT_PUBLIC_APP_URL` is set to the production domain (verify by checking OG tag URLs on a listing page)
- [ ] No `localhost` or staging Supabase URLs appear in production HTML responses
- [ ] Vercel Web Analytics is active (data appears in Vercel dashboard within 30 min of traffic)
- [ ] Preview deployments on non-main branches deploy successfully with staging env vars
- [ ] All 10 smoke tests from `deployment-plan.md` pass — documented with timestamp

## Failure States
| Failure | User-visible behavior |
|---|---|
| DNS not propagated | Site unreachable — wait for propagation (up to 48h), verify with `dig` |
| Missing env var | Server error on affected routes — add missing var and redeploy |
| Smoke test failure | Block announcement; diagnose and fix before launch |

## Edge Cases
- `www` redirect: choose one canonical form and redirect the other via Vercel's redirect config
- Preview deployments must use staging Supabase, not production — verify this is enforced by environment variable scoping

## Accessibility Notes
Not applicable.

## QA Test Cases (Smoke Tests from deployment-plan.md)
| # | Test | Steps | Expected result |
|---|---|---|---|
| 1 | Homepage loads | GET https://theblacqlist.com | 200, correct content |
| 2 | Search works | GET /search?q=barbershop&city=atlanta | Results page renders |
| 3 | Listing page loads | GET /atlanta/business/[slug] | BLACQList Page renders |
| 4 | Auth — sign up | POST /api/auth/signup | User created, session cookie set |
| 5 | Auth — sign in | POST /api/auth/signin | Session established |
| 6 | Protected route redirect | GET /dashboard (no session) | Redirect to /sign-in |
| 7 | Admin route blocked | GET /admin (non-admin session) | 403 or redirect |
| 8 | Analytics event | POST /api/analytics/event | 200 response |
| 9 | Media upload | POST /api/upload (authenticated) | 201, path returned |
| 10 | OG tags | GET /atlanta/business/[slug] | og:title, og:image present in HTML |

## Security Notes
- `SUPABASE_SERVICE_ROLE_KEY` scoped to Production env only — never in preview/development
- SSL must be valid before launch — no HTTP traffic to production
- Verify Vercel's "Protect Preview Deployments" is enabled to prevent public access to preview URLs

## Completion Checklist
- [ ] Custom domain configured and SSL active
- [ ] All production env vars set and verified
- [ ] `NEXT_PUBLIC_APP_URL` correct in production
- [ ] Vercel Web Analytics enabled
- [ ] Vercel Speed Insights enabled
- [ ] Preview deployments verified with staging env vars
- [ ] All 10 smoke tests passed and documented
- [ ] No localhost/staging references in production
- [ ] PR opened and linked to this ticket
