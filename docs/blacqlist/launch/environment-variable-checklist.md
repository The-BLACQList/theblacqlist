# Environment Variable Checklist — The BLACQList Production

**Date:** 2026-05-11
**Status:** Pre-deployment checklist
**Reference:** `docs/blacqlist/architecture/environment-plan.md` — authoritative variable inventory

Set variables in **Vercel Dashboard → Project → Settings → Environment Variables**. Each variable must be scoped correctly — Production variables are not automatically shared with Preview (staging).

Never put real values in `.env.example`, in any committed file, or in this document. This checklist uses only variable names and descriptions.

---

## How to Use This Checklist

For each variable:
1. Obtain the real value from the source listed (Supabase Dashboard, Resend, etc.)
2. Set it in Vercel under the correct environment scope
3. Check the box confirming it is set
4. Mark the "server-only" column — any server-only variable must **not** begin with `NEXT_PUBLIC_`

---

## Group A — Supabase (Required at MVP)

| Variable | Scope | Server only | Status |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production + Preview | No | [ ] Set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production + Preview | No | [ ] Set |
| `SUPABASE_SERVICE_ROLE_KEY` | Production + Preview | **Yes** | [ ] Set |

**How to get these values:**
- Supabase Dashboard → Select the project (production or staging) → Settings → API
- "Project URL" → `NEXT_PUBLIC_SUPABASE_URL`
- "Project API keys" → "anon / public" → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- "Project API keys" → "service_role" → `SUPABASE_SERVICE_ROLE_KEY`

**Critical:** Production and staging/preview must point to **different** Supabase projects. Confirm the Production scope uses the production project URL and the Preview scope uses the staging project URL.

**Security check:**
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is scoped to Production only (not set as a global variable)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` does not appear in any variable name beginning with `NEXT_PUBLIC_`
- [ ] After deploying, open the browser network tab and search for the service role key string in any response — it must never appear

---

## Group B — Next.js Application (Required at MVP)

| Variable | Scope | Server only | Value notes |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Production | No | `https://theblacqlist.com` |
| `NEXT_PUBLIC_SITE_URL` | Preview | No | `https://theblacqlist.vercel.app` (or primary staging URL) |
| `AUTH_SECRET` | Production + Preview | **Yes** | 32-byte random secret |

**How to generate `AUTH_SECRET`:**

```bash
openssl rand -base64 32
```

Use a different value for production vs staging. Store both in your team's secrets manager.

**Checklist:**
- [ ] `NEXT_PUBLIC_SITE_URL` set to `https://theblacqlist.com` in Production scope
- [ ] `NEXT_PUBLIC_SITE_URL` set to the staging URL in Preview scope
- [ ] `AUTH_SECRET` is not an empty string, not `"secret"`, not `"development"`
- [ ] Production and Preview use different `AUTH_SECRET` values

---

## Group C — Email / Resend (Required at MVP)

| Variable | Scope | Server only | Value notes |
|---|---|---|---|
| `RESEND_API_KEY` | Production | **Yes** | Resend live key — `re_live_...` |
| `RESEND_API_KEY` | Preview | **Yes** | Resend test key — `re_test_...` |
| `RESEND_FROM_EMAIL` | Production + Preview | **Yes** | `noreply@theblacqlist.com` |

**How to get the Resend API key:**
- Resend Dashboard → API Keys → Create API key
- Create separate keys for production and staging
- Production key should have "Full access" or "Sending access"

**Domain verification (required before production email works):**
- Resend Dashboard → Domains → Add Domain → `theblacqlist.com`
- Add the SPF, DKIM, and DMARC DNS records shown by Resend at your domain registrar
- Confirm all three records show green/verified status in Resend before testing email

**Checklist:**
- [ ] Production `RESEND_API_KEY` is a live key (not a test key)
- [ ] `theblacqlist.com` sending domain is verified in Resend (SPF + DKIM + DMARC green)
- [ ] Test email delivery end-to-end after deployment (sign up with a test account, confirm email arrives)
- [ ] Email arrives in inbox, not spam

---

## Group D — Error Tracking / Sentry (Strongly Recommended at MVP)

| Variable | Scope | Server only | Value notes |
|---|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | Production | No | Production Sentry DSN |
| `NEXT_PUBLIC_SENTRY_DSN` | Preview | No | Staging Sentry DSN (separate project or same with env tag) |

**How to get the Sentry DSN:**
- Sentry Dashboard → Project → Settings → Client Keys (DSN)

