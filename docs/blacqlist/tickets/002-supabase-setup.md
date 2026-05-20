# Ticket 002: Supabase project setup and environment configuration

## Status

Draft

## Phase

Phase 0: Setup and Foundation

## Priority

P0

## Feature Area

Infrastructure

## Context

The BLACQList backend is entirely built on Supabase — PostgreSQL, Auth, Storage, and RLS all run through the Supabase platform. Before any database migrations, authentication, or storage operations can be written or tested, two Supabase projects (staging and production) must exist, the application must have working client utilities for all rendering contexts (browser, server, middleware), and the three storage buckets defined in `environment-plan.md` Section 8 must be configured with the correct visibility and CORS policies. This ticket establishes that infrastructure foundation. Source documents: `docs/blacqlist/architecture/tech-stack-decision.md` (Section 5), `docs/blacqlist/architecture/environment-plan.md` (Sections 3, 4, 7, 8).

## User Story

As an engineer working on any data-touching feature, I want Supabase client utilities and storage buckets preconfigured and available, so that I can write queries, auth calls, and storage operations without building the connection layer myself.

## Scope

- Create two cloud Supabase projects: `theblacqlist-staging` and `theblacqlist-production`
- Install `@supabase/supabase-js` and `@supabase/ssr` packages via pnpm
- Create `lib/supabase/client.ts` — browser client (singleton, `createBrowserClient`)
- Create `lib/supabase/server.ts` — server client factory (`createServerClient` using Next.js `cookies()`)
- Create `lib/supabase/middleware.ts` — middleware session refresh helper (`createServerClient` in middleware context)
- Create `middleware.ts` at project root — session refresh on every request via Supabase SSR middleware helper
- Create three storage buckets on both staging and production projects:
  - `listing-media` — public visibility, 10MB file size limit
  - `verification-docs` — private, signed URLs only, 15-minute expiry
  - `receipts` — private, signed URLs only, 15-minute expiry
- Enable `pg_trgm` extension in both Supabase projects (SQL: `CREATE EXTENSION IF NOT EXISTS pg_trgm;`)
- Enable email confirmation in Supabase Auth settings for both projects
- Configure Auth redirect URLs per `environment-plan.md` Section 7
- Set all Supabase environment variables in Vercel Preview and Production environments
- Update `.env.example` with Supabase variable descriptions (Ticket 001 created the file; this ticket fills the Supabase group)
- Configure connection pooling (PgBouncer in transaction mode) on the production project

## Out of Scope

- Database schema migrations (Tickets 006–010)
- Authentication UI or flows (later tickets)
- RLS policies (later tickets, applied per-migration)
- Stripe, Resend, Sentry environment variables (Tickets 003, 004)
- Local Supabase CLI setup instructions — documented in `environment-plan.md` Section 9, not implemented here

## Dependencies

- Depends on: Ticket 001 — Next.js project initialization (must exist before installing packages)

## UX Notes

N/A — infrastructure ticket. No user-facing screens are built here.

## Design Notes

N/A — infrastructure ticket.

## Data Notes

No schema migrations in this ticket. The following are the storage buckets configured (not database tables):

**`listing-media` bucket:**

- Visibility: Public
- CDN: Enabled
- File size limit: 10MB (bucket-level max; per-file limits enforced in upload handler)
- Path pattern: `listings/[listing_id]/[type]/[uuid].[ext]` — constructed server-side only

**`verification-docs` bucket:**

- Visibility: Private
- Signed URL expiry: 15 minutes
- Access: service_role only — no direct browser access

**`receipts` bucket:**

- Visibility: Private
- Signed URL expiry: 15 minutes
- Access: service_role only via server-side signed URL generation

**`pg_trgm` extension:** Required for fuzzy text search on `listings.name` and future `search_vector` queries. Must be enabled before any search-related migration runs.

**Auth settings (both projects):**

- Email provider: enabled
- Email confirmation: enabled
- Redirect URLs:
  - `http://localhost:3000` (allow for local dev)
  - `https://*.vercel.app` (staging project only — wildcard for preview deploys)
  - `https://theblacqlist.com` (production project only)
- JWT expiry: 7 days (default)

**Connection pooling (production only):**

- PgBouncer in transaction mode
- All server-side clients in Vercel functions use the pooled connection string
- Non-pooled direct connection used only for `supabase db push` (migrations)

## API Notes

N/A — this ticket creates client utilities, not API routes.

The three client utility files created here are used as the building block for all future API routes and Server Actions. The usage pattern is:

```typescript
// In a Server Component or Server Action
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()

// In a Client Component (rare — prefer Server Components)
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
```

The service role client (used for admin mutations bypassing RLS) is a fourth utility not created in this ticket — it is created in the first ticket that requires it. It will use `SUPABASE_SERVICE_ROLE_KEY` and must never be imported in any `"use client"` file.

## Implementation Notes

**Files to create:**

- `lib/supabase/client.ts` — Browser Supabase client

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- `lib/supabase/server.ts` — Server Supabase client (async, uses Next.js cookies)

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — cookie mutation is handled by middleware
          }
        },
      },
    }
  )
}
```

- `lib/supabase/middleware.ts` — Middleware session refresh helper

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
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
  await supabase.auth.getUser()
  return supabaseResponse
}
```

- `middleware.ts` (project root) — Applies session refresh to all non-static routes

