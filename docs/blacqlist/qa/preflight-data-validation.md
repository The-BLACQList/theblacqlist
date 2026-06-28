# Preflight Data Validation — Production

_Last updated: 2026-06-28 · Target: production (`theblacqlist.com` / Supabase `ytlrnczevdnsfdzjbeqg`)_

Clears the **"Run preflight validation SQL; zero gaps"** item on the *Production data* card. Paste each block into the **prod Supabase SQL editor** and send me the output — I'll review against the pass criteria and we fix any gaps.

All checks scope to **published, non-deleted** listings: `status = 'published' AND deleted_at IS NULL`.

> **Cover-image gate = decision (A), 2026-06-28:** the bar is "every page renders a cover (branded default or real)," satisfied by the type-based default covers once the Track-B photos land. So the real-cover-% check below is **informational, not a blocker**.

---

## 1. Cover image coverage (informational under decision A)

```sql
select
  count(*)                                              as published_listings,
  count(*) filter (where cover_image_path is not null)  as with_real_cover,
  round(100.0 * count(*) filter (where cover_image_path is not null)
        / nullif(count(*), 0), 1)                       as real_cover_pct
from listings
where status = 'published' and deleted_at is null;
```
**Read:** `real_cover_pct` is the share with a real uploaded cover (likely ~0 today). Under decision (A) the branded default covers fill the rest visually; real % grows as owners upload on claim. **No action required to launch.**

---

## 2. Category × city coverage — combos below the ≥3 target

```sql
select ci.name as city, ca.name as category, count(*) as published
from listings l
join cities ci     on ci.id = l.city_id
join categories ca on ca.id = l.category_id
where l.status = 'published' and l.deleted_at is null
group by ci.name, ca.name
having count(*) < 3
order by ci.name, published asc, category;
```
**Read:** every (city, category) pair with **1–2** published listings — the gaps below "≥3 per category per city." **Empty result = no gaps.** (Combos with 0 listings don't appear here — that's a "do we feature this category in this city?" question, not a data defect. If you want the full 0-included matrix, say so and I'll add the cross-join version.)

---

## 3. Descriptions under 100 characters (business listings)

```sql
select l.slug, ci.name as city, coalesce(length(d.description), 0) as desc_len
from listings l
join cities ci on ci.id = l.city_id
left join listing_details_business d on d.listing_id = l.id
where l.status = 'published' and l.deleted_at is null
  and l.entity_type <> 'event'
  and (d.description is null or length(d.description) < 100)
order by desc_len asc, ci.name;
```
**Read:** business listings whose description is missing or under 100 chars. **Empty = all good.** (Events use `listing_details_event`, so they're excluded here.)

---

## 4. CTA completeness

```sql
select
  count(*)                                   as business_listings,
  count(*) filter (where d.cta_url is null)  as missing_cta_url
from listings l
join listing_details_business d on d.listing_id = l.id
where l.status = 'published' and l.deleted_at is null and l.entity_type <> 'event';
```
**Read:** `cta_type` is `NOT NULL DEFAULT 'visit'`, so every listing already has a CTA type (the "CTA non-null" item is satisfied by schema). `missing_cta_url` is informational — some CTA types (`visit`, `call`) don't need a URL.

---

## Pass criteria

| Check | Pass |
|---|---|
| 1 · Real cover % | Informational (decision A) — not a blocker |
| 2 · Category × city <3 | Review the gaps; acceptable for soft launch if the **featured** categories per live city have ≥3. Fix by adding/publishing listings where a key category is thin. |
| 3 · Descriptions <100 | Ideally empty. Any rows → I help backfill descriptions (or accept as P2). |
| 4 · CTA | `business_listings` > 0 and CTA type always set; `missing_cta_url` informational. |

**"Zero gaps"** for the card = checks 2 and 3 reviewed and either clean or with an explicit accepted-risk note.

---

## Results + decision (founder ran on prod, 2026-06-28)

| Check | Result | Call |
|---|---|---|
| 1 · Real cover % | 254 published · 0 real · **0.0%** | Non-blocker — decision (A) branded defaults render on every page |
| 2 · Category × city <3 | Many combos at 1–2 (ATL Automotive/Education/Events/Non-Profits=1, Home&Living/RealEstate=2; ~10 Chicago categories=1; several Houston=1–2) | **Accepted-risk** — content depth, not a defect; thin filters return 1–2 results |
| 3 · Descriptions <100 | ~25–30 business listings at **72–99 chars** (real, complete, just under the bar) | **Accepted-risk** — serviceable; backfill is P2 |
| 4 · CTA | 254 business · **55 missing `cta_url`** | Informational — `visit`/`call` CTAs need no URL |

**Decision: ACCEPT AS-IS FOR SOFT LAUNCH (founder, 2026-06-28).** No hard launch blockers. The "≥40% cover / ≥3-per-category / ≥100-char" targets are perfectionist quality bars, not correctness gates — nothing is broken or empty, and the data is fully functional. The thin categories, short descriptions, and real-cover backfill are **P2 post-launch** work that fills naturally as owners claim/edit their pages and as listings are added.

→ **Production-data card = PASS (with notes).** Preflight item cleared.
