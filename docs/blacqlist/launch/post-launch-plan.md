# Post-Launch Plan — The BLACQList

**Date:** 2026-05-11
**Status:** Active — execute from launch day forward
**Owner:** Tech Lead + Product Lead
**References:** `rollback-plan.md`, `prelaunch-smoke-test.md`, `post-launch-monitoring-plan.md`, `user-feedback-plan.md`

This document covers the first 30 days after production deployment. Read the monitoring plan for alert thresholds, the feedback plan for triage SLAs, and the rollback plan before every deployment.

---

## First 72 Hours

### Hour 0–4 — Soft Launch Only

- Deploy to production using `production-deployment-runbook.md`
- Share the production URL privately with **5–10 trusted testers only** (team, advisors, volunteer users)
- Do not post publicly, do not announce on social, do not send any email blast
- All smoke tests in `prelaunch-smoke-test.md` must pass before sharing the URL with testers

### Roles During First 72 Hours

| Person | Responsibility |
|---|---|
| Tech Lead | Monitoring cadence, incident response, deployment decisions |
| Product Lead | Collecting tester feedback, triaging severity, coordinating communication |
| On-call engineer | Available and reachable; executes rollback if Tech Lead calls it |

### Monitoring Cadence

- **Hours 0–4:** Check every 30 minutes — Sentry, Vercel Functions logs, Supabase Dashboard
- **Hours 5–72:** Check every 2 hours — abbreviated watchlist below
- Set up Sentry Slack alert (`#incidents`) for >5 unique errors per hour before deploying

### Watchlist (each check)

| Signal | Where to check | Action if bad |
|---|---|---|
| Sentry error count | Sentry Dashboard → Issues | >5 new errors/hr → P1 triage |
| Auth success rate | Vercel Functions logs → `/auth/callback` | Failures → check Supabase Auth config |
| Search response time | Vercel Analytics → Functions | P95 >3s → check DB connection and query |
| Listing page load | Vercel Analytics → Web Vitals | LCP >4s → check image CDN |
| Upload success | Vercel logs → `/api/upload/` | 4xx/5xx → check bucket config |
| DB connection pool | Supabase Dashboard → Database → Metrics | >80% pool used → check PgBouncer |

### Seed Data Gate

The public announcement is **blocked** until all three of these are true:
- [ ] 150+ Atlanta listings live with complete data (name, category, city, at least one image)
- [ ] 50+ Houston listings live with complete data
- [ ] 50+ Chicago listings live with complete data
- [ ] ≥40% of listings across all cities have at least one image

Check seed data counts:
```sql
-- Run in Supabase SQL Editor (production)
SELECT c.name AS city, COUNT(*) AS listing_count
FROM listings l
JOIN cities c ON c.id = l.city_id
WHERE l.status = 'published' AND l.deleted_at IS NULL
GROUP BY c.name
ORDER BY listing_count DESC;
```

### Escalation Path

| Severity | Trigger | Action |
|---|---|---|
| **P0** | Site down, auth broken, data breach, privacy violation | Roll back immediately via `rollback-plan.md` Scenario A. No investigation before rollback. |
| **P1** | Critical flow broken (search returns 0, listing pages 500, upload fails) | 30-minute assess: can this be hotfixed in <2 hours? If yes, hotfix. If no, roll back. |
| **P2** | Non-critical feature broken (collection page error, analytics event missing) | Log in Sentry and `#incidents`. Continue. Fix in next deploy. |
| **P3** | Visual inconsistency, copy error, UX confusion | Log in `#user-feedback`. Add to backlog. |

---

## First 2 Weeks

### Daily Standup (15 minutes)

Every business day for the first 2 weeks:
- What new issues were reported or detected since yesterday?
- What is the severity and owner of each open issue?
- What is being deployed today? (Run smoke tests within 5 minutes of any deployment)
- Are seed data targets being hit?

### Feedback Intake

- `feedback@theblacqlist.com` — monitored daily by Product Lead
- Slack `#user-feedback` — all team members route tester feedback here
- See `user-feedback-plan.md` for triage SLAs and response templates

### Week 1 Goal — All P0/P1 Bugs from Testers Resolved

Before the end of Week 1:
- [ ] All P0 bugs reported by testers are fixed and re-tested
- [ ] All P1 bugs reported by testers are either fixed or have a hotfix timeline
- [ ] No new P0 bugs introduced by any hotfix deployments
- [ ] Smoke test suite passes in full after each fix deployment

### Week 2 Goal — Public Announcement Ready

Before public announcement:
- [ ] Seed data gate passed (150 ATL, 50 HOU, 50 CHI with ≥40% images)
- [ ] Full smoke test pass (all 19 ST tests in `prelaunch-smoke-test.md`)
- [ ] No open P0 issues
- [ ] Privacy Policy and Terms of Service pages published at `/privacy` and `/terms`
- [ ] Tech Lead and Product Lead sign off in writing

---

## First 30 Days

### Growth Metrics to Track (Weekly)

