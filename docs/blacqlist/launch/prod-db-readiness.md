# Production DB Readiness — detailed runbook (091 finish + 093 seed)

**Date:** 2026-06-24 · **Production Supabase project:** `theblacqlist-production`
**Project ref:** `ytlrnczevdnsfdzjbeqg` · **Region:** AWS us-east-1 · **Plan:** Pro · **Postgres:** 17

**Goal:** bring the production database from its June-21 state (first 20 migrations + reference data, **0 listings**) to **fully migrated + seeded with the 254 launch listings**, so that when we point the live app at it (F9) everything works.

> **Read this top-to-bottom once before running anything.** Every step has: the **exact command**, the **expected output**, a **verification** check, and **"if it looks wrong."** Nothing here is destructive on the current empty DB, but precision matters — follow the order.

---

## 0. Safety first — the 4 rules

1. **You are working on the PRODUCTION project `ytlrnczevdnsfdzjbeqg` (`theblacqlist-production`).** Before *every* dashboard/SQL action, glance at the top-left project switcher and confirm it says **theblacqlist-production**, not "ChaDe1922's Project" (that's staging). A command run on the wrong project is the only real risk here.
2. **The DB is empty of real user data right now.** That's why this is low-risk: if a migration fails, there's nothing to lose — you restore the daily backup or recreate the project. (See §10.)
3. **The `service_role` key and DB password are master credentials.** Paste them only into your terminal or the Supabase dashboard — never into chat, a file, or a commit.
4. **If any step's output doesn't match what's described here, STOP** and read the "if it looks wrong" note before continuing. Don't push past an unexpected result.

---

## 1. Prerequisites — gather these first

| You need | Where to get it |
|---|---|
| The repo on the latest `main` | `cd projects/theblacqlist && git checkout main && git pull` |
| Dependencies installed | `pnpm install` — **this is a pnpm project**. Do **not** run `npm install` (npm 11 crashes on pnpm's `node_modules`). pnpm is already on your Mac; if a stray `npm install` left a mess, `rm -rf node_modules && pnpm install`. |
| **Supabase access token** (for the CLI login) | https://supabase.com/dashboard/account/tokens → **Generate new token** → copy it |
| **Production DB password** | Supabase → **theblacqlist-production** → Settings → Database → **Database password** (if you don't have it saved, click **Reset database password** and save the new one) |
| **Production `service_role` key** | Settings → **API** → Project API keys → **`service_role`** → reveal + copy |
| **Production Project URL** | Settings → **API** → **Project URL** = `https://ytlrnczevdnsfdzjbeqg.supabase.co` |

> **Expected on `pnpm install`:** you'll likely see `[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: @sentry/cli, sharp, unrs-resolver`. That's **normal** — pnpm skips dependency build scripts by default, and none of those are needed for the migrations, the reference seed, or the listing seed. Ignore it. _(Only if you later run a local `next build`: `pnpm approve-builds` and approve `sharp`.)_

Sanity-check the CLI is available (no install needed — `npx` fetches it):
```bash
npx supabase --version      # any recent version is fine
```

---

## 2. Pre-flight checklist (2 minutes in the dashboard)

On the **theblacqlist-production** project:
- [ ] **Settings → Billing** → plan = **Pro** (✅ already, from F1)
- [ ] **Settings → Backups** → a recent **daily backup** timestamp exists (your safety net during this work)
- [ ] **Settings → Database** → PostgreSQL version = **17**
- [ ] **Database → Extensions** → search **`pg_trgm`** → enabled. If not, run in the SQL Editor:
  ```sql
  create extension if not exists pg_trgm;
  ```

---

## 3. Apply the 9 missing migrations

Prod has the first 20 migrations (through `20260601000000`). These **9 are missing** and must be applied in order:
```
20260620000000_collections_editorial.sql
20260622000000_attributes_taxonomy.sql            ← powers Discover faceting
20260622000001_search_listings_faceted_rpc.sql    ← powers Discover faceting
20260622000002_listing_video.sql
20260622000003_services_group_label.sql
20260622000004_listing_faqs.sql
20260622000005_review_criteria.sql                 (self-seeds 4 review criteria)
20260622000006_review_media_rls.sql
20260622000007_event_entity.sql                    (re-adds the 'event' type + events table)
```

### 3.1 — Log in and link the CLI to production
```bash
cd projects/theblacqlist
npx supabase login
# Paste the access token from §1 when prompted.

npx supabase link --project-ref ytlrnczevdnsfdzjbeqg
# Enter the production DB password from §1 when prompted.
```
**Expected:** `Finished supabase link.` (or similar success). If it errors on the password, re-copy it (or reset it in Settings → Database).

### 3.2 — ⚠️ Confirm the migration ledger BEFORE pushing
This is the single most important check. It tells the CLI which migrations prod already has, so `db push` applies *only* the missing 9 — not re-run the 20 that are already live (which would error on "table already exists").

```bash
npx supabase migration list --linked
```

You'll see a table with **Local** and **Remote** columns. Read it:

- **✅ Clean (expected if June-21 used `db push`):** the 20 versions `20260510000000` … `20260601000000` show a timestamp in **both** Local and Remote; the 9 newer ones show in **Local only**. → **Go straight to §3.3.**
- **⚠️ Drifted (if June-21 was a manual SQL paste):** the first 20 are **missing from the Remote column** even though those tables clearly exist in the DB. This means the ledger doesn't know they're applied. **Do NOT just push** — it would try to recreate existing tables. Instead, tell the ledger they're already applied, then push:
  ```bash
  npx supabase migration repair --status applied \
    20260510000000 20260510000001 20260511000000 20260511000001 20260511000002 \
    20260511000003 20260511000004 20260514000000 20260515000000 20260515000001 \
    20260515000002 20260516000000 20260517000000 20260517000001 20260518000000 \
    20260518000001 20260524000000 20260524000001 20260527000000 20260601000000
  ```
  Then re-run `npx supabase migration list --linked` and confirm those 20 now show in Remote and only the 9 are pending.

> If you're unsure which case you're in, paste the `migration list` output to me and I'll tell you exactly which branch you're on before you push.

### 3.3 — Preview, then push
```bash
# Optional dry run — shows what WILL run without doing it:
npx supabase db push --dry-run

# Real push:
npx supabase db push
```
**Expected:** it lists the 9 pending migrations, asks `Do you want to push these migrations to the remote database? [Y/n]` → type `Y` → each applies in order, ending with a success line. There should be **no errors**.

### 3.4 — Verify the migrations landed
Run in the **SQL Editor** (theblacqlist-production):
```sql
-- The 10 new tables should all be present:
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'collection_sections','attribute_groups','attribute_values','listing_attributes',
    'tags','listing_tags','listing_faqs','review_criteria','review_ratings','listing_details_event')
order by table_name;
-- expect 10 rows

-- The 3 new functions (Discover faceting + open-now):
select proname from pg_proc
where proname in ('search_listings_faceted','facet_counts','is_open_now');
-- expect 3 rows

-- 'event' is a valid entity type again:
select 1 from information_schema.check_constraints
where constraint_name = 'listings_entity_type_check';   -- exists
```

### 3.5 — If a migration fails mid-push
`db push` stops at the first failing migration; the ones before it **are** applied and recorded.
- Read the error in the terminal (or re-run the failing migration's SQL in the SQL Editor to see the exact message).
- These migrations are additive — the most common cause of failure is the ledger being out of sync (you skipped §3.2). Re-check the ledger.
- Fix the cause, then run `npx supabase db push` again — it resumes from the first un-applied migration.
- Worst case on this empty DB: see §10 (restore the daily backup or recreate the project).

---

## 4. Re-run the reference seed (adds the Pillar B vocabulary)

`supabase/seed.sql` (reference data: states, cities, categories, plans — **plus** the attribute groups/values, tags, and review criteria that the new faceting migration needs). It's **idempotent** (`ON CONFLICT DO NOTHING`), so re-running it only adds what's missing.

**Easiest:** open `supabase/seed.sql` in the repo, copy its entire contents, paste into the **prod SQL Editor**, and **Run**.
*(Alternative, if you have the direct connection string: `psql "<prod-direct-connection-string>" -f supabase/seed.sql`.)*

**Verify:**
```sql
select 'states' t, count(*) from states
union all select 'cities', count(*) from cities
union all select 'categories', count(*) from categories
union all select 'attribute_groups', count(*) from attribute_groups
union all select 'attribute_values', count(*) from attribute_values
union all select 'tags', count(*) from tags
union all select 'review_criteria', count(*) from review_criteria;
-- states 51 · cities 13 · categories 25+ · attribute_groups/values/tags > 0 · review_criteria 4
```
**If `attribute_groups`/`attribute_values` are still 0:** the seed paste didn't run fully — re-run it and watch for a SQL error in the editor.

---

## 5. Data decisions — resolved (no action)

Settled with the founder on 2026-06-24:
- **Images → deferred** (soft-launch; listings go live without photos and fill in over time).
- **Identity attributes → no backfill** (every listing is Black-owned, so a "Black-Owned" filter is redundant; the Identity facet launches empty).
- **Gorée → already added** to `scripts/data/listings-chicago.json` (1126 E 47th St, Bronzeville). Chicago is now **52**, launch total **254**.

Nothing to do here — go to §6.

---

## 6. Seed the 254 launch listings

This is the real production listing seed: a TypeScript script that reads the 3 curated JSON files (**Atlanta 151 · Houston 51 · Chicago 52 = 254** — your keep/edit/remove–reviewed set of *real* businesses).

> **Note:** these are real, curated businesses — not test fixtures. (The older `environment-plan.md` line "never seed production" refers to *dev fixtures* in `supabase/seeds/*.sql`; those are **not** used here. The reference data and this curated launch JSON are the legitimate production seed.)

### 6.1 — Run it (from the repo root, with the prod credentials inline)
```bash
cd projects/theblacqlist

SUPABASE_URL=https://ytlrnczevdnsfdzjbeqg.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<prod service_role key from §1> \
pnpm run seed:launch
```
> The script reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the environment (it does **not** read `.env`), so they must be on the command line exactly as above. `SUPABASE_URL` is the **prod** URL — that's what makes this write to production.

### 6.2 — What it does (per listing)
Resolves the city + category by slug, then upserts: `listings` → `listing_details_business` → `listing_hours` → action `listing_links` → refreshes the search vector. All upserts use `ON CONFLICT … ignoreDuplicates`, so it's **idempotent**.

### 6.3 — Expected output
```
Resolving city and category lookups...
Found 13 cities, 25+ categories
[Atlanta] Done — Inserted: 151, Skipped: 0, Errors: 0 (total in file: 151)
[Houston] Done — Inserted: 51,  Skipped: 0, Errors: 0 (total in file: 51)
[Chicago] Done — Inserted: 52,  Skipped: 0, Errors: 0 (total in file: 52)

Seed complete.
```

### 6.4 — Reading the numbers / error modes
- **Inserted** = new listings created. **Skipped** = already existed (a slug match) — normal on a *re-run*. **Errors** = rows that couldn't be inserted.
- **`Errors > 0` with `Unknown city_slug` / `Unknown category_slug` warnings:** the listing references a slug that isn't in the DB → almost always means **§4 (reference seed) wasn't applied** or wasn't applied fully. Fix §4, then re-run the seed.
- **`Details/Hours/Links warning` lines:** non-fatal (the listing itself inserted; a detail row had a minor issue). Note them but they don't block launch.
- **Idempotency check:** run the exact same command **again**. Expected: every city reports `Inserted: 0, Skipped: <count>, Errors: 0`. That proves re-running is safe.

---

## 7. Verify the seed (SQL Editor, prod)

```sql
-- Published counts per city
select c.slug, count(*) as published
from listings l join cities c on c.id = l.city_id
where l.status = 'published'
group by c.slug order by c.slug;
-- expect: atlanta-ga 151 · houston-tx 51 · chicago-il 52

-- Total published
select count(*) from listings where status = 'published';   -- 254

-- Business details present
select count(*) from listing_details_business;              -- ~254

-- Full-text search works
select count(*) from listings
where search_vector @@ websearch_to_tsquery('english','restaurant');   -- > 0

-- The Discover faceting RPC returns rows (this is the engine /discover uses)
select count(*) from search_listings_faceted(
  null, null, null, null, null, null, null, null, false, 'relevance', 24, 0);
-- > 0

-- No accidental test data
select count(*) from auth.users where email like '%+test%' or email like '%@example.%';   -- 0

-- Gorée is in, with the corrected address
select l.name, d.address_line_1, d.zip
from listings l join listing_details_business d on d.listing_id = l.id
where l.slug = 'goree-cuisine-chicago';
-- Gorée Cuisine · 1126 E 47th St · 60653
```

---

## 8. Finish 091 — auth config + admin user

### 8.1 — Auth settings (do now, in the prod dashboard)
**Authentication → URL Configuration:**
- **Site URL:** set to `https://theblacqlist.vercel.app` for now (the live validation URL). **Switch to `https://theblacqlist.com` at F4** (DNS go-live).
- **Redirect URLs** — add:
  ```
  https://theblacqlist.vercel.app
  https://theblacqlist.vercel.app/auth/callback
  https://theblacqlist.vercel.app/onboarding
  https://*.vercel.app
  https://*.vercel.app/auth/callback
  ```
  At F4, add the `https://theblacqlist.com` equivalents. **Never** add `http://localhost:3000` to the production project.

**Authentication → Providers → Email** (and Sessions/Settings):
- **Enable email confirmations** (new users must verify their email).
- **Enable "Secure email change"** (double-confirm email changes).
- **JWT expiry → `604800`** (7 days). *(Local default is 3600 / 1 hour.)*
- Custom **SMTP → Resend** is already wired (F5).

**Authentication → Email Templates:** brand the **Confirm signup** and **Reset password** templates as **The BLACQList** (sender name, and a reply-to like `support@theblacqlist.com`).

**Settings → Database → Connection Pooling:** confirm it's enabled in **Transaction** mode (required for Vercel's serverless functions).

### 8.2 — Create the admin user (AFTER the F9 cutover)
The app must be pointed at the prod DB first (F9) so your signup writes to production.
1. Go to the live site → **Sign up** with your admin email → **verify** the email.
2. Supabase → **Authentication → Users** → copy your user's **UUID**.
3. SQL Editor (prod):
   ```sql
   insert into user_roles (user_id, role)
   values ('<your-user-uuid>', 'admin');
   ```
   *(New signups already get a `supporter` role via trigger; this adds a separate `admin` row — no conflict.)*
4. Verify:
   ```sql
   select u.email, r.role
   from user_roles r join auth.users u on u.id = r.user_id
   where r.role = 'admin';
   -- your email, 'admin'
   ```
5. Visit `/admin` on the live site → the admin dashboard should load (no redirect).

---

## 9. PITR — at the M7 gate (not now)

When you're near public launch and real data is accruing, enable **Point-in-Time Recovery**: Settings → Backups → **Point in Time Recovery** → 7-day window (~$100/mo). Skip during this setup phase — the Pro daily backup is enough while the DB is fresh.

---

## 10. If something goes wrong (rollback)

**During this setup phase, PITR is off and there's no real data — recovery is easy:**
- **A migration failed and left things half-applied:** since all 9 are additive, the simplest recovery is to **restore the latest Pro daily backup** (Settings → Backups → Restore) — it returns the DB to this morning's clean state, then you re-run from §3. Or, if needed, **recreate the project** (it's empty) and re-apply from §3.
- **You need to undo a specific additive migration:** write the reverse SQL (`drop table if exists …` / `drop function if exists …` / `alter table … drop column if exists …`) in reverse order, run it in the SQL Editor, then `npx supabase migration repair --status reverted <version>` so the ledger matches. (Pattern from `rollback-plan.md` Scenario B.)
- **Seed went wrong:** the seed is idempotent and additive — re-running fixes partial inserts; to remove seeded listings entirely you'd `delete from listings where source = 'admin'` (cascades to details/hours/links), then re-seed.
- **Post-launch (PITR on):** a destructive issue uses a **PITR restore** to 5 minutes before the bad change (`rollback-plan.md` Scenario C). Not applicable during setup.

---

## 11. Who does what

| Step | Owner | Why |
|---|---|---|
| §3 migrations · §4 reference seed · §6 listing seed · §7 verify · §8 auth/admin | **You (founder)** | They need the prod DB password + `service_role` key, which stay on your side |
| Prep work — Gorée JSON, decision write-ups, this runbook | Me | ✅ done |
| Interpreting `migration list` / `db push` / seed output, troubleshooting | Me | Paste me the output and I'll read it with you |

> I can't run these for you (I don't hold the prod credentials), but **paste me any command's output and I'll confirm it's right or tell you exactly what to fix** before you continue.

---

## 12. Final readiness checklist

- [ ] §2 pre-flight: Pro · recent backup · PG17 · `pg_trgm`
- [ ] §3 migration ledger confirmed (repaired if needed) → `db push` applied the 9 → §3.4 verify (10 tables + 3 functions)
- [ ] §4 reference seed re-run → attribute/tag/review_criteria counts > 0
- [ ] §6 listing seed → `Inserted 151 / 51 / 52, Errors 0` → re-run shows `Inserted 0` (idempotent)
- [ ] §7 verify → 254 published, search + faceting return rows, Gorée correct, 0 test users
- [ ] §8.1 auth settings (JWT 7d · confirmations on · templates · redirects · pooling)
- [ ] **Then:** F9 Vercel cutover → §8.2 admin user → F4 DNS → M7 PITR → soft launch

**When §3, §4, §6, §7 are green, the production database is launch-ready** and the F9 cutover can point the live app at it.
