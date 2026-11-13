# 191: Updates feed — "What's new" (shipped on main as Happening now posts)

**Status:** Shipped — not by this ticket. While 184's PR 1B was in flight, main merged **Happening now posts** (PR #326, owner-experience round 2 part F, 2026-11-13), which covers this ticket's ground: time-boxed posts with a headline, body, image and button, shown in a band above the hero on every template, managed at `/dashboard/pages/[id]/posts`, capped per plan. 1B dropped its own updates feed and announcement bar and samples the merged feature instead. Nothing is left to build here; the deltas below are recorded, not planned.
**Follows:** —
**Area:** business pages, the owner dashboard
**Gates:** none (the migration `20261116000000_listing_posts.sql` shipped with #326)

## What shipped (#326)

- `listing_posts(id, listing_id, headline ≤80, body ≤200, image_path, button_label ≤30, button_url https, starts_at, ends_at ≤ starts_at + 30 days, status draft|active|ended)`; RLS: anonymous read of live posts on published listings.
- `lib/listings/happeningNow.ts` (`PublicPost`, `shownPosts`, `postClickHref`, `endsLabel`, …), `components/entity-page/HappeningNowBanner.tsx` above the hero, `/api/happening-now/[postId]` click counting, the discover strip, the owner manager (`PostsManager`, `HappeningNowCard`), `lib/actions/dashboard/posts.ts`.
- Caps `TierLimits.activePosts`: free 0 / Starter 1 / Growth 3 / Premium 5 (`activePostLimit`); flag `FEATURE_HAPPENING_NOW` (on in Preview, off in production until the flip).
- PR #327 (open) lists the posts in each paid plan's pricing copy.

## Deltas from the plan's shape (recorded; no decision needed now)

- The plan had an evergreen feed (posts stay until an optional `expires_at`, "See all" history) with a `pinned` post doubling as an announcement bar. Main's posts are time-boxed (≤ 30 days); the band shows the soonest-ending post first with the rest under "+N more"; there is no pin and no history. If an evergreen "What's new" or a pin is still wanted, that is a new ticket against `listing_posts`, not this one.
- The plan's caps were Starter 3 / Growth 10 / Premium ∞; main's are 1 / 3 / 5. Founder may revisit in the pricing review.

## 184 1B

- Registry id `happening-now` (`gate: { flag: 'happeningNow', limit: 'activePosts' }`, editor `/dashboard/pages/[id]/posts`), rendered by the example route above the template as the live route does; three sample posts per variant inside main's rules.