**Checklist:**
- [ ] `NEXT_PUBLIC_SENTRY_DSN` is set in Production scope
- [ ] Sentry receives a test error within 60 seconds of deployment (trigger by visiting a non-existent route)
- [ ] Sentry alert configured: email or Slack notification on new production errors

**Build-time Sentry variables (set in Vercel, not runtime):**

These are used during `pnpm build` for source map upload — they are build-time only, not runtime environment variables:

| Variable | Value |
|---|---|
| `SENTRY_AUTH_TOKEN` | Sentry API token — set in Vercel as a CI build variable |
| `SENTRY_ORG` | Sentry organization slug |
| `SENTRY_PROJECT` | Sentry project slug |

---

## Group E — Stripe (Not Required at MVP — Set Before V1)

These variables are not needed for the MVP launch. The subscription/payment flow is not yet wired.

| Variable | Scope | Server only | When to set |
|---|---|---|---|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Production | No | Before V1 payment launch |
| `STRIPE_SECRET_KEY` | Production | **Yes** | Before V1 payment launch — live key only |
| `STRIPE_WEBHOOK_SECRET` | Production | **Yes** | After webhook endpoints are registered in Stripe Dashboard |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Preview | No | Set test key for staging |
| `STRIPE_SECRET_KEY` | Preview | **Yes** | Set test key for staging |

**When setting Stripe live keys:**
- [ ] Stripe account is fully verified (business + bank account)
- [ ] Live keys have never been set in staging/preview scope
- [ ] All webhook endpoints are registered in Stripe Dashboard → Webhooks with production URLs
- [ ] Run `vercel env ls` and confirm no `sk_test_` values appear in the production environment

---

## Group F — Stripe Connect (Not Required at MVP — Set at V2)

| Variable | When to set |
|---|---|
| `STRIPE_CONNECT_CLIENT_ID` | When vendor marketplace payout flow is implemented |

---

## Group G — Anthropic AI (Not Required at MVP — Set at V2)

| Variable | When to set |
|---|---|
| `ANTHROPIC_API_KEY` | When AI-powered suggestions (V2) are ready to ship |
| `NEXT_PUBLIC_AI_FEATURES_ENABLED` | Set to `true` only after API key is set and rate limits are configured |

The `ai_suggestions` and `ai_generation_requests` tables already exist in the schema (migration 20260511000004) but the application uses mock mode until `ANTHROPIC_API_KEY` is present.

---

## Group H — Algolia Search (Not Required at MVP — Set at V2)

| Variable | When to set |
|---|---|
| `NEXT_PUBLIC_ALGOLIA_APP_ID` | When Algolia search replaces native DB search |
| `NEXT_PUBLIC_ALGOLIA_SEARCH_KEY` | When Algolia search replaces native DB search |
| `ALGOLIA_ADMIN_API_KEY` | When search indexing pipeline is implemented — **server-only** |

---

## Pre-Deploy Security Verification

Run these checks before the first production deployment and after any environment variable changes:

- [ ] No variable starting with `NEXT_PUBLIC_` contains a secret (service role key, Stripe secret, auth secret, API keys)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is scoped to server-only contexts — it should not appear in the client-side JavaScript bundle
- [ ] Run `git grep -r "sk_live\|service_role\|re_live\|AUTH_SECRET"` in the repo — must return zero results
- [ ] `.env`, `.env.local`, `.env.production` are listed in `.gitignore` — confirmed: `.gitignore` blocks all `.env*` files
- [ ] `.env.example` is committed but contains only placeholder values and comments (no real keys)
- [ ] GitHub secret scanning is enabled on the repository (Settings → Security → Secret scanning)

---

## Environment Summary Table

Quick reference for which variables are required in each environment at MVP launch:

| Variable | Local | Staging/Preview | Production |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `http://localhost:54321` | Staging project URL | Production project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Local anon key | Staging anon key | Production anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Local service role | Staging service role | Production service role |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | `https://theblacqlist.vercel.app` | `https://theblacqlist.com` |
| `AUTH_SECRET` | Any random value | Staging-specific value | Production-specific value |
| `RESEND_API_KEY` | Optional (logs to console) | `re_test_...` | `re_live_...` |
| `RESEND_FROM_EMAIL` | Optional | `noreply@theblacqlist.com` | `noreply@theblacqlist.com` |
| `NEXT_PUBLIC_SENTRY_DSN` | Not set | Staging DSN | Production DSN |
| Stripe variables | Optional | Test mode keys | Live mode keys (V1) |
| Anthropic/Algolia | Not set | Not set | Not set until V2 |
