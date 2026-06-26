# Production DB Readiness — runbook (091 finish + 093 seed)

**Date:** 2026-06-24 · **Prod Supabase project:** `theblacqlist-production` (`ytlrnczevdnsfdzjbeqg`, us-east-1, Pro)
**Goal:** get the production database **migrated + seeded** so that when we repoint Vercel at it (F9) the live site has real data.

**Where it stands:** the June-21 setup (091) applied the first 20 migrations + reference data (states/cities/categories/plans) and the 3 storage buckets. Since then, 9 newer migrations and the 253 launch listings have NOT been applied to prod. This runbook closes that.

> **The DB work below is independent of the Vercel env cutover (F9).** You seed the production database *directly* (with the prod service key). The order is: **prod DB ready (this doc) → F9 cutover → F4 DNS → admin user.**

---

## ✅ 3 decisions — RESOLVED (founder, 2026-06-24)

1. **Images → soft-launch, deferred.** No image-coverage gate for launch; listings go live without photos and fill in over time (owner claims + curation). No action in this runbook.
2. **Identity attributes → no backfill.** Since *every* listing is Black-owned, a "Black-Owned" filter is redundant — so no attribute backfill. The Identity & Ownership facet launches empty. _(Optional follow-up: hide the redundant "Black-Owned" value from the Discover sidebar — small UI tweak, not blocking.)_
3. **Gorée → added.** Added to `scripts/data/listings-chicago.json` with `1126 E 47th St, Chicago, IL 60653` (Bronzeville). **Chicago is now 52, total 254.**

---

## Step 1 — Apply the 9 missing migrations

The missing migrations (in order):
```
20260620000000_collections_editorial.sql
20260622000000_attributes_taxonomy.sql          ← powers Discover faceting
20260622000001_search_listings_faceted_rpc.sql  ← powers Discover faceting
20260622000002_listing_video.sql
20260622000003_services_group_label.sql
20260622000004_listing_faqs.sql
20260622000005_review_criteria.sql              (self-seeds 4 review criteria)
20260622000006_review_media_rls.sql
20260622000007_event_entity.sql                  (re-adds 'event' type + events table)
```

