# User Feedback Plan — The BLACQList

**Date:** 2026-05-11
**Status:** Active — operational from launch day
**Owner:** Product Lead
**References:** `post-launch-plan.md`, `rollback-plan.md`, `next-90-days-roadmap.md`

This document covers how feedback is collected, categorized, triaged, and routed from launch day forward. Every team member is responsible for routing feedback to the right channel — not for deciding what to do with it.

---

## Section 1 — Feedback Channels

| Channel                           | Purpose                                               | Monitored by     | Frequency                       |
| --------------------------------- | ----------------------------------------------------- | ---------------- | ------------------------------- |
| `feedback@theblacqlist.com`       | Primary public feedback email                         | Product Lead     | Daily                           |
| Reply to the invite email         | Tester week feedback: testers reply to the invite they were sent, from the founder's mailbox | Founder          | Daily during tester week        |
| Soft launch tester channel        | Direct channel with soft launch testers               | Product Lead     | Active during first 2 weeks     |
| Social mentions (`@theblacqlist`) | Twitter/X, Instagram, Facebook mentions               | Product Lead     | Manual, daily for first 30 days |
| In-app feedback form              | Dedicated `/feedback` form if built                   | Product Lead     | Daily (same as email)           |

**If the in-app feedback form is not yet built:** All in-app feedback CTAs should link to `mailto:feedback@theblacqlist.com` until the form exists.

**Social mentions note:** Do not respond to social mentions with specific support or bug triage. For any bug report on social: reply publicly with "Thanks for letting us know — we'd love more details at feedback@theblacqlist.com" and route to the internal channel.

---

## Section 2 — Feedback Categories

Every piece of feedback must be assigned exactly one category before it enters the triage queue.

| Category              | Definition                                                                       | Owner        | Default route                                     |
| --------------------- | -------------------------------------------------------------------------------- | ------------ | ------------------------------------------------- |
| **Bug**               | Something is broken, wrong, or not working as designed                           | Tech Lead    | → Bug triage (Section 3)                          |
| **UX issue**          | Flow confusion, missing label, unclear state, confusing behavior (not broken)    | Product Lead | → Backlog ticket or next sprint                   |
| **Data quality**      | Incorrect info on a listing: wrong hours, wrong address, wrong phone, wrong name | Admin        | → Admin correction queue + business outreach      |
| **Feature request**   | A capability the user wants that does not currently exist                        | Product Lead | → reply to invite email → monthly review          |
| **Claim issue**       | Problem with submitting a claim, claim status, or claim result                   | Admin        | → Claim queue manual review at `/admin/claims`    |
| **Accessibility**     | Screen reader, keyboard navigation, contrast, or label issue                     | Tech Lead    | → Accessibility ticket (link to ticket 087 group) |
| **Praise / positive** | Positive feedback about the product                                              | Product Lead | → Log in monthly summary; share with team         |
| **Unclear**           | Cannot determine category from the submission                                    | Product Lead | → Reply to gather more detail before categorizing |

---

## Section 3 — Triage SLA

These SLAs apply from the moment feedback enters any monitored channel.

| Category                                     | Response SLA                              | Resolution SLA                    |
| -------------------------------------------- | ----------------------------------------- | --------------------------------- |
| P0 bug (site down, auth broken, data breach) | Same day → escalate to `rollback-plan.md` | Same day                          |
| P1 bug (critical flow broken)                | 24 hours                                  | 48 hours                          |
| P2 bug (non-critical feature broken)         | 72 hours                                  | Next deploy                       |
| P3 bug / UX issue                            | 1 week acknowledgement                    | Next sprint                       |
| Data quality issue                           | 24 hours (admin action)                   | N/A — correction made immediately |
| Feature request                              | 7 days acknowledgement                    | Monthly product review            |
| Claim issue                                  | 24 hours                                  | 48 hours                          |
| Accessibility issue                          | 48 hours                                  | Next sprint (or sooner if severe) |

**Escalation rule:** If any P1 bug goes unresolved for 36 hours, Tech Lead notifies Product Lead and both agree on next action (hotfix, rollback, or accept and timeline).

---

## Section 4 — Response Templates

Use these templates for all first responses. Personalize where indicated by `[brackets]`.

---

**Bug acknowledgement (P0/P1):**

> Hi [Name or "there"],
>
> Thank you for reporting this. We've logged it as a priority fix and are actively investigating.
>
> We'll follow up within [24 hours / same day] with an update.
>
> — The BLACQList Team

---

**Bug acknowledgement (P2/P3):**

> Hi [Name or "there"],
>
> Thank you — we've logged this issue and it's in our queue for an upcoming fix.
>
> — The BLACQList Team

---

**Feature request acknowledgement:**

> Hi [Name or "there"],
>
> Thank you for the suggestion — we've added it to our product review list.
>
> We review feature requests monthly and will keep this in mind as we plan upcoming releases. We'll reach out if it becomes part of a future update.
>
> — The BLACQList Team

---

**Data quality report acknowledgement:**

> Hi [Name or "there"],
>
> Thank you for letting us know. We're reaching out to the business to confirm the correct information and will update the listing as soon as we hear back.
>
> — The BLACQList Team

