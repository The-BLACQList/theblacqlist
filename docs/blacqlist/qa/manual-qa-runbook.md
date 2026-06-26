# Manual QA Runbook — Remaining Tests

This is the single source for **every remaining "Not Run" test that must be done by hand**. Everything else in the tracker is already automated (see the Appendix for the commands that cover the green rows).

**Covers:** I1, I3, I4 · K4, K5, K7 · L4–L12 · M3, M4, M5, M6, M7, M9, M10
**Last updated:** 2026-06-07

### How to use this doc
1. Do **Section 0 (one-time setup)** first.
2. Work top to bottom. Each test lists: **prerequisites → steps → pass criteria → what to record**.
3. In the tracker, set each row to **Pass / Fail** and paste the evidence noted (number, screenshot, or link).
4. ⛔ Two items are known **blockers** today: **M4** and **M9**. Their fix steps are included.

---

## Section 0 — One-time setup

### 0.1 Start the services
```bash
cd projects/theblacqlist
npx supabase start            # local DB/Auth/Storage; Studio http://127.0.0.1:54323
pnpm dev                      # app at http://localhost:3000  (use for the flow/browser tests)
```
> For the **Lighthouse** tests (Section I) do **not** use `pnpm dev` — see Section I.1.

### 0.2 Test accounts
Local sign-up requires **no email confirmation**, so you can sign in immediately after registering. (If you ever need a confirmation/reset email, it's captured at Inbucket: `http://127.0.0.1:54324`.)

| Role | How to get it |
|---|---|
| **Admin** | Already provisioned: **`a11y-admin@test.local`** / **`A11yTest1234!`** (sign in at `/sign-in`). |
| **Supporter** | Go to `/sign-up` → pick the "I'm here to discover / supporter" option → email e.g. `supporter@test.local`, password `Test1234!`, a display name → submit → you're signed in. |
| **Owner** | Go to `/sign-up` → pick **"I have a business"** → email e.g. `owner@test.local`, password `Test1234!` → finish onboarding (this grants the `owner` role). Then create an owned listing (next step). |

### 0.3 Data you'll need
- **For the Owner / dashboard tests (E, L10–L12):** as the Owner, complete **Add Business** (`/add-business`) and submit. It's created as **pending**. Then sign in as **Admin**, open the moderation/claims area (`/admin/entities` or `/admin/claims`), and **approve/publish** it. Now the Owner's `/dashboard` shows a live, owned listing.
- **For the Claim tests (D, L7–L9):** you need a **published, unclaimed** listing. Open `/discover`, click any listing that is not already claimed, and copy its URL / id. (Most seeded listings are unclaimed.)
- **A real listing URL** for several tests: open `/discover` → click any card → copy the address bar URL (pattern `/<city>/<type>/<slug>`, e.g. `/atlanta-ga/business/gochas-breakfast-bar`).

---

## Section I — Lighthouse (I1, I3, I4)

### I.1 Run against a production build (important)
`next dev` is unoptimized and will give meaningless performance scores. Build first:
```bash
pnpm build && pnpm start      # serves the production build at http://localhost:3000
```
(Or run Lighthouse against the deployed staging/production URL instead.)

### I.2 How to run one Lighthouse pass
1. Open the target URL in **Chrome** (Incognito window avoids extension noise).
2. Open DevTools (⌘⌥I) → **Lighthouse** tab.
3. Mode: **Navigation**; Device: **Mobile**; Categories: at least **Performance** (add SEO/Best Practices if you want).
4. Click **Analyze page load**.
5. Read **Performance score** and the **Core Web Vitals**: **LCP**, **CLS**, and **INP** (INP needs interaction — after the report, click around the page and re-check, or use the Performance panel; lab INP is an estimate).

### I.3 The three pages + thresholds

| Test | URL | Thresholds |
|---|---|---|
| **I1** BLACQList Page | a listing, e.g. `/atlanta-ga/business/gochas-breakfast-bar` | LCP < 2.5s · CLS < 0.1 · INP < 200ms · **Perf ≥ 80** |
| **I3** Search results | `/search?q=restaurant` | LCP < 2.5s · CLS < 0.1 · INP < 200ms |
| **I4** City landing | `/city/atlanta-ga` | LCP < 2.5s · CLS < 0.1 · INP < 200ms |

**Record:** the four numbers (Perf score, LCP, CLS, INP) per page. **Pass** if all thresholds are met.
> Reference: I2 (homepage) already passed with this method.

---

## Section K — Production / external (K4, K5, K7)

These can't be verified locally — they need the deployed app and external dashboards.

### K4 — Vercel Analytics
1. Deploy to Vercel (preview or production).
2. On the deployed URL, visit **3+ different pages** (home, a listing, /discover).
3. In the **Vercel project → Analytics** tab, confirm pageview events appear **within ~30 min**.
**Pass:** events show up for the pages you visited. **Record:** screenshot of the Analytics view.

### K5 — Sentry production error
1. In the production environment set **`SENTRY_TEST_TOKEN`** to a random secret (and ensure a valid `SENTRY_DSN`). Redeploy.
2. Visit `https://<prod-host>/api/_debug/sentry?token=<that-secret>` → it returns 500 and throws on purpose.
3. In **Sentry**, confirm the new event appears with **`environment: production`**.
**Pass:** event present, tagged production. **Record:** Sentry event link.
> Without the token the route returns 404, so it's safe to leave deployed. (K6 — no PII — is already covered by `pnpm test:unit`; while you're in Sentry, eyeball that the event has no email/phone/name.)

