# Ticket 234: Record Where Sign-Ups Come From

**Status:** PR open (`feat/signup-source`). Merging needs the founder's OK (GATE-DEPLOY).

## Why

Next-actions 2026-11-20, item 2. Before launch, every new account should say where it came from, so the weekly numbers (item 4) can tell which outreach works. Today a sign-up records only `flyer` or `invite`, and after the coming-soon gate comes down every public sign-up would be counted as `invite`. The founder said "go for both" (items 2 and 6) in Software's session on 2026-11-20.

## What Is Kept

- **Campaign tags** from the link a visitor first followed: `utm_source`, `utm_medium`, `utm_campaign`. Lowercased, limited to `[a-z0-9._~+-]`, 64 characters at most.
- **The referring site's host name only** (`instagram.com`), from the `Referer` header. Never the full address, which can carry search terms or a profile path. Our own hosts don't count.
- **First touch wins.** The first outside arrival is kept for 30 days and later visits don't replace it.

## Changes

1. `lib/analytics/first-touch.ts` (new, pure, Edge-safe): cleaning, the referrer host, and the `bl_ft` cookie format `v1|source|medium|campaign|referrer`. Reading the cookie cleans every field again, so a tampered cookie can't write anything outside the safe alphabet.
2. `proxy.ts`: a signed-out `GET` page visit (not `/api`) with tags or an outside referrer, and no `bl_ft` yet, gets the cookie (httpOnly, SameSite Lax, 30 days) on whatever the proxy answers. That includes the coming-soon bounce, which drops the query string the tags came in on.
3. `lib/actions/auth/signUp.ts`:
   - Saves `signup_utm_source`, `signup_utm_medium`, `signup_utm_campaign` and `signup_referrer` in user metadata, only when present.
   - Adds `utm_source`, `utm_medium`, `utm_campaign` and `referrer` to the `sign_up_completed` event properties. Still no user id and no email.
   - `signup_source` is `flyer`, else `invite` while `COMING_SOON_MODE` is on, else `public` (new). Before this, every post-launch sign-up would have read `invite`.
4. **Privacy Policy** section 2, "Information Collected Automatically": a line saying what's kept and why, and that it's never used for advertising. `PRIVACY_PROVIDERS_UPDATE` moves to November 20, 2026.
5. **Cookie Policy** section 2: a new "Where You Came From" group naming `bl_ft` and `bl_src`, which was never listed. The page's date moves from October 16 to November 20, 2026 (`COOKIE_POLICY_UPDATE`).

Both dates assume this goes live on 2026-11-20. Change them if it merges later. As with ticket 230, no notice email is planned (GATE-COMMS).

## Not Changed

- Tester one-tap links still record `signup_source: 'tester_link'` (`lib/tester/redeem.ts`). Testers are left out of the KPIs.
- No backfill: accounts made before this have no tags.
- No consent banner. The cookie is first-party, never shared, and read only on sign-up. [Needs professional review] alongside the rest of the policy text.

## Tests

- `tests/signup-source.test.ts`:
  - cleaning and referrer rules, including our own hosts and junk;
  - the cookie round trip and tampered values;
  - the proxy stamping tags, a referrer and the coming-soon bounce;
  - first touch wins;
  - nothing for signed-in visitors, API calls or posts;
  - sign-up saving the fields to metadata and the event;
  - `public`, `invite` and `flyer` labels, and a made-up `bl_src` ignored.
- `tests/sign-up-errors.test.ts`: the existing `invite` case now sets `COMING_SOON_MODE`.

## Reading It Later

- Weekly sign-ups by source: `analytics_events` where `event_name = 'sign_up_completed'`, grouped by `properties->>'source'`, `properties->>'utm_source'` and `properties->>'referrer'`. Item 4's weekly report reads this.
