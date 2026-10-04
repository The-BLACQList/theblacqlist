# Pre-launch waitlist: handoff

Branch `feat/prelaunch-waitlist`, built in a separate worktree from `main` at
`69ec50bbe8832909fbf10a30cf3cf9d0cc3d9385`. The operator approved the scope on
2026-10-04 (plan step 3). The copy comes verbatim from the marketing OS, run
`run_20261002_36bd2a` (`outputs/capture.md`, `outputs/qualification.md`), and
from the `10_lifecycle/sequences/` drafts.

**Not done on this branch:**

- not pushed
- not deployed
- migration not applied to any database
- no email sent

Each of those is a founder gate, listed below.

---

## 1. What changed

| Req | Change | Files |
|---|---|---|
| R1 | Approved copy on `/coming-soon`: headline, supporter line, CTA, owner line and its fallback, Ally line, and the Instagram follow link. The "Launching soon" eyebrow is removed. The owner headline row is off by default (see §2). | `lib/marketing/coming-soon-copy.ts`, `app/coming-soon/page.tsx`, `app/coming-soon/instagram-follow-link.tsx` |
| R2 | UTM (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`) and referrer attribution. These are read in the browser at submit time and re-validated on the server: 1 to 100 plain characters, and the referrer keeps its origin only. Both forms send them, the coming-soon form and the tier `LaunchWaitlist` form. | `lib/marketing/launch-attribution.ts`, `lib/actions/subscribers/subscribeLaunch.ts`, `components/marketing/LaunchWaitlist.tsx` |
| R2 | Migration adding six nullable columns. **Not applied.** The code works without it: if PostgREST rejects an unknown column (`PGRST204` / `42703`), the insert is retried as `{ email, source }`. | `supabase/migrations/20261004000000_launch_subscribers_attribution.sql`, `lib/supabase/types.ts` |
| R3 | Optional "Which describes you?" field with two options, `owner` and `supporter`. Nothing is preselected, and an email alone still submits. On a repeat signup (`23505`), a missing role is filled in only where it was NULL. | `app/coming-soon/coming-soon-form.tsx` |
| R4 | Share button on the confirmation. It uses the native share sheet if the browser has one, otherwise copies the link; if copying fails it prints the URL. The link is `utm_source=share&utm_campaign=pre-launch`. When the person picked owner, the confirmation shows the owner body text. | `app/coming-soon/coming-soon-form.tsx` |
| R5 | `proxy.ts` keeps the four UTM parameters through the `/` → `/coming-soon` bounce and drops every other query parameter. `/privacy` is added to the gate allowlist. | `proxy.ts` |
| R6 | Five analytics events (§5). | `lib/analytics/constants.ts` |
| R7 | The consent wording is unchanged. A Privacy Policy link is added, along with the marker comment `// Consent wording pending Business Operations (R7)`. | `coming-soon-copy.ts`, `coming-soon-form.tsx` |
| W0 | "You're on the list" confirmation email, sent after the response (`next/server` `after`). It goes only to a **new** row whose source is `coming-soon`, and only when all three of these are true: the flag is `true`, the postal address is set, and the unsubscribe URL is set. Otherwise it returns `disabled` or `missing_config` and sends nothing. | `lib/email/sendLaunchConfirmation.ts`, `lib/email/templates/launch-w0-on-the-list.tsx` |
| W1, E1–E4 | Templates only. Nothing schedules or sends them. W1 has an A/B opening line. | `lib/email/launch-copy.ts`, `lib/email/templates/launch-*.tsx`, `launch-layout.tsx` |
| Export | `pnpm email:export` renders W0, W1-A, W1-B and E1–E4 to `email-previews/` (gitignored) as HTML and text, plus an `index.html`. It sends nothing and reads no `.env` file. | `scripts/export-launch-emails.tsx`, `package.json` |
| Asset | Email header lockup PNG. | `public/brand/blacqlist-lockup-email.png`, `scripts/generate-brand-assets.ts` |

**Form behavior change.** The coming-soon form now submits through
`onSubmit` + `startTransition(dispatch)` rather than `<form action>`. React 19
calls `form.reset()` after a form action, which un-checked the controlled
radio after a validation error. The e2e spec caught this.

## 2. Environment flags

All of these are server-only, and each is safe to leave unset.

| Variable | Default | Effect |
|---|---|---|
| `COMING_SOON_OWNER_HEADLINE` | `off` | `a` shows "You deserve a better page." and `b` shows "Your Black-owned business deserves a better Page." Any other value, or unset, shows no headline row. The value is read per request (`force-dynamic`). Leave it off until WF-020 `positioning_approval` is decided. |
| `LAUNCH_CONFIRMATION_EMAIL_ENABLED` | `false` | Only the exact string `true` turns W0 on. |
| `SENDER_POSTAL_ADDRESS` | empty | Required before W0 can send (CAN-SPAM). While it is empty, previews carry a red "POSTAL ADDRESS REQUIRED BEFORE SENDING" banner and W0 returns `missing_config`. |
| `LAUNCH_UNSUBSCRIBE_URL` | empty | Required before W0 can send. See open item 4. |
| `EMAIL_EXPORT_HOSTED_LOGO` | unset | Export script only. Set it to `1` to point previews at the hosted lockup instead of a local copy. |

The flags are documented in `.env.example`. They have not been added to
`environment-variable-checklist.md`; add them when they are set in Vercel.

## 3. Migration (GATE-DATA, founder decision)

`supabase/migrations/20261004000000_launch_subscribers_attribution.sql` does the following:

- Adds `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `referrer` and `signup_role`, all nullable text.
- Adds a role CHECK (`owner`, `supporter`) and length CHECKs: 100 for each UTM, 255 for the referrer.
- Leaves RLS and policies unchanged.
- Is idempotent.

**Order:** merging the code first is safe. Attribution is stored once the migration is applied.

**Apply (when approved):**

1. Run it on staging first, by pasting the file into the Supabase SQL editor.
2. Check: `select column_name from information_schema.columns where table_name='launch_subscribers';`
3. Sign up once on staging with `?utm_source=test`, then confirm the row has `utm_source='test'`.
4. Repeat on production.

**Rollback:** the `DROP COLUMN IF EXISTS` block in the migration header. This
deletes the attribution data, so it is its own GATE-DATA decision. The code
keeps working after a rollback.

**Tests:** the source-text checks in
`tests/migrations/launch-subscribers-attribution.test.ts` run everywhere. The
scratch-DB checks are skipped when no local Postgres is reachable, which was
the case for this run.

## 4. Deploy (GATE-DEPLOY, founder decision)

1. Review and merge `feat/prelaunch-waitlist` (it is local only and not pushed).
2. Check the Vercel preview:
   - `/coming-soon` copy
   - the role field
   - `/privacy` opens with the gate on
   - `/?utm_source=x&fbclid=y` lands on `/coming-soon?utm_source=x`
3. Leave `LAUNCH_CONFIRMATION_EMAIL_ENABLED` unset in production until open items 2 and 4 are closed (GATE-COMMS).
4. Promote. Apply the migration whenever GATE-DATA approves; the order does not matter.

## 5. Analytics events (R6)

| Event | Where | Properties |
|---|---|---|
| `coming_soon_view` | client, once per mount | landing UTMs and referrer origin, when present |
| `launch_list_submit_success` | server, new row only | `source`, UTMs and `role` when present. **Never the email.** |
| `launch_list_submit_error` | client | `error_type`: `missing_email`, `invalid_email`, `rate_limited`, `turnstile` or `server` |
| `launch_list_share_click` | client | `method`: `native_share` or `copy_link` |
| `instagram_follow_click` | client | `placement`: `footer` or `confirmation` |

## 6. Test results (2026-10-04, local, no database)

| Check | Result | Baseline at `69ec50b` |
|---|---|---|
| `pnpm typecheck` | pass | pass |
| `pnpm lint` | 0 errors, 2 warnings (both pre-existing) | same |
| `pnpm test` (Vitest) | 109 files passed, 21 skipped; 1986 tests passed, 197 skipped, 0 failed | 105 / 21 files; 1896 / 195 tests |
| `e2e/coming-soon.spec.ts` (Playwright, `COMING_SOON_MODE=true`, dummy Supabase) | 6 passed, 1 skipped | new |
| Verbatim copy check against the marketing OS sources | 90 strings, 0 missing | n/a |

The skipped e2e test is the success path, which writes a `launch_subscribers`
row. It runs with `E2E_LAUNCH_LIST_DB=1` against a local or staging database.
The success path is also covered by unit tests with a mocked client.

New test files:

- `tests/launch-attribution.test.ts`
- `tests/subscribe-launch-attribution.test.ts`
- `tests/launch-emails.test.ts`
- `tests/migrations/launch-subscribers-attribution.test.ts`
- `e2e/coming-soon.spec.ts`

Updated test files:

- `tests/coming-soon-gate.test.ts`: covers R5, replacing the old "drops the query string" test.
- `tests/subscribe-rate-limit.test.ts`
- `tests/form-input-preservation.test.ts`

## 7. Open items

1. **Consent wording (Q2, Business Operations).** The page keeps its current line. The capture.md draft is not approved. No legal wording was written.
2. **Postal address.** `SENDER_POSTAL_ADDRESS` has no value yet. W0 cannot send, and the previews show the banner, until one is set.
3. **Owner headline A/B.** This is pending WF-020 `positioning_approval`. The flag stays `off`.
4. **Unsubscribe.** No unsubscribe handler exists in the app, and no `List-Unsubscribe` header is set. The exported previews use Resend's `{{{RESEND_UNSUBSCRIBE_URL}}}`, which works only for Resend Broadcasts. Before W0 is enabled, decide between two options:
   - send W0 through a Resend Audience or Broadcast, or
   - build an unsubscribe route and set `LAUNCH_UNSUBSCRIBE_URL` to it.
5. **E1 parenthetical.** E1 body copy ends with "(source: decision log, measured 4 Sep 2026)." It is copied verbatim from the draft, and it reads as an internal evidence note. Decide in the marketing OS draft whether a reader should see it, then copy the result here.
6. **R3 wording.** The supporter option uses qualification.md's "I'm here to find businesses", not capture.md's earlier "I'm here to discover".
7. **Not built:**
   - The trust line is omitted because it was not approved.
   - The W1 visual slot is omitted because no asset exists.
   - W0 fires only for coming-soon rows; tier waitlist signups get none.
8. **`LaunchWaitlist` (tier forms).** The tier copy is unchanged. Its `source` radio still uses `<form action>`, so React 19 can reset it after an error. This is pre-existing and was not fixed here.
9. **SLA mismatch, documented and not fixed (per instruction).** Verification copy says "2–3 business days", but the stated SLA is 48h. The copy is at:
   - `lib/email/templates/verification-submitted.tsx:41`
   - `app/dashboard/pages/[entityId]/verification/page.tsx:93` and `:110`
   - `components/dashboard/VerificationUploadForm.tsx:106`
10. **`AGENTS.md`.** `next dev` writes an untracked `AGENTS.md` into the worktree. It was not committed.

## 8. Re-exporting the email previews

```bash
pnpm email:export                                   # local logo copy, banner if no address
SENDER_POSTAL_ADDRESS="..." pnpm email:export       # footer address, no banner
EMAIL_EXPORT_HOSTED_LOGO=1 pnpm email:export        # hosted lockup URL
```

The script writes `email-previews/*.html`, `email-previews/*.txt` and
`email-previews/index.html`. It reads the shell environment only, never a
`.env` file, and sends nothing.