### K7 — Uptime monitors
1. In your uptime provider, create **3 checks** (suggested): `/` (home), `/discover`, and **`/api/health`** (canonical liveness — returns 200 even when degraded).
2. Confirm all **3 are green** in the dashboard.
**Pass:** all three green. **Record:** screenshot of the monitor dashboard.

---

## Section L — Cross-browser manual flows (L4–L12)

Run each flow in **three environments** and mark the matching cell:
- **Chrome desktop (macOS)** — normal Chrome window.
- **Safari desktop (macOS)** — real **Safari.app** (these rows specifically want real Safari).
- **Chrome mobile 375px** — Chrome DevTools **device toolbar** (⌘⇧M) → choose "iPhone SE" or set Responsive width to **375** — or a real phone.

In every run, keep the **DevTools Console** open and watch for **functional**, **layout** (overflow, broken spacing), and **console** errors. **Pass** a cell only if the flow completes cleanly with none of those.

### Path C — Add Business (L4 Chrome · L5 Safari · L6 mobile375)
**Prereq:** signed in as Supporter (or Owner).
1. Go to `/add-business`.
2. **Step 2 – Basic info:** enter a business name + a description (≥ 50 chars). Continue.
3. **Step 3 – Contact:** enter at least one of phone / email / website; set location (address or online). Continue.
4. **Step 4 – Category & city:** pick a category and a city. Continue.
5. **Step 5 – Media:** upload a logo image → confirm the **thumbnail preview** appears. Continue.
6. **Step 6 – CTA:** choose a CTA type → confirm the contextual input appears (e.g., URL). Continue.
7. **Step 7 – Preview:** confirm the preview shows your details → **Publish / Submit**.
8. Confirm redirect to **`/add-business/submitted`** (listing is now pending in the admin queue).
**Pass:** all 7 steps advance, upload preview works, submit succeeds. (Mobile: also confirm **no horizontal overflow**.)

### Path D — Claim (L7 Chrome · L8 Safari · L9 mobile375)
**Prereq:** signed in as Supporter; know a published **unclaimed** listing (from 0.3).
1. Go to `/claim`, search the business name, click **Claim** on it (or go straight to `/claim/<listing-id>`).
2. Confirm the claim form loads with the **business name pre-filled**.
3. Fill business email + role; **attach a PDF** → confirm the file name shows.
4. **Submit** → confirm the success state.
5. (Optional verify) as Admin, confirm the claim appears in **`/admin/claims`**.
**Pass:** form loads, document attaches, submit succeeds.

