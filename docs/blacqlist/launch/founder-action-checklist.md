# Founder Action Checklist — what *you* set up before we deploy

**For:** the founder · **Last updated:** 2026-06-20
**Purpose:** Everything below is something **only you can do** — create/own accounts, point your Bluehost domain, set DNS, review the business data, and confirm a few legal details. Once you hand these over, **I do the entire technical deploy** (≈1 hour) with no further action from you until it's live.

> **The deal in one line:** You own the accounts and the data/legal calls. I own the engineering. Developer/infra fees (Supabase Pro, domain, etc.) are **pass-through costs you pay directly** to the providers — they bill your card, not mine.

> 📋 **Prefer Trello?** This same checklist is broken into paste-ready cards (F1–F10, with descriptions, checklists, and links) in [founder-action-cards.md](./founder-action-cards.md).

---

## TL;DR — the 6 things only you can do

1. **Create the accounts** (Supabase, domain, Resend, Sentry) and confirm the Vercel project.
2. **Point your Bluehost domain + set its DNS records.**
3. **Review the business data** (`seed-review.csv`) and sign off. — ✅ applied (15 removed · 87 edited · 11 replacements → 151/51/51)
4. **Give me 3 legal details** (entity name, mailing address, DMCA agent).
5. **Hand me the secrets** securely (via a password manager).
6. **Sign off** to go live.

Everything else — migrations, deploy, seeding, smoke tests, monitoring — is mine.

---

## 1. Accounts to create (and what they cost)

| Service | What to create | Plan / cost | Why |
|---|---|---|---|
| **Supabase** | A **production** project (separate from staging), region **`us-east-1`** | **Pro — ~$25/mo** | Pro gives **daily backups + no auto-pause** (our safety net for the empty test DB), and is the base for **PITR** later. PITR itself is a ~$100/mo add-on we **turn on just before public launch** (real data) — not now. |
| **Domain** | ✅ **`theblacqlist.com`** confirmed at **Bluehost** — Active, **auto-renew ON**, expires **Aug 17 2026**, privacy + lock on | **renewal ~$12–18/yr** | Your public address. Nothing to buy; just the DNS edits at go-live (§2). |
| **Resend** | An account + **two API keys** (one **live**, one **test**) | **Free tier is fine** at launch volume | Sends sign-up verification, password reset, and claim emails. |
| **Sentry** | A **production** project + a **staging** project; grab the DSN + a build token | **Free tier is fine** | Error tracking + alerts so we hear about problems before users tweet them. |
| **Vercel** | A project already exists — **confirm you own it**, the plan, and that it's clean | Free works; Pro adds analytics | Hosts the app. ⚠️ See note below. |
| **Stripe** | — | **Skip for now** | Not needed for launch; we wire it up at V1 (paid plans / marketplace). |

> ⚠️ **Vercel — please confirm, don't assume.** A Vercel project already exists for this app, but its exact state is **unverified** (it may have been deployed via CLI rather than connected to Git, and its environment variables may be empty). Before deploy, confirm: (a) it's under **your** Vercel account, (b) what plan it's on, and (c) I have access to set environment variables. If it's messy, it's cleaner to recreate it under your account — tell me and I'll guide you.

---

## 2. Domain + DNS records (you set these in **Bluehost**)

Edit these in **Bluehost → Domains → `theblacqlist.com` → DNS (Advanced DNS Manager)**. **The exact target values appear in the Vercel and Resend dashboards when you add the domain there** — copy them into Bluehost. **⚠️ Do this at go-live, not now — it takes your current WordPress site offline at theblacqlist.com** (verify the new app on the Vercel preview URL first).

| Your current record | Change it to | Get the value from |
|---|---|---|
| `A   @   → 50.87.230.81` (Bluehost) | **edit → `76.76.21.21`** (Vercel) | Vercel → Domains |
| `CNAME  www → theblacqlist.com` | **edit → `cname.vercel-dns.com`** | Vercel → Domains |
| **MX `@` → aspmx.l.google.com (+ alt1/2/3)** | **LEAVE AS-IS** — your Google Workspace email | — |
| _(add)_ DKIM / SPF / DMARC TXT | as **Resend** shows (see SPF note) | Resend → Domains |

- ⚠️ **Edit, don't duplicate:** change the *existing* `@` A record and `www` CNAME (they point at Bluehost hosting today) — don't add a second.
- ⚠️ **One SPF record only — you use Google Workspace:** you already have a Google SPF TXT. **Don't add a second.** Either merge Resend's `include:` into it (`v=spf1 include:_spf.google.com … ~all`), **or** use Resend's **sending subdomain** (e.g. `send.theblacqlist.com`) so Resend's SPF/DKIM stay off your root and never touch Google email.
- **Leave alone:** the other Bluehost records (`cpanel`/`ftp`/`mail`/`webmail`/`whm`/`autoconfig`/… and `_acme-challenge`) — harmless.
- **SSL** auto-provisions once the A/CNAME resolve — no action from you.
- **Lead time:** propagation is usually minutes but can take **24–48h**. Confirm **Vercel = "Valid Configuration"** and **Resend = all green** before announcing.

---

## 3. Data review — the launch floor (your judgment, not mine)

A directory is only trustworthy if every listing is real. I researched ~265 businesses; **you confirm them** before they go public.

