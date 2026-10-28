# Ticket 105 — Enforce the new tier limits at every call site

**Phase:** Monetization (Phase 14) · **Priority:** P1 · **Status:** Done (PR open, merges after the flip)
**Depends on:** 076 (tier upgrade flow), 078 (webhook)
**Related:** `lib/stripe/features.ts`, `lib/stripe/planChecks.ts`, `lib/stripe/downgrade.ts`,
`monetization/time-to-1m-and-ai-margin-review.md`

---

## Why this is P1

The 2026-07-27 re-ladder rewrote `lib/stripe/features.ts` into a full entitlement map and rewrote
the `/pricing` copy to match. Until every limit with a real feature behind it is checked on the
server, the pricing page promises more than the server enforces. This ticket closes that gap for
every surface that exists today.

## Founder decisions (2026-10-20)

- **Scope:** finish every gate and limit that has a real feature behind it. Gates for features
  that are not built yet ship inside those tickets (107 to 112), which stay "Not built".
- **Videos:** Starter 1, Growth 3, Premium unlimited, stored in a new `listing_videos` table.
- **Downgrade:** content over the new plan's limit is hidden on the page, never deleted, and comes
  back on upgrade.
- **Copy (D-M):** Growth and Premium are not for sale yet, so only Free pages are told to upgrade.
  A paid page at its limit reads "Remove one to add another."

## Enforcement, as built

Every check runs in a server action. The editor shows the same message before the owner tries,
but hiding a button is never the gate.

