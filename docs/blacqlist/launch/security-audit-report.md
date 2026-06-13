# Security Audit Report — The BLACQList

**Ticket:** 086  
**Status:** Pending — to be executed on staging environment  
**Environment:** Staging (production-equivalent configuration)

---

## Summary

| Category | Findings | Critical | High | Medium | Low |
|---|---|---|---|---|---|
| RLS verification | Pending | — | — | — | — |
| Route boundary | Pending | — | — | — | — |
| IDOR / API | Pending | — | — | — | — |
| OWASP Top 10 | Pending | — | — | — | — |
| Secret exposure | Pending | — | — | — | — |

**Go/No-Go:** PENDING

---

## 1. RLS Verification Matrix

Test each table using the Supabase JS client directly (not through the app) with four sessions:
- **Anon** — `createClient()` with anon key, no session
- **Supporter** — authenticated user with no `owner` role
- **Owner** — authenticated user who owns the test listing
- **Service Role** — admin test via service client (expected: full access)

| Table | Anon SELECT | Supporter SELECT (non-owner) | Owner SELECT (own) | Service Role | Result |
|---|---|---|---|---|---|
| `listings` (published) | allowed | allowed | allowed | allowed | |
| `listings` (draft/pending) | blocked | blocked | allowed (own only) | allowed | |
| `listings` (soft-deleted) | blocked | blocked | blocked | allowed | |
| `listing_details_business` | via published join only | via published join only | own only | allowed | |
| `listing_hours` | via published join only | via published join only | own only | allowed | |
| `listing_links` | via published join only | via published join only | own only | allowed | |
| `services` | via published join only | via published join only | own only | allowed | |
| `media_attachments` (listing-media) | via published join only | via published join only | own only | allowed | |
| `saves` | blocked | own only | own only | allowed | |
| `claims` | blocked | own only | own only | allowed | |
| `reviews` | published only | own only | own only | allowed | |
| `collections` | published only | n/a | n/a | allowed | |
| `collection_items` | via published join | n/a | n/a | allowed | |
| `analytics_events` | blocked | blocked | own listing only | allowed | |
| `entity_analytics_daily` | blocked | blocked | own listing only | allowed | |
| `search_events` | blocked | blocked | blocked | allowed | |
| `admin_audit_log` | blocked | blocked | blocked | own entries (admin) / all (super_admin) | |
| `profiles` | blocked | own only | own only | allowed | |
| `user_roles` | blocked | own only | own only | allowed | |
| `categories` | all active | all active | all active | allowed | |
| `cities` | all | all | all | allowed | |

**Testing method:** Use Supabase Studio → SQL Editor with the anon key JS client for anon tests; use a real browser session cookie for authenticated tests.

---

## 2. Route Boundary Tests

Test each route pattern in three states: unauthenticated, authenticated as Supporter, authenticated as Owner/Admin.

| Route | Unauthenticated | Supporter | Owner | Admin |
|---|---|---|---|---|
| `/dashboard` | Redirect to `/sign-in?next=/dashboard` | Redirect to `/account/saved` (no listing) | Dashboard loads | — |
| `/dashboard/pages/[id]/edit` | Redirect to sign-in | 403 via requireOwner | Loads | — |
| `/account/saved` | Redirect to sign-in | Loads | Loads | Loads |
| `/admin` | Redirect to sign-in | Redirect to `/` (via requireAdmin) | Redirect to `/` | Loads |
| `/admin/listings` | Redirect to sign-in | Redirect to `/` | Redirect to `/` | Loads |
| `/admin/analytics` | Redirect to sign-in | Redirect to `/` | Redirect to `/` | Loads |
| `/claim/[id]` | Redirect to sign-in | Loads | Loads | Loads |
| `/add-business` | Redirect to sign-in | Loads | Loads | — |
| `/sign-in` (while logged in) | Loads | Redirect to `/account/saved` | Redirect to `/account/saved` | — |

---

## 3. IDOR / API Endpoint Tests

Use curl or Bruno with a valid session cookie for authenticated tests.

| Endpoint | Test | Expected | Result |
|---|---|---|---|
| `GET /api/search` | No auth, status=draft param injected | Only published listings returned | |
| `POST /api/upload` | No session | 401 | |
| `POST /api/upload` | Valid session, `entity_id` = another owner's listing | 403 | |
| `POST /api/listings/duplicate-check` | No session | 401 | |
| `GET /api/dashboard/analytics?listing_id=[other-owner-id]` | Owner A session, Owner B listing ID | 403 | |
| Server Action: `updateListingStatusAction` | Forged `listing_id` in formData | `{ error: 'Listing not found.' }` | |
| Server Action: `createClaimAction` | No session | Redirect to sign-in | |

---

## 4. OWASP Top 10 Checklist

| # | Category | Check | Finding | Severity | Status |
|---|---|---|---|---|---|
| A01 | Broken Access Control | IDOR test on analytics API; RLS matrix above | — | — | Pending |
| A02 | Cryptographic Failures | `npm audit`; no service role key in client bundle | — | — | Pending |
| A03 | Injection | Search param sanitization (Supabase parameterized queries); form field injection | — | — | Pending |
| A04 | Insecure Design | Auth flow: sign-up → verify email → onboarding; no token reuse | — | — | Pending |
| A05 | Security Misconfiguration | CORS on API routes; rate limiting on auth endpoints | — | — | Pending |
| A06 | Vulnerable Components | `npm audit` for known CVEs | — | — | Pending |
| A07 | Auth Failures | Session cookie httpOnly; token expiry handled; middleware refresh working | — | — | Pending |
| A08 | Data Integrity | CSP headers (check Vercel config); third-party scripts | — | — | Pending |
| A09 | Logging & Monitoring | `admin_audit_log` recording mutations; Sentry configured | — | — | Pending |
| A10 | SSRF | No server-side URL fetch from user-controlled input (spot-check) | — | — | Pending |

**npm audit command:**
```bash
cd projects/theblacqlist
npm audit --audit-level=high
```

---

## 5. Secret Exposure Check

**Browser test:** Open Chrome DevTools → Network tab → load homepage → search all response bodies for:
- `service_role`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `RESEND_API_KEY`

**Environment variable audit:** Confirm these are NOT prefixed with `NEXT_PUBLIC_`:
- `SUPABASE_SERVICE_ROLE_KEY` ✓ (server-only)
- `STRIPE_SECRET_KEY` ✓ (server-only)
- `RESEND_API_KEY` ✓ (server-only)
- `ANTHROPIC_API_KEY` ✓ (server-only)

| Variable | `NEXT_PUBLIC_`? | In client bundle? | Result |
|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | No | Pending | |
| `STRIPE_SECRET_KEY` | No | Pending | |
| `RESEND_API_KEY` | No | Pending | |

---

## 6. Findings Log

*To be populated during audit execution.*

| ID | Category | Severity | Description | Reproduction | Status |
|---|---|---|---|---|---|
| — | — | — | No findings yet | — | — |

---

## Go/No-Go Recommendation

**PENDING** — Execute audit in staging environment and update this document.

**Go criteria:**
- All Critical findings resolved and re-tested
- All High findings resolved or have accepted risk statement
- No `SUPABASE_SERVICE_ROLE_KEY` or other server secrets in client bundle
- RLS matrix: all 21 tables pass all 4 scenarios
