# Ticket 123: Earned weekly Featured

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready
**Depends on:** none
**Gates:** GATE-DATA (migration on staging, then prod; flipping the flag clears the 27 seeded Featured flags), GATE-DEPLOY

---

## Why

Featured was a flag set by seed data, and some copy implied it came with a paid plan. The founder decided on 2026-10-05 that Featured is earned, not bought. Each week it goes to the one listing per listing type with the most positive activity.

Founder answers:
- One winner per **listing type**.
- What counts: saves, reviews rated 4 or 5 stars, shares, and taps on website, call and directions.

## How it works

- **Buckets.** Each listing competes in one bucket, the most specific that fits:
  1. its own `entity_type` when that isn't `business` (restaurant, vendor, event);
  2. otherwise Restaurant, Professional or Creative by category, or Services by location type, using the discover Type chip mapping in `lib/listings/type-shortcuts.ts`;
  3. otherwise Business.

  Jobs sit out while Jobs is covered. `lib/featured/buckets.ts` builds the rules and the SQL receives them as an argument, so the mapping lives in one place.
- **Score** over the last full Monday to Sunday week, Eastern time. Weights live in the one-row `featured_weights` table:

  | Activity | Points |
  |---|---|
  | Save, still standing | 3 per person |
  | Published review rated 4 or 5 | 5 per reviewer |
  | Share | 2 per person or session |
  | Website, call or directions tap | 1 per person or session (all three together count once) |

- The owner's own activity never counts.
- Points from anonymous sessions are capped at 4 per listing per week. That's below the 5-point minimum, so anonymous activity alone can't win.
- A bucket's best score must reach 5 or nobody wins that bucket that week.
- Ties go to the higher all-time `activity_score`, then to whoever published first, then to the lower id.
- **`award_weekly_featured(p_week_start, p_buckets, p_excluded_types)`** is SECURITY DEFINER and runs as service_role only. In one transaction it scores, clears every `is_featured`, sets the winners, writes `featured_awards` and logs the run in `featured_runs`.
  - Rerunning the same week gives the same result.
  - An older week than the latest run is refused.
- **Cron.** `/api/cron/featured` runs at `0 9 * * 1` (Monday, about 5am Eastern) and shares `lib/cron/auth.ts` with the expiry cron. It does nothing while `FEATURE_EARNED_FEATURED` is off, which is the default in production.
- The migration also drops `featured_collection_placement` and `homepage_featured_placement` from `plans.features`, and the matching Stripe gates are removed.

## Acceptance criteria

- Given a week of activity, when the cron runs, then each bucket's top listing at or above 5 points has `is_featured = true`, and every other listing has `false`.
- Given the same week is run twice, then the winners and awards are the same.
- Given an owner saves, reviews, shares or taps their own listing, then none of it counts.
- Given only anonymous shares and taps, then the listing cannot win.
- Given an email tap, or a tap with no kind, then it doesn't count.
- Given a listing that isn't live (unpublished, deleted, or flagged), then it can't win.
- Given an anonymous visitor, then they can read awards for live listings and nothing in `featured_weights` or `featured_runs`.
- Given the flag is off, then the cron answers `skipped` and writes nothing.

## Contact tap tracking

`lib/analytics/contactTap.ts` sends website, call and directions taps with `properties { kind, source }`:

| Surface | Event |
|---|---|
| Hero button | `hero_cta_click` |
| Quick-action bar (phone, directions, button) | `action_bar_cta_click` |
| At a Glance (address, phone, website) | `cta_click` with entity_type `listing` |

Email and `#visit` links send nothing. The owner dashboard's CTA count already reads all three event names, so owners start seeing real numbers.

## QA notes

- Migration test: `tests/migrations/earned-featured.test.ts` (12 cases). Run it with `MIGRATION_TEST_DB_URL` pointing at a scratch Postgres. Never point it at staging or prod.
- Unit tests: `tests/featured-buckets.test.ts`, `tests/featured-award.test.ts`, `tests/contact-tap.test.ts`.
- Staging check, with the founder's go-ahead:
  1. Fire saves, shares and taps for a test listing.
  2. Call `/api/cron/featured` with the cron secret.
  3. Confirm there's one winner per bucket and the award rows exist.
  4. Confirm taps reach `analytics_events` with a `kind`.
- Founder action: add `/api/cron/featured` to the Vercel firewall Bypass rule, next to `/api/cron/expiry`. Bot Protection blocks crons otherwise.
