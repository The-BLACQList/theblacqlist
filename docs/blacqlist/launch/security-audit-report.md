# Security Audit Report — The BLACQList

**Ticket:** 086
**Status:** Complete (staging synthesis) — production re-verification is a launch condition
**Environment:** Staging (production-equivalent configuration) + static code/schema review
**Date:** 2026-06-20
**Method:** Synthesis of the 2026-05-22 manual QA execution (§A auth, §H IDOR/secrets, K6 PII — all Pass), the RLS policy plan + implemented policies, the security-and-privacy plan, direct FK/ownership review, and a fresh `pnpm audit`. This is a documentation audit of already-executed and statically-verifiable controls — **not** a fresh production penetration test (see Go/No-Go conditions).

---

## Summary

| Category | Findings | Critical | High | Medium | Low |
|---|---|---|---|---|---|
| RLS verification | Pass (boundary-verified; full per-table re-run is a launch condition) | 0 | 0 | 0 | 0 |
| Route boundary | Pass — guards enforce server-side | 0 | 0 | 0 | 0 |
| IDOR / API | Pass — H1/H2 verified 2026-05-22 | 0 | 0 | 0 | 0 |
| OWASP Top 10 | Pass with 3 accepted MVP gaps | 0 | 0 | 3 | 1 |
| Secret exposure | Pass — no server secret in client bundle | 0 | 0 | 0 | 0 |
| Dependencies (`pnpm audit`) | 6 transitive build-chain CVEs | 0 | 1 | 4 | 1 |

**Go/No-Go:** **GO WITH CONDITIONS** (see end).

---

## 1. RLS Verification Matrix

RLS is implemented in `supabase/migrations/20260510000001_mvp_rls_policies.sql` — **54 policies** across the MVP tables (spec: `docs/blacqlist/data/rls-policy-plan.md`; implementation notes: `docs/blacqlist/data/rls-implementation-report.md`). Roles: **Anon** (anon key, no session) · **Supporter** (authenticated non-owner) · **Owner** (owns the row) · **Service Role** (admin/backend, bypasses RLS).

| Table | Anon SELECT | Supporter SELECT (non-owner) | Owner SELECT (own) | Service Role | Result |
|---|---|---|---|---|---|
| `listings` (published) | allowed | allowed | allowed | allowed | PASS¹ |
| `listings` (draft/pending) | blocked | blocked | allowed (own only) | allowed | PASS¹ |
| `listings` (soft-deleted) | blocked | blocked | blocked | allowed | PASS¹ |
| `listing_details_business` | via published join only | via published join only | own only | allowed | PASS¹ |
| `listing_hours` | via published join only | via published join only | own only | allowed | PASS¹ |
| `listing_links` | via published join only | via published join only | own only | allowed | PASS¹ |
| `services` | via published join only | via published join only | own only | allowed | PASS¹ |
| `media_attachments` | via published join only | via published join only | own only | allowed | PASS¹ |
| `saves` | blocked | own only | own only | allowed | PASS¹ |
| `claims` | blocked | own only | own only | allowed | PASS¹ |
| `reviews` | published only | own only | own only | allowed | PASS¹ |
| `receipt_uploads` | blocked | own only | own only | allowed | PASS¹ |
| `spend_events` (aggregate) | aggregate only (no user_id) | aggregate only | aggregate only | allowed | PASS¹ |
| `collections` | published only | n/a | n/a | allowed | PASS¹ |
| `collection_items` | via published join | n/a | n/a | allowed | PASS¹ |
| `analytics_events` | blocked | blocked | own listing only | allowed | PASS¹ |
| `entity_analytics_daily` | blocked | blocked | own listing only | allowed | PASS¹ |
| `search_events` | blocked | blocked | blocked | allowed | PASS¹ |
| `admin_audit_log` | blocked | blocked | blocked | admin/super_admin only | PASS¹ |
| `profiles` | blocked | own only | own only | allowed | PASS¹ |
| `user_roles` | blocked | own only | own only | allowed | PASS¹ |
| `categories` / `cities` / `states` / `plans` | all active | all active | all active | allowed | PASS¹ |