---

**Unclear feedback — request for more detail:**

> Hi [Name or "there"],
>
> Thank you for reaching out. To help us look into this, could you share:
>
> - What you were trying to do
> - What page or step you were on
> - What you saw (an error message, a blank screen, something unexpected)
>
> — The BLACQList Team

---

**Claim issue acknowledgement:**

> Hi [Name or "there"],
>
> Thank you for reaching out about your claim. We've located your submission and will review it within 48 hours.
>
> You'll receive an email at [their email] once a decision is made.
>
> — The BLACQList Team

---

## Section 5 — Feedback → Ticket Pipeline

Not every piece of feedback becomes a ticket. This pipeline determines what does.

### Step 1 — Daily Triage (15 minutes, in standup)

- Product Lead reviews all feedback received since last standup
- Assigns a category (Section 2) and severity (P0–P3) to each item
- Routes to the appropriate owner
- Sends or delegates the response to the reporter

### Step 2 — Bug Conversion

| If     | Then                                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------------------ |
| P0 bug | Create a ticket immediately with: symptom, reproduction steps, affected users, assigned engineer. Begin fix. |
| P1 bug | Create a ticket within 4 hours. Add to top of current sprint.                                                |
| P2 bug | Create a ticket. Add to backlog. Include in next deploy planning.                                            |
| P3 bug | Add to backlog. Does not require a dedicated ticket — can be grouped as "minor fixes" in a sprint.           |

**Ticket format:** Title: `[Bug] [P0/P1/P2] [short description]`. Use the existing ticket template from the `docs/blacqlist/tickets/` format.

### Step 3 — UX Issue Conversion

1. Product Lead reviews all UX issues weekly (Wednesdays)
2. For confirmed issues with a clear fix: write a ticket and add to next sprint
3. For issues requiring more investigation: schedule a 30-minute design review before writing a ticket
4. For unclear issues: request a screen recording or more detail before triaging

### Step 4 — Feature Request Review (Monthly)

First Monday of each month, Product Lead reviews all tagged feature requests:

1. Group similar requests (e.g., 5 users asked for the same thing)
2. Assign a phase: `beta`, `v1`, `v2`, `do-not-build`, or `needs-research`
3. For high-volume requests (5+ reports): write a product brief or add to the roadmap
4. For low-volume requests: add to the `later` section of the roadmap with a note
5. For do-not-build decisions: document the reason (scope creep, vision misalignment, complexity)

### Step 5 — Data Quality Action

Data quality issues do not create tickets — they create admin actions:

1. Admin opens `/admin/listings` and finds the flagged listing
2. Corrects the information directly from the admin edit view if data is known
3. If data is uncertain: sends a data quality inquiry to the business using the business outreach process from `post-launch-plan.md`
4. Marks the listing as "outreach-sent" in the tracking spreadsheet
5. If no response in 7 days and the data is clearly incorrect: flag the listing as "needs-review" and add a note

---

## Section 6 — Day 30 Feedback Summary

At the end of Day 30, Product Lead produces a structured feedback summary for the team:

### Summary Template

```
## Post-Launch Feedback Summary — Day 30
**Period:** [Launch date] to [Day 30 date]
**Total feedback items received:** [N]

### By channel
- Email (feedback@theblacqlist.com): [N]
- Reply to invite email (tester week): [N]
- Soft launch tester channel: [N]
- Social mentions: [N]

### By category
- Bugs: [N] ([X] P0, [X] P1, [X] P2, [X] P3)
- UX issues: [N]
- Data quality reports: [N]
- Feature requests: [N]
- Claim issues: [N]
- Accessibility: [N]
- Praise: [N]

### Bug resolution status
- P0 bugs: [N] reported / [N] resolved / [N] open
- P1 bugs: [N] reported / [N] resolved / [N] open
- P2 bugs: [N] reported / [N] resolved / [N] open

### Top 3 UX issues (by report volume)
1. [Description] — [N] reports — Status: [ticket created / investigating / resolved]
2. [Description] — [N] reports
3. [Description] — [N] reports

### Top 5 feature requests (by report volume)
1. [Description] — [N] requests — Phase: [beta / v1 / v2 / do-not-build]
2. [Description] — [N] requests
3. [Description] — [N] requests
4. [Description] — [N] requests
5. [Description] — [N] requests

### Data quality corrections
- Listings corrected: [N]
- Listings awaiting business response: [N]

### Tester satisfaction signal
[Summary of qualitative feedback from the soft launch tester group — 2–3 sentences]

### Key takeaways for next sprint
1. [Takeaway]
2. [Takeaway]
3. [Takeaway]
```

---

## Section 7 — Feedback Process Review

At the end of Month 2 (Day 60), review this plan:

- Is the `feedback@theblacqlist.com` email being monitored consistently?
- Are P1 bugs being resolved within the SLA?
- Are feature requests being reviewed monthly?
- Is the triage taking more than 15 minutes per day? If yes, consider routing or tooling changes.
- Is an in-app feedback form needed? If yes, add a ticket for it.
- Should feedback be routed to a dedicated tool (Linear, Notion, Canny)? Evaluate at Month 2 based on volume.
