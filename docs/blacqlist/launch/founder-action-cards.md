# Founder Setup — Trello Cards

**Trello-ready cards** for everything the founder must set up before we deploy. Paste each block into a Trello card: the bold line is the **card title**, **Description** is the card body, **Checklist** becomes a Trello checklist, **Links** go in the description or as attachments.

These are the **founder-owned** companions to the engineering cards on the main board (091 Supabase · 092 Vercel+DNS · 093 seed · Resend · "Founder legal confirms"). The narrative version is [founder-action-checklist.md](./founder-action-checklist.md).

> **The deal:** you own the accounts + the data/legal calls; I own the engineering. Infra fees (Supabase Pro, domain) are pass-through — providers bill you directly.

---

## Label legend

- **Title prefix `🙋🏾‍♀️ Fn`** — founder card number (do these roughly in order; some run in parallel).
- **Priority:** 🔴 blocker · 🟠 important · 🟡 nice-to-have.
- **Area color** (reused from the main board): ⬛ Infra/Accounts · 🟧 Content/Data · 🟥 Compliance · 🩷 Product.
- **`Unblocks:`** the engineering card(s) this clears on the main board.
- **`⏳ founder-gated`** — only you can do it; I can't create or pay for your accounts.

**Suggested Trello list:** "Founder Setup" (separate from the engineering lists). Recommended order: **F7 (data review) + F1/F2 first — they're the long poles** _(all ✅ done as of 2026-06-22)_ — then F3–F6, F9, and F10 last.

---

## `🙋🏾‍♀️ F1 · 🔴` Create the Supabase **production** project — ✅ DONE (2026-06-21)
⬛ Infra/Accounts · ✅ complete · **Unblocks:** 091, 093

**Description.** Stand up a brand-new Supabase project for production, **separate from staging**, on the **Pro plan** (~$25/mo — gives daily backups + no auto-pause, and is the base needed to add PITR later). You create + own the project and its billing; I apply migrations and load data once you hand me the keys. **Done when** the project exists (Pro, `us-east-1`) and you've saved the 3 API values to give me in F9. → **Production project created on Pro.** _(PITR — a ~$100/mo add-on — is deferred until just before the public launch; Pro's daily backups cover the empty test DB.)_

**Checklist.**
- ✅ Create a new project named e.g. `theblacqlist-production`, region **`us-east-1`** _(confirm region)_
- ✅ Upgrade it to the **Pro plan** (PITR requires Pro)
- ✅ Set a billing email + a sensible spend cap
- From Settings → API, copy the **Project URL**, the **anon/public key**, and the **service_role key** → **hand to me in F9** (secure)
- ✅ Told me it's ready → **next: I apply schema + storage buckets + reference data** on the empty DB (Pro daily backups cover it) — needs F9 keys or dashboard access. _PITR is enabled pre-launch, not now._

