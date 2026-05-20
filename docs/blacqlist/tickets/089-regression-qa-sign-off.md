# Ticket 089: Full regression QA test suite and sign-off

## Status

Draft

## Phase

Phase 17: Security, QA, Accessibility, Launch

## Priority

P0

## Feature Area

QA

---

## Context

This is the final QA gate before production launch. All P0 and P1 tickets must be implemented and the security audit (Ticket 086), accessibility audit (Ticket 087), and performance optimization (Ticket 088) must be complete before this ticket begins. A QA reviewer executes all test cases from every ticket in the backlog, then documents the pass/fail result in a QA sign-off report. No launch proceeds until all P0 test cases pass and all P1 test cases pass or have documented exceptions approved by the tech lead.

Testing is conducted on the staging environment against production-equivalent data (seed data applied per Ticket 093) and production-equivalent configuration (all environment variables set as they will be in production). Testing is performed in Chrome on desktop, Safari on desktop, and Chrome on a physical or simulated mobile device at 375px width.

Source documents: `docs/blacqlist/architecture/deployment-plan.md` §§ 7 (Launch Checklist), 8 (Pre-Launch Go/No-Go), 9 (Production Smoke Tests); all previous tickets 001–088.

---

## User Story

As the engineering and product team, we want a documented sign-off confirming that every critical user flow works correctly before we open The BLACQList to the public, so that our first users have a reliable experience and we do not launch with known P0 defects.

---

## Scope

**In scope:**

- Execution of all QA test cases from P0 tickets (approximately 40+ test cases across Tickets 013, 014, 020, 025, 030, 032–035, 037, 040–041, 086)
- Execution of all QA test cases from P1 tickets (approximately 80+ test cases)
- Five critical path regression tests (described in Implementation Notes)
- Cross-browser testing: Chrome desktop, Safari desktop, Chrome mobile 375px
- Role matrix testing: 5 roles × critical flows = 25 role/flow combinations (see below)
- Documentation of every test case result in the QA sign-off report
- Bug triage: all failures categorized as P0 / P1 / P2 / P3; P0 and P1 bugs entered as separate tickets
- Final go/no-go recommendation in the QA sign-off report

**Out of scope:**

- Load testing / performance testing under concurrent users (deferred)
- Automated end-to-end test suite (deferred to V1 — Playwright or Cypress)
- iOS Safari testing (desired but not blocking)

---

## Dependencies

| Dependency                                                | Type                                                 | Status                |
| --------------------------------------------------------- | ---------------------------------------------------- | --------------------- |
| All P0 tickets (001–014, 020, 025, 032–035, 037, 040–041) | Must be implemented and merged                       | In Progress           |
| All P1 tickets                                            | Must be implemented and merged                       | In Progress           |
| Ticket 086: Security audit complete                       | Must be complete — no Critical or High findings open | In Progress           |
| Ticket 087: Accessibility audit complete                  | Must be complete — no Critical findings open         | In Progress           |
| Ticket 088: Performance optimization complete             | Must be complete — Lighthouse scores documented      | In Progress           |
| Staging environment with seed data applied                | Infrastructure                                       | Required              |
| Test accounts for all 5 roles (from seed data plan)       | Infrastructure                                       | Must exist in staging |

---

## UX Notes

This is a QA execution ticket. No UX changes.

---

## Design Notes

No design work.

---

## Data Notes

The staging database must match production configuration: all migrations applied, seed data loaded (150+ Atlanta listings, 50+ Houston, 50+ Chicago), all reference data present (states, cities, categories, plans).

---

## API Notes

No API changes.

---

## Implementation Notes

**Test environments:**

- Staging Vercel URL (not localhost) — must use the actual Vercel preview or staging deployment
- All tests conducted with JavaScript enabled (except one test to verify baseline HTML rendering for SEO)

**Required test accounts (staging):**

- `supporter@test.blacqlist.dev` / `TestPassword123!` — Supporter role
- `owner@test.blacqlist.dev` / `TestPassword123!` — Owner role (has one claimed, published listing)
- `admin@test.blacqlist.dev` / `TestPassword123!` — Admin role
- `superadmin@test.blacqlist.dev` / `TestPassword123!` — Super Admin role
- Unauthenticated (no account)

**Five critical path regression tests (execute in order):**

**Critical Path 1 — Discovery flow:**

1. Anonymous: homepage → search "restaurant" with city "Atlanta" → listing card click → BLACQList Page loads → verify SEO title in `<head>` → verify CTA button visible → attempt to save (sign-in modal appears) → close modal → listing page intact
2. Pass criteria: all steps complete without error; listing page server-rendered (view-source confirms `<title>` is not empty)

**Critical Path 2 — Submit (add business) flow:**

1. Sign in as Supporter → navigate to `/add-business` → complete all 7 steps → submit
2. Pass criteria: submission creates a pending listing; confirmation shown; listing appears in admin queue at `/admin/listings` with `status = 'pending_review'`

**Critical Path 3 — Claim flow:**

1. Sign in as Supporter → navigate to `/claim` → search for an unclaimed seed listing → complete claim form → upload a test document → submit
2. Sign in as Admin → navigate to `/admin/claims` → verify claim in queue → approve the claim
3. Sign back in as the claiming user → navigate to `/dashboard` → verify owner dashboard access granted
4. Pass criteria: full claim-to-approval cycle completes end-to-end; owner dashboard accessible after approval

