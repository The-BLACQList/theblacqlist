# 187: Seed "Test Business 123" as real listings on staging

> **Renamed 2026-11-18 (ticket 206):** the listings are now named "Demo — Sample & Co. (…)". The slug prefix stays `demo-test-business-123` so re-running the seed renames the existing staging listings in place and `--purge` still finds them.

**Status:** In PR, 2026-11-15, stacked on 196 (`feat/187-staging-seed`). Not run against any database yet: every staging run waits for the founder's OK. Originally: from the 184 plan, founder 2026-11-13.
**Follows:** 184 (reads the same fixture modules as `/example/*`, so the two cannot drift), 107–110 and 191–196 for the rows they add
**Area:** `scripts/`, staging data
**Gates:** every staging run is confirmed by the founder. The script **cannot target production**: it refuses the production project ref outright, requires the remote ref to equal the staging ref **and** `--yes`, and accepts local without ceremony (`docs/blacqlist/data/seed-data-plan.md` §10 forbids "Test Business…", example.com, stock photos and fake reviews in production).

## What changes

- Extract `assertTargetConfirmed` and the flag parsing from `scripts/seed-marketplace-demo.ts` into `scripts/lib/seed-guards.ts` (the marketplace script imports it), add `STAGING_REF`, and test the guard (`tests/seed-guards.test.ts`).
- `scripts/seed-example-business.ts`: `--owner-email=` (required), `--purge`, `--with-reviews` (creates `demo-reviewer-N@example.com` confirmed users, password never printed, one review per user per listing). Service role, idempotent upserts on slug: three listings `demo-test-business-123-{storefront,professional,creative}` named "Demo — Test Business 123 (…)", `noindex=true`, published, Premium, `verified`, `source='admin'`, with details, videos, buttons, services, FAQs, links, attributes, and — as their tickets land — team (one founder), coupons, booking settings, posts (one pinned), credentials, documents, highlights, hours overrides, albums, two extra locations, marketplace items and 1–2 job listings.
- Photos: upload `public/images/example/*` to `listing-media` at `listings/{id}/{role}/{name}.webp`, write `media_attachments`, set `cover_image_path` and `logo_path` to storage keys.
- `--purge` deletes by the exact slug list, storage objects and demo users, and prints counts. No spend or receipt rows, ever.

## As built

- `scripts/lib/seed-guards.ts`: `checkSeedTarget()` (pure, tested) and `assertTargetConfirmed()`. Production is refused outright, local runs freely, and the only remote target is staging with `--yes`. `seed-marketplace-demo.ts` now uses it too, so it can no longer target a remote project other than staging.
- `scripts/lib/example-seed-plan.ts`: the rows each sample page becomes, built from `lib/example/fixtures`, so the seed and `/example/*` cannot drift. Tested against every table CHECK in `tests/seed-example-plan.test.ts`.
- `scripts/seed-example-business.ts`: the I/O. `--dry-run` prints the plan with no env and no network. Child rows are replaced per page (delete, then insert), so re-runs are idempotent. Photos go to `listing-media` at `listings/{id}/{role}/{file}`. Each document is a generated one-page placeholder PDF in `listing-documents`. Shop item images use their public storage URL.
- Departures:
  - Extra buttons are seeded as type `learn-more` with the fixture's label, because the fixtures carry a label and a link but no type.
  - Posts have no "pinned" column, so none is pinned.
  - A location's city is matched by name. Where staging has no such city, it falls back to the main page's city.
  - Reviews are written only with `--with-reviews`. Reviewer `N` writes the page's `N`th fixture review, under the display name "Demo Reviewer N". Criteria scores and review photos are left out.
  - `--purge` does not need `--owner-email`.

## Checks

- Guard tests; a dry run against local; a confirmed staging run, the pages open on Preview, `--purge` leaves nothing behind.
