# Ticket 213: Stores and stockists, added by the brand and reviewed

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready
**Depends on:** 211. Brand self-service needs 212. Until then, the founder adds stockists for unclaimed brands.
**Gates:** a migration (GATE-DATA), staging first with a down plan. `[Needs professional review]` Counsel should confirm how we name real retailers on stockist rows. There are no retailer APIs and no scraping.
**Decision record:**
- Founder, 2026-11-07: brand stockist lists come first.
- 2026-11-08, Q4 A: the brand or owner adds stockists, and the founder reviews them.
- The States board: after 90 days with no update, a row shows "Not updated in 3 months". "Tell us it's not there" turns the row's date amber for everyone until the brand updates it.

## Why

"Where to buy" is the core of the picked product page (S3 E) and of list results (S2 B). Each row needs a store, a source and a date.

## Scope

In:
- **Migration** `stores`:
  - `id`, `name`, `banner` (the chain name, if any);
  - `kind`, either `physical` or `online`;
  - `url`, for online stores;
  - `address`, `city`, `state`, `zip`, `lat`, `lng`;
  - `status`, either `active` or `closed`;
  - the audit fields.
  Physical stores are geocoded with the existing N7 geocoder when they're saved. A store is created the first time a stockist names it, and the same address isn't duplicated: there's a unique index on normalized address plus zip.
- **Migration** `stockists`:
  - `id`, `store_id`;
  - exactly one of `marketplace_product_id` or `directory_product_id`, enforced by a CHECK;
  - `status`: `pending`, `approved` or `declined`;
  - `brand_updated_at`, the date shown in "Reported by the brand · updated {date}";
  - `reported_missing_at`, which is set by a shopper report and cleared when the brand updates the row;
  - `submitted_by`, `reviewed_by`, `reviewed_at`, `source` (`owner` or `admin`), and the audit fields.
  - A unique index on store plus product.
- **Where stockists get added:**
  - an owner, under "Where to buy" on `/dashboard/products/[id]/edit`;
  - a claimed brand, on its brand card from 212;
  - the founder, in admin.
  Every new or changed row starts as `pending`.
- **Admin review** at `/admin/marketplace/stockists`. Approve or decline. Reviewing a row sets `brand_updated_at` to the date the brand reported it.
- **"Tell us it's not there."** A public POST sets `reported_missing_at`.
  - It's rate-limited per IP, using the existing limiter.
  - It stores no shopper data and keeps no list of reports.
  - The row stays, and shows the amber date for everyone.
  - The pending review queue shows the reported rows first.
- **Freshness in code.** A row is stale when `brand_updated_at` is more than 90 days old, or when `reported_missing_at` is set. Stale rows show the amber "Not updated in 3 months" or the reported state, as on the States board.

Out:
- Any public page. Those are 217 and 218.
- "Ask {store} to carry it", which is 217 and stores nothing.
- Emails to brands about reports. That's GATE-COMMS, and the founder follows up by hand for now.

## Checks

- A stockist with both product ids set, or with neither, is rejected by the CHECK.
- An owner can add stockists only to their own products, and a claimed brand only to its own. Both are enforced by RLS and in the service layer, with tests.
- Pending and declined rows never show publicly.
- A report on an approved row shows amber for an anonymous visitor on the next load, and clears when the brand saves the row again.
- Ten rapid reports from one IP produce one write and then `429`.
