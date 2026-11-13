# 187: Seed "Test Business 123" as real listings on staging

**Status:** Planned — from the 184 plan, founder 2026-11-13. Not started. Own branch and draft PR off `origin/main` once 184 has merged; **no merge before Wed 18 Nov 2026** (launch merge freeze). Runs before the later tickets land: tables that do not exist yet are skipped with a warning.
**Follows:** 184 (reads the same fixture modules as `/example/*`, so the two cannot drift), 107–110 and 191–196 for the rows they add
**Area:** `scripts/`, staging data
**Gates:** every staging run is confirmed by the founder. The script **cannot target production**: it refuses the production project ref outright, requires the remote ref to equal the staging ref **and** `--yes`, and accepts local without ceremony (`docs/blacqlist/data/seed-data-plan.md` §10 forbids "Test Business…", example.com, stock photos and fake reviews in production).

## What changes

- Extract `assertTargetConfirmed` and the flag parsing from `scripts/seed-marketplace-demo.ts` into `scripts/lib/seed-guards.ts` (the marketplace script imports it), add `STAGING_REF`, and test the guard (`tests/seed-guards.test.ts`).
- `scripts/seed-example-business.ts`: `--owner-email=` (required), `--purge`, `--with-reviews` (creates `demo-reviewer-N@example.com` confirmed users, password never printed, one review per user per listing). Service role, idempotent upserts on slug: three listings `demo-test-business-123-{storefront,professional,creative}` named "Demo — Test Business 123 (…)", `noindex=true`, published, Premium, `verified`, `source='admin'`, with details, videos, buttons, services, FAQs, links, attributes, and — as their tickets land — team (one founder), coupons, booking settings, posts (one pinned), credentials, documents, highlights, hours overrides, albums, two extra locations, marketplace items and 1–2 job listings.
- Photos: upload `public/images/example/*` to `listing-media` at `listings/{id}/{role}/{name}.webp`, write `media_attachments`, set `cover_image_path` and `logo_path` to storage keys.
- `--purge` deletes by the exact slug list, storage objects and demo users, and prints counts. No spend or receipt rows, ever.

## Checks

- Guard tests; a dry run against local; a confirmed staging run, the pages open on Preview, `--purge` leaves nothing behind.
