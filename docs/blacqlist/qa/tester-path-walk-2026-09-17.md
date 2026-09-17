# Tester-path walk — 2026-09-17

**Purpose:** record what a tester actually meets on the invite path before invites go out Mon 21 Sep, screen by screen, with a verdict on each. Fix P0/P1 as small draft PRs; log P2 and move on.
**Roles walked:** owner and supporter (cohort is both, `[Decision — founder, 2026-09-16]`).
**Path under test:** `/sign-up?preview=<token>` → confirmation email → `/onboarding` → `/account` → search → listing → save → review → `/add-business` (owner) → `/dashboard` → `/forgot-password` → `/sign-in` through the gate.
**Verdict scale:** **P0** dead end or data loss · **P1** wrong copy, broken state, or a step the tester cannot complete without help · **P2** later.
**Privacy:** no email addresses in this file. The founder's test account is "the founder's test address".

---

## Part A — Step 2: founder's sign-up re-walk with #129

**Environment** `[Measured — Sentry event d642d345…, 2026-09-17 22:31 UTC]`: the walk ran on the **#129 branch-alias preview** `theblacqlist-git-fix-signup-error-clarity-the-blacql-ist.vercel.app` (project `theblacqlist-staging`, environment `preview`, release `b45338d`, Chrome 152 / macOS), against the **staging** Supabase project. Not localhost, and not production.

| # | Screen / step | What the founder saw `[Observed — founder, 2026-09-17]` | Verdict | Cause | Fix |
|---|---|---|---|---|---|
| A-1 | `/sign-up`, fresh address | Account created, "Check your inbox" panel, **confirmation email arrived** | ✅ pass | Staging rate limit at 30/h and the redirect pattern from Step 1 did their job | none |
| A-2 | `/sign-up`, same address again | Named error, not the blank failure of 09-14. Copy read *"That email is already registered. Sign in instead. Sign in instead"* | **P1** copy | `SIGN_UP_ALREADY_REGISTERED.error` already ended with "Sign in instead." and the page appended its own "Sign in instead" `<Link>` on the `already registered` match | **Fixed on #129** `d7e15ea`: error is now "That email is already registered." and the page supplies the single link. `tests/sign-up-errors.test.ts` asserts the sentence carries no CTA |
| A-3 | Confirmation link from the email | *"verification link expired very quickly and does not take me to onboarding"*, landed on `/sign-in` with the callback-failed message | **P1** broken state | See "Why the link looked expired" below. The token was consumed and the email **was** confirmed; only the browser handoff failed | **Draft PR #133** `2eac128`: sign-up confirmation moves to `token_hash` + `verifyOtp` via `/auth/confirm` (same pattern as password reset, commit `2a69ab6`). Needs the Supabase template change after deploy (Part C) |
| A-4 | Sign in afterwards | *"just takes me to the dashboard and I don't see where I can … do the onboarding"* | **P1** missing step | `/onboarding` was only reachable as the callback's default `next`. Nothing recorded completion; `signInAction` always sent the user to `/account` | **Draft PR #133** `0d8d5fe`: `setOnboardingRoleAction` stamps `user_metadata.onboarding_completed_at`; sign-in sends unstamped accounts to `/onboarding` once, then `/account` |
| A-5 | Welcome email (Resend) | Not mentioned by the founder; Sentry caught it | **P1 on preview · [Unknown] on production** | `Resend rejected "Welcome to The BLACQList": The theblacqlist.com domain is not verified` at `lib/email/resend.ts:61`, `handled = yes` `[Measured — Sentry, 2026-09-17]`. Fired by the fire-and-forget `void sendEmail(...)` in `signUp`; it never blocked sign-up. The **preview** Resend key belongs to an account where `theblacqlist.com` is not verified | Founder check: does the account behind the **Production** `RESEND_API_KEY` have `theblacqlist.com` verified at resend.com/domains? If yes, nothing to do for testers. If no, every tester's welcome email silently fails on prod → P1, verify the domain before Mon 21 |

