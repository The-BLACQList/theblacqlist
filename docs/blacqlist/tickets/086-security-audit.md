# Ticket 086: Security audit — RLS verification, auth boundary testing, OWASP review

## Status

Draft

## Phase

Phase 17: Security, QA, Accessibility, Launch

## Priority

P0

## Feature Area

Security

---

## Context

Before the platform opens to the public, every data access boundary must be tested from the outside — not just reviewed in code. This is a QA and audit ticket. The deliverable is not code; it is a security audit report identifying every finding with severity (Critical / High / Medium / Low), and a confirmation that all Critical and High findings have been resolved before launch.

The audit covers four areas: (1) RLS policy verification against the specification in `rls-policy-plan.md`, (2) auth boundary testing for every protected route, (3) direct API testing for IDOR and parameter tampering vulnerabilities, and (4) an OWASP Top 10 review checklist against the codebase.

All Critical and High findings must be resolved and re-tested before the launch go/no-go gate (Ticket 089 — regression QA sign-off). Medium and Low findings must be documented as known issues with a resolution timeline.

Source documents: `docs/blacqlist/data/rls-policy-plan.md`; `docs/blacqlist/architecture/security-and-privacy-plan.md`; `docs/blacqlist/architecture/production-architecture.md` § 5 (Auth Architecture); Ticket 013 (RLS policies); Ticket 058 (auth middleware, assumed).

---

## User Story

As the engineering team, we want to verify that every security boundary is correctly enforced before launching publicly, so that user data is protected and the platform cannot be exploited by unauthorized access.

---

## Scope

**In scope:**

