# Auth + Account Onboarding — Implementation Report

**Date:** 2026-05-11
**Checks:** `pnpm tsc --noEmit` → ✅ zero errors · `pnpm lint` → ✅ zero errors

---

## What Was Built

Complete authentication and account onboarding foundation for The BLACQList. All routes, server actions, and account pages are in place. DB operations on `profiles` and `user_roles` are gracefully no-op until schema migrations run.

---

## Files Created

### Server Actions

| File                                       | Purpose                                                                                                                                                                                                                           |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/actions/auth/signIn.ts`               | Calls `supabase.auth.signInWithPassword`; validates `next` param is same-origin; returns typed `SignInState` with field-level error targeting (`email` / `password` / `general`)                                                  |
| `lib/actions/auth/signUp.ts`               | Calls `supabase.auth.signUp` with `options.data` containing `display_name`, `onboarding_role`, `onboarding_intent`; returns `{ success: true; email }` on success so client can render verification pending UI without a redirect |
| `lib/actions/auth/signOut.ts`              | Calls `supabase.auth.signOut()` then `redirect("/")`                                                                                                                                                                              |
| `lib/actions/account/updateProfile.ts`     | Auth-guarded; validates display_name (max 100), bio (max 500), website_url (must start `https://`); wraps Supabase update in try/catch; graceful no-op on `42P01` error until profiles table exists                               |
| `lib/actions/account/setOnboardingRole.ts` | Auth-guarded; validates role is exactly `'supporter' \| 'owner'`; uses `createServiceClient()` to bypass RLS for user_roles INSERT; idempotent (checks existing role first); graceful no-op on `42P01`                            |

### Route Handler

| File                         | Purpose                                                                                                                                                                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/auth/callback/route.ts` | PKCE code exchange via `supabase.auth.exchangeCodeForSession(code)`; validates `next` as same-origin relative URL; redirects to `/onboarding` if no `next`; on error redirects to `/sign-in?error=auth_callback_failed` |

### Auth Route Group — `app/(auth)/`

| File                               | Purpose                                                                                                                                                                                                                                   |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/(auth)/layout.tsx`            | No public header/footer; `min-h-screen bg-deep-bg` centered card layout; BLACQList wordmark as Link to `/` in amber-gold                                                                                                                  |
| `app/(auth)/sign-in/page.tsx`      | Client Component; `useActionState(signInAction, null)` + `useFormStatus` submit button; email + password fields with show/hide Eye toggle; field-level inline errors; `?error=auth_callback_failed` banner; links preserve `?next=` param |
| `app/(auth)/sign-up/page.tsx`      | Client Component; `useActionState(signUpAction, null)`; on success renders inline verification pending UI (no redirect); 6 role radio cards mapping to 2 DB roles; hidden `role` + `onboardingIntent` inputs; terms acceptance text       |
| `app/(auth)/verify-email/page.tsx` | Server Component; reads `email` from async `searchParams`; shows "Check your inbox" state with back-to-sign-in button                                                                                                                     |

### Protected Routes

| File                            | Purpose                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/onboarding/page.tsx`       | Client Component; 2-step flow (city → role-specific); progress bar with `role="progressbar"` ARIA; Step 1: city selector with STUB_CITIES; Step 2A (owner): `/claim` and `/add-business` option cards as `<button>` elements; Step 2B (supporter): category interest pills with `aria-pressed`; calls `setOnboardingRoleAction` on final submit; reads `role`, `next`, `action`, `listing_id` from URL params |
| `app/account/page.tsx`          | Server Component; auth guard → `redirect("/sign-in?next=/account")`; shows `display_name` from user metadata; quick links to `/account/saved` and `/account/settings`                                                                                                                                                                                                                                         |
| `app/account/settings/page.tsx` | Client Component; `useActionState(updateProfileAction, null)`; display_name, bio, website_url fields; success banner with CheckCircle; field-level errors via `aria-describedby`                                                                                                                                                                                                                              |
| `app/account/saved/page.tsx`    | Server Component; auth guard; empty state with "Discover businesses" CTA; TODO comment for real saves query                                                                                                                                                                                                                                                                                                   |

### Modified Files

| File            | Change                                                                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `middleware.ts` | Changed authenticated-user redirect target at `/sign-in`/`/sign-up` from `/dashboard` → `/account` (dashboard not yet built) |

---

## Architecture Decisions

**No new packages.** React 19 `useActionState` + `useFormStatus` from `react-dom` replace `react-hook-form` and `zod` for MVP auth forms. No install needed.

**`display_name` in auth metadata.** Stored via `options.data` in `signUp` so the DB trigger can read it when schema migrations run. The profiles INSERT is handled by trigger — not by the sign-up action.

**6 UI roles → 2 DB roles.** The sign-up page offers six intent-driven role cards. All business-facing intents map to DB role `owner`; discovery intent maps to `supporter`. The specific intent is stored as `onboarding_intent` in auth metadata for future use.

**Graceful no-op pattern.** All Supabase DB operations on `profiles` and `user_roles` are wrapped in try/catch. `42P01` (relation does not exist) and `"does not exist"` message matches return success/no-error responses so the app is fully usable before schema migration runs.

**`next` param safety.** Validated server-side in both `signInAction` and `app/auth/callback/route.ts`: must start with `/` and not `//`. Absolute URLs are rejected.

**PKCE flow.** `app/auth/callback/route.ts` exchanges the Supabase `code` param via `exchangeCodeForSession`. Email verification link → callback → `/onboarding` (or `next` if provided).

---

## What Remains (Schema-Dependent)

These features are structurally in place but need schema migration before they produce live data:

| Feature                           | Blocked on                                |
| --------------------------------- | ----------------------------------------- |
| Profile update persisting to DB   | `profiles` table migration (Ticket 008)   |
| Role assignment persisting to DB  | `user_roles` table migration (Ticket 008) |
| Saved businesses list             | `saves` table migration (Ticket 011)      |
| City pre-population in onboarding | `cities` table migration (Ticket 006)     |

---

## Test Checklist

```bash
pnpm tsc --noEmit   # ✅ zero errors
pnpm lint           # ✅ zero errors
```

**Manual golden path (requires Supabase project connected):**

1. Navigate to `/sign-up`
2. Enter display name, email, password — select a role card — submit
3. See verification pending UI inline (no redirect)
4. Click email verification link → hits `/auth/callback` → redirects to `/onboarding`
5. Complete onboarding city + category steps → lands at `/account/saved`
6. Navigate to `/account/settings` → update display name → see success banner
7. Navigate to `/sign-out` (or call `signOutAction`) → redirected to `/`
8. Navigate to `/account` without session → redirected to `/sign-in?next=/account`
9. Sign in → redirected back to `/account`

**Auth-only paths (no Supabase project needed):**

- `/sign-in` — form renders, field errors appear on submit with empty fields
- `/sign-up` — role cards selectable, form renders
- `/onboarding` — both step 1 and step 2A/2B render correctly based on `?role=` param
- `/account` — middleware redirects to `/sign-in` if no session cookie
