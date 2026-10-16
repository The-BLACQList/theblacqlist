# Ticket 139: Post the updated Privacy Policy, Terms and Cookie Policy (AI help, site import, Turnstile)

**Phase:** V1.5 · **Priority:** P0 for real AI in prod · **Status:** In review (counsel)
**Depends on:** #239 (street address and owner name removed before text reaches the AI)
**Gates:** counsel sign-off on the page text and the email. The founder merges, and the founder runs the send script. No migration.
**Source text:** `docs/blacqlist/legal/ai-and-site-import-policy-update-2026-10.md`
**Decision record:** on 2026-10-16 the founder chose to build now, then approved the text on their own word and merged it the same day, with counsel review to follow. The update was posted Fri Oct 16, the email goes out by the end of Mon Oct 19, and it takes effect Mon Nov 2, 2026. Street address and owner name are removed before sending (#239). The "Black-owned only" wording (F13) and the Vercel Analytics row (F14) are folded in. The AI safety-plan exception is approved. Only registered accounts get the email.

---

## Why

Privacy §10 and Terms §13 promise registered users an email at least 14 days before a material change takes effect. Real AI help for owners (#235, #238, ticket 128) sends owner text to Anthropic, which the current policy does not name. Cloudflare Turnstile has been live since 2026-10-01 and is not named either. Real AI stays off in prod until the new text is in effect.

## What it does

- `/privacy`, `/terms` and `/cookies` keep the current text until Nov 2, with a short banner: "We're updating our {doc} on November 2, 2026. See what's changing."
- `/privacy/upcoming`, `/terms/upcoming` and `/cookies/upcoming` show the new text early with a "takes effect" banner. They are noindex and redirect (308) to the main page once the update is in effect.
- Each page switches to the new text on its own at midnight Eastern, Nov 2 (re-rendered hourly). No deploy is needed on the day.
- All dates live in `lib/legal/policyUpdate.ts`. If the email slips, move all three dates by the same number of days.
- The coming-soon gate lets all six pages through.
- The notice email (`lib/email/templates/policy-update-notice.tsx`) and `scripts/ops/send-policy-notice.ts`.

## The send script

- Dry run by default. It prints only counts.
- A real send needs `--send --confirm=<count>`, and the count must match what the dry run printed.
- It refuses to send after the end of Oct 19 Eastern (`POLICY_UPDATE.sendBy`).
- Recipients are accounts with a confirmed email, with duplicate addresses dropped. Waitlist subscribers are not emailed.
- Safe to re-run. It records user ids (never addresses) in a temp progress file and skips them.
- It never prints or saves an email address.

## Acceptance criteria

- Given today is before Nov 2, when I open /privacy, then I see the current text and the banner linking /privacy/upcoming.
- Given today is before Nov 2, when I open /privacy/upcoming, then I see the new text, "Takes effect: November 2, 2026", and a link back to the current version.
- Given it is Nov 2 or later, when I open /privacy, then I see the new text with no banner, and /privacy/upcoming redirects to /privacy.
- The same holds for /terms and /cookies.
- Given the coming-soon gate is on, when a visitor opens any of the six pages, then the page loads.
- Given no `--send`, when the script runs, then nothing is sent and only counts print.
- Given `--confirm` does not match, or the window has closed, or `RESEND_API_KEY` is missing, when `--send` runs, then it stops with an error and sends nothing.

## Tests

- `tests/policy-update.test.ts`: the switch boundary, subtitle, 14-day gap, send-by window, email links, and the script's no-address and dry-run rules.
- `tests/coming-soon-gate.test.ts`: the six legal paths pass the gate.
- `tests/email-copy-style.test.ts`: the new template has no em dashes.

## QA notes

- Previews read STAGING data and run on today's date, so a Preview shows only the "before" state. The "after" state is covered by the tests.
- Check the banner and both versions at 390 and 1440.
- Send the email to the founder's own address first (from Resend's dashboard or a one-off test), never by running the script against prod.

## Not in scope

- Emailing waitlist subscribers.
- Turning on real AI in prod. That happens no earlier than Nov 2, by the founder.