| Limit or gate | Free | Starter | Growth | Premium | Where it is checked |
|---|---|---|---|---|---|
| Photos | 1 | 10 | 25 | 50 | `checkPhotoAdd` in `lib/media/storeListingImage.ts` |
| Videos | 0 | 1 | 3 | unlimited | `checkVideoAdd` in `lib/actions/dashboard/updateListingVideo.ts` (link, upload start, upload finish) and the `listing_videos` insert policy |
| Common questions | 0 | 5 | unlimited | unlimited | `checkFaqAdd` in `lib/actions/dashboard/addListingFaq.ts` |
| Filter details | 3 | 10 | unlimited | unlimited | `checkAttributeCount` in `lib/actions/dashboard/updateListingAttributes.ts` (creator groups have their own caps) |
| Description | 300 chars | unlimited | unlimited | unlimited | `checkDescription` in `updateListingContent.ts` and `createListing.ts` |
| Social links | not included | included | included | included | `checkSocialLinks` in `updateListingContent.ts`, `checkLinkAdd` in `addListingLink.ts` |
| Products and services (combined) | 0 | 0 | 25 | unlimited | `marketplaceAllowances` in `lib/marketplace/entitlements.ts` |
| Events | 0 | 0 | 3 | unlimited | Ticket 106 (PR #255): `canAccess(tier, 'events')` in the create and submit actions, plus the live per-owner `eventQuotaFor` |
| Analytics | locked | 7 and 30 days | up to 12 months | up to 12 months | `resolvePeriod` in `lib/analytics/periods.ts` bounds the query itself, not just the chart |
| Review responses | | | | | `canAccess(…, 'review_response')` in `submitReviewResponse.ts` |
| AI writing help | | | | | `canAccess(…, 'ai_suggestions')` in `lib/ai/allowance.ts` and `generateSuggestion.ts` |
| Priority placement | | | | | Already read in SQL: `20260809000000_search_tier_tiebreak.sql` |

### Videos

- New table `listing_videos` (migration `20261020000000_tier_limits_videos.sql`): `kind`
  embed or file, `embed_url`, `file_path`, `position`, audit fields, RLS like `listing_media`.
- Backfilled once from `listing_details_business.video_embed_url` and `video_path`. The old
  columns stay for now; dropping them is a later migration after the founder approves.
- The insert policy also enforces the limit in the database. It counts through the
  `SECURITY DEFINER` function `owned_listing_video_count(listing_id)`, because a policy that
  queries its own table recurses ("infinite recursion detected in policy"). The function answers
  only for the listing's owner.
- Owners can always remove and reorder, even on a lower plan.
- `VideoSection.tsx` is a list editor (add link, upload, remove, move up and down).
  `EntityVideoSection.tsx` shows every video the plan allows.

### Analytics window

- Starter picks 7 or 30 days. Growth and Premium also get 90 days and 12 months.
- An unknown or not-included `?period=` falls back to 30 days, so a Starter page can never read
  Growth-depth data from the network response.
- 90 days shows weekly bars and 12 months shows monthly bars, so the chart fits on a phone.
- Free keeps the lock card.

## Downgrade: hidden, never deleted

- **Rule.** Caps apply only when the page is on a lower plan than the best one it has had.
  `listings.peak_tier` (new, same migration) holds that best plan. A trigger raises it whenever
  `tier` goes up and never lowers it. End users cannot write it. It was backfilled from the
  current tier and from past subscriptions.
- **Why peak_tier** (an addition to the plan): without it, a page that never paid but was loaded
  with platform content (seeds, imports) would lose content on its first read. With it, only a
  real move down trims anything.
- **Where.** At read time. The Stripe webhook already writes `listings.tier`; nothing in storage
  changes, so an upgrade brings everything back at once.
  - Public page (`lib/listings/entityPage.ts`): photos, videos, common questions, filter details,
    upcoming events on the host page, and the description (cut at a whole word, full text kept).
  - Owner editor (`lib/listings/hiddenContent.ts`): the same caps in the same order, so items the
    page leaves out are tagged "Hidden on your page".
  - `HiddenContentNotice` lists what is hidden in plain words and says nothing was deleted.
- **Tester free month.** A tester's free Growth month raises `peak_tier` to growth. When it ends,
  Growth-only extras (a 2nd and 3rd video, photos past 10) hide until the page is on Growth again.
  That is the intended behaviour, and the notice explains it.

## Typed errors

Every limit returns a plain message, never a raw 400 or 429:

- Free: "A video is part of Starter. Upgrade to add one to your page."
- Paid page at its limit: "Your plan includes up to 3 videos. Remove one to add another."

## Gates with nothing to guard yet

| Gate | Why it is not wired here |
|---|---|
| `service_menu_pricing` | Covered: Free and Starter cannot add services (`products: 0`) |
| `review_criteria` | Set per category; there is no owner surface |
| `editorial_eligibility`, `priority_support`, `dedicated_support`, `analytics_advanced` | Operational, or no feature exists |
| `teamMembers` (107), `coupons` (108), `booking` (109), `locations` (110), category exclusivity (111), spend panel (112), `sonnet_agents` | Ship with those tickets |

## Products and services after a downgrade

`[Decision — founder, 2026-10-28]` a page below Growth keeps its products and services, hidden
from the public, never deleted. They show again the moment the page is on Growth or Premium.

A storefront is a Growth feature, so this is all or nothing, not a count cap like photos.

- **RLS:** migration `20261028000000_marketplace_hide_below_growth.sql` recreates
  `marketplace_products_read` and `marketplace_services_read`. The public branch also requires the
  page to be on `growth` or `premium`. The owner branch is unchanged. This narrows access. Test:
  `tests/migrations/marketplace-hide-below-growth.test.ts`.
- **App layer:** the seven public paths read through the service client, which skips RLS, so each
  one filters on `STOREFRONT_TIERS` from `lib/marketplace/visibility.ts`: `/marketplace`,
  `/marketplace/products`, `/marketplace/services`, both detail pages (404 when hidden), `/vendors`
  and `/vendors/[slug]` (a non-vendor page with nothing visible 404s).
- **Owner:** `/dashboard/products` and `/dashboard/services` show the hidden notice ("Your plan
  doesn't include a storefront") and tag each hidden row "Hidden on your page". The public link
  is left off those rows.
- **Release:** the migration is GATE-DATA. Apply it to staging, then prod, before this PR merges.

## Known gaps

- **Premium to Growth with more than 25 items.** A page that drops from Premium to Growth keeps
  showing every product and service; nothing caps the public list at 25. No page can be on Premium
  while Premium is not for sale, so this must be built before Premium opens.
- **Status and deletion on the marketplace list pages.** `/marketplace`, `/marketplace/products`
  and `/marketplace/services` read through the service client and never checked
  `listings.status = 'published'` or `deleted_at`, which RLS does. Older than this ticket; worth a
  small follow-up.
- **Events in the editor notice.** The host page drops events past the cap, but the dashboard
  notice does not count them yet, because events are separate listings edited on their own page.

## Out of scope

- Building features that do not exist yet (107 to 112).
- AI quota enforcement (Ticket 104, which reads `aiQuota` from the same map).

## Release notes

- **Migrate before merge.** Apply `20261020000000_tier_limits_videos.sql` to prod after the flip,
  on the founder's word, before this PR merges. The new code reads `listing_videos` and
  `peak_tier`. Both reads fail soft, so a missing migration breaks nothing, but existing videos
  would not show until it runs.
- Rollback: the migration file lists the drop statements in a comment.

## Tests

- `tests/plan-checks.test.ts`: every limit's message on Free, Starter and Growth.
- `tests/listing-video-actions.test.ts`: link, upload start and finish, remove, move; limits per
  plan; foreign paths, bad files and idempotent retries.
- `tests/downgrade.test.ts`: `isDowngraded`, `shownLimits`, `capList`, `capDescription`,
  `hiddenLine`, and `hiddenContent` (approved photos only, finished questions only, creator
  groups excluded).
- `tests/analytics-periods.test.ts`: ranges per plan, fallback, weekly and monthly bars.
- `tests/migrations/tier-limits-videos.test.ts` (real Postgres): backfill runs once, shape
  checks, insert limits per plan, the count function answers only for the owner, remove and
  reorder stay open, anon reads published pages only, `peak_tier` backfill, trigger and write
  lock.