- RLS verification for every MVP table (21 tables): test each table with (a) unauthenticated request, (b) authenticated non-owner request, (c) authenticated owner request, (d) admin request — confirm each behaves per `rls-policy-plan.md`
- Auth boundary testing: every route pattern listed in the middleware spec (`/dashboard/*`, `/account/*`, `/claim/*`, `/admin/*`) tested while (a) unauthenticated, (b) with expired session, (c) with a suspended account
- API endpoint testing: every Route Handler and Server Action tested directly (curl/Postman/Bruno — not through the UI) for: auth bypass (call without session), IDOR (substitute another user's resource ID), parameter tampering (inject unexpected values into validated fields)
- OWASP Top 10 checklist: review the codebase against each of the 10 categories; document findings per category
- Secret exposure check: confirm no API keys, service role keys, or other secrets are present in the client bundle (browser network tab inspection) or in any `NEXT_PUBLIC_*` environment variable that should be server-only
- Sentry PII audit: trigger a test error from each major flow and inspect the Sentry event payload for PII fields (email, phone, name, address)

**Out of scope:**

- Penetration testing by an external security firm (deferred to V1)
- Stripe webhook security (separate audit when V1 payments are implemented)
- V2 marketplace security review

---

## Dependencies

| Dependency                                                                 | Type                                 | Status                                   |
| -------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------- |
| Ticket 013: RLS policies for all 21 MVP tables                             | Blocking ticket — must exist to test | In Progress                              |
| Ticket 014: Auth flows                                                     | Blocking ticket                      | In Progress                              |
| All Route Handler and Server Action tickets (025, 030, 031, 041, 045, 049) | Must be implemented to test          | In Progress                              |
| Staging environment with all migrations applied                            | Infrastructure                       | Must be ready                            |
| Test accounts: supporter, owner, admin, super_admin                        | Infrastructure                       | Must exist in staging per seed data plan |

---

## UX Notes

This is a backend/audit ticket. No user-facing UI changes.

---

## Design Notes

No design work in this ticket.

---

## Data Notes

**Tables to test (all 21 MVP tables):**

| Table                               | Anonymous can SELECT?              | Owner can SELECT own?   | Owner can UPDATE own?    | Admin (service role) full access?            |
| ----------------------------------- | ---------------------------------- | ----------------------- | ------------------------ | -------------------------------------------- |
| `listings` (published, non-deleted) | Yes                                | Yes (any status)        | Yes                      | Yes                                          |
| `listings` (draft/pending)          | No                                 | Yes (own only)          | Yes                      | Yes                                          |
| `listings` (soft-deleted)           | No                                 | No                      | No                       | Yes                                          |
| `listing_details_business`          | Via JOIN to published listing only | Own listing only        | Own listing only         | Yes                                          |
| `listing_hours`                     | Via JOIN to published listing only | Own listing only        | Own listing only         | Yes                                          |
| `listing_links`                     | Via JOIN to published listing only | Own listing only        | Own listing only         | Yes                                          |
| `services`                          | Via JOIN to published listing only | Own listing only        | Own listing only         | Yes                                          |
| `media_attachments` (listing-media) | Via JOIN to published listing only | Own listing only        | Own listing only         | Yes                                          |
| `saves`                             | No (own saves only)                | Own saves only          | N/A                      | Yes                                          |
| `claims`                            | No                                 | Own claims only         | No (insert only)         | Yes                                          |
| `reviews`                           | Published reviews only (V1)        | Own reviews only        | Own pending reviews only | Yes                                          |
| `collections`                       | Published only                     | N/A                     | N/A                      | Yes                                          |
| `collection_items`                  | Via JOIN to published collection   | N/A                     | N/A                      | Yes                                          |
| `analytics_events`                  | No                                 | Own listing events only | No                       | Yes                                          |
| `entity_analytics_daily`            | No                                 | Own listing rows only   | No                       | Yes                                          |
| `search_events`                     | No                                 | No                      | No                       | Yes                                          |
| `admin_audit_log`                   | No                                 | No                      | No                       | Admin: own entries; Super Admin: all entries |
| `users` / `profiles`                | No                                 | Own profile only        | Own profile only         | Yes                                          |
| `user_roles`                        | No                                 | Own roles only          | No                       | Yes                                          |
| `categories`                        | Yes (all active)                   | N/A                     | N/A                      | Yes                                          |
| `cities`                            | Yes (all)                          | N/A                     | N/A                      | Yes                                          |

---

## API Notes

**Endpoints to test for auth bypass and IDOR:**

| Endpoint                                                              | Test scenario                                                                                                     |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `GET /api/search`                                                     | No auth needed; test that `status != 'published'` listings never appear                                           |
| `POST /api/upload`                                                    | Test without session (expect 401); test uploading to another user's listing (expect 403)                          |
| `POST /api/listings/duplicate-check`                                  | Test without session (expect 401)                                                                                 |
| `POST /api/saves`                                                     | Test without session (expect 401); test saving on behalf of another `user_id` (expect 403/ignored)                |
| `DELETE /api/saves/[id]`                                              | Test deleting another user's save by guessing the save ID (expect 403 or 404)                                     |
| `POST /api/analytics/event`                                           | Test injecting a `listing_id` belonging to a private draft listing (event should be recorded but not exploitable) |
| `GET /api/dashboard/analytics`                                        | Test with a `listing_id` belonging to another owner (expect 403)                                                  |
| All Server Actions (createListing, updateListing, approveClaim, etc.) | Test each without a session; test each with a valid session but insufficient role                                 |

---

## Implementation Notes

**Deliverables (documents, not code):**

1. **Security Audit Report** (`docs/blacqlist/launch/security-audit-report.md`):
   - Per-table RLS test results (pass/fail per the 4-scenario matrix)
   - Per-route auth boundary test results
   - Per-endpoint IDOR test results
   - OWASP Top 10 checklist with findings per category
   - Secret exposure check results
   - Sentry PII audit results
   - Summary: findings by severity (Critical / High / Medium / Low)

2. **Findings backlog tickets:** For every Critical or High finding, open a hotfix ticket in the backlog with the finding description, reproduction steps, and proposed fix. These tickets must be resolved and verified before the launch gate.

**Testing methodology:**

- Use Supabase Studio "SQL Editor" with a non-service-role Supabase JS client to test RLS policies directly — no application layer involvement
- Use curl or Bruno (REST client) for Route Handler testing — not the application UI
- Use `next/headers` session cookies from a logged-in browser session for authenticated API tests
- For the OWASP review: use the OWASP Testing Guide (WSTG) as the reference; document each category with specific findings or "No findings" per category

**OWASP Top 10 categories to check:**

1. Broken Access Control — IDOR, RLS bypass, privilege escalation
2. Cryptographic Failures — secrets in client bundle, HTTP vs. HTTPS, session storage
3. Injection — SQL injection via search params, form fields, URL slugs
4. Insecure Design — auth flow design, password reset token lifetime
5. Security Misconfiguration — CORS settings, rate limiting on auth endpoints
6. Vulnerable and Outdated Components — `npm audit` for known CVEs
7. Identification and Authentication Failures — session fixation, token expiry handling
8. Software and Data Integrity Failures — CSP headers, third-party script integrity
9. Security Logging and Monitoring Failures — Sentry configured, audit log working
10. Server-Side Request Forgery — any server-side URL fetch from user-controlled input

**Key checks that commonly fail on first audit:**

- Direct URL access to `/admin/*` with a supporter session — must redirect, not 403 with admin route confirmation
- POST to a Server Action with a forged `listing_id` in the form payload
- `GET /api/dashboard/analytics?listing_id=[other-owner-listing-id]` — must return 403
- `SUPABASE_SERVICE_ROLE_KEY` visible in browser network tab (often appears when accidentally added with `NEXT_PUBLIC_` prefix)
- Search query results including draft or flagged listings

---

## Acceptance Criteria

- [ ] All 21 MVP tables tested against the 4-scenario RLS matrix; results documented in the security audit report
- [ ] All protected route patterns (`/dashboard/*`, `/admin/*`, `/claim/*`, `/account/*`) tested unauthenticated, with expired session, and with a suspended account — results documented
- [ ] All listed API endpoints tested for auth bypass and IDOR — results documented
- [ ] OWASP Top 10 checklist completed and documented
- [ ] No `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, or `ANTHROPIC_API_KEY` visible in the client-side bundle or any `NEXT_PUBLIC_*` variable
- [ ] Sentry events confirmed to not include PII (email, phone, name, address)
- [ ] Security audit report written and committed to `docs/blacqlist/launch/security-audit-report.md`
- [ ] All Critical findings resolved and re-tested
- [ ] All High findings resolved and re-tested OR documented with an accepted risk statement from the tech lead
- [ ] A go/no-go recommendation included in the audit report: "PASS — ready for production launch" or "BLOCK — [list of unresolved findings]"

---

## Failure States

| Failure                                 | Resolution                                                                                                       |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Critical RLS bypass found               | Hotfix ticket opened; RLS policy corrected; re-tested before launch                                              |
| Service role key found in client bundle | Emergency hotfix; key rotated in Supabase and all environments; variable renamed to remove `NEXT_PUBLIC_` prefix |
| IDOR vulnerability in a Route Handler   | Hotfix ticket; ownership check added; tested before launch                                                       |
| Known CVE in npm dependency             | Dependency updated or replaced; `npm audit` re-run                                                               |

---

## Edge Cases

- Some RLS policies use subqueries on `user_roles` — verify these do not have O(N) performance issues at scale (test with a `user_roles` table containing 100+ rows)
- Suspended accounts: verify that `middleware.ts` checks `profiles.suspended_at IS NOT NULL` and that a suspended admin cannot access admin routes
- Service role usage in Edge Functions: confirm Edge Function auth header validation is in place (Ticket 082)

---

## Accessibility Notes

This is an audit ticket. No accessibility requirements.

---

## QA Test Cases

| #    | Scenario                               | Role      | Steps                                                                                       | Expected result                                                             |
| ---- | -------------------------------------- | --------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| QA-1 | Unauthenticated access to `/dashboard` | Anonymous | Navigate to `https://theblacqlist.com/dashboard` without being signed in                    | Redirected to `/sign-in?next=/dashboard`; dashboard content not visible     |
| QA-2 | Non-admin access to `/admin`           | Supporter | Sign in as supporter; navigate to `/admin`                                                  | Redirected to `/`; no "access denied" message that confirms `/admin` exists |
| QA-3 | IDOR on analytics endpoint             | Owner     | Sign in as Owner A; GET `/api/dashboard/analytics?listing_id=[Owner B's listing ID]`        | 403 response; no Owner B data returned                                      |
| QA-4 | Service role key not in client bundle  | Any       | Open browser DevTools → Network; load the homepage; search all responses for `service_role` | No response contains the string `service_role`                              |
| QA-5 | RLS: draft listing not public          | Anonymous | Direct Supabase JS query for a listing with `status = 'draft'` using the anon key           | Zero rows returned                                                          |

---

## Security Notes

The security audit itself is the security deliverable. The audit must be conducted on the staging environment using production-equivalent data and configuration. Do not conduct the RLS or IDOR tests on the production database.

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
