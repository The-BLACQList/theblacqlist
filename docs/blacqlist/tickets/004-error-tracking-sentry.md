# Ticket 004: Error tracking setup (Sentry)

## Status

Draft

## Phase

Phase 0: Setup and Foundation

## Priority

P1

## Feature Area

Infrastructure

## Context

A live platform serving real users and real data requires immediate error visibility from the first day of operation. Without Sentry, errors are only discovered when users report them — which means silent failures in the claim submission flow, listing edit flow, or auth flow go undetected. Sentry's source map integration makes TypeScript stack traces debuggable against original source rather than minified output, and its performance monitoring provides p95/p99 latency tracking for the three critical user paths (search, listing create/edit, claim submission). This is classified as P1 rather than P0 because the platform can function briefly without it; however, it must be in place before any real user traffic is accepted. Source documents: `docs/blacqlist/architecture/tech-stack-decision.md` (Section 15), `docs/blacqlist/architecture/environment-plan.md` (Section 5, Group D).

## User Story

As an engineer on call or debugging a production issue, I want runtime errors and performance regressions to be captured in Sentry with TypeScript source context, so that I can identify and fix problems before users report them.

## Scope

- Install `@sentry/nextjs` via pnpm
- Run `npx @sentry/wizard@latest -i nextjs` to generate Sentry configuration files
- Configure `sentry.client.config.ts` — client-side error capture, performance monitoring, replay
- Configure `sentry.server.config.ts` — server-side error capture, performance monitoring
- Configure `sentry.edge.config.ts` — edge runtime error capture (Next.js middleware)
- Create or update `next.config.ts` to wrap with `withSentryConfig` for source map upload
- Create a Sentry project for each environment: `theblacqlist-staging` and `theblacqlist-production`
- Set `NEXT_PUBLIC_SENTRY_DSN` in Vercel Preview environment (staging DSN) and Production environment (production DSN)
- Set `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` in Vercel as CI/CD-only build variables (not runtime)
- Add custom error context: authenticated user ID (`auth.uid()`) when a session is present
- Enable performance monitoring at 10% sample rate (MVP — adjustable as traffic grows)
- Verify source maps upload on a Preview build

## Out of Scope

- Uptime monitoring (Sentry Crons or external uptime tool — later ticket)
- Custom Sentry dashboards or alert rule configuration beyond the defaults
- Sentry Replay (session recording) — evaluate at V1; not enabled at MVP to reduce bundle size

## Dependencies

- Depends on: Ticket 001 — Next.js project initialization
- Depends on: Ticket 003 — Vercel deployment pipeline (required for the CI/CD source map upload)

## UX Notes

N/A — infrastructure ticket. Sentry is invisible to users; it only surfaces in the Sentry dashboard for engineers.

## Design Notes

N/A — infrastructure ticket.

## Data Notes

N/A — Sentry is an external service. No Supabase tables are created or modified in this ticket.

**PII warning:** Sentry must not capture personally identifiable information. The following must be scrubbed:

- Do not send email addresses in error context
- Do not send authentication tokens or session cookies in breadcrumbs
- User context must include only: `id` (Supabase `auth.uid()` UUID), `role` (from `user_roles` table, if available) — never name, email, or phone

## API Notes

N/A — Sentry reports to the Sentry API automatically via the SDK. No custom routes are built here.

## Implementation Notes

**Files to create or modify:**

- `sentry.client.config.ts`:

```typescript
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  debug: false,
  // Do not enable Replay at MVP — evaluate at V1
})
```

- `sentry.server.config.ts`:

```typescript
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  debug: false,
})
```

- `sentry.edge.config.ts`:

```typescript
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  debug: false,
})
```

- `next.config.ts` (modify to wrap with `withSentryConfig`):

```typescript
import { withSentryConfig } from '@sentry/nextjs'
// ... existing config ...
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
})
```

- `app/global-error.tsx` — Next.js global error boundary that reports to Sentry:

```typescript
'use client'
import * as Sentry from '@sentry/nextjs'
import NextError from 'next/error'
import { useEffect } from 'react'

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => { Sentry.captureException(error) }, [error])
  return (
    <html>
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  )
}
```

**User context enrichment pattern** (to be applied in Server Actions and Route Handlers once auth is set up in a later ticket):

```typescript
import * as Sentry from '@sentry/nextjs'
// After getting the session:
Sentry.setUser({ id: session.user.id })
// On sign out:
Sentry.setUser(null)
```

**Key patterns:**

- `NEXT_PUBLIC_SENTRY_DSN` is safe to expose in the browser bundle — it identifies the project for error reporting, not a secret key
- `SENTRY_AUTH_TOKEN` is a build-only secret — set it in Vercel as a build environment variable, not a runtime variable; it is used only during `next build` to upload source maps
- Source maps are uploaded during the Vercel build process via `withSentryConfig` — they are stripped from the client bundle (`hideSourceMaps: true`)
- Do not enable Sentry locally (`NEXT_PUBLIC_SENTRY_DSN` is not set in `.env.local`) — errors surface in the terminal and browser console during local development
- Separate Sentry projects for staging and production prevent staging noise polluting production error feed

