# F9 — Production Environment Variables (paste-ready handoff)

**Date:** 2026-06-24 · **For:** founder, pasting directly into Vercel
**Audited against:** every `process.env.*` reference in the code + `.env.example`

---

## What this is

To run in production, the app needs a set of "environment variables" — named values (URLs, keys, secrets) that Vercel injects into the app when it builds and runs. This document lists **every variable**, tells you **exactly where each value comes from**, and which ones to **set now vs. at launch**.

**The headline:** almost everything is already done (Resend, Sentry, the app secret). You really only have **4 quick things to set now**, plus **3 Supabase values to swap at launch**. That's it.

Where to work: **Vercel → project `theblacqlist` → Settings → Environment Variables.**

---

## Before you start — 3 things to understand

**1. "Environment" = which deployment the value applies to.** When you add a variable, Vercel shows checkboxes:
- **Production** — your real, live site (what users see at the domain). ← this doc is about Production.
- **Preview** — test builds from branches/PRs (points at staging).
- **Development** — local only (ignore).

A value set for Production is **not** automatically used by Preview, and vice-versa. Check the box(es) you intend.

**2. "Sensitive" = a secret.** Vercel has a **Sensitive** toggle when adding a variable. Turn it **ON** for anything secret (keys, tokens, the service-role key). Once saved as Sensitive, the value is hidden and can't be read back — only replaced. **Rule:** any variable whose name starts with `NEXT_PUBLIC_` is exposed to the browser, so it is **never** sensitive; everything else that's a key/token/secret **is**.

**3. "Build" vs "Runtime."** Most variables are available both while the app builds and while it runs — you don't normally pick. The one to watch is **`SUPABASE_SERVICE_ROLE_KEY`**, which the app needs **during the build**. If your Vercel UI ever offers a "only expose at runtime" option, do **not** restrict that one to runtime — leave it available at build, or the build fails.

---

## How to add or edit a variable in Vercel

**To ADD a new variable:**
1. Settings → **Environment Variables** → find the **Key / Value** input (or an **"Add Another"** / **"Add New"** button).
2. **Key** = the variable name exactly as written here (e.g. `NEXT_PUBLIC_SITE_URL`).
3. **Value** = paste the value.
4. **Environments** = tick **Production** (and Preview if this doc says so).
5. **Sensitive** = ON if it's a secret (this doc tells you per-variable).
6. **Save.**

**To EDIT an existing variable** (some already exist — e.g. the Supabase ones point at staging today):
1. Find it in the list → click the **⋯** (three-dot) menu on its row → **Edit**.
2. Change the **Value** (and/or the environment scope) → **Save**.

> **A change only takes effect on the *next* deploy.** After you finish, you'll redeploy (Section 5).

---

## Section 1 — Already set this session ✅ (just spot-check, no work)

These were set during F5 (Resend) and F6 (Sentry). Open each and confirm the value looks right; otherwise leave them alone.

| Variable | Should be | Secret? |
|---|---|---|
| `RESEND_API_KEY` | your Resend **production** key, starts with `re_` | 🔒 yes |
| `RESEND_FROM_EMAIL` | `The BLACQList <noreply@send.theblacqlist.com>` | no |
| `NEXT_PUBLIC_SENTRY_DSN` | the production Sentry DSN | no |
| `SENTRY_AUTH_TOKEN` | the Sentry org token | 🔒 yes |
| `SENTRY_ORG` | `the-blacqlist` | no |
| `SENTRY_PROJECT` | `theblacqlist-production` | no |
| `AUTH_SECRET` | a long random string (set Jun 13) | 🔒 yes |

> The one worth a real look: confirm **`RESEND_FROM_EMAIL`** uses **`send.theblacqlist.com`** (the subdomain), not the bare `theblacqlist.com` — only the subdomain is verified in Resend.

---

## Section 2 — Set these now ⬜ (4 variables, all safe)

These don't touch the database, so you can do them today with zero risk. All in **Production** scope.

### ① `NEXT_PUBLIC_APP_URL`  — _EDIT (it already exists)_
- **Value:** `https://theblacqlist.com`
- **Environment:** Production · **Sensitive:** no
- **Why:** this is the base URL stamped into your **password-reset and claim emails**. It already exists (set Jun 13) — **open it and confirm the value is `https://theblacqlist.com`**, not a `…vercel.app` URL. If it's wrong, the links inside those emails point to the wrong place.

