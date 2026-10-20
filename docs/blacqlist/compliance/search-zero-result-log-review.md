# Privacy Review: Zero-Result Search Log and Map Place Lookup (Ticket 142)

> **Disclaimer:** This output is informational and does not constitute legal advice. Requirements vary by jurisdiction, business type, and product specifics. Consult a licensed attorney for guidance applicable to your situation before relying on any of the following.

_Reviewed: 2026-10-20 · Reviewer: Privacy agent · Audience: the founder, and counsel if needed · Status: **Draft. Needs the founder's sign-off before PR 7 merges.**_

Jurisdictions assumed: the United States (California users in scope under CCPA/CPRA), with EU visitors possible because the site is not geo-blocked. This matches the scope in `docs/blacqlist/legal/privacy-terms-compliance-review.md`.

---

## What changes

Ticket 142 touches search data in two places.

### 1. The zero-result search log

|                                 | Before (live today)                                                            | After (PR 7)                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Table                           | `analytics_events` (event `search_performed`), which the admin page never read | `search_events`, the table the admin page reads                                                |
| Which searches                  | **Every** `/api/search` call, including searches that found results            | Only searches that found **nothing**, on page 1, with words in the box, where every filter ran |
| What is stored                  | Raw query (no length cap, no filtering), result count, city id, category id    | Query trimmed to 200 characters, result count, city id, category slug, time                    |
| Email or phone typed in the box | Stored as typed                                                                | **Not stored.** The whole search is skipped                                                    |
| User id, IP, coordinates        | Not stored                                                                     | Not stored. A test fails if any of them is ever added (`tests/zero-result-log.test.ts`)        |
| Kept for                        | No limit                                                                       | **90 days.** A nightly job (`purge-search-events`, 03:30 UTC) deletes older rows               |
| Who can read it                 | Service role only                                                              | Service role only (RLS on, no policies). The admin page reads it on the server                 |

Net effect: we collect much less search data than we do today, and we keep it for a fixed time.

### 2. The map place lookup

`GET /api/places/lookup?q=` answers where on the map the words point. It runs only when someone presses Enter in the map search box.

- Our own city list answers first ("Atlanta", "atl", "decatur ga"). Nothing leaves our servers for these.
- Anything else goes from **our server** to OpenStreetMap's Nominatim service (run by the OpenStreetMap Foundation, based in the UK). Nominatim gets the words, our app's name and contact address (its usage policy requires these), and our server's IP. It does **not** get the visitor's IP, cookies, account, or location.
- We log nothing: not the words, not the answer, on success or failure. The per-IP rate limit uses the same ledger as every other limit on the site (`rate_limit_counters`, short-lived).
- Answers are cached by Vercel's CDN for a day, and by Next's data cache for seven days, keyed on the words. The cache holds the place, not who asked.

---

## Check against the Privacy Policy

| Policy text                                                                                                 | Where                   | Does PR 7 match?                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Usage data (search queries, listings viewed, saves, clicks on calls-to-action), stored in anonymized form" | `PrivacyPolicy.tsx:105` | **Yes, and better than today.** No user id or IP is kept, and email-like and phone-like searches are dropped. A search for a business name is not personal data in itself                                                    |
| "Your IP address is used transiently ... We do not retain your raw IP address"                              | `PrivacyPolicy.tsx:104` | **Yes.** The log never sees the IP. The rate limiter is unchanged                                                                                                                                                            |
| "Anonymized analytics data ... will not be retroactively removed"                                           | `PrivacyPolicy.tsx:460` | **Yes.** The 90-day purge removes more than the policy promises, never less                                                                                                                                                  |
| Service provider list (Supabase, Vercel, Resend, Sentry, Stripe, Anthropic, Cloudflare Turnstile)           | `PrivacyPolicy.tsx` §6  | **Gap. See F3.** Nominatim is not listed. Listing addresses already go to Nominatim when they are geocoded (`lib/listings/geocode.ts`), so this gap predates PR 7, but PR 7 is the first time a **visitor's** words go there |

---

## Findings

| #   | Finding                                                                                                                                                                                                        | Rating     | State                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | A visitor could type something personal that is neither an email nor a phone number (a home street address, a person's name) into the search box. If it finds no business, that text is kept for up to 90 days | **Low**    | Accepted risk. Rows have no user id, IP or coordinates, so the text can't be tied back to a person through us. The 200-character cap and the 90-day purge limit the exposure. Mitigated as far as it can be without dropping the log                                                                                                                                                                                                                                                                                                    |
| F2  | Old `search_performed` rows already in `analytics_events` (every `/api/search` call so far, raw text, no cap) stay after PR 7, because the code no longer writes them but nothing deletes them                 | **Medium** | **Required, not yet done.** Deleting them is a prod data change, so it needs the founder's word. Suggested: one delete of `event_name = 'search_performed'` rows on prod, after the flip, run with PR 7's prod migration. The admin page never read them, so nothing breaks                                                                                                                                                                                                                                                             |
| F3  | Nominatim (OpenStreetMap Foundation) gets visitor-typed place words from our server and is not named in Privacy Policy §6                                                                                      | **Medium** | **Required, not yet done.** Add a row to the §6 table: "OpenStreetMap (Nominatim): turns a place name or ZIP typed into the map search into a map location. Gets only the words, from our server." Under CCPA this is a service-provider style disclosure. Under GDPR it is a transfer to a UK processor, which the UK adequacy decision covers. Consult attorney on whether a policy-change notice is needed for a new provider row. **Note: verify against the current UK adequacy decision, since adequacy decisions get reviewed.** |
| F4  | A cached CDN answer is keyed on the words. Someone could learn that a place was searched recently by timing a cache hit                                                                                        | **Low**    | Accepted. The answer is a public place (a town or ZIP), and the cache does not record who asked                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| F5  | The 90-day job depends on pg_cron being enabled on prod. It was applied and checked on staging on 2026-10-20 (migration `20261022000000`)                                                                      | **Low**    | **Unverified on prod.** Confirm `cron.job` has `purge-search-events` right after the prod migration runs                                                                                                                                                                                                                                                                                                                                                                                                                                |
| F6  | The zero-result log could reveal a search that a signed-in person ran, if the admin matched timestamps against another log                                                                                     | **Low**    | Accepted. No other table records a person's searches, and `search_events` has no session or user column in use                                                                                                                                                                                                                                                                                                                                                                                                                          |

No High findings.

---

## Hand-offs

→ **Backend**: after the flip, on the founder's word, delete `analytics_events` rows where `event_name = 'search_performed'` on prod, and confirm the `purge-search-events` cron job exists (F2, F5).
→ Ticket: `docs/blacqlist/tickets/142-search-phase-2.md` (rollout notes)

→ **Docs**: add an OpenStreetMap (Nominatim) row to the Privacy Policy §6 provider table, with counsel's view on notice (F3).
→ Ticket: a follow-up to `docs/blacqlist/tickets/142-search-phase-2.md`, to be numbered when the founder approves the wording

---

## Sign-off

- [ ] Founder approves F1, F4 and F6 as accepted risks
- [ ] Founder decides on F2 (delete the old rows on prod after the flip)
- [ ] Founder decides on F3 (policy row now, or with the next policy update)
- [ ] F5 checked after the prod migration