Pull these from Vercel Analytics + Supabase query each Monday:

| Metric | Week 1 target | Week 4 target |
|---|---|---|
| Unique visitors | — (baseline) | 500+ |
| Search queries/day | — | 30+ |
| Listing page views | — | 2,000+ |
| User registrations | — | 100+ |
| Saves | — | 50+ |
| Shares | — | 25+ |
| Claims submitted | — | 50+ |
| Claims resolved (≤48h) | — | 90%+ |

The Week 4 targets are drawn directly from the MVP done-when criteria in `ruthless-mvp-and-roadmap.md`: 500 unique searches, 50 saves, 50 owner claims within 60 days.

### Claim Queue SLA

Every pending claim in `/admin/claims` must receive a decision within **48 hours** of submission:
- Approved: email sent to claimant; owner dashboard access granted
- Rejected: email sent with reason; claimant can re-submit with corrected info

Claim queue must be checked every business day, ideally at the same time (e.g., 9am standup).

### Content Cadence

- At minimum **1 new editorial collection** published per week via `/admin/collections`
- Collection ideas for first 4 weeks: "Best ATL Brunch Spots", "Black-Owned Coffee in Houston", "Chicago's Best Hair Salons", "Where to Shop Black in Atlanta"
- After Week 4: review which collections drove the most page views and saves; plan next 4

---

## 8 Operational Processes

These 8 processes run continuously after launch. Each should become a routine with a designated owner and schedule.

---

### Process 1 — Bug Triage

**Owner:** Tech Lead  
**Cadence:** Daily during standup; real-time for P0

**Severity tiers:**

| Level | Definition | Response | Resolution |
|---|---|---|---|
| P0 | Site down, auth broken, data breach, privacy violation | Immediate — roll back | Same day |
| P1 | Critical flow broken (search, listing pages, upload, claim, sign-in) | 30-min assess | 24–48 hours |
| P2 | Non-critical feature broken | 72-hour response | Next deploy |
| P3 | Visual/copy issue, minor UX friction | 1-week response | Next sprint |

**Bug log fields:** Date reported, reporter, symptom (what user sees), reproduction steps, severity, affected users (all / specific role / specific flow), assigned engineer, status.

**Rule:** No P0 is left open overnight. If a fix cannot be deployed within 4 hours, roll back.

---

### Process 2 — Feature Request Intake

**Owner:** Product Lead  
**Cadence:** Slack `#feature-requests` monitored daily; monthly batch review

**Workflow:**
1. Anyone (team or user) posts a feature request to `#feature-requests`
2. Product Lead adds a phase tag: `beta`, `v1`, `v2`, `do-not-build`, or `needs-research`
3. Once per month, Product Lead reviews all tagged requests and decides: add to roadmap, add to backlog, or document why not
4. Requests become tickets only after Product Lead sign-off
5. "Do-not-build" decisions are logged with reason — do not re-open without new evidence

**Rule:** Feature requests are not bugs. Do not block a deployment for a feature request.

---

### Process 3 — Data Quality Audits

**Owner:** Admin (rotating weekly)  
**Cadence:** Weekly spot-check; ad-hoc on user report

**Weekly audit (30 minutes):**
1. Open `/admin/listings` and filter by city; sort by `created_at` descending
2. Spot-check 10 random listings for: correct phone number, accurate hours, real address, category match, no broken images
3. For any inaccurate listing: flag it and contact the business (see Process 7 — Business Outreach)
4. Duplicate detection: check for two listings with identical or near-identical names in the same city; merge or delete

**Data quality query (run monthly):**
```sql
-- Listings with no images (may need outreach)
SELECT l.id, l.name, c.name AS city, l.created_at
FROM listings l
JOIN cities c ON c.id = l.city_id
LEFT JOIN media_attachments ma ON ma.entity_id = l.id AND ma.entity_type = 'listing'
WHERE l.status = 'published' AND l.deleted_at IS NULL AND ma.id IS NULL
ORDER BY l.created_at ASC;
```

---

### Process 4 — Verification and Claim Cadence

**Owner:** Admin (dedicated claim reviewer)  
**Cadence:** Daily check; 48-hour SLA per claim

**Daily routine:**
1. Open `/admin/claims`
2. Review all claims in `pending` status
3. For each claim: review submitted verification info (email match, phone, optional document)
4. Decision: Approve (access granted, owner email sent) or Reject (email sent with reason)
5. No claim stays in `pending` for more than 48 hours

**Claim fraud indicators (flag for manual review):**
- Submitted email domain does not match the business website domain
- Same user has submitted more than 3 claims in 7 days
- Verification document appears altered (inconsistent fonts, mismatched address)

**Weekly metric:** Average claim resolution time. Target ≤24 hours by Month 2.

---

### Process 5 — Editorial Content Cadence

**Owner:** Product Lead  
**Cadence:** Weekly publication; monthly performance review; quarterly calendar planning

