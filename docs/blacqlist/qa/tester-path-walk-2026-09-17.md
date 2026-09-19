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
| A-5 | Welcome email (Resend) | Not mentioned by the founder; Sentry caught it. Founder then checked resend.com/domains: **only `send.theblacqlist.com` is Verified** (added 3 months ago); the apex `theblacqlist.com` is mid-setup on the add-domain screen `[Observed — founder screenshots, 2026-09-17]` | **P1, production too** → **✅ closed 2026-09-18**: `theblacqlist.com` **Verified** in Resend at 12:08 PM (DKIM TXT + both SPF CNAMEs Verified, sending on, receiving off) `[Observed — founder screenshot, 2026-09-18]`; records confirmed in public DNS `[Measured — dig, 2026-09-18]` | `Resend rejected "Welcome to The BLACQList": The theblacqlist.com domain is not verified` at `lib/email/resend.ts:61`, `handled = yes` `[Measured — Sentry, 2026-09-17]`. Fired by the fire-and-forget `void sendEmail(...)` in `signUp`; it never blocked sign-up. The **preview** Resend key belongs to an account where `theblacqlist.com` is not verified | **C-3 below.** `lib/email/resend.ts:15` sends from `RESEND_FROM_EMAIL`, defaulting to `noreply@theblacqlist.com` (apex). DNS is at **Bluehost** (`ns1/ns2.bluehost.com`) `[Measured — dig, 2026-09-17]`. The existing subdomain's records sit at `send.send.theblacqlist.com` (MX + SPF) and `resend._domainkey.send.theblacqlist.com` (DKIM), so the three apex records Resend asks for (`resend._domainkey` TXT, `rsend` CNAME, `send` CNAME) collide with nothing. Plan B if DNS stalls: set `RESEND_FROM_EMAIL` to `@send.theblacqlist.com` in Vercel (env change, GATE-DEPLOY) |

**Why the link looked expired (A-3).** Sign-up calls `supabase.auth.signUp` with `emailRedirectTo: ${getAppUrl()}/auth/callback` and the Supabase project still uses the default "Confirm signup" template (`{{ .ConfirmationURL }}`, PKCE flow). `getAppUrl()` (`lib/env.ts`) returns `NEXT_PUBLIC_APP_URL`, which is set **only in Vercel Production**; on a preview it falls back to `https://${VERCEL_URL}`, the **deployment-hash** hostname. The founder signed up on the **branch-alias** hostname, so the PKCE `code_verifier` cookie lived on one host and the `?code=` exchange ran on another → `exchangeCodeForSession` failed → `/sign-in?error=auth_callback_failed`. Supabase had already burned the one-time token and marked the email confirmed, which is exactly why signing in then worked. The same class of failure hits **production** whenever the link is opened in a different browser or device than the one that signed up, or is prefetched by a mail scanner. `token_hash` + `verifyOtp` needs no per-browser cookie and only spends the token on the Continue click, which is why #133 moves sign-up onto it.

**Side finding (P2, not fixed this week).** `lib/actions/account/setOnboardingRole.ts` checks `.in('role', ['supporter', 'owner']).maybeSingle()` and returns early if a row exists. The trigger `on_auth_user_created_role` inserts a `supporter` row for **every** new auth user, so a tester who picks **owner** on `/onboarding` may never receive an `owner` role row. Nothing on the tester path reads that row this week (owner capability comes from listing ownership), so it is logged, not fixed. Fix later: update-or-insert the chosen role instead of returning early.