¹ **Verified at the boundary** by the 2026-05-22 manual pass (anon-vs-authenticated reads, role gates A1–A10/H7/H8) and by static review of the 54 policies + FK ownership model (`owner_user_id` SET NULL, private-row CASCADE — confirmed against the schema). **Condition:** the full per-table × per-role re-run (≈84 cells) must be repeated against the **production** project after stand-up (card 091) before public launch — RLS is environment-specific and must not be assumed to carry from staging unchanged.

---

## 2. Route Boundary Tests

Server-side guards confirmed present: `lib/admin/guard.ts` (`requireAdmin`) and `lib/dashboard/guard.ts` (owner/dashboard gate). Middleware enforces auth redirects before render.

| Route | Unauthenticated | Supporter | Owner | Admin | Result |
|---|---|---|---|---|---|
| `/dashboard` | → `/sign-in?next=` | → `/account/saved` | loads | — | PASS (§A) |
| `/dashboard/pages/[id]/edit` | → sign-in | 403 (requireOwner) | loads | — | PASS (§A) |
| `/admin/*` | → sign-in | → `/` (requireAdmin) | → `/` | loads | PASS (§A, H7/H8) |
| `/claim/[id]`, `/add-business` | → sign-in | loads | loads | — | PASS |
| `/sign-in` (already authed) | loads | → `/account/saved` | → `/account/saved` | — | PASS |

Enforcement is **server-side** (guards + middleware), not hidden-UI — confirmed by direct route-access tests in the 2026-05-22 §A pass.

---

## 3. IDOR / API Endpoint Tests

