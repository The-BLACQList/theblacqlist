# Next 90 Days Roadmap — The BLACQList

**Date:** 2026-05-11
**Status:** Active — review weekly during standup
**Owner:** Product Lead + Tech Lead
**References:** `ruthless-mvp-and-roadmap.md`, `ticket-index.md`, `post-launch-plan.md`

This roadmap covers Day 0 through Day 90 post-launch. It is divided into three phases — Stabilize, Beta Preparation, and V1 Planning — each with defined gates and success criteria.

---

## Phase 1: Day 0–30 — Stabilize

**Theme:** Get the platform stable, hit seed data targets, confirm every system is working.

**Gate to Phase 2:** All items in this section must be complete before Beta Preparation begins.

### Engineering Priorities

| Priority | Task                                                                                                         | Owner     | Tickets                     |
| -------- | ------------------------------------------------------------------------------------------------------------ | --------- | --------------------------- |
| P0       | Resolve all P0/P1 bugs surfaced by soft launch testers                                                       | Tech Lead | New bug tickets as reported |
| P0       | Confirm all Phase 18 tickets complete (091–095)                                                              | Tech Lead | 091, 092, 093, 094, 095     |
| P0       | Verify production monitoring active: Sentry alerts, Vercel alert emails                                      | Tech Lead | Ticket 094                  |
| P1       | Deploy hotfixes for known remaining issues (BRM-01 through BRL-03 from `mvp-release-readiness-checklist.md`) | Tech Lead | Hotfix tickets as needed    |
| P1       | Confirm `sitemap.xml` auto-generates and has been submitted to Google Search Console                         | Tech Lead | Ticket 090 partial          |

### Product Priorities

| Priority | Task                                                              | Owner               |
| -------- | ----------------------------------------------------------------- | ------------------- |
| P0       | Hit seed data threshold: 150 ATL, 50 HOU, 50 CHI with ≥40% images | Product Lead + team |
| P0       | Public announcement sign-off (Tech Lead + Product Lead)           | Both                |
| P1       | First editorial collection published                              | Product Lead        |
| P1       | Claim queue running with ≤48h SLA                                 | Admin               |
| P1       | Business outreach to 50 unclaimed seed listings sent              | Product Lead        |

### Day 30 Success Criteria

From `ruthless-mvp-and-roadmap.md` MVP done-when criteria:

- [ ] An anonymous user can find a polished BLACQList Page in Atlanta under 30 seconds
- [ ] A business owner can claim or create their Page in under 15 minutes
- [ ] A logged-in supporter can save and share a listing
- [ ] Admin can review and approve claims from the dashboard
- [ ] 150+ ATL, 50+ HOU, 50+ CHI listings live with full data
- [ ] All BLACQList Pages server-rendered and indexable by Google
- [ ] No P0 bugs open

---

## Phase 2: Day 31–60 — Beta Preparation

**Theme:** Build the features that make the platform trustworthy and multi-dimensional.

**Gate to Phase 3:** At least 2 Beta features completed and tested. Phase 17 audit tickets complete.

### Engineering Priorities — Phase 16: Analytics

These tickets provide the data layer the team needs to measure growth and identify improvements:

| Ticket                                               | Title                                                                 | Priority |
| ---------------------------------------------------- | --------------------------------------------------------------------- | -------- |
| [082](../tickets/082-analytics-daily-aggregation.md) | Entity analytics daily aggregation — Supabase scheduled Edge Function | P2       |
| [083](../tickets/083-owner-analytics-dashboard.md)   | Owner analytics dashboard — 7/30-day charts (`/dashboard/analytics`)  | P2       |
| [084](../tickets/084-admin-platform-analytics.md)    | Admin platform analytics dashboard (`/admin/analytics`)               | P2       |
| [085](../tickets/085-search-analytics.md)            | Search analytics — trending queries, zero-result queries              | P2       |

Complete 082 before 083 — the dashboard depends on the aggregated data from the Edge Function.

### Engineering Priorities — Phase 17: Audits and Optimization

These unblock Beta launch and surface any remaining quality issues before public growth:

| Ticket                                            | Title                                                               | Priority |
| ------------------------------------------------- | ------------------------------------------------------------------- | -------- |
| [086](../tickets/086-security-audit.md)           | Security audit — RLS verification, auth boundary, OWASP review      | P0       |
| [087](../tickets/087-accessibility-audit.md)      | Accessibility audit and WCAG AA remediation — all MVP screens       | P1       |
| [088](../tickets/088-performance-optimization.md) | Performance optimization — Core Web Vitals, ISR, image optimization | P1       |
| [090](../tickets/090-seo-audit.md)                | SEO audit — sitemap.xml, robots.txt, Search Console submission      | P1       |

Target: LCP <2.5s, CLS <0.1, INP <200ms (from ticket 088). These are required before Beta outreach.

### Beta Feature Tickets (New — to be written)

These come from the Beta scope in `ruthless-mvp-and-roadmap.md`. Write tickets for each before building:

| Feature                                 | Description                                                                                | Depends on                                        |
| --------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| Reviews display (moderated)             | Reviews submitted during MVP now visible after admin approval; admin moderation queue live | Existing `reviews` table + intake from ticket 048 |
| Basic trust verification intake         | Verified badge document upload form; admin review queue                                    | Ticket 035 pattern (doc upload), new admin queue  |
| Community corrections                   | Flag-incorrect-info button on BLACQList Pages; admin correction queue + resolution email   | Existing admin infrastructure                     |
| At least one non-business page template | Professional or Creative Page template available to beta users                             | Ticket 020 pattern (new listing type)             |
| Supporter dashboard                     | Recently viewed listings, suggested businesses based on saved categories                   | Tickets 045, 046                                  |

