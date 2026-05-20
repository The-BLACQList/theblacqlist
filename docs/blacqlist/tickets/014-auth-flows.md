# Ticket 014: Auth Flows — Sign Up, Sign In, Sign Out, Email Verification, Password Reset

## Status

Draft

## Phase

Phase 1: Database / Auth / RLS Foundation

## Priority

P0

## Feature Area

Auth

## Context

Authentication is the gateway to every personalized experience on the BLACQList platform: saving listings, claiming a business, submitting a review, and accessing the owner dashboard. These five auth flows (sign-up, sign-in, sign-out, email verification, and password reset) must exist and work correctly before any authenticated feature can be built or tested. Source: `docs/blacqlist/ux/mvp-screen-map.md` section 2 (Auth Screens), `docs/blacqlist/ux/empty-loading-error-success-states.md` section 6, `docs/blacqlist/architecture/api-contract.md` section 2 (endpoints 11–13).

## User Story

As a new visitor, I want to create an account, verify my email, and sign in so that I can save listings, submit claims, and access my dashboard.

## Scope

- Five auth screens: `/sign-up`, `/sign-in`, `/forgot-password`, `/reset-password`, `/verify-email`
- Server Actions: `signUp`, `signIn`, `signOut`, `sendPasswordReset`, `resetPassword`
- Supabase Auth integration via `@supabase/ssr` with httpOnly cookie sessions
- After sign-up: Supabase sends verification email; UI shows inline success state (no redirect)
- After sign-in: redirect to `?next=` param, or `/dashboard` for owners, or `/account/saved` for supporters
- Email verification token handling via `/verify-email?token=...` redirecting to `/onboarding` on success
- Password reset: `/forgot-password` always shows success (security — never reveal whether email is registered); `/reset-password` validates token from URL params
- Middleware guard: authenticated users arriving at auth screens redirect to their dashboard before the page renders
- `profiles` row and `user_roles` row with `role = 'supporter'` created atomically in the `signUp` Server Action via service_role

## Out of Scope

- Onboarding flow (covered by a separate ticket)
- OAuth (Google, Apple) sign-in — deferred to V1
- Account deletion — `/account/settings` ticket
- Role switching — covered by `setOnboardingRole` endpoint (API contract endpoint 13)

## Dependencies

- Depends on: Ticket 013 — RLS policies must be in place (profiles and user_roles RLS required for profile creation and role reads)
- Depends on: Ticket 015 — App shell layout (Navbar + root layout must exist for auth screens to render correctly inside the site structure)

## UX Notes

- **Screen:** Auth Centered layout — centered card, no full nav, no footer. BLACQList wordmark at top of card.
- **Routes:** `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/verify-email`
- **Entry points:** Nav "Sign In" CTA, save button modal, claim page CTA, protected route redirects
- **Exit points:** Sign-in → dashboard (role-based) or `?next=` param. Sign-up → inline success, no redirect. Verify email → `/onboarding`. Forgot password → always shows success screen. Reset password → `/sign-in` on success.
- **Mobile behavior at 375px:** Single-column centered card, full-width inputs and buttons, password show/hide toggle accessible with thumb
- **Loading states:** Submit button disabled with inline spinner for duration of all async operations
- **Error states from `docs/blacqlist/ux/empty-loading-error-success-states.md` section 6:**
  - Sign-in invalid credentials: inline error below password field "Email or password is incorrect."
  - Sign-in account not found: inline error below email field with "Sign up" link
  - Sign-in account suspended: inline error below form with support email link
  - Sign-in email not verified: inline notice with "Resend verification email" link
  - Sign-up email in use: inline error below email field with "Sign in instead?" link
  - Sign-up password too weak: inline error below password field with requirements
  - Sign-up server error: error below button "Something went wrong. Try again."
  - Verify email token expired: "This verification link has expired." with resend button
  - Verify email token invalid: "This link isn't valid." with redirect to `/sign-in`
  - Reset password token expired: "This link has expired." with link to `/forgot-password`
  - Reset password passwords don't match: inline error below confirm field

## Design Notes