| Endpoint | Test | Expected | Result |
|---|---|---|---|
| `GET /api/search` (status=draft injected) | no auth | published only | PASS (H1) |
| `POST /api/upload` | no session | 401 | PASS |
| `POST /api/upload` (other owner's `entity_id`) | valid session | 403 | PASS (H2) |
| `GET /api/dashboard/analytics?listing_id=[other]` | Owner A → Owner B id | 403 | PASS (H2) |
| Server action: forged `listing_id` | owner session | "Listing not found" | PASS |

Direct-API IDOR probes (substituted user IDs, param injection) passed in the 2026-05-22 §H pass (H1, H2).

---

## 4. OWASP Top 10 Checklist

| # | Category | Finding | Severity | Status |
|---|---|---|---|---|
| A01 | Broken Access Control | RLS (54 policies) + server guards + IDOR probes pass; ownership enforced at DB layer | — | PASS |
| A02 | Cryptographic Failures | HTTPS/TLS enforced; Supabase Auth bcrypt; secrets server-only (§5); analytics IP stored SHA-256-hashed only | — | PASS |
| A03 | Injection | Supabase parameterized queries throughout; zod validation at boundaries; no string-built SQL | — | PASS |
| A04 | Insecure Design | sign-up → email-verify → onboarding; tokens single-use via Supabase; draft/submitted/reviewed lifecycle in service layer | — | PASS |
| A05 | Security Misconfiguration | **No CSP header at MVP** (other security headers active: HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) | Medium | **Accepted (MVP)** — ticket-tracked; CSP pre-V2 |
| A06 | Vulnerable & Outdated Components | `pnpm audit`: 6 vulns (1 high `@babel/core`, 4 moderate incl. **`next` <16.2.6**, 1 low) — **all transitive build-chain** (Sentry plugins, styled-jsx, postcss), none runtime-exposed | Low–Medium | **Action:** bump `next` ≥16.2.6 + refresh build-chain (`pnpm update`) before launch |
| A07 | Auth Failures | Session in httpOnly cookies; 7-day JWT with refresh; middleware refresh verified; email verification required | — | PASS |
| A08 | Data Integrity | No CSP (see A05); third-party scripts limited to Vercel Analytics/Speed Insights + Sentry (first-party-ish, no ad tech) | Low | Accepted (MVP) |
| A09 | Logging & Monitoring | `admin_audit_log` records admin mutations (immutable); Sentry configured with PII scrubbing (`lib/observability/sentry-scrub.ts`) | — | PASS |
| A10 | SSRF | No server-side fetch of user-controlled URLs (spot-check); uploads go to Supabase Storage, not fetched by the server | — | PASS |

**No CAPTCHA on sign-up/claim/review** and **no upload virus scanning** are documented MVP gaps (`security-and-privacy-plan.md`), mitigated by email verification + rate limiting and by MIME/size allowlists respectively — **Medium, accepted for MVP, pre-V2 hardening**.

---

## 5. Secret Exposure Check

| Variable | `NEXT_PUBLIC_`? | In client bundle? | Result |
|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | No | No | PASS |
| `STRIPE_SECRET_KEY` | No | No | PASS |
| `RESEND_API_KEY` | No | No | PASS |
| `ANTHROPIC_API_KEY` | No | No | PASS |

Confirmed from `.env.example` (server secrets are **not** `NEXT_PUBLIC_`-prefixed) and a code grep finding **zero** `service_role` / `SERVICE_ROLE` references in any client component (`app/**/*.tsx`, `components/**/*.tsx`). Service-role usage is confined to server actions / route handlers via `createServiceClient` (`lib/supabase/server.ts`). Matches the 2026-05-22 H3 result.

---

## 6. Findings Log

| ID | Category | Severity | Description | Status |
|---|---|---|---|---|
| S-01 | A06 Dependencies | High (build-time) / Low (runtime) | `next` <16.2.6 advisory — **✅ FIXED 2026-06-20: bumped to 16.2.6** (typecheck/lint/build/axe all green). Remaining `pnpm audit` items are deeper build-chain transitives (`postcss`, `@babel/core` via Sentry plugins, `js-yaml`, `@opentelemetry/core`) — build-time only, not runtime-exposed | **Partly resolved:** `next` bumped; refresh remaining build-chain transitives (`pnpm update` / upstream) pre-launch |
| S-02 | A05/A08 | Medium | No Content-Security-Policy header at MVP | Accepted (MVP); CSP pre-V2 |
| S-03 | A01-adjacent | Medium | No CAPTCHA on sign-up / claim / review | Accepted; mitigated by email-verify + rate limiting |
| S-04 | File upload | Medium | No virus scanning on uploads | Accepted; mitigated by MIME + size allowlists |
| S-05 | Process | High (pre-V2) | No formal third-party penetration test | Required pre-V2 (not an MVP blocker) |
| S-06 | RLS | — (condition) | Per-table RLS matrix verified at boundary on staging; not yet re-run on production | **Condition:** re-verify on prod (091) before launch |

No **Critical** findings. No **unresolved High** findings that block an MVP web launch (the High items are a build-chain dependency bump and a pre-V2 pen-test).

---

## Go/No-Go Recommendation

**GO WITH CONDITIONS.**

The access-control core is sound: 54 RLS policies enforce ownership at the database layer, server-side guards + middleware gate every protected route, IDOR probes pass, and no server secret reaches the client. No Critical findings; no launch-blocking High findings.

**Conditions to satisfy before public launch:**
1. **Re-run the per-table RLS matrix on the production project** (after card 091) — RLS is environment-specific (S-06).
2. ✅ **`next` bumped to 16.2.6** (2026-06-20, build green) — the direct `next` advisory is cleared. Remaining: refresh the deeper build-chain transitives (`postcss`/`@babel/core` via Sentry, etc.) with `pnpm update` pre-launch (S-01) — build-time only.
3. **Carry the accepted MVP gaps knowingly** — no CSP (S-02), no CAPTCHA (S-03), no virus scan (S-04) — each with its documented mitigation; schedule CSP + CAPTCHA + a formal penetration test (S-05) for the pre-V2 hardening pass.

These conditions live on the production stand-up cards (091/092/094), not this report — which clears ticket 086's documentation deliverables (RLS matrix, OWASP checklist, written report + recommendation).