```typescript
import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

**Key patterns:**

- Follow the official `@supabase/ssr` Next.js App Router guide exactly — do not use the deprecated `auth-helpers-nextjs` package
- The `createClient()` in `server.ts` is `async` because `cookies()` in Next.js 14+ is async
- The service role client is a separate utility that will be added later — do not create it here
- Environment variable access uses `process.env.NEXT_PUBLIC_SUPABASE_URL!` with the non-null assertion — the variables are always present in production; the assertion is correct

**Do not:**

- Import `lib/supabase/server.ts` in any `"use client"` component
- Use `@supabase/auth-helpers-nextjs` — it is deprecated; use `@supabase/ssr`
- Store the Supabase CDN URL in any database field — store paths only; generate URLs at read time
- Set `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` — the service role key must NEVER have the `NEXT_PUBLIC_` prefix
- Disable RLS on any table for any reason — use the service role client for admin operations instead

## Acceptance Criteria

- [ ] `pnpm add @supabase/supabase-js @supabase/ssr` completes without errors and both packages appear in `package.json`
- [ ] `lib/supabase/client.ts`, `lib/supabase/server.ts`, and `lib/supabase/middleware.ts` all exist and export the functions described above
- [ ] `middleware.ts` at the project root runs the session refresh on every non-static request (verified by checking Supabase auth cookies are set after a page load in the browser)
- [ ] A basic connectivity test — importing `createClient` from `lib/supabase/server.ts` in an async Server Component and calling `supabase.from('profiles').select('count')` — returns a Supabase response object (even if the table does not exist yet; the response structure is what is validated, not the data)
- [ ] Three storage buckets (`listing-media`, `verification-docs`, `receipts`) exist in both the staging and production Supabase projects with the correct visibility settings
- [ ] `pg_trgm` extension is enabled in both staging and production Supabase projects (verify with `SELECT * FROM pg_extension WHERE extname = 'pg_trgm';`)
- [ ] Email confirmation is enabled in Auth settings for both projects
- [ ] All Supabase environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are set in Vercel under both "Preview" and "Production" environments
- [ ] PgBouncer connection pooling is enabled in transaction mode on the production Supabase project

## Failure States

| Failure                                                     | User-visible behavior                                                                                                                                                                              |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL` not set in Vercel                | Preview deploy crashes on first Supabase call; engineer checks Vercel environment variables and confirms the value is set                                                                          |
| `@supabase/ssr` version incompatible with Next.js 14        | `pnpm dev` fails with a module resolution error; engineer pins to the compatible version documented in `@supabase/ssr` release notes                                                               |
| `pg_trgm` extension not enabled                             | Ticket 009 search vector migration fails with `ERROR: function similarity(text, unknown) does not exist`; engineer runs `CREATE EXTENSION IF NOT EXISTS pg_trgm;` manually via Supabase SQL editor |
| `listing-media` bucket created as private instead of public | Images uploaded to the bucket return 403 on public URL access; engineer toggles the bucket to public in Supabase Storage settings                                                                  |
| Middleware not matching app routes                          | Authenticated sessions expire mid-session without refresh; engineer verifies the `config.matcher` pattern excludes only static assets and not application routes                                   |

## Edge Cases

- The `createClient()` in `server.ts` is async — it must be `await`ed in every Server Component or Server Action that calls it; forgetting the `await` is a common mistake that produces a confusing type error rather than a clear runtime error
- Supabase staging and production projects must use separate API keys — never copy a production key into staging or vice versa; verify by checking the URL prefix (staging keys reference the staging project URL)
- Local Supabase CLI (`supabase start`) generates different keys than the cloud projects — the local keys are correct for `.env.local` but must never be committed or set in Vercel

## Accessibility Notes

- [ ] N/A — infrastructure ticket.

## QA Test Cases

| #   | Scenario                     | Role     | Steps                                                                                                                               | Expected result                                                                                                                                                            |
| --- | ---------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Browser client connects      | Engineer | Import `createClient` from `lib/supabase/client.ts` in a Client Component; call `supabase.auth.getSession()`                        | Returns a session object (null if not signed in, which is expected); no console errors                                                                                     |
| 2   | Server client connects       | Engineer | Import `createClient` from `lib/supabase/server.ts` in a Server Component; call `await supabase.from('categories').select('count')` | Returns a Supabase response with `error: null` or `error: { message: 'relation "public.categories" does not exist' }` (either is acceptable — the connection itself works) |
| 3   | Storage buckets exist        | Engineer | Open Supabase Dashboard → Storage for both staging and production projects                                                          | Three buckets visible: `listing-media` (public), `verification-docs` (private), `receipts` (private)                                                                       |
| 4   | Middleware runs              | Engineer | Open `http://localhost:3000`; inspect request headers in browser dev tools network tab                                              | Supabase auth cookie (`sb-[project-ref]-auth-token`) is present in response Set-Cookie header                                                                              |
| 5   | Service role key not exposed | Engineer | Inspect the browser network tab on any page load; search for `service_role` string                                                  | String is never present in any response body or header                                                                                                                     |

## Security Notes

- `SUPABASE_SERVICE_ROLE_KEY` bypasses all RLS — it must only ever appear in server-side files (`app/actions/`, `app/api/`) and never in any file with `"use client"` at the top
- The service role key must never be assigned to a `NEXT_PUBLIC_*` environment variable — any such assignment is an immediate security incident
- Storage bucket policies for `verification-docs` and `receipts` must be private — verify in the Supabase Dashboard after creation; do not rely on the API call response alone
- Git history must never contain real Supabase keys; run `git log --all -S 'supabase' -- .env*` after setup to confirm no key was accidentally committed

## Completion Checklist

- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] All four states implemented (loading, empty, error, success) — N/A for infrastructure ticket
- [ ] Mobile tested at 375px — N/A for infrastructure ticket
- [ ] Keyboard navigation tested — N/A for infrastructure ticket
- [ ] Accessibility requirements met — N/A for infrastructure ticket
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