1. Open **`docs/blacqlist/data/seed-review.csv`** in Google Sheets (the README next to it explains the columns). Rows are **sorted most-flagged-first** per city, and each has a **1-click Google Maps verify link**.
   - Current counts: **Atlanta 156 · Houston 55 · Chicago 54 (= 265)**.
2. For each business, confirm it's: **real, currently operating, genuinely Black-owned (≥51% ownership + operational control — our Terms §4 definition), and OK to be listed publicly.**
3. Mark each row **Keep / Edit / Remove** and note anything to fix.
4. The README also lists **categories below 3 listings per city** — top those up if you want fuller coverage at launch.
5. **Sign off** when done. I then apply your "Remove"/"Edit" decisions and seed only the approved list.

> This is the one judgment call I can't make for you (consent, accuracy, "is it still Black-owned"). The sheet just makes it fast.

---

## 4. Legal details to give me (3 things)

The policies are written and accurate, but three blanks need **you** (they appear as `[CONFIRM: …]` in the live Privacy & Terms pages):

1. **Legal entity name** — e.g. "The BLACQList LLC" (and the corporate form). → Privacy §11, Terms §14.
2. **Mailing address** — a physical postal address for legal notices. → Privacy §11, Terms §14.
3. **DMCA designated agent** — register an agent with the **U.S. Copyright Office** (preserves the copyright safe-harbor for user reviews/photos) and give me the name/contact. → Terms §8 (tracked in ticket `102-dmca-designated-agent.md`).

Give me those and I'll replace the placeholders. **Separately**, the policies should still get a **licensed-attorney review** before launch — that's the Legal-card sign-off, beyond these three values.

---

## 5. Hand me the secrets — securely

Put these in a **password manager** (1Password, Bitwarden…) and share that entry with me. **Never email or Slack secrets.** The authoritative list is `environment-variable-checklist.md`; here's what you provide:

| What | Where you get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API (the "anon/public" key — safe to be public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (the "service_role" key — **secret, server-only**) |
| `RESEND_API_KEY` (live **and** test) | Resend → API Keys |
| `RESEND_FROM_EMAIL` | `noreply@theblacqlist.com` (after domain verification) |
| `NEXT_PUBLIC_SENTRY_DSN` (prod + staging) | Sentry → project settings |
| `SENTRY_AUTH_TOKEN` (+ org/project slugs) | Sentry → settings (for readable error stack traces) |

- I generate `AUTH_SECRET` myself (`openssl rand -base64 32`) — you don't need to.
- **Rule of thumb:** anything named `NEXT_PUBLIC_*` is safe to be public; everything else is a secret. The service-role key, especially, must **never** be public.

---

## 6. What happens next — my part (no founder action needed)

**Setup/testing (now, on the empty DB — Pro daily backups cover it, no PITR yet):** apply the schema migrations, wire the 3 storage buckets, and load reference data (categories/cities/etc.). No real data is at risk.

**At go-live (after your data sign-off + secrets), I run `production-deployment-runbook.md` in order — the sequence matters:**

1. **Enable PITR** on the prod Supabase project — this is the moment real user data starts (the ~$100/mo add-on; gate **M7**).
2. Set environment variables in Vercel (secrets server-only).
3. Final migration check (schema already applied during setup).
4. **Seed only your approved business data.**
5. Create the admin user; confirm storage buckets.
6. Connect the domain + SSL; deploy.
7. Run the 10-point smoke test + verify RLS, PITR, backups, Sentry, uptime.

Then the production-only audit conditions get checked (RLS matrix re-verify, Lighthouse on the live URL, post-deploy analytics/Sentry/uptime tests). **Estimated ~1 hour of my time once your items are ready.** Engineer runbooks (you don't need to read them): `supabase-production-checklist.md`, `environment-variable-checklist.md`, `production-deployment-runbook.md`, `prelaunch-smoke-test.md`.

---

## ✅ Your ordered checklist

Do these roughly top-to-bottom (DNS and data review can run in parallel):

- [x] **Supabase** — ✅ production project created (Pro plan, `us-east-1`) · 2026-06-21. _(PITR add-on stays off until just before launch — saves ~$100/mo; Pro's daily backups cover testing.)_
- [x] **Domain** — ✅ `theblacqlist.com` confirmed active in **Bluehost** (auto-renew on, expires Aug 17 2026) · 2026-06-21
- [ ] **Vercel** — confirm ownership/plan + that I can set env vars (or tell me to recreate it)
- [ ] **DNS** — in **Bluehost's Zone Editor**, replace `@`/`www` with the Vercel A + CNAME (and add Resend's TXT records) once I give you the values
- [ ] **Resend** — create account; make a **live** + a **test** key; add the domain; set its SPF/DKIM/DMARC DNS records; confirm all green
- [ ] **Sentry** — create prod + staging projects; grab the DSNs + a build token
- [x] **Data review** — keep/edit/remove pass applied (15 removed · 87 edited · 11 verified replacements → ATL 151 / HOU 51 / CHI 51); production import still pending on 093
- [ ] **Legal** — give me entity name, mailing address, DMCA agent (+ start the attorney review)
- [ ] **Secrets** — put all keys in a password manager and share with me
- [ ] **Go** — tell me you're ready; I run the deploy

> Nothing here touches production yet — this is the setup that makes the eventual deploy a clean, ordered, ~1-hour push. Ping me for the Vercel/Resend DNS values when you're at that step.