Write Beta tickets as: `096-reviews-display.md`, `097-trust-verification-intake.md`, etc., continuing from the existing ticket 095.

### Day 60 Success Criteria

- [ ] Phase 16 analytics tickets complete — owner can see 7/30-day charts; admin can see platform stats
- [ ] Phase 17 audit tickets complete — security and accessibility issues from audits resolved
- [ ] At least 2 Beta features built and tested
- [ ] Beta invite list ready (target: 20–50 willing early adopters and business owners)

---

## Phase 3: Day 61–90 — V1 Planning and Beta Launch

**Theme:** Launch Beta, begin V1 scoping, confirm product-market fit signals.

### Beta Launch (Day 61–65)

- Invite 20–50 users to access Beta features
- Beta access via invite email or waitlist form — not public
- Monitor Beta feature usage for critical bugs; maintain 48h P1 resolution SLA
- Collect structured feedback on each Beta feature (see `user-feedback-plan.md`)

### V1 Scoping (Day 65–90)

V1 is defined in `ruthless-mvp-and-roadmap.md`. Begin formal scoping with the following:

**V1 Features to Scope:**

| Feature              | Current state                                                        | V1 target                                                                         |
| -------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Reviews              | Submitted but not displayed (intake only)                            | Publicly displayed, moderated, with business owner response                       |
| Trust tiers          | Claimed badge only; Verified/Certified badges in UI but not earnable | Full Verified document review + admin grant; Certified auto-grant criteria active |
| Editorial CMS        | Admin can create collections                                         | BLACQLight articles (rich text), full collection editor, city guide foundation    |
| Enhanced analytics   | Owner sees views/saves/clicks                                        | 30/90-day trend charts, search impression count, review count in dashboard        |
| Listing tiers        | Free only (plans table exists, no tier enforcement)                  | Free / Starter / Growth / Premium tiers with feature gating                       |
| Sponsored placements | Table exists, no admin UI, no injection in search                    | Admin-managed sponsored placement in search results (labeled "Sponsored")         |
| Stripe integration   | None                                                                 | Stripe subscription checkout; webhook handler for lifecycle events                |

**Stripe planning prerequisite:** Before writing any Stripe tickets, confirm:

- Stripe account fully verified (business entity + bank account)
- Decision on live key rollout timing (V1 vs V1.5)
- Reference ticket group 075–078 in `ticket-index.md`

### V1 Ticket Writing (Day 80–90)

Write V1 tickets using the same format as `docs/blacqlist/tickets/`. Continue numbering from the highest existing ticket number. Required tickets to write before V1 sprint begins:

- Full reviews system (display, moderation queue, business owner response)
- Full trust tiers (Verified badge workflow, Certified auto-grant)
- Editorial CMS (BLACQLight articles, enhanced collections)
- Stripe subscriptions (tickets 075–078 from backlog)
- Enhanced owner analytics
- Admin platform analytics (if not complete in Phase 2)

### Day 90 Success Criteria

**MVP done-when criteria check** (from `ruthless-mvp-and-roadmap.md`):

- [ ] 500+ unique searches completed since launch
- [ ] 50+ saves by logged-in users
- [ ] 50+ owner claims submitted (any combination of approved/pending)

**Beta health check:**

- [ ] At least 2 Beta features used by 5+ real users without critical bugs
- [ ] No open P0 bugs
- [ ] Claim resolution SLA being met consistently (≤48h average)

**V1 readiness check:**

- [ ] V1 feature scope agreed by Tech Lead and Product Lead
- [ ] V1 tickets written and estimated
- [ ] Phase 17 audits complete
- [ ] Stripe account verified and live key decision made

---

## Weekly Metrics Tracker

Pull every Monday from Vercel Analytics + Supabase queries. Fill in this table:

| Metric                       | Week 1 | Week 2 | Week 3 | Week 4 | Week 6 | Week 8 | Week 12 |
| ---------------------------- | ------ | ------ | ------ | ------ | ------ | ------ | ------- |
| Unique visitors              |        |        |        |        |        |        |         |
| Search queries/day (avg)     |        |        |        |        |        |        |         |
| Listing page views           |        |        |        |        |        |        |         |
| User registrations           |        |        |        |        |        |        |         |
| Saves                        |        |        |        |        |        |        |         |
| Shares                       |        |        |        |        |        |        |         |
| Claims submitted             |        |        |        |        |        |        |         |
| Claims approved              |        |        |        |        |        |        |         |
| Collections published        |        |        |        |        |        |        |         |
| Receipt uploads              |        |        |        |        |        |        |         |
| Sentry errors (weekly total) |        |        |        |        |        |        |         |

**Queries to run weekly:**

```sql
-- Registrations
SELECT count(*) FROM auth.users
WHERE created_at >= now() - interval '7 days';

-- Saves this week
SELECT count(*) FROM saves
WHERE created_at >= now() - interval '7 days';

-- Claims submitted this week
SELECT count(*) FROM claims
WHERE created_at >= now() - interval '7 days';

-- Receipt uploads this week
SELECT count(*) FROM receipt_uploads
WHERE created_at >= now() - interval '7 days';
```

---

## What Does Not Change in This Period

Per `ruthless-mvp-and-roadmap.md` Do-Not-Build-Yet list — these are explicitly deferred and not in scope for Day 0–90:

| Feature                            | Blocked until          |
| ---------------------------------- | ---------------------- |
| Marketplace cart + checkout        | V2                     |
| Stripe Connect vendor payouts      | V2                     |
| AI conversational discovery        | V2 (beta)              |
| Full dollar-flow map visualization | V3                     |
| iOS / Android native app           | V4                     |
| Near-me geo search                 | V2                     |
| Community forums                   | Never (current vision) |

Any request to add these before their phase requires written justification and Product Lead sign-off.