**Links.** [Supabase dashboard](https://supabase.com/dashboard) · [Pricing/Pro](https://supabase.com/pricing) · [PITR / backups](https://supabase.com/docs/guides/platform/backups) · engineer steps: [supabase-production-checklist.md](./supabase-production-checklist.md)

---

## `🙋🏾‍♀️ F2 · 🔴` Confirm your **Bluehost** domain (theblacqlist.com) — ✅ DONE (2026-06-21)
⬛ Infra · ✅ complete · **Unblocks:** 092

**Description.** `theblacqlist.com` is registered + healthy at Bluehost — confirmed from your dashboard: **Active**, **auto-renew ON**, expires **Aug 17 2026**, Domain Privacy + Domain Lock ON, and DNS is reachable (Bluehost default nameservers, Advanced DNS Manager). Nothing to buy or fix here. **Two things this surfaced that shape F4** (below).

**Checklist.**
- ✅ Domain **Active**, **auto-renew ON**, expires **Aug 17 2026** (owner: BLACQList)
- ✅ Domain Privacy + Domain Lock ON
- ✅ DNS reachable — Bluehost → Domains → `theblacqlist.com` → **DNS** (Advanced DNS Manager); default NS1/NS2.BLUEHOST.COM
- ⚠️ **A live WordPress site currently runs on this domain** (apex `@` → Bluehost `50.87.230.81`; "WordPress service" Connected, expires 07/20/2026). **Pointing DNS at Vercel in F4 replaces it** — so F4 is a **go-live** step, done after the new app is deployed + tested. (Once on Vercel you can let the Bluehost WordPress *hosting* lapse to save money — keep the *domain*.)
- ⚠️ **Email is Google Workspace** (MX → `aspmx.l.google.com`). In F4, **leave the MX records alone** so email keeps working.

**Links.** [Bluehost](https://www.bluehost.com) (Log in → Domains) · [Bluehost Help — DNS](https://www.bluehost.com/help) · [Vercel domains guide](https://vercel.com/docs/projects/domains)

---

## `🙋🏾‍♀️ F3 · 🔴` Connect the existing **Vercel project** to GitHub — ✅ DONE (2026-06-23)
⬛ Infra · ✅ complete · **Unblocks:** 092

**✅ Resolved 2026-06-23.** Git reconnected to the **org** repo `The-BLACQList/theblacqlist` @ `main` (the project was wrongly linked to the old personal `ChaDe1922/theblacqlist`, which had been transferred to the org → "repository can't be found" on redeploy; fixed by granting the Vercel GitHub App org access + reconnecting in Settings → Git). A redeploy then **built GREEN** (`dpl_8tGUd5j…`, READY) — build log confirms `Cloning github.com/The-BLACQList/theblacqlist (Branch: main)`, metadata `githubRepoOwnerType: Organization`. Claude has Vercel MCP access (inspect/deploy/logs). Env vars are set (Preview scopes switched). **Push-to-`main` auto-deploy is restored.**
> **Remaining for 092 (not F3):** (1) repoint the **Production**-scope Supabase vars to the real production project at **F9** (they currently point at staging, set Jun 13). (2) custom domain + SSL at **F4**. (3) **Confirm `main` is current** — the validating deploy was a *redeploy* of commit `bee61fd` (~33 days old); recent Phase-2 work was on branch `feat/phase-2-legal-pages` (deployed as previews). Verify that branch is merged into `main` (or push the intended HEAD) so production deploys the latest code, then trigger a fresh deploy.

**Description.** Audited 2026-06-23. A Vercel project already exists — **`theblacqlist`** (projectId `prj_Lh3E2AhPff1nRrfN2pKdH2aTG7hm`) under team **`the-blacql-ist`**, which the founder confirmed is theirs. It's **CLI-linked, not connected to GitHub**, has **no custom build config** (`vercel.json`/`vercel.ts` absent — Vercel auto-detects Next.js), and its env vars exist **by name but with empty values**. **Verdict: KEEP it and connect Git** — it's not messy, just not Git-wired; recreating would only churn the projectId for no gain. **Done when** the project is connected to the GitHub repo, on Pro, and I have access to set env vars + deploy (092).

**Verdict: KEEP + connect Git** (not recreate). The project is clean — nothing custom to migrate.

**Checklist.**
- ✅ Confirmed: project `theblacqlist` is under **your** team `the-blacql-ist` (2026-06-23)
- **Upgrade the team to Vercel Pro** (~$20/mo, pass-through to you) — required for Git integration
- **Connect Git:** Project → Settings → **Git** → connect GitHub → select `The-BLACQList/theblacqlist`, production branch = `main` (this is the missing piece — afterward pushes auto-build and PRs get preview deploys)
- **Confirm build settings:** Framework **Next.js** (auto), Build `next build`, Install auto — no overrides
- **Grant me access** (or be ready to paste env vars yourself) → then I configure 092

**Env vars to set** (per [environment-variable-checklist.md](./environment-variable-checklist.md) — set in Project → Settings → Environment Variables):

| Variable | Scope | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Prod + Preview | no |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Prod + Preview | no |
| `SUPABASE_SERVICE_ROLE_KEY` | Prod + Preview (**Build *and* Runtime**) | **yes** |
| `NEXT_PUBLIC_SITE_URL` | Prod = `theblacqlist.com` · Preview = staging URL | no |
| `AUTH_SECRET` | Prod + Preview (different values) | **yes** |
| `RESEND_API_KEY` | Prod = live · Preview = test | **yes** |
| `RESEND_FROM_EMAIL` | Prod + Preview | yes |
| `NEXT_PUBLIC_SENTRY_DSN` (+ build-time `SENTRY_AUTH_TOKEN`/`ORG`/`PROJECT`) | Prod + Preview | mixed |

**Gotchas (from the audit):**
- ⚠️ **`SUPABASE_SERVICE_ROLE_KEY` must be set in the Build scope, not just Runtime** — many server/admin pages call `createServiceClient()` during `next build`, so a build-only-missing key fails the build outright.
- **Preview → staging Supabase · Production → the new production Supabase** (different projects). Production Supabase already exists (F1 ✅ + 091 schema applied).
- **You can connect Git + fully wire the Preview scope now** (staging keys exist). The **Production** env values come from **F9** (secrets handoff) + F5/F6 (Resend/Sentry) — populate that scope when F9 lands.
- DNS (F4) is a **separate go-live step** — connecting Git does not touch the domain.

**Links.** [Vercel dashboard](https://vercel.com/dashboard) · [Connect Git](https://vercel.com/docs/git) · [Env vars docs](https://vercel.com/docs/projects/environment-variables) · authoritative var list: [environment-variable-checklist.md](./environment-variable-checklist.md)

---

## `🙋🏾‍♀️ F4 · 🔴` Set the **DNS records** (in Bluehost)
⬛ Infra · ⏳ founder-gated · _depends on F2 (domain) + values from F3 (Vercel) & F5 (Resend)_ · **Unblocks:** 092 + email

**Description.** Point the domain at Vercel and authorize Resend, by editing two records in **Bluehost → Domains → `theblacqlist.com` → DNS (Advanced DNS Manager)**. **Do this at go-live, not now** — ⚠️ it **takes your current WordPress site offline** at theblacqlist.com (verify the new app on the Vercel preview URL first). The exact target values come from the Vercel + Resend dashboards. SSL auto-provisions once the records resolve. **Done when** Vercel shows "Valid Configuration" and Resend shows all email records green.

**Checklist** (your current records, from the Bluehost DNS screenshot):
- **Apex** — **edit** the existing `A  @  → 50.87.230.81` (Bluehost hosting) **→ `76.76.21.21`** (the Vercel IP shown in Vercel → Domains). Edit it, don't add a second `@`.
- **www** — **edit** the existing `CNAME  www → theblacqlist.com` **→ `cname.vercel-dns.com`**.
- **Email — DO NOT TOUCH:** leave all the **Google Workspace MX** records (`aspmx.l.google.com`, `alt1/2/3.aspmx.l.google.com`) exactly as they are.
- **Resend** — add the DKIM/SPF/DMARC records Resend gives you (F5). You **already have a Google SPF** TXT — never add a second SPF: either **merge** Resend's `include:` into it (one `v=spf1 …` record), **or** (cleaner) use Resend's **sending subdomain** (e.g. `send.theblacqlist.com`) so its SPF/DKIM live on the subdomain and never touch your Google root SPF.
- **Leave alone:** the Bluehost service A records (`cpanel`/`ftp`/`mail`/`webmail`/`whm`/`autoconfig`/…) and the `_acme-challenge` CNAME — harmless; Vercel issues its own SSL.
- Wait for propagation (minutes, but allow up to **24–48h**); confirm **Vercel = "Valid Configuration"** and **Resend = all green** before announcing.

**Links.** [Bluehost Help — manage DNS](https://www.bluehost.com/help) · [Vercel domains/DNS](https://vercel.com/docs/projects/domains/working-with-domains) · [Resend domain setup](https://resend.com/docs/dashboard/domains/introduction)

---

## `🙋🏾‍♀️ F5 · 🔴` Set up **Resend** (email) — _audited 2026-06-23_
⬛ Infra · ⏳ founder-gated · **Unblocks:** the 6 app transactional emails (welcome, claim status, listing rejected, admin claim alert). _Auth emails (password reset / future sign-up confirm) are a **separate** step — see Part B._

**Audit (2026-06-23).** The app has **two** email systems, and the original card only covered one:
- **Resend = app emails** (`lib/email/resend.ts`): 6 react-email templates — welcome, claim-submitted, claim-admin-notification, claim-approved, claim-rejected, entity-rejected. From = `RESEND_FROM_EMAIL` (default `The BLACQList <noreply@theblacqlist.com>`). **If the key is missing it just logs + skips — nothing breaks**, emails simply don't send.
- **Supabase Auth = its own emails**: password reset (`resetPasswordForEmail`) is sent by **Supabase**, not Resend. Sign-up confirmation is currently **OFF** (`enable_confirmations = false`), so password-reset is the only live auth email today. Without custom SMTP, it sends from a `supabase.io` address with low rate limits.

**Done when** the live + test keys exist, the sending domain is verified in Resend, and (Part B) the production Supabase project's Auth SMTP points at Resend.

### Part A — Resend (app emails)
- Create a Resend account (free tier is fine at launch volume).
- Create a **live** key (`re_live_…`) → for the **Production** Vercel scope, and a **test** key (`re_test_…`) → for **Preview**. Save both for **F9**.
- **Verify a *sending subdomain* `send.theblacqlist.com`** in Resend (Domains → Add Domain) — **not** the root domain. Reason: your root has a **Google Workspace SPF** already, and you can't have two SPF records; a subdomain keeps Resend's SPF/DKIM isolated and leaves Google email untouched.
- Sender address will be **`noreply@send.theblacqlist.com`** → set `RESEND_FROM_EMAIL = 'The BLACQList <noreply@send.theblacqlist.com>'`.
- Set **`ADMIN_NOTIFICATION_EMAIL`** = the inbox that should receive "new claim submitted" alerts.
- Add Resend's **SPF/DKIM/DMARC** records for `send.theblacqlist.com` in **Bluehost DNS** (coordinate with **F4**; the subdomain means these never touch your Google MX/root SPF). Confirm the domain shows **Verified** in Resend.

### Part B — Supabase Auth SMTP → Resend (so password-reset email comes from your domain)
- In the **production** Supabase project → **Authentication → SMTP Settings** → enable custom SMTP:
  - Host `smtp.resend.com` · Port `465` · Username `resend` · Password = a Resend API key · Sender `noreply@send.theblacqlist.com`.
- Same screen / **URL Configuration**: set **Site URL** = `https://theblacqlist.com` and add `https://theblacqlist.com/auth/callback` to the **Redirect URLs** allowlist (the app builds auth links from `NEXT_PUBLIC_APP_URL`).
- (Staging Supabase: optional — leave default or point at the same Resend subdomain with the test key.)

**Env vars (already present by name in Vercel — set/confirm the values):** `RESEND_API_KEY` (Prod=live · Preview=test, **secret**) · `RESEND_FROM_EMAIL` (both) · `ADMIN_NOTIFICATION_EMAIL` (both). Secrets → you paste; hand the keys over in **F9**.

**Links.** [Resend](https://resend.com) · [API keys](https://resend.com/docs/dashboard/api-keys/introduction) · [Domain (subdomain) verification](https://resend.com/docs/dashboard/domains/introduction) · [Resend SMTP](https://resend.com/docs/send-with-smtp) · [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)

---

## `🙋🏾‍♀️ F6 · 🟠` Set up **Sentry** (error monitoring)
⬛ Infra · ⏳ founder-gated · **Unblocks:** 094 (monitoring & alerting)

**Description.** Sentry tells us about production errors before users do. Create a **production** project and a **staging** project, and grab the DSN for each plus a build token (so error stack traces are readable). Free tier is fine for our volume. **Done when** you've got both DSNs and a build auth token saved for F9.

**Checklist.**
- Create a Sentry account/org
- Create a **production** project (note its DSN) and a **staging** project (note its DSN)
- Generate an **auth token** for source-map upload (Settings → Auth Tokens)
- Note your **org slug** and **project slug**
- Save DSNs + token for F9

**Links.** [Sentry](https://sentry.io) · [Next.js setup guide](https://docs.sentry.io/platforms/javascript/guides/nextjs/)

---

## `🙋🏾‍♀️ F7 · 🔴` Review & sign off the **business data** (the long pole) — ✅ DONE (2026-06-22)
🟧 Content/Data · ✅ complete · **Unblocks:** 093 (production seed)

**Description.** A directory is only trustworthy if every listing is real. I researched **265 businesses** (Atlanta 156 · Houston 55 · Chicago 54); you reviewed them in `seed-review-complete.csv` and I **applied your keep/edit/remove pass**: **15 closed/unverifiable removed · 87 enriched** (addresses + website/social) · **11 verified Black-owned replacements added** → final **ATL 151 / HOU 51 / CHI 51** (all ≥ M9). The staging reconcile is ready (`scripts/reconcile-staging-listings.ts` archives the removed ones; `seed-launch` adds the replacements). _Remaining on **093**: image coverage (≥40%) + the production import itself._

**Checklist.**
- ✅ Open `seed-review.csv` in Google Sheets (the README beside it explains the columns)
- ✅ Work top-down (most-flagged rows first); use the **Maps verify link** per row
- ✅ For each: confirm it's **real, currently operating, ≥51% Black-owned + operationally controlled** (Terms §4), and **OK to list publicly**
- ✅ Mark each row **Keep / Edit / Remove**; note any corrections → **applied** (`seed-review-complete.csv`)
- Top up any **category under 3 listings/city** (the README lists the gaps) if you want fuller coverage — _optional, still open_
- ✅ **Sign off** — sheet finalized; cleanup applied to the launch dataset

**Links.** [seed-review.csv](../data/seed-review.csv) · [seed-review README](../data/seed-review.md) · engineer seed ticket: [093](../tickets/093-seed-data-import.md)

---

## `🙋🏾‍♀️ F8 · 🔴` Provide the **3 legal details**
🟥 Compliance · ⏳ founder-gated · **Unblocks:** Legal-card sign-off · _mirrors board card "Founder legal confirms"_

**Description.** The Privacy & Terms pages are written and accurate, but three details need **you** — they show as `[CONFIRM: …]` placeholders in the live pages today. Give me these and I'll drop them in. Separately, the policies should still get a **licensed-attorney review** before launch (that's the Legal-card sign-off, beyond these three values). **Done when** all three are provided (and the attorney review is scheduled).

**Checklist.**
- **Legal entity name** + corporate form (e.g. "The BLACQList LLC") → Privacy §11, Terms §14
- **Mailing address** (physical postal address for legal notices) → Privacy §11, Terms §14
- **DMCA designated agent** — register one with the U.S. Copyright Office and give me the name/contact → Terms §8
- Hand the reconciled pages to a **licensed attorney** (or product owner) for sign-off

**Links.** [USCO DMCA agent directory](https://www.copyright.gov/dmca-directory/) · [compliance review](../legal/privacy-terms-compliance-review.md) · DMCA ticket: [102](../tickets/102-dmca-designated-agent.md) · pages: `app/(public)/privacy/page.tsx`, `app/(public)/terms/page.tsx`

---

## `🙋🏾‍♀️ F9 · 🔴` Hand over the **secrets** — securely
⬛ Infra · ⏳ founder-gated · _depends on F1, F5, F6_ · **Unblocks:** 092 (env vars)

**Description.** Collect all the keys from F1/F5/F6 into a **password manager** and share that entry with me. **Never** email or Slack secrets. I generate the one server-only `AUTH_SECRET` myself — you don't need to. **Done when** I can pull every value below from a shared, secure vault. Rule of thumb: anything named `NEXT_PUBLIC_*` is safe to be public; everything else is a secret (the **service_role** key especially must never be public).

**Checklist.**
- Supabase: **Project URL**, **anon key**, **service_role key** (from F1)
- Resend: **live key**, **test key**, sender `noreply@theblacqlist.com` (from F5)
- Sentry: **prod DSN**, **staging DSN**, **auth token**, org + project slugs (from F6)
- Put all of the above in 1Password / Bitwarden and share with me
- Confirm none of the secret keys are prefixed `NEXT_PUBLIC_`

**Links.** [authoritative variable list](./environment-variable-checklist.md) · [1Password](https://1password.com) · [Bitwarden](https://bitwarden.com)

---

## `🙋🏾‍♀️ F10 · 🔴` Give the **go-ahead**
🩷 Product · ⏳ founder-gated · **Unblocks:** the deploy + soft launch

**Description.** Final green light. Once F1–F9 are done — accounts live, DNS green, data signed off, legal details in, secrets shared — tell me to go and I run the full production deploy (~1 hour): **enable PITR (now there's real data) →** env vars → final migration check → your approved seed → admin user → domain/SSL → smoke tests → monitoring. No further action from you until it's live, then we do the soft launch.

**Checklist.**
- F1–F9 all complete (accounts, DNS green, Resend/Sentry verified, data signed off, legal provided, secrets shared)
- **Turn on PITR now** — this is the moment real user data starts (gate **M7**); the ~$100/mo add-on is worth it from here on. Confirm Vercel access + DNS + Resend all green
- **Say "go"** — I execute the production-deployment-runbook
- (Mine) post-deploy: production RLS re-verify, Lighthouse on the live URL, analytics/Sentry/uptime checks, then soft launch

**Links.** [founder-action-checklist.md](./founder-action-checklist.md) · engineer deploy steps: [production-deployment-runbook.md](./production-deployment-runbook.md) · [prelaunch smoke test](./prelaunch-smoke-test.md)

---

### Dependency order at a glance

```
Done (long poles):       F7 (data review) ✅   F1 (Supabase) ✅   F2 (domain) ✅
Then (need F2/F1):       F3 (Vercel)  F5 (Resend)  F6 (Sentry)
Then (need values):      F4 (DNS — uses F3+F5 values)
Then (need F1/F5/F6):    F9 (secrets handoff)
Anytime:                 F8 (legal details)
Last:                    F10 (go-ahead)
```

---

## After-launch enhancements (NON-BLOCKING — not part of F1–F10)

> These are **not** launch blockers and don't gate the MVP. Do them whenever you want to enable/test the Pillar B richness features on **staging**. The app already renders fine without them (every new table/column is read fail-soft).

## `🙋🏾‍♀️ Fn-B · 🟡` Paste the **4 Pillar B migrations** on staging
🟩 Backend/DB · 🟡 nice-to-have · ⏳ founder-gated (Supabase SQL editor) · **Unblocks:** the Pillar B features on staging (FAQ, multi-criteria reviews + photos, events)

**Description.** Pillar B (listing/owner richness + events) is built and verified (tsc/lint clean, a11y green), but four migrations haven't been applied to **staging** yet. They're idempotent and self-contained (table + RLS + seed each), and the pages render fail-soft before they're applied — so this is a safe, do-it-anytime step that switches the new features on. **Done when** all four run with no errors in the staging SQL editor and you can smoke-test the flows below. _(These also need applying to **production** later, but only once you actually want these features live — they are not required for the MVP launch.)_

**Checklist.**
- Paste `supabase/migrations/20260622000004_listing_faqs.sql` (FAQ accordion)
- Paste `supabase/migrations/20260622000005_review_criteria.sql` (multi-criteria review ratings + seed)
- Paste `supabase/migrations/20260622000006_review_media_rls.sql` (review-photo read policies)
- Paste `supabase/migrations/20260622000007_event_entity.sql` (events as a first-class entity)
- Smoke-test: add an FAQ on a listing · submit a review with a photo → publish it in `/admin/reviews/[id]` → photo shows · create an event at `/add-event` → publish → it renders at `/{city}/event/{slug}`, appears under the **Events** discover filter, and (if you set an organizer) under "Upcoming events" on that business's page

**Links.** plan: `~/.claude/plans/my-original-theme-for-tranquil-flask.md` · migrations: `supabase/migrations/2026062200000{4,5,6,7}_*.sql`
