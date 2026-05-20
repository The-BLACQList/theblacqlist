# Ticket 058: Auth middleware — route protection, role guards, and session refresh (`middleware.ts`)

## Status
Draft

## Phase
Phase 9: Supporter Account (Auth)

## Priority
P0

## Feature Area
Auth / Security

## Context
The BLACQList has three tiers of protected routes: (1) authenticated routes (any logged-in user) — `/account`, `/onboarding`, `/claim`, `/add-business`; (2) owner-only routes — `/dashboard`; (3) admin-only routes — `/admin`. Without middleware enforcing these boundaries, the entire auth model is window-dressing — a user could navigate directly to any URL. This ticket implements `middleware.ts` at the project root using the Supabase SSR middleware helper to refresh the session cookie on every request and redirect based on auth state and role. It also handles the inverse case: redirecting already-authenticated users away from auth screens (`/sign-in`, `/sign-up`).

This middleware has been referenced as a dependency in tickets 037 (admin layout), 050 (owner dashboard), 056 (account settings), and 057 (onboarding). It is a P0 blocker for all protected routes.

Source documents: `docs/blacqlist/ux/mvp-screen-map.md` (all protected routes), `docs/blacqlist/data/rls-policy-plan.md` (role model), `docs/blacqlist/data/database-schema-plan.md` (`user_roles`, `profiles`).

## User Story
As a platform engineer, I want route protection and session refresh to be enforced at the middleware layer, so that no protected route can be accessed without the correct authentication state and role.

## Scope
- `middleware.ts` (project root) — Supabase SSR middleware using `createServerClient` from `@supabase/ssr`; calls `supabase.auth.getUser()` on every matched request; refreshes the session cookie; applies redirect logic
- Protected route matching configuration in `middleware.ts` `matcher` array — covers `/account`, `/dashboard`, `/admin`, `/onboarding`, `/claim`, `/add-business`
- Auth-redirect logic:
  - Unauthenticated user → protected route: redirect to `/sign-in?next=[encoded-path]`
  - Authenticated user → `/sign-in` or `/sign-up`: redirect to role-appropriate home (`/dashboard` for owners, `/account/saved` for supporters)
  - Authenticated user without `owner` role → `/dashboard/**`: redirect to `/account/saved`
  - Authenticated user without `admin` role → `/admin/**`: redirect to `/`
  - Suspended user (any protected route): redirect to `/account/suspended` (static page, see Out of Scope note)
- Session cookie refresh: on every matched request, the middleware calls `supabase.auth.getUser()` and the SSR helper writes updated session cookies to the response — this keeps sessions alive without requiring a manual refresh call
- `?next=` redirect preservation: after sign-in, the `next` param is read and the user is redirected to the originally requested URL

