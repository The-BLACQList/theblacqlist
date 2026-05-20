# Production Readiness Plan — The BLACQList

**Last updated:** 2026-05-07
**Status:** Source of truth
**Owner:** Engineering + Product + Operations

This document defines what "production ready" means for each phase of The BLACQList, and the checklist required before any phase goes live to real users.

---

## What "Production Ready" Means

For The BLACQList, production ready means:

1. A non-founder user can complete the primary workflow end-to-end without assistance
2. No Critical or High severity bugs are open
3. The platform is secure, stable, and observable
4. Minimum seed data is in place for the experience to have value at launch
5. Legal and compliance requirements are met for the features being shipped
6. The team can monitor, respond to, and recover from incidents

---

## Phase 0 — Foundation Readiness

Before any user-facing work begins.

### Infrastructure
- [ ] Next.js project scaffolded with TypeScript, Tailwind, shadcn/ui
- [ ] Supabase project created (production instance, not just local)
- [ ] Vercel project connected to GitHub repository
- [ ] Preview deploy works on every PR branch
- [ ] Environment variables documented and set (`.env.example` committed)
- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` configured
- [ ] RLS enabled on all Supabase tables from day one

### Database
- [ ] Initial migration files committed and tested
- [ ] Base tables created: `users`, `listings`, `categories`, `cities`
- [ ] Seed script imports 10 test listings cleanly
- [ ] All primary keys are UUIDs
- [ ] `updated_at` trigger installed on mutable tables

### Monitoring
- [ ] Sentry (or equivalent) installed and sending errors to the team
- [ ] Vercel Analytics enabled
- [ ] Supabase database usage alerts configured

### Repository
- [ ] `.gitignore` blocks `.env` files
- [ ] No secrets committed to version control (confirmed via `git log`)
- [ ] `README.md` explains how to run the project locally
- [ ] Branch protection on `main` (PR required, no direct push)

**Gate:** A developer can run the project locally, sign up, and see an empty admin dashboard. Seed script runs without errors.

---

## Phase 1 (MVP) — Launch Readiness Checklist

This is the gate for public launch.

### Code Quality
- [ ] `tsc --noEmit` passes with zero errors
- [ ] ESLint passes with zero errors
- [ ] No `console.log` statements in production code
- [ ] No hardcoded API keys, secrets, or credentials anywhere in the codebase
- [ ] All `TODO:` comments reviewed and either resolved or converted to tickets

### Functional Verification
- [ ] Anonymous user can search by keyword and return results
- [ ] Anonymous user can filter by category and city
- [ ] Anonymous user can view a complete BLACQList Page
- [ ] Anonymous user can share a Page and the OG preview renders correctly
- [ ] Logged-in user can save a listing
- [ ] Logged-in user can view their saved list
- [ ] Business owner can claim an existing listing
- [ ] Business owner can create a new listing
- [ ] Business owner can upload logo and cover image
- [ ] Business owner can set a primary CTA and it works
- [ ] Business owner receives claim approval/rejection email
- [ ] Admin can approve and reject claims
- [ ] Admin can edit any listing
- [ ] Admin can view pending claims queue

### BLACQList Pages
- [ ] Every Page is server-rendered (check page source — content is in HTML, not JS)
- [ ] `<title>` and `<meta description>` are unique per Page
- [ ] OG tags (`og:title`, `og:description`, `og:image`) are set on every Page
- [ ] Pages are included in the sitemap
- [ ] Pages load in under 2 seconds on a simulated 4G mobile connection

### Authentication + Security
- [ ] Signup, signin, and password reset flows work end-to-end
- [ ] Protected routes redirect to signin when not authenticated
- [ ] Admin routes are blocked for non-admin users (tested directly, not just through UI)
- [ ] Business owner cannot access or edit another owner's listing (tested via direct URL)
- [ ] RLS policies verified for: `listings`, `claims`, `saves`, `users`
- [ ] No PII is logged in application logs
- [ ] HTTPS is enforced (HTTP redirects to HTTPS)

### Media
- [ ] Logo upload works and image appears on the Page
- [ ] Cover image upload works and image appears on the Page
- [ ] Gallery images upload and display correctly
- [ ] Images are served via CDN (Supabase Storage CDN URL), not directly from database
- [ ] File type validation works (rejects non-image files)
- [ ] File size limit enforced server-side (max 10MB per image)

### Mobile
- [ ] Homepage renders correctly at 375px
- [ ] Search results page renders correctly at 375px
- [ ] BLACQList Page renders correctly at 375px
- [ ] Claim flow works on mobile
- [ ] Business owner dashboard works on mobile

### Accessibility
- [ ] All form inputs have visible labels
- [ ] Tab order is logical on all pages
- [ ] Error messages are descriptive and shown inline
- [ ] Color contrast meets WCAG AA on all primary UI
- [ ] CTA buttons are keyboard-activatable

### Performance
- [ ] Lighthouse score ≥ 80 on BLACQList Page (mobile)
- [ ] Time to First Contentful Paint < 2s (mobile, simulated 4G)
- [ ] Search returns results in < 1.5s for standard queries
- [ ] Image gallery uses lazy loading

### Data + Seed
- [ ] Atlanta: ≥ 150 listings with complete data (name, category, city, description, contact)
- [ ] Houston: ≥ 50 listings
- [ ] Chicago: ≥ 50 listings
- [ ] At least 40% of seed listings have a logo or cover image
- [ ] All seed listings are categorized correctly
- [ ] No duplicate listings in seed data (verified via admin)

### Legal + Compliance (MVP minimum)
- [ ] Privacy Policy page published and linked in footer
- [ ] Terms of Service page published and linked in footer
- [ ] Cookie policy / banner if applicable (check jurisdiction requirements)
- [ ] DMCA contact email documented in footer
- [ ] No screenshots of Google Maps used without license compliance
- [ ] Receipt upload legal language reviewed (data retention, anonymization)

### Email
- [ ] All transactional emails send correctly in production environment
- [ ] Emails render correctly in Gmail, Apple Mail, and Outlook
- [ ] Unsubscribe mechanism works for any marketing-adjacent emails
- [ ] From address is a branded domain (not `no-reply@supabase.io`)

### Operations
- [ ] On-call person identified for launch week
- [ ] Incident response process documented (who to contact, how to roll back)
- [ ] Vercel deployment confirmed in production environment
- [ ] Database backup confirmed (Supabase point-in-time recovery enabled)
- [ ] Domain DNS is correctly configured
- [ ] SSL certificate is valid and auto-renewing

### Known Issues
- [ ] All open bugs reviewed and triaged
- [ ] No Critical (P0) bugs open
- [ ] No High (P1) bugs that affect the primary MVP flow
- [ ] Known issues documented in `docs/blacqlist/launch/known-issues.md`

**Gate:** All checkboxes above are checked. At least one non-team member has completed the full search → view Page → save → claim flow without assistance. Go/No-Go decision made by product lead.

---

## Phase 2 (V1) — Readiness Additions

Additional checks required before V1 ships on top of Phase 1.

### Reviews
- [ ] Review submission works for logged-in users on verified listings
- [ ] Review appears on BLACQList Page after submission
- [ ] Admin moderation queue shows new reviews
- [ ] Business owner can respond to a review from their dashboard
- [ ] Flag review flow works

### Trust + Verification
- [ ] Verification document upload works
- [ ] Admin can review uploaded documents
- [ ] Verified badge appears on approved listings
- [ ] Rejected verification sends email to owner with reason

### Monetization
- [ ] Stripe integration tested in Stripe test mode before production
- [ ] Listing tier upgrade flow works end-to-end
- [ ] Stripe webhook handler processes events correctly
- [ ] Subscription cancellation and downgrade work
- [ ] No production Stripe keys in code; only environment variables

### Analytics
- [ ] Business owner can view their Page analytics (views, CTA clicks, saves)
- [ ] Admin can view platform-level stats
- [ ] Analytics data is accurate (spot-checked against raw database counts)

**Gate:** All Phase 1 checks still passing. All Phase 2 checks passing. Legal review of paid listing tier terms.

---

## Phase 3 (V2) — Readiness Additions

Additional checks required before marketplace goes live.

### Marketplace
- [ ] Vendor Stripe Connect onboarding tested end-to-end (vendor receives payout after test purchase)
- [ ] Checkout flow tested in Stripe test mode
- [ ] Order confirmation email sends correctly
- [ ] Vendor order management dashboard shows new orders
- [ ] Platform application fee is applied correctly on all transactions
- [ ] Refund flow works (buyer requests → vendor approves → Stripe processes)

### Legal (Marketplace-specific)
- [ ] Vendor agreement / Terms of Service for sellers reviewed by legal counsel
- [ ] Marketplace return/refund policy published and linked
- [ ] Sales tax handling documented (is the platform responsible, or the vendor?)
- [ ] Payout schedule and fee structure disclosed to vendors before onboarding

### Receipt Upload
- [ ] Receipt photo capture works on iOS and Android mobile browsers
- [ ] OCR parsing returns reasonable category suggestions
- [ ] Spend data is stored correctly and linked to user account
- [ ] Aggregated community spend data is anonymized (no individual spend is publicly identifiable)
- [ ] User can opt out of community spend tracking

**Gate:** Legal review completed for marketplace. Minimum 50 vendor storefronts seeded or onboarded before marketplace launch.

---

## Rollback Plan

For each phase, document the rollback procedure before deployment:

| Scenario | Rollback method | Time estimate |
|---|---|---|
| Bad deploy breaks the site | Vercel: redeploy previous deployment (1 click) | < 5 minutes |
| Bad database migration | Supabase point-in-time recovery to pre-migration snapshot | 15–30 minutes |
| Stripe webhook handler broken | Disable webhook in Stripe dashboard; deploy fix; re-enable | 30–60 minutes |
| Seed data causes performance issues | Admin tool to bulk-flag or remove listings | < 15 minutes |
| Security incident (compromised key) | Rotate key in Supabase/Stripe/Vercel dashboards immediately | < 30 minutes |

---

## Incident Severity Levels

| Level | Definition | Response |
|---|---|---|
| P0 (Critical) | Site is down or completely unusable | Immediate — fix before anything else |
| P1 (High) | Core flow is broken (search, claim, Page display, auth) | Fix within 24 hours |
| P2 (Medium) | Secondary feature broken (gallery, share, analytics) | Fix within 72 hours |
| P3 (Low) | Minor UX issue, cosmetic bug | Fix in next sprint |

---

## Monitoring Stack

| Layer | Tool | What it monitors |
|---|---|---|
| Error tracking | Sentry | Frontend and API exceptions, error rate |
| Performance | Vercel Analytics | Core Web Vitals, request latency |
| Database | Supabase Dashboard | Query performance, connection count, disk usage |
| Uptime | Vercel built-in | Deployment health |
| Payments | Stripe Dashboard | Webhook failures, failed charges |
| Email | Resend Dashboard | Delivery rate, bounces |

---

## Assumptions

- Vercel point-in-time rollback covers the majority of deployment rollback scenarios
- Supabase point-in-time recovery (paid plan) is enabled before production launch
- A dedicated on-call person is available for the first two weeks after each phase launch
- The seed data pipeline is tested on staging before running on production

---

## Open Questions

1. Is there a bug bounty or responsible disclosure policy to publish before MVP launch?
2. Should the privacy policy be reviewed by legal counsel before launch, or is a template policy sufficient for MVP?
3. What is the SLA for claim approval at launch — can we commit to 48 hours?
4. Does the platform need a status page (e.g., status.theblacqlist.com) at MVP?

---

## Do Not Overbuild Yet

- Do not build a status page before there is an SLA to enforce
- Do not build a full incident management tool (PagerDuty, Opsgenie) before V1
- Do not set up a multi-region database before there is evidence the platform is latency-sensitive for users outside the primary Supabase region
- Do not build automated rollback tooling before manual rollback procedures are validated