**Do not:**

- Set `NEXT_PUBLIC_SENTRY_DSN` in `.env.local` — local errors should go to the terminal, not Sentry
- Enable Sentry Replay at MVP — it increases bundle size significantly and is not yet needed
- Send user email, name, or phone in Sentry user context — only the `auth.uid()` UUID
- Use `debug: true` in production Sentry config — it logs verbose output to the console

## Acceptance Criteria

- [ ] `pnpm add @sentry/nextjs` completes; `@sentry/nextjs` appears in `package.json`
- [ ] `sentry.client.config.ts`, `sentry.server.config.ts`, and `sentry.edge.config.ts` exist with the configurations above
- [ ] `next.config.ts` is wrapped with `withSentryConfig` and the build completes successfully
- [ ] A test error thrown in the placeholder home page (`throw new Error('Sentry test')`) appears in the Sentry staging project within 60 seconds of triggering in a Preview deployment
- [ ] The test error Sentry event includes a TypeScript source trace (file name and line number in `.ts`/`.tsx`, not `.js`)
- [ ] `NEXT_PUBLIC_SENTRY_DSN` is set in Vercel Preview environment (staging DSN value) and Production environment (production DSN value)
- [ ] `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` are set as build-time variables in Vercel (not runtime)
- [ ] No Sentry errors are generated during a normal page load of the placeholder home page
- [ ] Sentry staging project receives errors tagged with `environment: staging`; production project receives errors tagged with `environment: production`

## Failure States

| Failure                                     | User-visible behavior                                                                                                                                                                         |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SENTRY_DSN` missing in Vercel  | Sentry initializes but reports no DSN configured; errors are silently dropped; engineer adds the variable and redeploys                                                                       |
| Source map upload fails in CI               | Sentry receives errors but stack traces show minified JavaScript filenames instead of TypeScript source; engineer checks `SENTRY_AUTH_TOKEN` is set and valid in the Vercel build environment |
| `withSentryConfig` breaks the Next.js build | `next build` fails with a Sentry-specific error; engineer checks for version compatibility between `@sentry/nextjs` and Next.js 14 and pins to a compatible version                           |
| PII captured in Sentry breadcrumbs          | User email or token appears in a Sentry event payload; engineer audits all `Sentry.setUser` calls and removes PII fields; rotates any leaked tokens                                           |

## Edge Cases

- If the Sentry wizard generates an `instrumentation.ts` file in addition to the config files, verify it is compatible with Next.js 14's instrumentation hook and does not conflict with any future instrumentation usage
- Sentry's `tracesSampleRate: 0.1` means only 10% of requests are traced in production — this is intentional to control costs; do not raise it without understanding the billing impact at V1+ traffic levels
- `app/global-error.tsx` replaces the root `error.tsx` boundary for errors during rendering — ensure it renders a minimal valid HTML shell since it runs when the root layout itself fails

## Accessibility Notes

- [ ] N/A — infrastructure ticket. `app/global-error.tsx` renders a Next.js native error component; accessibility of the generic error UI is handled by Next.js.

## QA Test Cases

| #   | Scenario                  | Role     | Steps                                                                                                                        | Expected result                                                                 |
| --- | ------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1   | Error captured in staging | Engineer | Deploy a Preview; navigate to a page that throws `throw new Error('Sentry connectivity test')`; check Sentry staging project | Event appears in Sentry within 60 seconds with TypeScript source context        |
| 2   | No errors on clean load   | Engineer | Load the homepage in a Preview deployment with no errors thrown                                                              | Sentry receives zero events for the page load                                   |
| 3   | Source maps resolve       | Engineer | In the Sentry event from QA-1, click the stack trace frame                                                                   | Frame resolves to the original `.tsx` filename and line number, not minified JS |
| 4   | No DSN in `.env.local`    | Engineer | Verify `.env.local` does not contain `NEXT_PUBLIC_SENTRY_DSN`; run `pnpm dev`; throw an error in a component                 | Error appears in the terminal/browser console but NOT in Sentry                 |

## Security Notes

- `SENTRY_AUTH_TOKEN` grants write access to the Sentry organization — it must be stored only as a Vercel build-time environment variable and rotated if it is ever logged or exposed
- `NEXT_PUBLIC_SENTRY_DSN` is intentionally public (identifies the project for ingest) but should not be committed as a raw value in source code — use the environment variable reference
- Never log or capture session tokens, auth cookies, or database query parameters in Sentry breadcrumbs or error context
- PII in Sentry constitutes a data privacy violation — review all `captureException` and `setUser` calls before the first production deployment

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