**Recommended: `supabase db push` (it applies only what's missing and updates the ledger).**

```bash
cd projects/theblacqlist
# 1. Link the CLI to the production project (you'll be prompted for the DB password)
npx supabase link --project-ref ytlrnczevdnsfdzjbeqg

# 2. ⚠️ CONFIRM THE LEDGER FIRST — list what prod records as applied
npx supabase migration list --linked
```

**Read the list output carefully:**
- If migrations `20260510…` through `20260601000000` show as **applied (Remote)** and the 9 above show as **local-only** → you're clean. Go to step 3.
- If the first 20 are **NOT** marked applied on Remote (the June-21 run may have been a manual paste that didn't update the ledger) → **repair the ledger before pushing**, so `db push` doesn't try to re-create tables that already exist:
  ```bash
  npx supabase migration repair --status applied 20260510000000 20260510000001 20260511000000 \
    20260511000001 20260511000002 20260511000003 20260511000004 20260514000000 20260515000000 \
    20260515000001 20260515000002 20260516000000 20260517000000 20260517000001 20260518000000 \
    20260518000001 20260524000000 20260524000001 20260527000000 20260601000000
  ```

```bash
# 3. Push the missing migrations
npx supabase db push
# Expect: it applies the 9 migrations in order, finishing without error.
```

> One migration (`…0007_event_entity`) drops + recreates the `entity_type` CHECK to re-add `'event'`. On a 0-listing DB that's safe.

---

## Step 2 — Re-run the reference seed (adds Pillar B vocabulary)

`supabase/seed.sql` is idempotent (`ON CONFLICT DO NOTHING`) and now also seeds the **attribute groups/values and tags** that the new faceting migration needs (the June-21 seed predates them). Re-run it on prod:

```bash
# Easiest: paste the contents of supabase/seed.sql into the prod project's SQL Editor and run.
# (Or, if you have the direct DB URL:)
# psql "<prod-direct-connection-string>" -f supabase/seed.sql
```

**Verify:**
```sql
select 'states' t, count(*) from states
union all select 'cities', count(*) from cities
union all select 'categories', count(*) from categories
union all select 'attribute_groups', count(*) from attribute_groups
union all select 'attribute_values', count(*) from attribute_values
union all select 'review_criteria', count(*) from review_criteria;
-- attribute_groups / attribute_values / review_criteria should now be > 0
```

---

## Step 3 — Data decisions (resolved — no action)

All three are settled: **images deferred**, **no attribute backfill**, **Gorée already added** to the JSON. Nothing to do here — go straight to Step 4.

---

## Step 4 — Seed the 253 launch listings

The production seed is the JSON + TypeScript script (NOT the `supabase/seeds/*.sql` files — those are dev fixtures). The 3 JSON files already hold your reviewed set: **Atlanta 151 · Houston 51 · Chicago 52 = 254** (Chicago includes Gorée).

```bash
cd projects/theblacqlist
SUPABASE_URL=https://ytlrnczevdnsfdzjbeqg.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<prod service_role key> \
npx tsx scripts/seed-launch-listings.ts
```

- **Idempotent** (`ON CONFLICT (slug) DO NOTHING`) — safe to re-run; a second run inserts 0.
- Inserts each listing + `listing_details_business` + `listing_hours` + `listing_links`, and refreshes the search vector.
- Expected output:
  ```
  [Atlanta] Inserted: 151, Skipped: 0, Errors: 0
  [Houston] Inserted: 51,  Skipped: 0, Errors: 0
  [Chicago] Inserted: 52,  Skipped: 0, Errors: 0
  ```

> The prod **service_role** key (from Supabase → project → Settings → API). It bypasses RLS for the insert — keep it out of chat/files; paste it inline in your terminal only.

---

## Step 5 — Verify the seed

```sql
-- Counts per city (published)
select c.slug, count(*)
from listings l join cities c on c.id = l.city_id
where l.status = 'published'
group by c.slug order by c.slug;
-- expect atlanta-ga 151, houston-tx 51, chicago-il 52

-- Details + hours present
select count(*) from listing_details_business;          -- ~254
select count(distinct listing_id) from listing_hours;   -- listings with hours

-- Search works
select count(*) from listings
where search_vector @@ websearch_to_tsquery('english','restaurant');  -- > 0

-- Faceting RPC returns rows (the Discover engine)
select count(*) from search_listings_faceted(null,null,null,null,null,null,null,null,false,'relevance',24,0);
```

---

## Step 6 — Finish 091 (auth + admin)

**In the prod project's dashboard — Authentication → these you can do now:**
- **JWT expiry** → `604800` (7 days) _(local default is 3600 / 1 hr)_
- **Enable email confirmations** (so new signups verify their email)
- **Email templates** → brand "Confirm signup" + "Reset password" as **The BLACQList** (SMTP→Resend is already wired from F5)
- **Site URL / Redirect URLs** → set to `https://theblacqlist.vercel.app` now to enable testing; switch to `https://theblacqlist.com` at **F4** (DNS go-live)
- **Connection pooling** → confirm it's enabled in **Transaction** mode (Settings → Database)

**Admin user — *after* the F9 cutover** (so the signup writes to the prod DB):
1. Sign up on the live site with your admin email → verify the email.
2. Find the user's UUID (Authentication → Users), then in the SQL Editor:
   ```sql
   insert into user_roles (user_id, role)
   values ('<your-user-uuid>', 'admin')
   on conflict (user_id, role, listing_id) do nothing;
   ```
3. Confirm `/admin` loads without redirect.

---

## Step 7 — PITR (at M7, pre-public-launch)

Once real data is live and you're near public launch, enable **Point-in-Time Recovery** (Settings → Backups → 7-day window, ~$100/mo). Not needed during this setup.

---

## Sequence at a glance

```
Step 1  migrations (db push, ledger-checked)        ← safe now
Step 2  re-run seed.sql (reference + vocab)          ← safe now
Step 3  decisions: Gorée? attributes? images?        ← your call
Step 4  seed 253 listings (script + prod key)        ← founder-run
Step 5  verify counts + search + faceting
Step 6  091 auth dashboard config + (post-cutover) admin user
   →    F9 Vercel env cutover  →  F4 DNS  →  M7 PITR  →  go-live
```

**What I can do for you:** the generic identity-attribute backfill SQL (decision 2), the Gorée JSON entry (decision 3), and a `media_attachments` insert step if you source images (decision 1). Everything that touches the prod DB itself is yours to run (you hold the prod service key).