**Critical Path 4 — Owner dashboard and page editor:**

1. Sign in as Owner → navigate to `/dashboard` → verify stat cards show data → navigate to `/dashboard/page` → edit the business name → save → wait 5 seconds → navigate to the public BLACQList Page → verify updated name is visible
2. Pass criteria: edit saved; public page reflects the update (either immediately via `revalidatePath` or after manual cache bust)

**Critical Path 5 — Admin operations:**

1. Sign in as Admin → navigate to `/admin/claims` → verify pending claims visible → navigate to `/admin/listings` → filter by `status = 'published'` → verify 150+ Atlanta listings visible → navigate to `/admin/analytics` → verify stat cards populated
2. Pass criteria: all admin pages load; data correct; no JavaScript errors in console

**Role × Flow matrix (25 combinations):**

| Flow                              | Anonymous     | Supporter | Owner    | Admin | Super Admin |
| --------------------------------- | ------------- | --------- | -------- | ----- | ----------- |
| View BLACQList Page               | Pass          | Pass      | Pass     | Pass  | Pass        |
| Search with city filter           | Pass          | Pass      | Pass     | Pass  | Pass        |
| Attempt to save (unauthenticated) | Sign-in modal | Pass      | Pass     | Pass  | Pass        |
| Access `/dashboard`               | Redirect      | Redirect  | Pass     | Pass  | Pass        |
| Access `/admin`                   | Redirect      | Redirect  | Redirect | Pass  | Pass        |

**Deliverable:**

- `docs/blacqlist/launch/qa-sign-off-report.md` containing:
  - Test execution date and environment
  - Tester name
  - Pass/fail result for every test case in every ticket
  - List of P0 bugs found (must be zero for launch approval)
  - List of P1 bugs found (must be resolved or have approved exceptions)
  - List of P2/P3 bugs (logged as known issues)
  - Final recommendation: GO / NO-GO / GO WITH CONDITIONS

---

## Acceptance Criteria

- [ ] All QA test cases from P0 tickets executed and documented as pass or fail
- [ ] All QA test cases from P1 tickets executed and documented as pass or fail
- [ ] Five critical path regression tests completed on Chrome desktop, Safari desktop, and Chrome mobile 375px
- [ ] Role × flow matrix completed — all 25 combinations tested
- [ ] Zero P0 bugs open at the time of sign-off (any P0 found during QA must be fixed and re-tested before this ticket closes)
- [ ] All P1 bugs either fixed, or documented with an approved exception from the tech lead
- [ ] QA sign-off report written and committed to `docs/blacqlist/launch/qa-sign-off-report.md`
- [ ] QA report includes a final GO / NO-GO / GO WITH CONDITIONS recommendation
- [ ] Security audit report (Ticket 086) linked from the QA sign-off report
- [ ] Accessibility audit report (Ticket 087) linked from the QA sign-off report
- [ ] Lighthouse scores document (Ticket 088) linked from the QA sign-off report

---

## Failure States

| Failure                            | Resolution                                                                                               |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| P0 bug found during QA             | Open hotfix ticket; fix merged and re-tested; QA sign-off blocked until resolved                         |
| P1 bug found with no fix timeline  | Documented in QA report with "GO WITH CONDITIONS — P1 resolution by [date]"; tech lead approval required |
| Critical Path 3 (claim flow) fails | P0 blocker; launch blocked until entire claim-to-approval flow works end-to-end                          |
| Admin queue inaccessible           | P0 blocker; critical admin infrastructure failure                                                        |

---

## Edge Cases

- Test with a real email address for smoke test QA-6 (sign-up with email verification) — use a `+` alias to avoid consuming a real account slot
- Test the 404 page at a URL that doesn't exist — confirm branded 404 renders, not Vercel's default
- Test in Safari private browsing mode — some cookie/session behaviors differ from Chrome

---

## Accessibility Notes

The QA sign-off includes verification that all Critical and High accessibility findings from Ticket 087 are resolved. The accessibility audit report must be marked PASS before this ticket can close.

---

## QA Test Cases

The test cases for this ticket ARE the compilation of all test cases from all previous tickets. The per-flow critical path tests above are the additional regression tests specific to this ticket.

| #    | Scenario                             | Role              | Steps                     | Expected result                                                       |
| ---- | ------------------------------------ | ----------------- | ------------------------- | --------------------------------------------------------------------- |
| QA-1 | Critical Path 1 — Discovery          | Anonymous         | See Critical Path 1 above | All steps pass on Chrome desktop, Safari desktop, Chrome mobile 375px |
| QA-2 | Critical Path 2 — Submit             | Supporter         | See Critical Path 2 above | Submission creates pending listing visible in admin queue             |
| QA-3 | Critical Path 3 — Claim              | Supporter + Admin | See Critical Path 3 above | End-to-end claim-to-approval cycle completes                          |
| QA-4 | Critical Path 4 — Dashboard + editor | Owner             | See Critical Path 4 above | Edit saved; public page updated                                       |
| QA-5 | Critical Path 5 — Admin              | Admin             | See Critical Path 5 above | Admin pages load; data correct                                        |

---

## Security Notes

QA testing must include the verification that all security audit findings (Ticket 086) are resolved. The QA sign-off report references the security audit report as a prerequisite.

---

## Completion Checklist

- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] All four states implemented (loading, empty, error, success)
- [ ] Mobile tested at 375px
- [ ] Keyboard navigation tested
- [ ] Accessibility requirements met
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
