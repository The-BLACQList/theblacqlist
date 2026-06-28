# Production QA Close-Out

_Last updated: 2026-06-28 · Target: production (`theblacqlist.com` / Supabase `ytlrnczevdnsfdzjbeqg`)_

Closes the **doable-now** QA tickets against the live production DB while the public launch is held behind the coming-soon gate. Five items: account-deletion E2E, K7 health/uptime, K5 Sentry prod-error, 086 RLS re-verify, 088 Lighthouse.

## Working with the gate

`COMING_SOON_MODE=true` redirects full pages (`/`, `/discover`, `/sign-in`, listings…) to `/coming-soon`, but **allowlists `/api/*` and `/auth/*`**. To reach gated pages, hit any URL once with **`?preview=<COMING_SOON_BYPASS_TOKEN>`** — it sets a `bl_preview` cookie and serves the real page in the same request. Use that token (the one set in Vercel) for every "via the app" step below.

Legend: ✅ verified · ⬜ to run · 🙋🏾‍♀️ founder-run · 🤖 Claude-run

### What you'll need (one glance)

| Item | Needs | Who |
|---|---|---|
| 1 · Account deletion | bypass token (`?preview=`), prod SQL editor, a throwaway email inbox | 🙋🏾‍♀️ (🤖 reviews SQL) |
| 2 · Health + uptime | — (endpoints public); an uptime service for the 3 monitors | 🤖 re-verified · 🙋🏾‍♀️ monitors |
| 3 · Sentry prod error | `SENTRY_TEST_TOKEN`, Sentry dashboard access | 🙋🏾‍♀️ (🤖 reviews event) |
| 4 · RLS re-verify | prod SQL editor (structural) + prod **anon** key (behavioral) | 🙋🏾‍♀️ (🤖 reviews) |
| 5 · Lighthouse | Chrome (DevTools → Lighthouse → Mobile), bypass token | 🙋🏾‍♀️ |

**Suggested order:** 2 (done) → 4 structural → 3 → 5 → 1 (deletion last — it consumes a throwaway account). Every "via the app" URL needs `?preview=<COMING_SOON_BYPASS_TOKEN>`.

---

## 1. Account deletion — end-to-end (card: "Staging QA: account-deletion walk-through")

**Code-review verdict (🤖, 2026-06-26): PASS.** `lib/actions/account/deleteAccount.ts` matches Privacy Policy §7:
- Requires typing `DELETE` (`deleteAccount.ts:39-42`).
- Collects receipt + avatar storage paths *before* the cascade (`:53-66`).
- **Explicitly deletes the user's reviews** before the auth delete (`:70`) — reviews are `SET NULL` by FK, but the policy says *remove* them.
- `auth.admin.deleteUser(userId)` (`:73`) triggers the FK cleanup; on failure it aborts (no redirect) so PII rows survive a failed delete.
- **CASCADE** → `profiles`, `user_roles`, `saves`, `receipt_uploads`, `subscriptions` removed.
- **SET NULL** → owned `listings.owner_user_id` (preserved-but-unclaimed), authorship/audit/analytics refs anonymized; `spend_events` de-linked (anonymized aggregate retained).
- Best-effort storage cleanup of receipt + avatar files (`:89-100`) — non-blocking by design.
- Redirect `/sign-in?deleted=1` (`:102`).

**Known, accepted:** storage cleanup is best-effort (a failure leaves RLS-blocked orphan files, no row → no signed URL); receipts cleared from both `receipts` and `receipt-uploads` buckets (legacy naming); Stripe subscription is not cancelled API-side (payments deferred to V1 — out of scope).