**Weekly (Tuesdays):**
- Publish 1 new collection via `/admin/collections`
- Suggested format: "[City] + [Category or Occasion]" (e.g., "Black-Owned Bookstores in Chicago")
- Minimum 5 listings per collection; curate personally — do not include listings with no images

**Monthly:**
- Review collection page views (Vercel Analytics → `/collection/*` routes)
- Review which collections drove the most saves
- Retire collections that are no longer accurate or relevant

**Quarterly:**
- Plan next quarter's collection calendar with seasonal hooks (e.g., holiday gift guides, Black History Month, Juneteenth)
- Identify new cities or categories gaining listing density

---

### Process 6 — Seed City Strategy

**Owner:** Product Lead + data entry volunteer(s)  
**Cadence:** Ongoing through Month 1; re-assess at Month 2

**Targets:**

| City | Minimum listings | Priority categories |
|---|---|---|
| Atlanta | 150 | Restaurants, salons/barbers, retailers, professional services, creatives |
| Houston | 50 | Restaurants, salons/barbers, retailers, professional services |
| Chicago | 50 | Restaurants, salons/barbers, retailers, professional services |

**Sourcing methods (manual):**
1. Existing Black business directories (Google searches, community lists, Yelp)
2. Community submission form at `/add-business` (share with Atlanta/Houston/Chicago community groups)
3. Social media discovery (search "Black-owned [category] in [city]")
4. Referrals from early claimed businesses ("Who else should be on here?")

**Tracking:** Maintain a shared spreadsheet with columns: business name, city, category, source, status (added/pending/no info), claimed (yes/no), outreach sent (date).

**Quality gate:** Every new listing must have: name, category, city, at least one contact method (phone or website), and at least one image before being marked complete.

---

### Process 7 — Business Outreach

**Owner:** Product Lead  
**Cadence:** Ongoing; weekly batch

**Outreach triggers:**
- Business exists in the directory as an unclaimed listing
- Business was identified from a seed data source but not yet added
- A community member reported that a business should be on the platform

**Outreach process:**
1. Identify unclaimed listings via `/admin/listings?claimed=false`
2. Find the business's public contact information (website, Instagram, Google)
3. Send the outreach email (template below)
4. Wait 7 days for a response
5. If no response, send one follow-up
6. Mark status in the tracking spreadsheet: `outreach-sent`, `outreach-followed-up`, `claimed`, `no-response`

**Outreach email template:**
> Subject: Your business is on The BLACQList — claim your Page
>
> Hi [Business Name] team,
>
> We've added [Business Name] to The BLACQList — a directory dedicated to Black-owned businesses. Your page is live at [listing URL].
>
> Claiming your page is free and takes about 15 minutes. Once claimed, you can:
> - Update your hours, contact info, and photos
> - Add your services and configure your call-to-action
> - See how many people are finding your business
>
> To claim your page: [claim URL]
>
> Questions? Reply to this email or visit [feedback@theblacqlist.com].
>
> — The BLACQList Team

**Target:** 30% of seed listings claimed within 60 days of launch.

---

### Process 8 — Sponsor Outreach

**Owner:** Product Lead (or dedicated sales person)  
**Cadence:** Month 1 research → Month 2 outreach → Month 3 close

**Month 1 — Research and target list**
- Identify 5–10 potential sponsors aligned with Black economic empowerment
- Target sponsor types:
  - **Community Partners:** Local credit unions, community banks, regional nonprofits targeting Black entrepreneurs
  - **City Spotlight sponsors:** National retail brands with a presence in Atlanta, Houston, or Chicago looking to reach local Black consumers
  - **Platform Partners:** National brands (banking, insurance, telecom) aligned with HBCU/Black community investments
- Research: existing Black business publication sponsors, NMSDC partner companies, HBCU sponsor lists

**Month 2 — Outreach**
- Send sponsorship deck to 5 target contacts
- Deck should include: platform mission, audience (Black community + businesses), reach metrics (page views, registered users), placement options (homepage, city pages, category pages), pricing tiers
- Reference `docs/blacqlist/monetization/monetization-spec.md` for placement pricing

**Month 3 — Close**
- Target: at least 1 signed sponsor agreement
- Minimum viable sponsorship: $500/month featured placement on homepage or city page
- First sponsor placement is manually managed via `/admin/sponsorships` (self-serve dashboard planned for V1.5)

---

## Day 30 Review

At the end of Day 30, conduct a structured review with Tech Lead and Product Lead:

**Operational health check:**
- [ ] Zero open P0 bugs
- [ ] Claim resolution SLA being met (≤48h)
- [ ] Seed data targets hit
- [ ] Monitoring alerts active and responding
- [ ] Sentry error count trending down week-over-week

**Growth check (against MVP done-when criteria):**
- [ ] Unique searches on trajectory toward 500 within 60 days
- [ ] Saves on trajectory toward 50 within 60 days
- [ ] Owner claims on trajectory toward 50 within 60 days

**Decision: Are we ready to expand to public launch?**

If YES: proceed with public social announcement and press outreach.  
If NO: identify the specific gate blocking public launch and set a 2-week fix timeline.