**Step 2 verdict:** sign-up itself passes. Three P1s found, three fixed in code (#129 `d7e15ea`, #133 `2eac128` + `0d8d5fe`); the fourth (A-5, Resend apex domain) closed by the founder on 2026-09-18 via C-3. **All Step 2 findings resolved.** One proof still to collect: a fresh sign-up showing "Welcome to The BLACQList" as Delivered in Resend → Emails (falls out of Step 3 naturally).

---

## Part B — Steps 3b/4: walk of the whole tester path, both roles

**Environment:** the refreshed `preview/tester-week-all-four` at `457114f` (#121 #125 #126 #127 #129 #130 #131 #133) on Vercel project `theblacqlist-staging`, against the **staging** Supabase project, in a private window with the invite token. Walked by the founder as the stranger, following Walk A (supporter), Walk B (owner), and the admin check from `ops/tester-week/send-readiness-runbook-2026-09-18.md` Step 4. Two fresh addresses; neither is recorded here. `[Observed — founder, 2026-09-19]`

**Result:** both paths complete end to end. One P1 on the supporter path (B-2 step 10), one P1 on the admin side (B-3), one copy addition to the owner invite (B-3). All three are built and folded into the preview at `00e1130`; the founder re-checks only those three before the merge batch.

### B-1 Owner path (Walk B)

| # | Screen | What a stranger sees | Verdict | Fix |
|---|---|---|---|---|
| 1 to 6 | `/sign-up?preview=<token>` → "Check your inbox" → duplicate address → confirmation email → link → sign in | Same as the supporter path below, steps 1 to 6 | ✅ confirmed | none |
| 7 | `/onboarding`, pick **owner** | Lands on `/account` | ✅ confirmed | none |
| 8 | `/add-business`, submit a test business | Success state; the business appears on `/dashboard` as pending | ✅ confirmed | none |
| 9 | `/dashboard` | Renders with the pending business, no dead links | ✅ confirmed | none |
| 10 | Admin, founder's real account: `/admin/entities` | The test business (listing `17f82a73-a814-4217-b38e-b34c269deec8` on staging) is visible in the pending queue. Not approved | ✅ confirmed, but see B-3 F-2 | none here |

Founder's words: *"Walk B Confirmed"*.

### B-2 Supporter path (Walk A)

| # | Screen | What a stranger sees | Verdict | Fix |
|---|---|---|---|---|
| 1 | `/sign-up?preview=<token>` | Sign-up form, not the coming-soon page | ✅ confirmed | none |
| 2 | Create account, fresh address | "Check your inbox" panel | ✅ confirmed | none |
| 3 | Same address again | "That email is already registered." with one **Sign in instead** link | ✅ confirmed (A-2 fix holds) | none |
| 4 | Confirmation email | Arrives | ✅ confirmed | none |
| 5 | Confirmation link | Behaves as the runbook warned for a preview (C-1 template change waits on deploy); email confirmed either way | ✅ as expected | C-1 after deploy |
| 6 | Sign in | `/onboarding`, not `/account` (#133) | ✅ confirmed | none |
| 7 | Pick **supporter**, two questions | Lands on `/account` | ✅ confirmed | none |
| 8 | Search, open a listing | Results load, listing renders | ✅ confirmed | none |
| 9 | Save the listing | Save state flips, visible in the saved list | ✅ confirmed | none |
| 10 | Leave a review | Opened listing A (Trill Burgers), opened listing B (Frenchy's Chicken), pressed **Back** (URL showed A), wrote and submitted a review. **The success message named B and the row was written against B.** Founder: *"The URL was for trill burgers, the review submitted to frenchy's chicken."* | **P1** wrong record written (F-1) | **Draft PR #134** `13237b5` (`fix/review-form-listing-key`): `key={entity.id}` on the template outlet, the review disclosure, and the form, so a Back-restored page can never keep the previous listing's form instance; the action now returns the name of the listing it actually validated and the success copy prints that, never the prop. New `e2e/review-form-listing-identity.spec.ts` (A → B → Back → hidden `listing_id` equals A) and `tests/review-form-listing-key.test.ts`. The stray review is staging data, no production cleanup |
| 11 | Sign out, `/forgot-password` | Form loads, email arrives, link opens the Continue page | ✅ confirmed | none |
| 12 | `/sign-in?preview=<token>` | Loads through the gate (#126), signs in, lands on `/account` | ✅ confirmed | none |

Founder's words: *"everything else on walk A confirmed."*

### B-3 Admin side and the invite renders (Walk C)

| # | Screen | What the founder saw | Verdict | Fix |
|---|---|---|---|---|
| 1 | `/admin` overview and the admin sidebar, with the test business pending | *"I don't see any notifications either on the dashboard or on the sidemenu for pending business reviews."* The count existed (the "Pending entities" stat card read a non-zero number) but it was one figure among five cards and appeared nowhere else. Staging held 3 pending listings and 1 pending claim at the time `[Observed — staging service query, 2026-09-19]`, so this is display, not the query | **P1** for the week: A-13 (approve tester businesses as they arrive) depends on the founder noticing (F-2) | **Draft PR #135** `c1c948d` (`feat/admin-pending-signals`): one `server-only` count helper feeds both the overview and the sidebar (entities with `deleted_at IS NULL`, claims, verifications, reports, receipts, reviews in intake); amber count pills next to the sidebar items, hidden at zero; a priority alert above the stat grid, "N businesses are waiting for review" with one link to `/admin/entities?status=pending`, hidden at zero; `revalidatePath('/admin', 'layout')` in the five approve/reject/moderate actions so the pill drops as soon as the founder acts. `tests/admin-pending-counts.test.ts` (18) and one new read-only e2e in `e2e/admin-entities.spec.ts` |
| 2 | `/admin/email-preview`, audience **Owner** | Renders, but the founder wants it to state the compensation: *"1 month free subscription of theblacqlist of any tier."* Details that stay out of the email: good for any tier at any time; use now or hold until the other tiers are for sale | Copy addition (F-3) | **Commit `28d0f15` on #131** (`feat/tester-invite-supporter-variant`): owner variant gains, after step 5, *"As a thank you for testing, you get one month of The BLACQList free on any tier. Use it as soon as plans open, or hold it until the tier you want is available."* Supporter variant unchanged. `tests/tester-invite-email.test.ts` asserts the sentence on owner and its absence on supporter; trial/tour/personalise guards still pass |
| 3 | `/admin/email-preview`, audience **Supporter** | No pause reported | ✅ | none |

### Re-check on the refreshed preview (`00e1130`), three items only

Preview now holds #121 #125 #126 #127 #129 #130 #131 (with `28d0f15`) #133 #134 #135. Typecheck clean, 1373 unit tests pass `[Measured — local, 2026-09-19]`; `e2e/admin-entities.spec.ts` 7/7 and `e2e/review-form-listing-identity.spec.ts` pass locally against staging `[Observed — 2026-09-19]`.

| # | Do | Expect | Status |
|---|---|---|---|
| R-1 | Signed in as a supporter: open listing A, open listing B, Back, leave a review | Success text names A; the review sits on A | `[Unknown]` until the founder re-walks |
| R-2 | Signed in as admin: `/admin` with the test business still pending | Amber alert above the stat cards, "N businesses are waiting for review" linking to the pending queue; count pills on Entities and Claims in the sidebar; pills still present on `/admin/entities` | `[Unknown]` until the founder re-walks |
| R-3 | `/admin/email-preview`, audience Owner | The free-month sentence sits right after step 5; supporter render does not have it | `[Unknown]` until the founder re-walks |

Note for R-2: on this preview, approving an entity also emails the owner (`EntityApprovedEmail`, from one of the tester-week PRs). The alert copy does not promise or deny an email for that reason. Do not approve the test business during the re-check.

---

## Part C — Founder actions that fall out of this walk

| # | Action | When | Why |
|---|---|---|---|
| C-1 | Supabase → Authentication → Email Templates → **Confirm signup** → set the link to `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=signup&next=/onboarding` on **production** `ytlrnczevdnsfdzjbeqg` **and staging** `fmbohsloskqbmlwbzpjm` | **After** #133 is deployed, never before. Old template keeps working with new code; new template with old code sends every tester to `/sign-in?error=auth_callback_failed` without confirming anything | Moves confirmation off PKCE so the link works from any browser or device |
| C-2 | Same screen → **Reset Password** template → confirm it already reads `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery` | Same sitting | Password reset has needed this since `2a69ab6`; the tester path includes `/forgot-password` |
| C-3 | **Finish adding the apex `theblacqlist.com` in Resend.** At Bluehost → Domains → `theblacqlist.com` → DNS / Zone Editor add the three records exactly as Resend shows them (copy buttons): TXT `resend._domainkey` = the `p=MIGfMA…` value; CNAME `rsend` = the `rsend.…mta.net` target; CNAME `send` = the `send.…mta.net` target. Back in Resend click **"I've added the records"**, then wait for the Domains list to show `theblacqlist.com` **Verified** (minutes to a few hours; "Verify" can be re-clicked). Confirm with one fresh sign-up: Resend → Emails shows "Welcome to The BLACQList" **Delivered** from `noreply@theblacqlist.com`. Also read (not the value) Vercel → Settings → Environment Variables: if `RESEND_FROM_EMAIL` exists in Production, it overrides the default sender | **✅ Done 2026-09-18 12:08 PM** (Domain added 11:59, DNS verified 12:06, Domain verified 12:08) | A-5 above. Only `send.theblacqlist.com` is verified today; the app sends from the apex, so every tester's welcome email fails silently until this is done or the sender is switched |
| C-4 | Expect `/onboarding` once on your own next sign-in | After #133 deploys | Existing accounts have no `onboarding_completed_at` stamp; it is set the first time the role is saved |

---

## Known P2s carried in from the plan (log, do not fix this week)

- `/onboarding` promises "we'll personalize" and nothing personalises yet.
- `service_area_description` is captured and never displayed.
- Staging Supabase redirect allow-list still contains `https://*.vercel.app/**` (ops-log 09-17, Step 1 ②); tighten after tester week.
- `setOnboardingRoleAction` owner-row early return (Part A side finding).