- **Design brief:** `docs/blacqlist/design/design-brief.md`
- **Layout:** Auth centered — `max-w-sm mx-auto` centered card, `min-h-screen flex items-center justify-center bg-[#FCFAF4]`
- **Card:** `bg-white rounded-2xl shadow-md p-8` on cream page background
- **Typography:** Wordmark in Glacial Indifference at top of card. Heading `text-2xl font-bold text-black` (Glacial Indifference). Body Lato Regular. CTA button Quicksand Bold Italic.
- **Components to use:** shadcn/ui `Input`, `Label`, `Button`, `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`
- **CTA button:** `w-full bg-[#E2A428] text-black font-bold hover:bg-[#FFD867]` (Amber Gold, full-width)
- **Password field:** Show/hide toggle using an eye icon button inside the input
- **Role selector on sign-up:** Two option cards side by side — `border rounded-xl p-4 cursor-pointer` with selected state `border-[#E2A428] bg-amber-50`. Left: "I'm a supporter" (bookmark icon). Right: "I own a business" (storefront icon). Supporter pre-selected.
- **States to implement:** Default / Loading (button spinner + disabled) / Error (inline field errors) / Success (inline success state — not a separate page except for verify-email)

## Data Notes

- **Data model:** `docs/blacqlist/data/database-schema-plan.md` — `profiles`, `user_roles`
- **Tables written on sign-up:**
  - `auth.users` (via `supabase.auth.signUp()`)
  - `profiles` (id = auth user id, display_name from form, created_at = now()) — created via service_role in the same Server Action
  - `user_roles` (user_id, role = 'supporter', listing_id = null, granted_by = null) — created via service_role
- **Migration required:** No — tables exist after Tickets 009, 011, 013
- **Validation rules:**
  - `display_name`: required, 1–100 characters
  - `email`: valid email format, lowercase-normalized before sending to Supabase Auth
  - `password`: minimum 8 characters, at least one number (validated client-side and server-side)
  - `role`: must be `'supporter'` or `'owner'` at sign-up; defaults to `'supporter'` if no selection
  - ToS checkbox: required (validated client-side; form cannot submit without it)

## API Notes

- **API contract:** `docs/blacqlist/architecture/api-contract.md` — Section 2 (endpoints 11–13)
- **All auth flows use Server Actions**, not Route Handlers:
  - `lib/actions/auth/signUp.ts` — `signUp(FormValues): ActionResult<{ userId: string }>`
  - `lib/actions/auth/signIn.ts` — `signIn(FormValues): ActionResult<{ redirectTo: string }>`
  - `lib/actions/auth/signOut.ts` — `signOut(): ActionResult<void>`
  - `lib/actions/auth/sendPasswordReset.ts` — `sendPasswordReset({ email }): ActionResult<void>` (always returns success)
  - `lib/actions/auth/resetPassword.ts` — `resetPassword({ password, token }): ActionResult<void>`
- **ActionResult pattern:** `{ data: T } | { error: string; code: string; fields?: Record<string, string> }` — never throws
- **Error codes to handle:**
  - `EMAIL_ALREADY_EXISTS` (409) → inline error below email field
  - `INVALID_CREDENTIALS` (401) → inline error below password field
  - `WEAK_PASSWORD` (400) → inline error below password field
  - `EMAIL_NOT_VERIFIED` (401) → inline notice with resend link
  - `TOKEN_EXPIRED` (400) → expired state on `/verify-email` and `/reset-password`
  - `TOKEN_INVALID` (400) → invalid state on `/verify-email`
  - `ACCOUNT_SUSPENDED` (403) → inline error with support email
  - `SERVER_ERROR` (500) → generic error with retry action
- **Session:** `@supabase/ssr` creates session in httpOnly cookie automatically on successful sign-in
- **`GET /api/me`** (endpoint 11): called by nav component to populate display name and role — auth header is the session cookie

## Implementation Notes

**Files to create:**

- `app/(auth)/sign-up/page.tsx` — Sign-up page (Server Component shell)
- `app/(auth)/sign-in/page.tsx` — Sign-in page (Server Component shell)
- `app/(auth)/forgot-password/page.tsx` — Forgot password page
- `app/(auth)/reset-password/page.tsx` — Reset password page (reads `token` from `searchParams`)
- `app/(auth)/verify-email/page.tsx` — Email verification landing page (reads `token` from `searchParams`)
- `app/(auth)/layout.tsx` — Auth layout: no full nav, no footer, centered page
- `components/auth/SignUpForm.tsx` — Client Component with react-hook-form + zod
- `components/auth/SignInForm.tsx` — Client Component
- `components/auth/ForgotPasswordForm.tsx` — Client Component
- `components/auth/ResetPasswordForm.tsx` — Client Component
- `components/auth/VerifyEmailStatus.tsx` — Client Component (handles token validation state)
- `components/auth/RoleSelector.tsx` — Two-card role selection component
- `lib/actions/auth/signUp.ts`
- `lib/actions/auth/signIn.ts`
- `lib/actions/auth/signOut.ts`
- `lib/actions/auth/sendPasswordReset.ts`
- `lib/actions/auth/resetPassword.ts`
- `lib/validations/auth.ts` — Zod schemas for all auth forms
- `middleware.ts` (modify if already exists) — Add auth redirect: unauthenticated users hitting `/dashboard/*` redirect to `/sign-in?next=[path]`; authenticated users hitting `/sign-in`, `/sign-up` redirect to their role-appropriate destination