**Why the link looked expired (A-3).** Sign-up calls `supabase.auth.signUp` with `emailRedirectTo: ${getAppUrl()}/auth/callback` and the Supabase project still uses the default "Confirm signup" template (`{{ .ConfirmationURL }}`, PKCE flow). `getAppUrl()` (`lib/env.ts`) returns `NEXT_PUBLIC_APP_URL`, which is set **only in Vercel Production**; on a preview it falls back to `https://${VERCEL_URL}`, the **deployment-hash** hostname. The founder signed up on the **branch-alias** hostname, so the PKCE `code_verifier` cookie lived on one host and the `?code=` exchange ran on another → `exchangeCodeForSession` failed → `/sign-in?error=auth_callback_failed`. Supabase had already burned the one-time token and marked the email confirmed, which is exactly why signing in then worked. The same class of failure hits **production** whenever the link is opened in a different browser or device than the one that signed up, or is prefetched by a mail scanner. `token_hash` + `verifyOtp` needs no per-browser cookie and only spends the token on the Continue click, which is why #133 moves sign-up onto it.

**Side finding (P2, not fixed this week).** `lib/actions/account/setOnboardingRole.ts` checks `.in('role', ['supporter', 'owner']).maybeSingle()` and returns early if a row exists. The trigger `on_auth_user_created_role` inserts a `supporter` row for **every** new auth user, so a tester who picks **owner** on `/onboarding` may never receive an `owner` role row. Nothing on the tester path reads that row this week (owner capability comes from listing ownership), so it is logged, not fixed. Fix later: update-or-insert the chosen role instead of returning early.

**Step 2 verdict:** sign-up itself passes. Three P1s found, three fixed in code (#129 `d7e15ea`, #133 `2eac128` + `0d8d5fe`); one founder check outstanding (A-5).

---

## Part B — Step 3: stranger walk, both roles

_Pending. Runs against the refreshed `preview/tester-week-all-four` once #133 is folded in. Each row: screen · what a stranger sees · verdict · fix._

### B-1 Owner path

| # | Screen | What a stranger sees | Verdict | Fix |
|---|---|---|---|---|
| | | | | |

### B-2 Supporter path

| # | Screen | What a stranger sees | Verdict | Fix |
|---|---|---|---|---|
| | | | | |

---

## Part C — Founder actions that fall out of this walk

| # | Action | When | Why |
|---|---|---|---|
| C-1 | Supabase → Authentication → Email Templates → **Confirm signup** → set the link to `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=signup&next=/onboarding` on **production** `ytlrnczevdnsfdzjbeqg` **and staging** `fmbohsloskqbmlwbzpjm` | **After** #133 is deployed, never before. Old template keeps working with new code; new template with old code sends testers to a 404 | Moves confirmation off PKCE so the link works from any browser or device |
| C-2 | Same screen → **Reset Password** template → confirm it already reads `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery` | Same sitting | Password reset has needed this since `2a69ab6`; the tester path includes `/forgot-password` |
| C-3 | resend.com/domains, signed in to the account whose key is in Vercel **Production** → `theblacqlist.com` shows **Verified** | Before Mon 21 | A-5 above. If not verified, testers' welcome emails fail silently |
| C-4 | Expect `/onboarding` once on your own next sign-in | After #133 deploys | Existing accounts have no `onboarding_completed_at` stamp; it is set the first time the role is saved |

---

## Known P2s carried in from the plan (log, do not fix this week)

- `/onboarding` promises "we'll personalize" and nothing personalises yet.
- `service_area_description` is captured and never displayed.
- Staging Supabase redirect allow-list still contains `https://*.vercel.app/**` (ops-log 09-17, Step 1 ②); tighten after tester week.
- `setOnboardingRoleAction` owner-row early return (Part A side finding).