## Out of Scope
- `app/account/suspended/page.tsx` — the suspension landing page (a simple static error screen; can be a one-liner Server Component in this ticket's scope or a separate ticket; implement the redirect in middleware but the page itself is minimal — just a message and a "Contact support" link)
- Email verification enforcement (handled by Supabase Auth; the middleware does not check `email_confirmed_at` — Supabase redirects unverified users itself)
- Role-switching UI (V1 — users have one role at MVP)
- API route protection (`/api/**`) — API routes use their own session validation in the route handler; middleware does not protect them

## Dependencies
- Depends on: Ticket 014 (auth flows — `@supabase/ssr` client configuration; session cookie name must match)
- Depends on: Ticket 008 (`user_roles` table — role lookup in middleware requires this table to exist)
- Depends on: Ticket 002 (Supabase setup — `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars)
- Note: Tickets 037, 050, 056, 057 all list this ticket as a blocking dependency. Those tickets can be tested with a temporary inline auth check in the page Server Component until this ticket is merged.

## UX Notes
- **Screen:** Not a user-visible screen — middleware operates invisibly
- **Redirect flow for unauthenticated user:** navigates to `/dashboard/page` → middleware redirects to `/sign-in?next=%2Fdashboard%2Fpage` → user signs in → `SignInForm` reads `next` param and redirects to `/dashboard/page`
- **Redirect flow for wrong role:** authenticated supporter navigates to `/dashboard/page` → middleware queries `user_roles` → no `owner` role found → redirect to `/account/saved`
- **Redirect flow for already-authenticated user on sign-in page:** authenticated owner navigates to `/sign-in` → middleware detects active session → redirect to `/dashboard`
- **Redirect flow for suspended user:** suspended user navigates to any protected route → middleware checks `profiles.suspended_at IS NOT NULL` → redirect to `/account/suspended`
- The `?next=` parameter must be URL-encoded to handle paths with query strings

## Design Notes
- No UI component; no visual states
- The `/account/suspended` redirect target must render a minimal, branded page with the BLACQList wordmark, a "Your account has been suspended" heading, contact information (`support@theblacqlist.com`), and a sign-out button
- This page can be a minimal Server Component with no auth requirement — suspended users must be able to see it

## Data Notes
- **Data model:** `docs/blacqlist/data/database-schema-plan.md` → `user_roles`, `profiles`
- **Role check:** `SELECT role FROM user_roles WHERE user_id = [session.user.id] LIMIT 1` — runs in middleware using the Supabase SSR server client
- **Suspension check:** `SELECT suspended_at FROM profiles WHERE id = [session.user.id]` — a second query in the same middleware execution
- **Performance concern:** Two DB queries per protected route request is acceptable at MVP; at scale (V1), these can be moved into JWT custom claims to avoid middleware DB round-trips. Document this as a V1 optimization.
- **Operations:** SELECT only — middleware never writes to the database
- **RLS:** Middleware uses the anon key client (not service role) — the `user_roles` SELECT policy allows `authenticated` users to read their own role; `profiles` SELECT policy allows `authenticated` users to read their own record; both queries are user-scoped via the session

## API Notes
- No API endpoints — middleware is server-side edge logic
- **Supabase SSR middleware pattern** (`@supabase/ssr`):
  ```typescript
  import { createServerClient } from '@supabase/ssr'
  import { NextResponse, type NextRequest } from 'next/server'

  export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request })
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )
    const { data: { user } } = await supabase.auth.getUser()
    // ... redirect logic ...
    return supabaseResponse
  }
  ```
- **Auth required:** Middleware uses the session from the request cookie — no additional auth header

## Implementation Notes
**Files to create:**
- `middleware.ts` (project root — next to `next.config.ts`)
- `app/account/suspended/page.tsx` — minimal suspension landing page

**Files to modify:**
- None — middleware is a new file; if a minimal `middleware.ts` already exists from Ticket 014 (basic session refresh only), this ticket extends it with the full redirect logic

**Key patterns:**
- Use `supabase.auth.getUser()` — NOT `getSession()`. `getSession()` does not validate the JWT with the server; `getUser()` makes a network call to Supabase Auth and is the only safe choice for middleware.
- Do NOT use the service role key in middleware — use the anon key. The SSR client with the user's cookie handles the session.
- Matcher configuration — use the Next.js `matcher` to exclude static assets and `_next/` internals:
  ```typescript
  export const config = {
    matcher: [
      '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
  }
  ```
  Then apply path-based logic inside the middleware function, not in the matcher, for fine-grained control.
- Role check: fetch role only when the user is authenticated and the path requires a role check (i.e., starts with `/dashboard` or `/admin`) — skip the DB query for public routes and basic auth-only routes like `/account` and `/onboarding`
- Suspension check: run only when the user is authenticated and the path is a protected route — skip for unauthenticated users
- The `?next=` param must be set using `request.nextUrl.pathname + request.nextUrl.search` to preserve query strings
- After sign-in redirect: the `next` param should be validated to prevent open redirect attacks — only redirect to paths starting with `/` on the same origin

**Do not:**
- Use `getSession()` anywhere in middleware — this is a security risk (JWT not re-validated server-side)
- Run the role DB query for every request regardless of path — only run it when the path requires a role check
- Block `/api/**` routes in middleware — API routes handle their own auth
- Call `revalidatePath` or any mutation from middleware — read only

## Acceptance Criteria
- [ ] Unauthenticated user navigating to `/dashboard` is redirected to `/sign-in?next=%2Fdashboard`
- [ ] Unauthenticated user navigating to `/account/settings` is redirected to `/sign-in?next=%2Faccount%2Fsettings`
- [ ] Unauthenticated user navigating to `/onboarding` is redirected to `/sign-in?next=%2Fonboarding`
- [ ] After signing in with a `?next=` param, the user is redirected to the originally requested path
- [ ] Authenticated supporter navigating to `/dashboard` is redirected to `/account/saved`
- [ ] Authenticated admin navigating to `/dashboard` is allowed through (admins also have access to owner routes — confirm this with the role model in `rls-policy-plan.md`; if not, admins redirect to `/admin`)
- [ ] Authenticated non-admin navigating to `/admin` is redirected to `/`
- [ ] Authenticated user on `/sign-in` is redirected: owner → `/dashboard`, supporter → `/account/saved`
- [ ] Authenticated user on `/sign-up` is redirected: owner → `/dashboard`, supporter → `/account/saved`
- [ ] Suspended user navigating to any protected route is redirected to `/account/suspended`
- [ ] `/account/suspended` page renders without authentication required
- [ ] Session cookie is refreshed on every matched request (confirmed by logging/inspecting `Set-Cookie` headers)
- [ ] `tsc --noEmit` and `npm run lint` pass with zero errors

## Failure States
| Failure | Condition | User sees | Recovery |
|---|---|---|---|
| Supabase `getUser()` call fails | Network error between middleware and Supabase Auth | Request proceeds as unauthenticated (Next.js default behavior); protected route then redirects to sign-in | User signs in again |
| Role DB query fails | Supabase DB unreachable during role check | Log the error; treat as "no role found" and redirect to `/account/saved` (fail safe, not fail open) | User is not granted elevated access on failure |
| `?next=` param contains external URL | Malicious redirect attempt | Middleware validates that `next` starts with `/`; ignores external URLs; redirects to role-default home | Safe default redirect |
| Session cookie is expired | JWT has expired | `getUser()` returns null; user is treated as unauthenticated; redirect to sign-in | User re-authenticates |

## Edge Cases
- User has multiple roles in `user_roles` (e.g., both `supporter` and `owner`): middleware should prioritize the highest-privilege role — check for `owner` first, then `admin`; if either exists, allow through the dashboard route
- User navigates to `/admin/claims` without an admin role — redirect to `/` (not to `/account/saved`, which is for supporters)
- User's session is valid but their record has been hard-deleted from `profiles` — `getUser()` returns a user ID, but the `profiles` SELECT returns null; treat as unauthenticated and redirect to sign-in
- Admin navigates to `/onboarding` — middleware should allow this (admins are also authenticated users); the page Server Component handles the onboarding-completed check
- Static assets matching `/account/favicon.ico` — the matcher regex excludes static file extensions; verify the regex covers all common extensions

## Accessibility Notes
- [ ] `/account/suspended` page has a clear `<h1>` heading and a `<main>` landmark
- [ ] The sign-out button on `/account/suspended` is keyboard-focusable and has a visible label
- [ ] All redirects are immediate (no visible flash of protected content before redirect fires) — this is guaranteed by middleware running before page rendering

## QA Test Cases
| # | Scenario | Role | Steps | Expected result |
|---|---|---|---|---|
| 1 | Unauthenticated → dashboard | None | 1. Open incognito. 2. Navigate to `/dashboard`. | Redirect to `/sign-in?next=%2Fdashboard` |
| 2 | Supporter → dashboard | Supporter | 1. Sign in as supporter. 2. Navigate to `/dashboard`. | Redirect to `/account/saved` |
| 3 | Admin → admin route | Admin | 1. Sign in as admin. 2. Navigate to `/admin/listings`. | Allowed through; admin listings page renders |
| 4 | Non-admin → admin route | Owner | 1. Sign in as owner. 2. Navigate to `/admin/claims`. | Redirect to `/` |
| 5 | Already authed → sign-in page | Owner | 1. Sign in as owner. 2. Navigate to `/sign-in`. | Redirect to `/dashboard` |

## Security Notes
- `getUser()` not `getSession()` — the JWT is re-validated on every protected request; a revoked session is caught immediately
- Anon key only in middleware — service role key is never used or referenced in `middleware.ts`
- Role check is server-side — a user cannot claim a role by modifying client-side state or cookies
- `?next=` validation prevents open redirect: only paths starting with `/` are allowed; external URLs are silently ignored
- Suspended status check happens server-side on every protected route — a suspended user cannot access any authenticated page

## Completion Checklist
- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] All redirect scenarios tested (unauthenticated, wrong role, suspended, already-authed on auth pages)
- [ ] `?next=` redirect works end-to-end through sign-in
- [ ] Suspended user redirect tested
- [ ] Session refresh confirmed (cookie updated on every request)
- [ ] Mobile tested at 375px (redirect behavior is device-agnostic, but confirm no issues)
- [ ] PR opened and linked to this ticket