### ② `NEXT_PUBLIC_SITE_URL`  — _ADD for Production (today it's only set for Preview)_
- **Value:** `https://theblacqlist.com`
- **Environment:** Production · **Sensitive:** no
- **Why:** used for SEO — your sitemap, robots file, social-share (OG) tags, canonical URLs, and the add-to-calendar links. _(There's a built-in fallback to this exact URL, so it's not strictly breaking — but set it explicitly so it's unambiguous.)_

### ③ `ADMIN_NOTIFICATION_EMAIL`  — _ADD (confirm it isn't already there)_
- **Value:** the inbox that should receive **"a business just submitted a claim"** alerts (your email)
- **Environment:** Production · **Sensitive:** no
- **Why:** when someone claims a listing, the app emails this address so you can review it.

### ④ `SENTRY_TEST_TOKEN`  — _ADD (new)_
- **Value:** any random string you make up — e.g. a UUID like `7f3a9c20-1e4b-4d8a-bb02-9f1c6e5a2d77`
- **Environment:** Production · **Sensitive:** 🔒 yes
- **Why:** it unlocks a hidden test route (`/api/_debug/sentry?token=…`) so that *after* you go live you can deliberately trigger one error and confirm Sentry catches it (the "K5" check). Without this token that route stays disabled (returns 404), which is the safe default.

---

## Section 3 — The Supabase cutover 🔴 (the real F9 step — do at launch, not today)

**The situation:** there are two Supabase databases — **staging** (`fmbohsloskqbmlwbzpjm`, what everything points at now) and the new **production** one (`theblacqlist-production` / `ytlrnczevdnsfdzjbeqg`). Three variables currently point Production at **staging**. "Going live" means **editing those three to point at the production database.**

### ⛔ The gate — do NOT do this until the production database is ready
The production database must first have **all its tables (migrations) and all its listing data (seeds)** loaded — that's tickets **091** (finish) and **093** (seed import). If you switch these variables before that, your live site will load against an **empty database** and show nothing. So the order is fixed:

> **1)** Load migrations + seed data into the production DB → **2)** edit the 3 variables below → **3)** redeploy.

Until then, **leave these three exactly as they are** — staging keeps the `theblacqlist.vercel.app` test site working.

### Where to copy the values from
Open the production project's API settings:
**`https://supabase.com/dashboard/project/ytlrnczevdnsfdzjbeqg/settings/api`**
You'll see a **Project URL** and a **Project API keys** section with an **anon / public** key and a **service_role** key.

### The 3 variables to EDIT (at cutover)

| # | Variable | New value (from the page above) | Environment | Sensitive? |
|---|---|---|---|---|
| ⑤ | `NEXT_PUBLIC_SUPABASE_URL` | `https://ytlrnczevdnsfdzjbeqg.supabase.co` (the **Project URL**) | Production | no |
| ⑥ | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the **anon / public** key | Production | no |
| ⑦ | `SUPABASE_SERVICE_ROLE_KEY` | the **service_role** key | Production | 🔒 yes — **and keep it available at build** |

> ⚠️ The **service_role** key is the master key to your database — it bypasses all security rules. Keep it Sensitive, keep its name exactly `SUPABASE_SERVICE_ROLE_KEY` (never with a `NEXT_PUBLIC_` prefix), and never paste it anywhere public.

---

## Section 4 — Skip / defer (no action)

| Variable(s) | Why you can ignore it |
|---|---|
| `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Payments are a later (V1) feature, not wired for launch. (`STRIPE_WEBHOOK_SECRET` may already exist — harmless to leave.) |
| `A11Y_ADMIN_EMAIL`, `A11Y_ADMIN_PASSWORD` | Used only by the automated accessibility tests. **Never set these in production.** |
| `NEXT_PUBLIC_APP_ENV` | In the example file but **no code actually reads it** — cosmetic. Fine to leave or set to `production`. |
| `ANTHROPIC_API_KEY`, Algolia keys, `STRIPE_CONNECT_CLIENT_ID` | V2 features — not now. |

---

## Section 5 — After you save: redeploy + verify

1. **Redeploy Production.** A variable change only applies to a new build. Vercel → Deployments → **⋯ → Redeploy** on the latest Production deployment.
   - If you changed anything related to **Sentry build** (you won't in Section 2, but at cutover you might), redeploy with **"Use existing Build Cache" UNCHECKED**.
2. **Confirm the build is green** and the site loads.
3. **Security spot-check:** open the live site → browser DevTools → **Network** tab → search responses for the first few characters of your **service_role** key → it must **never** appear. (If it does, a variable was mis-named with `NEXT_PUBLIC_`.)
4. **After the Supabase cutover only:** confirm the site shows the **production** data (the real listing counts), not staging's.

---

## One-glance checklist

**Do now (safe, ~5 min):**
- [ ] ① `NEXT_PUBLIC_APP_URL` — confirm = `https://theblacqlist.com` (Production)
- [ ] ② `NEXT_PUBLIC_SITE_URL` — add `https://theblacqlist.com` (Production)
- [ ] ③ `ADMIN_NOTIFICATION_EMAIL` — add your inbox (Production)
- [ ] ④ `SENTRY_TEST_TOKEN` — add a random string, mark Sensitive (Production)

**At launch (after the prod DB is migrated + seeded — 091/093):**
- [ ] ⑤ `NEXT_PUBLIC_SUPABASE_URL` → `https://ytlrnczevdnsfdzjbeqg.supabase.co`
- [ ] ⑥ `NEXT_PUBLIC_SUPABASE_ANON_KEY` → prod anon key
- [ ] ⑦ `SUPABASE_SERVICE_ROLE_KEY` → prod service_role key (Sensitive, build-available)
- [ ] Redeploy Production → verify green + service-role key not in browser + production data shows

**Already done (✅):** Resend ×2 · Sentry ×4 · `AUTH_SECRET`