**Files to modify:**

- `middleware.ts` — Add auth route protection and authenticated-user redirects from auth screens

**Key patterns:**

```typescript
// ActionResult pattern — all Server Actions return this shape
type ActionResult<T> =
  | { data: T }
  | { error: string; code: string; fields?: Record<string, string> }

// Server Action pattern (signUp)
'use server'
export async function signUp(values: SignUpValues): Promise<ActionResult<{ userId: string }>> {
  const parsed = signUpSchema.safeParse(values)
  if (!parsed.success) {
    return { error: 'Validation failed', code: 'VALIDATION_ERROR', fields: ... }
  }
  const supabase = createServiceClient() // service_role for profile + role creation
  // 1. supabase.auth.signUp() with email + password
  // 2. INSERT profiles row
  // 3. INSERT user_roles row with role = 'supporter'
  // 4. Return { data: { userId } }
}
```

```typescript
// After sign-in: role-based redirect
const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
const isOwner = roles?.some((r) => r.role === 'owner')
const redirectTo = params.get('next') || (isOwner ? '/dashboard' : '/account/saved')
redirect(redirectTo)
```

**Do not:**

- Use localStorage to store the session token — `@supabase/ssr` handles httpOnly cookies automatically
- Trust the `role` field from the sign-up form payload in the service layer — always insert `'supporter'` as the initial role regardless of form input (the onboarding flow handles owner role assignment via endpoint 13)
- Redirect on sign-up success — show inline success state only; user must verify email before accessing authenticated routes

## Acceptance Criteria

- [ ] Given a new user submits the sign-up form with valid email, password (8+ chars, 1 number), display name, and ToS checked, then a `auth.users` row, a `profiles` row, and a `user_roles` row (`role = 'supporter'`) are created, and the UI shows "Check your email" inline success state without redirecting
- [ ] Given a signed-up user clicks their verification email link, then `/verify-email` validates the Supabase token and redirects to `/onboarding`
- [ ] Given a user signs in with valid credentials, then the session cookie is set and the user is redirected to `/account/saved` (supporter) or `/dashboard` (owner)
- [ ] Given a user signs in with an incorrect password, then an inline error "Email or password is incorrect." appears below the password field and the email field retains its value
- [ ] Given a user submits `/forgot-password`, then the UI always shows "Check your email." success state regardless of whether the email is registered — no error state is ever shown
- [ ] Given a user opens `/reset-password` with a valid token and submits a new password, then the password is updated and the user is redirected to `/sign-in` with a success indicator
- [ ] Given a user opens `/reset-password` with an expired token, then the UI shows "This link has expired." with a link to `/forgot-password`
- [ ] Given an authenticated user navigates to `/sign-in`, then middleware redirects them to their role-appropriate destination without rendering the sign-in form
- [ ] Given a sign-up is attempted with an email that already has an account, then an inline error "An account with this email already exists. Sign in instead?" appears below the email field
- [ ] All five auth screens pass keyboard navigation — Tab order is logical, all inputs and buttons reachable via keyboard, Enter submits forms

## Failure States

| Failure                         | User-visible behavior                                                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Email already registered        | Inline error below email field: "An account with this email already exists. Sign in instead?" with link to `/sign-in`       |
| Incorrect password              | Inline error below password field: "Email or password is incorrect." (do not specify which field is wrong)                  |
| Account suspended               | Inline error below form: "Your account has been suspended. Contact support@theblacqlist.com"                                |
| Email not verified on sign-in   | Inline notice: "Please verify your email. [Resend verification email]" — link triggers resend and shows "Email sent" inline |
| Password too weak               | Inline error below password field: "Password must be at least 8 characters and include a number."                           |
| Verification token expired      | "This verification link has expired." heading + "Resend verification email" button                                          |
| Verification token invalid/used | "This link isn't valid." heading + link to `/sign-in`                                                                       |
| Reset token expired             | "This link has expired." with link to request a new reset                                                                   |
| Passwords don't match on reset  | Inline error below confirm password field: "Passwords don't match."                                                         |
| Server error on any form        | Error below the submit button: "Something went wrong. Try again." Button re-enables. Form values preserved.                 |
| Network timeout                 | Same as server error; form values preserved                                                                                 |