### Path E — Owner dashboard (L10 Chrome · L11 Safari · L12 mobile375)
**Prereq:** signed in as the Owner who has a **published owned listing** (from 0.3).
1. Go to `/dashboard` → confirm the **listing card** is visible.
2. Open **Edit** (`/dashboard/pages/[id]/edit`) → confirm sections are pre-populated.
3. Edit the business name → **Save** → confirm success feedback.
4. Open **Analytics** (`/dashboard/pages/[id]/analytics`) → confirm the stat cards render.
**Pass:** dashboard, editor, save, and analytics all work. (Mobile: no overflow.)

---

## Section M — Launch gates (M3, M4, M5, M6, M7, M9, M10)

For each, confirm the gate and **capture evidence** (screenshot or link) so it's auditable before launch.

| Gate | What to do | Pass when |
|---|---|---|
| **M3 — No open P0 bugs** | Review `docs/blacqlist/qa/mvp-bug-risk-log.md`; scan the tracker for any open **P0**. | No open P0 bugs; log reviewed + dated. |
| **M4 — ⛔ Publish a collection** | **Currently 0 published.** As Admin, go to `/admin/collections/new`, create a collection, add listings, set it **active**. Verify: `pnpm test:gates` → M4 passes. | ≥ 1 collection with `is_active=true`; `/collections` shows it. |
| **M5 — Claim SLA ≤48h** | Confirm the team commits to the SLA documented in `docs/blacqlist/launch/user-feedback-plan.md` (+ `support-playbook.md`). | SLA owned and agreed. |
| **M6 — On-call schedule** | Open `docs/blacqlist/launch/on-call.md` — the template exists but **names are placeholders (`[name]`)**. Fill in real primary/secondary contacts + the 4-week rotation. | Real names/contacts for the first 30 days. |
| **M7 — Supabase PITR** | In the **production** Supabase project: Settings → Database → enable **Point-in-Time Recovery** (needs Pro plan). Ref: `docs/blacqlist/architecture/environment-plan.md`. | PITR toggle ON in prod. |
| **M9 — ⛔ Seed thresholds** | **Currently ATL 40/150, HOU 20/50, CHI 19/50.** Add real listings to `scripts/data/listings-{atlanta,houston,chicago}.json` to reach **150 / 50 / 50**, then `pnpm seed:launch`. Verify: `pnpm test:gates` → M9 passes. | ATL ≥150, HOU ≥50, CHI ≥50 published. |
| **M10 — Sentry prod errors** | Same as **K5** — trigger the guarded route in production and confirm the event lands in Sentry (`environment: production`). | Confirmed test event in prod Sentry. |

> M1 (`/privacy`), M2 (`/terms`), and M8 (no hardcoded localhost) already pass via `pnpm test:gates`. M8's remaining owner step: confirm all production env vars are set in **Vercel**.

---

## Appendix — quick reference

**Test accounts:** Admin `a11y-admin@test.local` / `A11yTest1234!` · Supporter & Owner you create in 0.2.
**Key URLs:** `/` · `/discover` · `/search?q=` · `/city/atlanta-ga` · listing `/<city>/<type>/<slug>` · `/add-business` · `/claim` · `/dashboard` · `/admin`.

**Already automated (the green rows) — re-run anytime:**
| Command | Covers |
|---|---|
| `pnpm test:a11y` | J1–J15 accessibility |
| `pnpm test:unit` | K2 (health degraded), K6 (Sentry no-PII) |
| `pnpm test:infra` | K1 (health ok), K3 (middleware redirect) |
| `pnpm test:seed-idempotent` | K8 (seed idempotency) |
| `pnpm test:cross-browser` | L1–L3 (B) + L13–L15 (G) across Chrome/WebKit/mobile |
| `pnpm test:gates` | M1, M2, M4, M8, M9 (M4/M9 fail until the blockers above are cleared) |

**Deeper guides (referenced, not duplicated here):** `voiceover-manual-test-scripts.md` (J9–J11), `infra-monitoring-test-guide.md` (K series), `cross-browser-and-launch-gates-guide.md` (L/M detail).