### 1a. Live walk-through 🙋🏾‍♀️
1. Open `https://theblacqlist.com/?preview=<token>` (sets the bypass cookie).
2. Go to `/sign-up`, create a throwaway account (e.g. `qa-delete-<date>@<your-inbox>+`), confirm it (Supabase → Authentication → Users → ⋯ → confirm, or the email link).
3. As that user, generate data: **save a business** (heart on any listing), **submit a business** via `/add-business` (creates an owned listing), and a **receipt**/**review** if those flows are reachable.
4. **Capture the user's UUID + the owned listing's id** (Supabase → Auth → Users; and `select id, slug from listings where submitted_by = '<uid>'`) — you can't read them after deletion.
5. Go to **`/account/settings`** → **"Delete my account…"** → type **`DELETE`** → **"Permanently delete account"**.
6. Confirm you land on **`/sign-in?deleted=1`** and **cannot sign back in** with that account.

### 1b. Verification SQL 🙋🏾‍♀️ (prod SQL editor) — replace `:uid` and `:listing_id`
```sql
-- (A) PII rows — CASCADE + the explicit reviews delete. Every count MUST be 0:
select 'auth.users'      as t, count(*) from auth.users      where id = ':uid'
union all select 'profiles',        count(*) from profiles        where id = ':uid'
union all select 'user_roles',      count(*) from user_roles      where user_id = ':uid'
union all select 'saves',           count(*) from saves           where user_id = ':uid'
union all select 'receipt_uploads', count(*) from receipt_uploads where user_id = ':uid'
union all select 'subscriptions',   count(*) from subscriptions   where user_id = ':uid'
union all select 'reviews',         count(*) from reviews         where reviewer_user_id = ':uid';
-- → every count MUST be 0 (rows deleted).

-- (B) No dangling references — SET NULL columns the test user may have touched
--     must all be nulled, so rows STILL pointing at :uid MUST be 0:
select 'analytics_events.user_id'        as ref, count(*) from analytics_events  where user_id = ':uid'
union all select 'search_events.user_id',        count(*) from search_events     where user_id = ':uid'
union all select 'media_attachments.uploaded_by',count(*) from media_attachments where uploaded_by = ':uid'
union all select 'claims.claimant_user_id',      count(*) from claims            where claimant_user_id = ':uid'
union all select 'listings.owner_user_id',       count(*) from listings          where owner_user_id = ':uid'
union all select 'listings.submitted_by',        count(*) from listings          where submitted_by = ':uid'
union all select 'listings.updated_by',          count(*) from listings          where updated_by = ':uid';
-- → every count MUST be 0 (references nulled). (spend_events has NO user_id by
--    design — anonymized community data — so there is nothing to check there.)

-- (C) Owned listing PRESERVED but unclaimed (row still exists, authorship nulled):
select id, status, owner_user_id, submitted_by, updated_by
from listings where id = ':listing_id';
-- → row returns; owner_user_id / submitted_by / updated_by all IS NULL.
```
**Pass criteria:** all (A) and (B) counts = 0; the (C) listing row still exists with `owner_user_id` / `submitted_by` / `updated_by` = NULL. (Optional: Supabase → Storage → confirm the test user's receipt/avatar files are gone, or—if a storage hiccup left them—that no row references them.)

---

## 2. K7 — health endpoints + uptime monitors

**🤖 verified live on prod (2026-06-26; re-verified 2026-06-28 on deploy `e192df2`, through the gate):**
- ✅ `GET /api/health` → `200 {"status":"ok","timestamp":"…","checks":{"supabase":"ok"}}`
- ✅ `GET /api/health/supabase` → `200 {"status":"ok","message":"Supabase connection healthy"}`

Both are allowlisted, so they answer even while gated. (`/api/health` returns 200 with `status:"degraded"` if Supabase is unreachable — monitor the JSON `status`, not just the HTTP code.)

### Set up monitors 🙋🏾‍♀️ — Sentry Uptime (chosen: no new service; reuses the F6 Sentry)

Sentry's uptime checks are **status-code based** (2xx = up), **follow 3xx redirects** (they verify the final 200), support 5-min intervals, and open an issue after N consecutive failures. Add **3 monitors** (GET · 5-min interval · environment `production`):

| # | URL | Expect | Catches |
|---|---|---|---|
| 1 | `https://theblacqlist.com/api/health/supabase` | 2xx | **DB outage** — returns **503** if Supabase is unreachable (the real DB signal) |
| 2 | `https://theblacqlist.com/api/health` | 2xx | App/serverless liveness (⚠️ always 200 even when degraded — see note) |
| 3 | `https://theblacqlist.com/` | 2xx | Frontend/edge liveness — Sentry follows the 307→`/coming-soon`→200, so **no `?preview` token needed** (stays 200 at public launch) |

**Setup (per monitor):** Sentry → your **production** project → **Insights → Uptime** (or **Alerts → Create Alert → "Uptime Monitor"**; or `sentry.io/monitors/new`) → set the URL, **Method GET**, **Interval 5 minutes**, **Environment `production`** → save. Send the alert to the same destination as your existing Sentry error alerts (email / Slack).

**Threshold:** the default opens an issue after **3 consecutive failures** (~15 min at a 5-min interval). To honor "alert if down >5 min," lower it to **1–2 consecutive failures** in the monitor's Thresholds.

**Notes / why these 3:**
- ⚠️ **`/api/health` always returns HTTP 200** (its body flips to `status:"degraded"` when Supabase is down), so a *status-only* check on it won't catch a DB outage — that's why **#1 (`/api/health/supabase`, which returns 503 on failure) is the primary DB signal**. If your Sentry plan has the **Verification / Early-Adopter** assertions feature, add a JSON-body assertion `status == "ok"` on #2 to also catch the degraded state.
- The bypass **token stays out of Sentry** — #3 watches `/` and Sentry follows the redirect to the 200, so no secret lands in a third-party dashboard.

---

## 3. K5 — Sentry production error test

`app/api/_debug/sentry/route.ts` is guarded by `SENTRY_TEST_TOKEN` (set in Vercel) and lives under `/api` (allowlisted).

### Run 🙋🏾‍♀️
1. Trigger: `https://theblacqlist.com/api/_debug/sentry?token=<SENTRY_TEST_TOKEN>` → expect **HTTP 500** + thrown error. *(Without/with a wrong token → 404 `{"error":"Not found"}`.)*
2. In **Sentry** (prod project) confirm the event:
   - tagged **`environment: production`**,
   - **source-mapped** (stack shows real `.tsx` frames, not minified),
   - **zero PII** (no email / name / IP / cookies — enforced by `lib/observability/sentry-scrub.ts`).
3. Confirm the **alert rule** fires (≥5 errors / 5 min, or your chosen threshold).

**Pass:** PII-free, source-mapped, prod-tagged event in Sentry + alert fired.

---

## 4. 086 — RLS re-verify on production

RLS is **environment-specific** (prod is a separate Supabase project) → re-confirm on prod. The full 84-cell matrix passed on staging (`security-audit-report.md` §1); here we (A) confirm the policies are applied and (B) spot-check enforcement.

### A. Structural 🙋🏾‍♀️ (prod SQL editor)
```sql
-- 1) Every table that holds user data must have RLS ON (reference tables like
--    states/cities/categories are public-read but still RLS-enabled with an anon policy):
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and rowsecurity = false
order by tablename;
-- → review the list; flag any user-data table that appears here.

-- 2) Policy count — INFORMATIONAL only (do not anchor on a single number).
--    Prod has all migrations applied → expect ~143 total: 54 MVP policies
--    (20260510000001_mvp_rls_policies.sql) + post-MVP (marketplace, editorial,
--    AI, attributes, faqs, review_criteria, launch_subscribers, …). The pass is
--    the STRUCTURAL checks (1) + (3) below, not a magic count.
select count(*) as policy_count from pg_policies where schemaname = 'public';

-- 3) Per-table policy presence for the high-risk tables:
select tablename, count(*) as policies
from pg_policies where schemaname = 'public'
  and tablename in ('listings','saves','receipt_uploads','reviews','claims',
                    'user_roles','media_attachments','subscriptions','spend_events')
group by tablename order by tablename;
```

### B. Behavioral spot-checks 🙋🏾‍♀️ (as anon + as a 2nd user, via the app/API)
- **Anon can't read a non-published listing:** with the prod **anon** key, `GET …/rest/v1/listings?status=eq.draft&select=id` → returns `[]` (RLS blocks). *(Service-role/SQL-editor bypasses RLS — these must run as anon.)*
- **Non-owner can't read another user's private rows:** signed in as user B, attempt to read user A's `saves` / `receipt_uploads` → empty / 403.
- **Direct-URL probe:** as user B (or anon), open a draft/owned-only page belonging to user A → blocked (redirect / 404 / empty), not leaked.

**Pass:** no user-data table appears with RLS off (query 1); each of the 9 high-risk tables has ≥1 policy (query 3); anon + non-owner reads of protected rows return nothing (B). The raw policy count (query 2) is informational — not a pass/fail.

---

## 5. 088 — production Lighthouse

Run **Chrome DevTools → Lighthouse → Mobile** on the **bypassed** prod URLs (so you measure the real pages, not the gate). 🙋🏾‍♀️ (Headless Lighthouse isn't available in this environment — run it from your browser.)

| Page | URL |
|---|---|
| Home | `https://theblacqlist.com/?preview=<token>` |
| Discover | `https://theblacqlist.com/discover?preview=<token>` |
| Listing | `https://theblacqlist.com/atlanta-ga/business/busy-bee-cafe?preview=<token>` |
| Search | `https://theblacqlist.com/search?q=restaurant&preview=<token>` |
| Sign-up | `https://theblacqlist.com/sign-up?preview=<token>` |

**Thresholds:** Performance **≥80** · LCP **<2.5s** · CLS **<0.1** · INP **<200ms**. Local prerequisites (ISR windows, `next/image`, named icon imports, GIN/`pg_trgm`, `next` 16.2.6) are already ✅ per `lighthouse-scores.md`.

| Page | Perf | LCP | CLS | INP | Pass? |
|---|---|---|---|---|---|
| Home | | | | | |
| Discover | | | | | |
| Listing | | | | | |
| Search | | | | | |
| Sign-up | | | | | |

---

## Results log

| Item | Status | Date | Notes |
|---|---|---|---|
| 1 · Account deletion (code review) | ✅ PASS | 2026-06-26 | Cascade matches Privacy §7 |
| 1 · Account deletion (live walk-through) | ⬜ | | Founder run + SQL |
| 2 · K7 health endpoints live | ✅ PASS | 2026-06-28 | both 200 / ok (re-verified on e192df2) |
| 2 · K7 uptime monitors configured | ⬜ | | Founder — Sentry Uptime, 3 monitors (no new service) |
| 3 · K5 Sentry prod error | ⬜ | | Founder + Sentry |
| 4 · 086 RLS structural | ⬜ | | prod SQL |
| 4 · 086 RLS behavioral | ⬜ | | anon + 2nd user |
| 5 · 088 Lighthouse (5 pages) | ⬜ | | Founder, bypassed URLs |