## Edge Cases

- User pastes email with leading/trailing whitespace — normalize with `.trim()` before passing to Supabase Auth
- User navigates to `/sign-in?next=/dashboard/claim/123` — after sign-in, redirect must preserve the full `next` param including path and query string; validate that `next` starts with `/` to prevent open redirect attacks
- User clicks sign-up submit multiple times quickly — button must be disabled during the in-flight request to prevent double account creation
- User signs up as a business owner (selects "I own a business" role card) — the `signUp` action still creates a `'supporter'` role; the user will be prompted during onboarding to confirm owner intent and trigger `setOnboardingRole` (endpoint 13)
- Session expires while user is on a protected page mid-flow — middleware handles this on the next navigation; Supabase SSR also handles token refresh automatically

## Accessibility Notes

- [ ] All form inputs have associated `<label>` elements via `htmlFor` — no placeholder-only labels
- [ ] Password show/hide toggle is a `<button>` with `aria-label="Show password"` / `aria-label="Hide password"` — not a `<div>` or `<span>`
- [ ] Inline error messages are linked to their input via `aria-describedby` — shadcn/ui `FormMessage` handles this automatically
- [ ] Error summary messages use `role="alert"` so they are announced by screen readers on appearance
- [ ] The role selector cards on sign-up are keyboard-navigable — each card is a `<button>` or uses `role="radio"` in a `radiogroup`
- [ ] After form submission error, focus moves to the first field with an error
- [ ] After successful email verification, focus is set to the page heading

## QA Test Cases

| #    | Scenario                                       | Role          | Steps                                                                                                                            | Expected result                                                                                                                                                |
| ---- | ---------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QA-1 | Happy path sign-up                             | Anonymous     | Navigate to `/sign-up`; fill display name, valid email, valid password (8+ chars, 1 number), select Supporter, check ToS; submit | Inline success state: "Check your email. We sent a verification link to [email]." No redirect. Supabase `auth.users`, `profiles`, and `user_roles` rows exist. |
| QA-2 | Sign-in with valid credentials                 | Anonymous     | Navigate to `/sign-in`; enter valid email and password; submit                                                                   | Session cookie set; redirect to `/account/saved` (supporter) or `/dashboard` (owner)                                                                           |
| QA-3 | Sign-in with wrong password                    | Anonymous     | Navigate to `/sign-in`; enter registered email, wrong password; submit                                                           | Inline error below password field: "Email or password is incorrect." Email field retains value.                                                                |
| QA-4 | Email verification with expired token          | Anonymous     | Navigate to `/verify-email?token=expired-token-string`                                                                           | "This verification link has expired." heading with "Resend verification email" button                                                                          |
| QA-5 | Authenticated user redirected from auth screen | Authenticated | Sign in; navigate directly to `/sign-in`                                                                                         | Redirected to `/dashboard` or `/account/saved` without rendering the sign-in form                                                                              |

## Security Notes

- Passwords are never logged, stored in application state, or included in error messages
- The `?next=` redirect parameter must be validated server-side: only paths starting with `/` are accepted; external URLs are ignored and the default redirect is used instead
- Supabase Auth handles password hashing — do not implement custom hashing
- Session tokens are stored in httpOnly cookies via `@supabase/ssr` — they cannot be accessed by JavaScript in the browser
- The `sendPasswordReset` Server Action always returns success (never reveals whether an email is registered) to prevent user enumeration attacks
- Rate limiting on auth endpoints is enforced at the middleware layer — Supabase Auth also applies its own built-in rate limits on auth endpoints

## Completion Checklist

- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] All four states implemented (loading, empty, error, success) for all five auth screens
- [ ] Mobile tested at 375px — all forms single-column, full-width buttons, show/hide password accessible
- [ ] Keyboard navigation tested — Tab order logical, all inputs reachable, Enter submits
- [ ] Accessibility requirements met — labels, aria-describedby on errors, role="alert" on error banners
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
