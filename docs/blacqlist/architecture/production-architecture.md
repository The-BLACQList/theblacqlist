# Production Architecture — The BLACQList

**Last updated:** 2026-05-07
**Status:** Source of truth
**Owner:** Architecture + Engineering
**Linked ADRs:** `architecture-decisions.md`
**Linked data model:** `docs/blacqlist/data/entity-content-model.md`
**Linked route map:** `docs/blacqlist/ux/route-map.md`

This document is the production engineering reference for The BLACQList. It defines how the system is structured, how requests flow through it, how data is stored and retrieved, how auth and permissions are enforced, and how each major service layer is organized. It is intended to be implementation-ready: an engineer should be able to begin building any section of the platform from the relevant section of this document without needing to guess at patterns, resolve ambiguities, or ask clarifying questions about architecture.

Phase callouts — MVP, Beta, V1, V1.5, V2, V3 — appear throughout. They indicate what to build now versus what to defer.

---

## Table of Contents

1. Architecture Overview
2. Frontend Architecture
3. Backend Architecture
4. Database Architecture
5. Auth Architecture
6. Storage Architecture
7. Search Architecture
8. Marketplace and Payment Architecture
9. Flow-Map Architecture
10. AI Architecture
11. Analytics Architecture
12. Admin Architecture
13. Deployment Architecture
14. Monitoring and Logging
15. Scalability Considerations
16. What Stays Manual at MVP

---

## 1. Architecture Overview

### Platform Type

The BLACQList is a national discovery and commerce platform. Its architecture is SSR-heavy at the discovery layer — entity pages, city pages, and category pages must be fully server-rendered and indexable — with transactional flows layered on top for authenticated users (claim, create, manage, save, purchase).

The two primary concerns that shape every architecture decision are:

1. **SEO fidelity at scale.** Three hundred seeded listings at launch, targeting 5,000 within 12 months. Every BLACQList Page must produce a fully-rendered HTML document for Googlebot on first request, with complete structured data, OG meta, and a canonical URL. This is not achievable with a client-side SPA and is the primary driver of the Next.js App Router choice.

2. **Owner experience and trust.** The platform's growth depends on business owners claiming and maintaining their Pages. The owner-side flows — create, claim, edit, analytics, upgrade — must be fast, mobile-friendly, and forgiving of partial saves. This shapes the dashboard form architecture, autosave requirements, and the ISR strategy for how quickly owner edits become visible on the public Page.

### System Topology

```
User browser / search crawler
        │
        ▼
Vercel Edge Network (CDN + middleware execution)
        │
        ▼
Next.js App Router (Vercel serverless functions)
   ├── Server Components   (initial render, data fetch)
   ├── Server Actions      (mutations)
   ├── Route Handlers      (API endpoints, webhooks)
   └── Edge Middleware     (auth check, redirects)
        │
        ▼
Service layer  (lib/services/)
        │
        ├──── Supabase PostgreSQL (primary database + RLS)
        ├──── Supabase Auth       (sessions, JWT)
        ├──── Supabase Storage    (3 buckets)
        ├──── Stripe              (subscriptions V1, Connect V2)
        ├──── Resend              (transactional email)
        └──── Anthropic API       (AI features V2+)
```

### Request Lifecycle: BLACQList Page

This is the most performance-critical path in the system. It must produce a full HTML response with structured data for search crawlers and a fast First Contentful Paint for human visitors.

1. Browser sends `GET /atlanta/business/sweet-auburn-bbq-atlanta`
2. Request hits Vercel Edge Network
3. Edge middleware (`middleware.ts`) runs: checks for session cookie; no auth required for this route, so request proceeds without redirect
4. Vercel checks ISR cache: if cached copy is fresh (within 1-hour revalidation window), serve from CDN — no database call
5. On cache miss, request reaches the Next.js server function: `app/(public)/[city-slug]/business/[listing-slug]/page.tsx`
6. Server Component runs: queries Supabase for the listing record (base + `listing_details_business` + `media_attachments` + category + city) using the Supabase server client
7. Supabase RLS evaluates the query: listing is published, not deleted, not flagged — allows read
8. Page tree renders: static sections (hero, about, services, contact) render synchronously; sections requiring secondary data (save count, review aggregate) wrapped in `<Suspense>` boundaries and streamed
9. Next.js generates: complete HTML with JSON-LD structured data, OG meta tags, canonical URL, and React hydration payload
10. Response returned to Vercel Edge; stored in ISR cache with `revalidate: 3600`
11. Browser renders: above-the-fold content visible immediately; streamed Suspense boundaries resolve

### Scale Targets

| Metric                    | Launch          | 12 months           |
| ------------------------- | --------------- | ------------------- |
| Seed listings             | 300+ (3 cities) | 5,000+              |
| Monthly visitors          | —               | 50,000              |
| Monthly page views        | —               | ~250,000 (estimate) |
| Business owners (claimed) | 30–50 at launch | 1,500+              |

These targets are well within single-region Supabase and Vercel serverless capacity at MVP and V1. The search architecture upgrade (PostgreSQL → Algolia) is the only infrastructure change driven by scale within the 12-month window.

### ISR Strategy

| Route                                     | Strategy                                                      | Revalidation interval |
| ----------------------------------------- | ------------------------------------------------------------- | --------------------- |
| `/[city-slug]/business/[listing-slug]`    | ISR with `generateStaticParams` for all published listings    | 1 hour                |
| `/city/[city-slug]`                       | ISR with `generateStaticParams` for all cities                | 24 hours              |
| `/city/[city-slug]/[category-slug]`       | ISR with `generateStaticParams` for all active combinations   | 24 hours              |
| `/collection/[slug]`                      | ISR with `generateStaticParams` for all published collections | 1 hour                |
| `/`, `/discover`                          | ISR                                                           | 30 minutes            |
| `/search`                                 | Dynamic — always server-rendered, no cache                    | None                  |
| `/dashboard/*`, `/account/*`, `/admin/*`  | Dynamic — session-dependent, never cached                     | None                  |
| `/privacy`, `/terms`, `/cookies`, `/dmca` | Fully static                                                  | No revalidation       |

On-demand revalidation (`revalidateTag` or `revalidatePath`) is called from Server Actions when an owner saves a Page edit or an admin publishes a listing, so the public Page reflects changes before the 1-hour TTL expires.

### Streaming Strategy

Entity pages use `<Suspense>` to stream secondary data sections independently of the primary content. The hero section, about text, and CTA render synchronously. Save count, review aggregate (V1), and analytics-dependent content are wrapped in `<Suspense>` with skeleton fallbacks. This pattern ensures above-the-fold content is visible immediately even if secondary data queries are slower.

---

## 2. Frontend Architecture

### Framework and Defaults

Next.js 14+ App Router. TypeScript strict mode. All components Server Components by default. `"use client"` added only when the component requires browser APIs, user event handlers, React state, or hooks that cannot run server-side.

### Route Group Structure

The App Router folder structure uses route groups (parenthesized directories) to separate layout shells without affecting URL paths.

| Route Group | Folder              | Shared Layout                         | Routes                                                                         |
| ----------- | ------------------- | ------------------------------------- | ------------------------------------------------------------------------------ |
| Public      | `app/(public)/`     | Top nav, footer, cookie banner        | `/`, `/discover`, `/search`, `/city/*`, entity pages, legal pages              |
| Auth        | `app/(auth)/`       | Centered minimal layout, no nav       | `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/verify-email` |
| Onboarding  | `app/(onboarding)/` | Progress indicator, no full nav       | `/onboarding`                                                                  |
| Dashboard   | `app/(dashboard)/`  | Sidebar nav, top bar, mobile nav      | `/dashboard/*`, `/account/*`, `/claim`, `/add-business`                        |
| Admin       | `app/(admin)/`      | Admin sidebar, breadcrumbs, role gate | `/admin/*`                                                                     |

### Server vs. Client Component Boundaries

The default is always Server Component. Client Components are added when a specific requirement forces it.

Components that must be `"use client"`:

| Component                           | Reason                                                  |
| ----------------------------------- | ------------------------------------------------------- |
| Search filter bar                   | `useSearchParams`, `useRouter` for URL state management |
| Save button                         | `onClick` handler, optimistic UI state                  |
| Page editor form                    | `react-hook-form`, `useState`, autosave effect          |
| Claim form and create-business form | `react-hook-form`, multi-step state                     |
| Admin approve/reject action buttons | `onClick`, confirmation dialog                          |
| Image gallery uploader              | `useState`, drag-to-reorder                             |
| Mobile navigation                   | `useState` for open/close toggle                        |
| Cookie consent banner               | `localStorage`, `useState`                              |
| `/near-me` geo detection (V2)       | `navigator.geolocation` browser API                     |
| OG share button                     | `navigator.clipboard` or `navigator.share`              |

All other components — entity pages, city pages, search results list, analytics display, admin list views — remain Server Components. Data is fetched in Server Components and passed as props to any Client Component children that need it.

### State Management

No global state library at MVP or V1. Three state categories and their patterns:

| State type                                            | Pattern                                                            | Where                                |
| ----------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------ |
| URL-driven state (filters, search params, pagination) | `useSearchParams` + `useRouter`                                    | Client Component filter bars         |
| Local UI state (modals, open/close, form step)        | `useState`, `useReducer`                                           | Client Components                    |
| Server state (remote data)                            | Server Components for initial render; Server Actions for mutations | Server Components + `revalidatePath` |

Global state libraries (Zustand, Jotai) are not added unless a demonstrated need arises where distant Client Components share state that cannot be lifted to a Server Component or URL param.

### Forms

All forms use `react-hook-form` with a `zod` resolver. The same `zod` schema is shared between the form and the Server Action that processes the submission. This eliminates schema drift between client validation and server validation.

Form state requirements:

- Submit button shows loading state during Server Action execution
- Field-level errors rendered immediately on blur and again on submit
- Forms preserve all user input on validation failure — never clear on error
- Multi-step forms (create business, claim) store step state in `useState` within a Client Component wrapper; completed step data is accumulated in local state until final submission
- The `/dashboard/page` editor (BLACQList Page editor) autosaves on section blur via a debounced Server Action call, with an inline "Saved" / "Unsaved changes" indicator

### Required Files Per Route Segment

| File            | Purpose                    | Required for                      |
| --------------- | -------------------------- | --------------------------------- |
| `page.tsx`      | Rendered page content      | Every accessible URL              |
| `layout.tsx`    | Shared layout and shell    | Route groups; dashboard; admin    |
| `loading.tsx`   | Suspense fallback skeleton | All data-heavy pages              |
| `error.tsx`     | Runtime error boundary     | All routes that fetch remote data |
| `not-found.tsx` | 404 content                | Entity detail routes              |
| `route.ts`      | API endpoint handler       | All `/api/` routes                |

### OG Image Generation

Every BLACQList Page generates a unique Open Graph image via the `/og/[...params]` route handler using `@vercel/og`. The `og:image` meta tag on each listing page references this route. The handler composes an image from the listing's cover image or logo, the business name, category, and city label. OG images are edge-cached with a long TTL and a cache key based on the listing slug. When a listing's cover image or name changes, on-demand revalidation is triggered for the OG route.

---

## 3. Backend Architecture

### Server Actions vs. Route Handlers

The backend is split between two execution contexts. The decision rule is clear:

**Use Server Actions for:**

- All mutations owned by the app: create listing, edit listing, submit claim, save/unsave, upload image, approve claim, flag listing, update user settings
- Any mutation that originates from a form or button in the product UI
- Operations that must invalidate the ISR cache after completing (`revalidatePath`, `revalidateTag`)

**Use Route Handlers (`app/api/`) for:**

- The public search endpoint (`GET /api/search`) — needed as a standalone endpoint callable by external clients or future mobile apps
- Webhook receivers (`/api/webhooks/stripe`, `/api/webhooks/resend`) — POST endpoints called by external services with their own signature verification requirements
- Signed URL generation for private storage assets — needs to return a URL without a full page re-render
- The analytics event endpoint (`POST /api/analytics/event`) — fire-and-forget from client-side JS without a form submission
- The save/unsave endpoint (`/api/saves`) — lightweight toggle called by Client Component buttons without a page transition

### Service Layer

Route Handlers and Server Actions must remain thin. They validate input, call a service, and return a result. Business logic and database queries live in service modules under `lib/services/`.

```
lib/
  services/
    listing-service.ts          business logic for listings (create, update, publish, flag)
    claim-service.ts            claim submission, approval, rejection workflow
    search-service.ts           full-text search query construction and execution
    save-service.ts             save/unsave logic
    upload-service.ts           file validation, Supabase Storage write, path management
    analytics-service.ts        analytics event writes and aggregation queries
    email-service.ts            Resend API wrappers for all transactional emails
    auth-service.ts             session helpers, role checks, permission assertions
    admin-service.ts            admin mutations, audit log writes
    stripe-service.ts           (V1) Stripe session creation, webhook handling
    ai-service.ts               (V2) Anthropic API calls, prompt construction
  db/
    listing-queries.ts          raw Supabase queries for listing reads (used by services)
    search-queries.ts           FTS query construction
    analytics-queries.ts        analytics aggregation queries
  validations/
    listing.ts                  zod schemas for listing create/edit forms
    claim.ts                    zod schemas for claim submission
    upload.ts                   zod schemas for upload validation
    search.ts                   zod schemas for search query params
```

Nothing goes directly in a Server Action or Route Handler that could be unit-tested in isolation. If it has logic, it is in a service.

### Validation

Every request is validated server-side with `zod` before any business logic executes. This applies to:

- Server Action: validate `FormData` or typed object input at the top of the function, before any DB call
- Route Handler: validate `request.json()` or `request.url` search params before processing
- Webhook handlers: validate the webhook signature first, then validate the payload shape

Validation failures return `400` with field-level detail. Validation never silently passes invalid data through to the database.

### Error Handling

Errors are caught at the service boundary. Services return typed result objects rather than throwing uncaught exceptions into route handlers.

The error classification and response pattern:

| Error type                       | HTTP status | Client response                                                           |
| -------------------------------- | ----------- | ------------------------------------------------------------------------- |
| Validation failure               | 400         | `{ error: "Validation failed", code: "VALIDATION_ERROR", fields: {...} }` |
| Missing or invalid session       | 401         | `{ error: "Authentication required" }`                                    |
| Valid session, insufficient role | 403         | `{ error: "Access denied" }`                                              |
| Resource not found               | 404         | `{ error: "Not found" }`                                                  |
| State conflict (duplicate)       | 409         | `{ error: "...", code: "ALREADY_EXISTS", existingId: "..." }`             |
| Business rule violation          | 422         | `{ error: "...", code: "..." }`                                           |
| Unexpected failure               | 500         | `{ error: "Something went wrong" }`                                       |

Raw database errors and stack traces must never reach the client. All unexpected errors are caught, logged server-side with full context (operation, user ID, error), and returned to the client as a generic 500 response.

### Background Jobs

Operations that must not block a user request run as Supabase Edge Functions triggered on a schedule or by a database webhook.

| Job                                  | Trigger                               | Payload                                                                  | Phase |
| ------------------------------------ | ------------------------------------- | ------------------------------------------------------------------------ | ----- |
| Auto-archive expired events and jobs | Daily cron                            | Listings where `auto_archive_at <= now()` or `auto_expire_at <= now()`   | Beta  |
| Stale listing detection              | Daily cron                            | Listings where `last_edited_by_owner_at` is null or > 180 days ago       | V1    |
| Sponsored placement expiry           | Daily cron                            | Listings where `sponsored_expires_at <= now()` and `is_sponsored = true` | V1    |
| Welcome email                        | Post-signup webhook on `users` insert | `{ user_id, email, display_name }`                                       | MVP   |
| Claim approved email                 | Post-approval Server Action call      | `{ claim_id, user_id, listing_name }`                                    | MVP   |
| Claim rejected email                 | Post-rejection Server Action call     | `{ claim_id, user_id, listing_name, reason }`                            | MVP   |
| Stripe subscription sync             | Stripe webhook                        | Subscription event payload                                               | V1    |
| BLACQList Certified auto-grant       | PostgreSQL trigger on `reviews` table | Fires on review insert or status update to published                     | V1    |

All background jobs must be idempotent. Running the same job twice must not produce duplicate side effects. Daily cron jobs check for rows not already in the target state before updating them.

---

## 4. Database Architecture

### Platform

Supabase managed PostgreSQL. PgBouncer connection pooling in transaction mode (required for serverless function compatibility — serverless functions cannot hold long-lived database connections). All application code uses the Supabase client in transaction pooling mode.

### Core Design Principles

- UUID primary keys on all tables (`gen_random_uuid()`) — no sequential integer IDs exposed in any URL or API response
- `timestamptz` for all datetime fields — never bare `timestamp`
- `text` instead of `varchar(255)` for string fields
- `NOT NULL` by default; nullable only when absence of data is semantically meaningful
- Soft deletes (`deleted_at timestamptz`) on `listings` and `users`; hard delete on ephemeral data
- All default queries filter `WHERE deleted_at IS NULL`; enforced by RLS

### Standard Audit Fields

Every table that represents a persistent entity carries:

| Field        | Type          | Default             | Notes                              |
| ------------ | ------------- | ------------------- | ---------------------------------- |
| `id`         | `uuid`        | `gen_random_uuid()` | Primary key                        |
| `created_at` | `timestamptz` | `now()`             | Set on insert, never updated       |
| `updated_at` | `timestamptz` | `now()`             | Updated by trigger on every UPDATE |

Entry tables with user attribution also carry `submitted_by` and `updated_by` (FK to `users.id` with `ON DELETE SET NULL`).

### Base + Extension Table Pattern

Every entity type on the platform shares a single `listings` base table. Entity-type-specific fields live in `listing_details_*` extension tables, each with a one-to-one FK back to `listings.id` with `ON DELETE CASCADE`.

This design means:

- Search, discovery, SEO, status, trust, and admin fields are consistent across all entity types — they are always on `listings`
- Adding a new entity type requires only a new `listing_details_*` table
- RLS policies on `listings` apply universally; extension tables inherit access through their FK

The six extension tables:

| Table                          | Entity type  | Phase |
| ------------------------------ | ------------ | ----- |
| `listing_details_business`     | Business     | MVP   |
| `listing_details_professional` | Professional | Beta  |
| `listing_details_creative`     | Creative     | Beta  |
| `listing_details_event`        | Event        | Beta  |
| `listing_details_job`          | Job          | Beta  |
| `listing_details_vendor`       | Vendor       | V2    |

Sub-entity tables (children of top-level entities, not searchable themselves):

| Table      | Parent                                                         | Phase |
| ---------- | -------------------------------------------------------------- | ----- |
| `services` | `listings` where `entity_type IN ('business', 'professional')` | MVP   |
| `products` | `listings` where `entity_type = 'vendor'`                      | V2    |

### Supporting Tables

| Table                 | Purpose                                                                                         | Phase |
| --------------------- | ----------------------------------------------------------------------------------------------- | ----- |
| `users`               | Auth and profile; FK target for `owner_user_id`, `submitted_by`, `updated_by` across all tables | MVP   |
| `user_roles`          | Role assignments; one row per user-role pair (allows multiple roles per user)                   | MVP   |
| `categories`          | Hierarchical category tree; top-level and subcategories                                         | MVP   |
| `cities`              | City/metro reference table with SEO slugs and geo data                                          | MVP   |
| `claims`              | Ownership claim requests; FK to listing and claiming user                                       | MVP   |
| `saves`               | User-listing save associations; FK to both                                                      | MVP   |
| `media_attachments`   | Polymorphic media store; `entity_type` + `entity_id` pattern                                    | MVP   |
| `analytics_events`    | Page views, CTA clicks, shares, search events                                                   | MVP   |
| `collections`         | Editorial curated collections                                                                   | MVP   |
| `collection_listings` | Junction table: collections ↔ listings                                                          | MVP   |
| `reviews`             | Star ratings and text reviews                                                                   | V1    |
| `spend_events`        | Tracked spend linked to listings and users                                                      | V2    |
| `admin_audit_log`     | Record of all admin mutations                                                                   | MVP   |

### Full-Text Search Index

The `listings` table carries a `search_vector tsvector` column that concatenates:

- `name` (weight A — highest)
- `category name` (denormalized or joined — weight B)
- `city name` (weight B)
- `description` from the relevant `listing_details_*` table (weight C)
- `tagline` (weight C)

A `GIN` index on `search_vector` enables fast full-text queries. A trigger on INSERT and UPDATE to `listings` (and on UPDATE to `listing_details_business.description`) updates the `search_vector` column automatically.

The `pg_trgm` extension provides fuzzy matching via trigram similarity. Fuzzy matching is applied when the exact FTS query returns fewer than 5 results.

### Migration Strategy

All schema changes are represented as migration files managed by the Supabase CLI.

Workflow:

1. Make schema changes in the local Supabase development environment
2. Run `supabase db diff --file [name]` to generate a migration file
3. Review the migration for correctness and safety
4. Apply to staging: `supabase db push --db-url [staging-url]`
5. Verify staging is correct
6. Apply to production: `supabase db push --db-url [production-url]`

Destructive migrations (DROP COLUMN, DROP TABLE, TRUNCATE, renames used in application code) require: a confirmed backup, a written rollback plan, and explicit approval before execution.

Zero-downtime patterns for high-traffic tables: add column (nullable) → backfill data → add NOT NULL constraint → remove old column. Never add a NOT NULL column with no default to a populated table in a single migration.

### Row Level Security

RLS is enabled on all tables. Every table has explicit policies. The absence of a matching policy denies access. The Supabase service role key bypasses RLS and is used only in server-side code — never in client-side code or exposed in environment variables accessible to the browser.

The core RLS patterns on `listings`:

| Policy                                  | Condition                                                                               |
| --------------------------------------- | --------------------------------------------------------------------------------------- |
| Public read of published listings       | `status = 'published' AND deleted_at IS NULL AND flag_status = 'none'`                  |
| Owner read of own listings (any status) | `auth.uid() = owner_user_id`                                                            |
| Owner update of own listings            | `auth.uid() = owner_user_id AND status != 'archived'`                                   |
| Admin full access                       | `auth.uid() IN (SELECT user_id FROM user_roles WHERE role IN ('admin', 'super_admin'))` |

Extension tables inherit access through their FK — a user who can read a `listings` row can read the associated `listing_details_business` row through a join, because the extension table policy checks access via the parent listing's policy.

---

## 5. Auth Architecture

### Provider

Supabase Auth. Email + password at MVP. Google OAuth at V1. Apple OAuth at V2 (required for iOS App Store compliance).

### Session Management

Sessions use JWT stored in httpOnly cookies. The `@supabase/ssr` package manages the cookie-based session on both server and client. The Supabase client on the server reads the session from cookies on every server-side request. Session refresh is handled automatically by the Supabase client.

| Property         | Value                                       |
| ---------------- | ------------------------------------------- |
| Session storage  | httpOnly, SameSite=Lax cookie               |
| Token type       | Supabase JWT (not exposed to client JS)     |
| Session duration | Supabase default (1 week with refresh)      |
| Refresh strategy | Automatic via Supabase SSR helpers          |
| Expiry handling  | Redirect to `/sign-in?next=[original-path]` |

Sessions are never stored in `localStorage`. Client-side JavaScript does not have direct access to the JWT token.

### Auth Flows

| Flow               | Trigger                                | Steps                                                                                                            | Post-action                                                           |
| ------------------ | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Sign up            | User submits `/sign-up` form           | Create Supabase Auth user → create `users` row → assign Supporter role in `user_roles` → send verification email | Redirect to `/verify-email` screen                                    |
| Email verification | User clicks link in verification email | Supabase validates token → marks email verified                                                                  | Redirect to `/onboarding`                                             |
| Sign in            | User submits `/sign-in` form           | Supabase validates credentials → sets httpOnly session cookie                                                    | Redirect to `?next=` param or `/dashboard`                            |
| Sign out           | User clicks sign out                   | Supabase clears session cookie                                                                                   | Redirect to `/`                                                       |
| Password reset     | User submits `/forgot-password` form   | Supabase sends reset email                                                                                       | Always shows success message (no email enumeration)                   |
| Reset password     | User clicks link in reset email        | Validate token → user sets new password                                                                          | Redirect to `/sign-in`                                                |
| Google OAuth (V1)  | User clicks "Continue with Google"     | Redirect to Google → OAuth callback → create or link Supabase Auth user → set session                            | Redirect to `/onboarding` (new user) or `/dashboard` (returning user) |

### Role Management

Roles are stored in the `user_roles` table, not embedded in the JWT. This allows role changes to take effect immediately without requiring the user to re-authenticate.

The `user_roles` table structure:

| Column        | Type                                                                     | Notes                                            |
| ------------- | ------------------------------------------------------------------------ | ------------------------------------------------ |
| `id`          | `uuid`                                                                   | PK                                               |
| `user_id`     | `uuid` FK → `users.id` ON DELETE CASCADE                                 | The user                                         |
| `role`        | `text` CHECK IN ('supporter', 'owner', 'editor', 'admin', 'super_admin') | The assigned role                                |
| `assigned_by` | `uuid` FK → `users.id` ON DELETE SET NULL                                | Who assigned the role (null for system-assigned) |
| `created_at`  | `timestamptz`                                                            | When assigned                                    |

A user can have multiple rows (multiple roles). The `owner` role is assigned by the system when a claim is approved. The `admin` role is assigned only by a `super_admin` through the admin users interface.

Role checks happen server-side on every protected operation:

1. Session is read from the httpOnly cookie via the Supabase server client
2. The `user_roles` table is queried for the authenticated user's roles
3. The required role is asserted; if not present, return `403` or redirect

The client never trusts its own role claim. Even if a client sends a request asserting it has admin access, the server verifies against the `user_roles` table before executing any privileged operation.

### Middleware Protection

`middleware.ts` runs at the Vercel Edge before any protected page renders. It checks the session cookie using the Supabase server client.

Protected route patterns:

| Pattern                | Check                                     | On failure                                               |
| ---------------------- | ----------------------------------------- | -------------------------------------------------------- |
| `/dashboard(.*)`       | Valid session                             | Redirect to `/sign-in?next=[path]`                       |
| `/account(.*)`         | Valid session                             | Redirect to `/sign-in?next=[path]`                       |
| `/claim(.*)`           | Valid session                             | Redirect to `/sign-in?next=[path]`                       |
| `/add-business`        | Valid session                             | Redirect to `/sign-in?next=[path]`                       |
| `/onboarding`          | Valid session                             | Redirect to `/sign-in`                                   |
| `/admin(.*)`           | Valid session + admin or super_admin role | Redirect to `/` (no indication of admin route existence) |
| `/sign-in`, `/sign-up` | Already authenticated → redirect          | Redirect to `/dashboard`                                 |

Admin role checking in middleware uses a Supabase service client to query `user_roles`. This is the first layer of defense; server-side role checks within each admin page are the second layer.

---

## 6. Storage Architecture

### Buckets

Three buckets in Supabase Storage. Bucket structure defined before any upload code is written.

| Bucket              | Access                     | Contents                                               | Path pattern                                        |
| ------------------- | -------------------------- | ------------------------------------------------------ | --------------------------------------------------- |
| `listing-media`     | Public (CDN-served)        | Logos, cover images, gallery images, product images    | `[entity_type]/[listing_id]/[timestamp]-[filename]` |
| `verification-docs` | Private (signed URLs only) | Business license uploads, EIN documents, identity docs | `claims/[claim_id]/[timestamp]-[filename]`          |
| `receipts`          | Private (signed URLs only) | User receipt photos                                    | `receipts/[user_id]/[timestamp]-[filename]`         |

### Access Rules

**`listing-media` (public):** Files are publicly accessible via Supabase CDN URLs. All entity images, logos, and gallery photos are in this bucket. The Supabase CDN handles delivery. Next.js Image optimization is configured to allow the `supabase.co` domain in `next.config.ts`. Storage paths — not CDN URLs — are stored in the database. CDN URLs are generated at read time from the stored path.

**`verification-docs` (private):** No public access under any circumstances. Admin-only read access. Signed URLs are generated server-side with a 15-minute expiry when an admin views a claim record. The signed URL is generated by a Server Action, returned to the admin's browser session only, and never stored. RLS on the storage bucket enforces that only service-role requests can read from this bucket. Application-layer code generates signed URLs only after verifying the requesting user has the `admin` or `super_admin` role.

**`receipts` (private):** Owner-only access. Signed URLs generated server-side with a 15-minute expiry when the authenticated user accesses their own receipt records. RLS enforces `auth.uid() = owner_user_id` on the storage bucket. Receipt images are never accessible to other users or admins except through a designated admin review interface that generates signed URLs after role verification.

### Upload Validation

All file validation happens server-side in the upload service before any write to Supabase Storage. Client-side validation is informational only and is never the enforcement mechanism.

Server-side validation rules:

| Check                        | Rule                                                | Failure response                  |
| ---------------------------- | --------------------------------------------------- | --------------------------------- |
| MIME type                    | `image/jpeg`, `image/png`, `image/webp` only        | `400` with specific error message |
| File size — logo             | Max 2 MB                                            | `400`                             |
| File size — cover image      | Max 5 MB                                            | `400`                             |
| File size — gallery image    | Max 5 MB                                            | `400`                             |
| File size — verification doc | Max 10 MB                                           | `400`                             |
| File size — receipt          | Max 10 MB                                           | `400`                             |
| Gallery count                | Enforced against tier limit before accepting upload | `409` if limit reached            |

### Storage Paths

Storage paths follow the pattern `[entity_type]/[listing_id]/[timestamp]-[filename]`. The timestamp prefix prevents collisions when the same file is re-uploaded. File names are sanitized to be URL-safe before storage.

The database always stores the storage path, never the CDN URL. CDN URLs are constructed at read time using the Supabase Storage public URL helper. Signed URLs for private buckets are generated at read time with a short expiry and are never stored.

---

## 7. Search Architecture

### MVP: PostgreSQL Full-Text Search

The `listings` table carries a `search_vector tsvector` column maintained by a trigger. The trigger fires on INSERT and UPDATE to `listings` and on UPDATE to `listing_details_business.description`.

Vector composition:

| Source field                           | Weight      | Rationale                                      |
| -------------------------------------- | ----------- | ---------------------------------------------- |
| `listings.name`                        | A (highest) | Business name is the strongest search signal   |
| `categories.name` (joined)             | B           | Category match is highly relevant              |
| `cities.name` (joined)                 | B           | City match is highly relevant for local intent |
| `listing_details_business.description` | C           | Body text, lower weight                        |
| `listings.tagline`                     | C           | Short descriptor                               |
| `listings.service_area_description`    | D           | Geographic context                             |

A `GIN` index on `search_vector` provides fast FTS query execution.

The `pg_trgm` extension is installed. Trigram similarity is used as a fallback when an exact FTS query returns fewer than 5 results, enabling fuzzy matching for misspellings and partial names.

### Search Endpoint

`GET /api/search` is a public Route Handler. It accepts the following query parameters:

| Parameter  | Type    | Notes                                                                                    |
| ---------- | ------- | ---------------------------------------------------------------------------------------- |
| `q`        | string  | Free-text query. Converted to FTS query with `plainto_tsquery` or `websearch_to_tsquery` |
| `city`     | string  | City slug. Joined to `cities` table and filtered as `city_id`                            |
| `category` | string  | Category slug. Joined to `categories` table and filtered as `category_id`                |
| `type`     | string  | Entity type. One of: `business`, `professional`, `creative`, `event`, `job`, `vendor`    |
| `page`     | integer | Default 1                                                                                |
| `limit`    | integer | Default 20, max 100                                                                      |

Response envelope:

```
{
  "data": [listing records with basic fields],
  "meta": { "total": N, "page": N, "limit": 20 }
}
```

Sort order: relevance (`ts_rank`) descending, then `published_at` descending as a tiebreaker. Sponsored listings receive a ranking boost applied in the query (not by reordering in application code).

The search endpoint applies the following filters unconditionally regardless of query params:

- `status = 'published'`
- `deleted_at IS NULL`
- `flag_status = 'none'`

RLS does not apply to the public search endpoint (it uses the anon key, which only sees published, non-deleted, non-flagged listings through the RLS policies).

### Upgrade Path

The upgrade to Algolia is triggered when any one of the following conditions is met:

- Total published listings exceed 50,000
- Search query p95 latency exceeds 500ms (measured via Vercel Analytics or Supabase query logs)
- User-facing need for synonym expansion ("barber" matching "barbershop", "locs" matching "loctician") is validated
- AI-assisted conversational search (V2) requires vector similarity, which cannot be served by PostgreSQL FTS alone

Migration approach when triggered:

1. Build the Algolia index in parallel from existing Supabase data (batch sync script)
2. Keep PostgreSQL as source of truth — Algolia is a read replica for search only
3. Implement a webhook from Supabase (via Supabase database webhooks or Edge Functions) to sync listing updates to Algolia in real time
4. Swap the `/api/search` route handler to query Algolia instead of PostgreSQL
5. Run both systems in parallel for a validation period before decommissioning PostgreSQL FTS queries

PostgreSQL FTS is never removed — it remains the source of truth. Only the search query path changes.

---

## 8. Marketplace and Payment Architecture

### Phase Scope

| Phase | Payment scope                                                      |
| ----- | ------------------------------------------------------------------ |
| MVP   | No payments                                                        |
| V1    | Stripe subscriptions for listing tier upgrades (Standard, Premium) |
| V1.5  | Stripe Customer Portal for self-service subscription management    |
| V2    | Stripe Connect for vendor marketplace payouts                      |

### V1: Listing Tier Subscriptions

Stripe Products and Prices are created for two paid listing tiers: Standard and Premium. Free tier requires no Stripe record.

Subscription flow:

1. Business owner visits `/dashboard/upgrade`
2. Server Action creates a Stripe Checkout Session with the appropriate Price ID and the user's Stripe Customer ID (created on first subscription or retrieved from `users.stripe_customer_id`)
3. User is redirected to Stripe-hosted Checkout
4. On success, Stripe sends `checkout.session.completed` webhook to `/api/webhooks/stripe`
5. Webhook handler verifies Stripe signature, updates `listings.tier` for the owner's listing, and writes a subscription record
6. On cancel, Stripe sends `customer.subscription.deleted` webhook; handler sets tier back to `'free'`

Stripe fields stored on `users`:

| Field                | Notes                                                  |
| -------------------- | ------------------------------------------------------ |
| `stripe_customer_id` | Created on first subscription attempt; null until then |

Stripe fields on `listings`:

| Field                    | Notes                                                             |
| ------------------------ | ----------------------------------------------------------------- |
| `tier`                   | `'free'` / `'standard'` / `'premium'`; updated by webhook handler |
| `stripe_subscription_id` | Current active subscription ID; null for free tier                |

### V1.5: Stripe Customer Portal

The `/dashboard/billing` route generates a Stripe Customer Portal session server-side and redirects the user to the Stripe-hosted portal. No UI to build beyond a redirect button and loading state. The portal handles subscription cancellation, payment method updates, and invoice downloads.

### V2: Stripe Connect (Marketplace Payouts)

Vendor onboarding flow:

1. Vendor clicks "Connect Stripe" in their vendor dashboard
2. Server Action creates a Stripe Connect Account Link for an Express account
3. Vendor completes KYC on Stripe-hosted onboarding
4. Stripe sends `account.updated` webhook when onboarding completes
5. Webhook handler sets `listing_details_vendor.stripe_connect_id` and updates `stripe_connect_status` to `'active'`

Marketplace purchase flow (V2):

1. Buyer adds product to cart
2. Server Action creates a Stripe Payment Intent with `transfer_data.destination` set to the vendor's `stripe_connect_id` and a platform application fee
3. Buyer completes payment via Stripe Elements embedded checkout
4. On success, Stripe sends `payment_intent.succeeded` webhook
5. Webhook handler creates an order record, decrements inventory, sends confirmation emails to buyer and vendor

### Webhook Security

All webhook handlers validate the Stripe signature using `stripe.webhooks.constructEvent()` with the raw request body before processing any event. Handlers are idempotent — they check for an existing processed record keyed by `stripe_event_id` before executing any state change. Duplicate events from Stripe are silently acknowledged.

---

## 9. Flow-Map Architecture

### Data Model Foundation (V2)

The `spend_events` table is the sole data foundation for the dollar-flow map. It is populated from two sources at V2:

1. **In-platform marketplace purchases:** When a buyer completes a checkout, a `spend_event` row is created automatically with `source = 'marketplace-purchase'`, `vendor_listing_id`, `user_id`, `amount`, and `category` inferred from the product.

2. **Receipt uploads:** When a supporter uploads a receipt and attributes it to a BLACQList listing, a `spend_event` row is created with `source = 'receipt-upload'`. At V2 MVP, OCR parsing is a stub — the user manually enters the amount and category after uploading the photo. `ocr_confidence` is null for manual entries.

No external graph database is needed. `spend_events` rows aggregated by `business_id` and date provide all the data needed for V2 and V3 visualizations.

### V2: Aggregate Counter

The `/api/spend/city-total` endpoint (V2) returns the aggregate dollar amount spent with Black-owned businesses in a city:

```
SELECT city_id, SUM(amount) as total
FROM spend_events
JOIN listings ON spend_events.business_id = listings.id
WHERE listings.city_id = [city_id]
GROUP BY city_id
```

This query result is cached in memory (or via a simple `unstable_cache` wrapper in Next.js) with a 1-hour TTL. The result surfaces as the "Total spent" counter on city pages and the homepage. No visualization at V2 beyond this counter.

### V3: Interactive Graph

The full dollar-flow map visualization reads from aggregated `spend_events` data. The graph nodes are businesses; edges are spend flows between a supporter's location and the business. The visualization library (D3.js or React Flow — see ADR open decision) renders this as an interactive graph.

No schema changes are required at V3. The `spend_events` table established in V2 is the complete data source. The only V3 addition is:

- A `flow_map_opt_in` boolean field on `listings` (default `false`) — businesses appear as nodes only when they have opted in
- The aggregate query and graph data API endpoint
- The client-side visualization component

---

## 10. AI Architecture

### Phase and Scope

All AI features are V2 and later. No AI integration at MVP or Beta. No AI integration at V1 beyond the data being ready.

| Phase | AI capability                                                                      |
| ----- | ---------------------------------------------------------------------------------- |
| V2    | Business Page optimization suggestions for owners; conversational discovery search |
| V3    | Admin curation agent (surfaces trending listings, flags stale content)             |

### Provider

Anthropic Claude API. Server-side only. The API key is stored in an environment variable (`ANTHROPIC_API_KEY`) accessible only to server-side code. It is never included in a client bundle, never returned in an API response, and never logged.

### Module Structure

All AI code lives in `lib/ai/`.

```
lib/ai/
  client.ts               Anthropic SDK initialization; exports typed client
  prompts/
    page-optimization.ts  Prompt template for business description suggestions
    discovery-search.ts   Prompt template for conversational search
    admin-curation.ts     Prompt template for admin curation recommendations (V3)
  services/
    page-optimizer.ts     Server-side service: accepts listing record, returns suggestions
    discovery-search.ts   Server-side service: accepts natural language query, returns ranked results with reasoning
```

### Rate Limiting

Before any call to the Anthropic API, the `auth-service` checks a per-user rate limit counter stored in Supabase (or a Redis instance at V2 if needed). The limit at V2 launch:

- Page optimization suggestions: 10 per day per user
- Conversational search: 20 per day per user (anonymous users share a global bucket keyed by IP)

If the rate limit is exceeded, the server returns `429` with a `Retry-After` header. The client displays a human-readable message ("You've used your daily AI suggestions — check back tomorrow").

### Response Handling

At V2, AI responses are simple request/response (no streaming to the client). The Server Action:

1. Checks rate limit
2. Sends prompt to Anthropic API with a timeout of 10 seconds
3. Parses the response into a typed suggestions object
4. Returns the suggestions to the client

If the Anthropic API times out or returns an error, the Server Action returns a graceful degradation response — the feature is unavailable, but the user is not shown a hard error.

Prompt templates are versioned in code (not stored in the database at V2). When prompt quality warrants iteration, templates are updated via code deploy. Migrating prompt management to admin-editable database records is deferred to V3.

---

## 11. Analytics Architecture

### MVP: Custom Events + Vercel Analytics

Two analytics layers from day one:

**Custom `analytics_events` table (Supabase):** Platform-specific events that drive business owner analytics. Every event write is non-blocking (fire-and-forget via the `/api/analytics/event` endpoint).

Event schema:

| Field        | Type                                         | Notes                                                                                                               |
| ------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `id`         | `uuid`                                       | PK                                                                                                                  |
| `event_name` | `text`                                       | `'page_view'`, `'cta_click'`, `'save'`, `'unsave'`, `'share'`, `'search_submitted'`, `'search_result_clicked'`      |
| `listing_id` | `uuid` FK → `listings.id` ON DELETE SET NULL | The listing the event is attributed to; null for non-listing events like search                                     |
| `user_id`    | `uuid` FK → `users.id` ON DELETE SET NULL    | Null for anonymous events                                                                                           |
| `properties` | `jsonb`                                      | Event-specific metadata (e.g., `{cta_type: 'book'}` for CTA clicks, `{query: 'natural hair atlanta'}` for searches) |
| `created_at` | `timestamptz`                                | Event timestamp                                                                                                     |

**Vercel Analytics:** Automatic Core Web Vitals tracking, page performance, and geographic traffic distribution. No configuration required — enabled by adding the Vercel Analytics package and the `<Analytics />` component to the root layout.

### Event Capture Points

| Event                   | When                                         | Server or client                                    |
| ----------------------- | -------------------------------------------- | --------------------------------------------------- |
| `page_view`             | On every entity page render                  | Server-side (inside Server Component, non-blocking) |
| `cta_click`             | When the primary CTA button is clicked       | Client-side (event handler on Client Component)     |
| `save`                  | When a listing is saved                      | Client-side (after optimistic UI update)            |
| `share`                 | When the share button is clicked             | Client-side                                         |
| `search_submitted`      | When the search form is submitted            | Client-side                                         |
| `search_result_clicked` | When a search result listing card is clicked | Client-side                                         |

`page_view` fires server-side to ensure coverage without JavaScript. All other events fire client-side.

### Business Owner Dashboard (MVP vs V1)

At MVP, the owner dashboard shows basic aggregates: total page views (all time), CTA clicks (all time), saves (all time). These are computed by simple `COUNT` queries against `analytics_events` filtered by `listing_id`.

At V1, the analytics dashboard adds: 30-day trend charts (grouped by day), search impressions (requires tracking search result exposures by listing ID), and comparison to prior period. Charts use Recharts.

### V1: Product Analytics Evaluation

At V1, evaluate PostHog (open source, self-hostable) or Plausible Analytics for product-level analytics (funnel analysis, retention, feature adoption). The decision is deferred to V1 when there is real usage data to understand what product questions need answering.

### Error Tracking

Sentry is installed from Phase 0 (before public launch). Both frontend errors (via the Sentry Next.js SDK) and backend errors (via Sentry's Node SDK in Server Actions and Route Handlers) are captured. PII is never included in Sentry events — user IDs may be included for debugging, but email addresses, phone numbers, and names are stripped.

---

## 12. Admin Architecture

### Access Model

All admin routes (`/admin/*`) are protected at two layers:

1. **Middleware** (`middleware.ts`): checks for a valid session and queries `user_roles` for `admin` or `super_admin` role. A valid session without the required role redirects to `/` with no indication that the admin route exists.

2. **Server-side role check in every admin page and action**: each admin page component reads the session and queries `user_roles` independently of middleware. Middleware alone is not sufficient — it can be bypassed by direct API calls.

The Supabase service role key is used for all admin database operations. It is stored in `SUPABASE_SERVICE_ROLE_KEY`, accessible only to server-side code, and never included in any client bundle or API response.

### Admin Audit Log

Every admin mutation writes a row to `admin_audit_log`. This is non-negotiable — every state change made by an admin must be auditable.

`admin_audit_log` schema:

| Field           | Type                                      | Notes                                                                                                                                                                  |
| --------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`            | `uuid`                                    | PK                                                                                                                                                                     |
| `admin_user_id` | `uuid` FK → `users.id` ON DELETE SET NULL | The admin who performed the action                                                                                                                                     |
| `action`        | `text`                                    | String enum: `'listing_status_changed'`, `'claim_approved'`, `'claim_rejected'`, `'listing_flagged'`, `'user_suspended'`, `'role_assigned'`, `'listing_deleted'`, etc. |
| `target_table`  | `text`                                    | The table that was mutated: `'listings'`, `'claims'`, `'users'`, etc.                                                                                                  |
| `target_id`     | `uuid`                                    | The PK of the mutated record                                                                                                                                           |
| `before_state`  | `jsonb`                                   | Snapshot of the record before the mutation (only changed fields, not the full row)                                                                                     |
| `after_state`   | `jsonb`                                   | Snapshot of the record after the mutation                                                                                                                              |
| `notes`         | `text`                                    | Optional admin-provided reason or context                                                                                                                              |
| `created_at`    | `timestamptz`                             | When the action occurred                                                                                                                                               |

The audit log write is included in the same database transaction as the mutation where possible, so there are no audit rows without a corresponding state change.

### Bulk Operations

Admin operations that affect multiple listings at once (bulk flag, bulk status change) use dedicated Server Actions that accept an ID array. Validation runs on the full array before any record is mutated. All mutations in a bulk operation run in a single database transaction.

Bulk operations are limited to 100 records per action to prevent timeout and accidental mass mutations. The UI surfaces a count confirmation before the action executes.

### Admin-Only Data Exposure

Admin pages query with the Supabase service role client, which bypasses RLS. This means admin list views can surface flagged, draft, soft-deleted, and unpublished listings that are invisible to the public and to business owners outside their own records.

The service role key must never appear in any response body, log line, or client-side code path.

---

## 13. Deployment Architecture

### Hosting

Vercel. Zero-config Next.js deployment. Serverless functions for Route Handlers and Server Actions. Edge Runtime for `middleware.ts`.

### GitHub Integration

- Push to `main` branch → production deployment
- Open pull request → preview deployment on a unique subdomain with staging environment variables
- Preview deployments are automatically linked in pull request comments

All engineers review PRs against a live preview URL before merging. Non-technical stakeholders can review UX changes on preview URLs without local setup.

### Environment Configuration

Three environments: `local`, `staging`, `production`. Each has its own Supabase project, Stripe account (test vs. live keys), and Resend configuration.

Required environment variables:

| Variable                             | Accessible      | Purpose                                                            |
| ------------------------------------ | --------------- | ------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`           | Client + server | Supabase project URL                                               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`      | Client + server | Supabase anon key (limited by RLS)                                 |
| `SUPABASE_SERVICE_ROLE_KEY`          | Server only     | Supabase service role key (bypasses RLS) — never expose            |
| `STRIPE_SECRET_KEY`                  | Server only     | Stripe secret key                                                  |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client          | Stripe publishable key                                             |
| `STRIPE_WEBHOOK_SECRET`              | Server only     | Stripe webhook signature secret                                    |
| `RESEND_API_KEY`                     | Server only     | Resend API key                                                     |
| `ANTHROPIC_API_KEY`                  | Server only     | Anthropic API key (V2)                                             |
| `NEXT_PUBLIC_APP_URL`                | Client + server | The canonical public URL (for OG image generation, canonical URLs) |
| `SENTRY_DSN`                         | Server only     | Sentry project DSN                                                 |
| `NEXT_PUBLIC_SENTRY_DSN`             | Client          | Sentry DSN for frontend errors                                     |

`NEXT_PUBLIC_` prefixed variables are bundled into the client. All others are server-side only. The Supabase service role key, Stripe secret key, Resend API key, and Anthropic API key must never have the `NEXT_PUBLIC_` prefix.

### Edge Middleware

`middleware.ts` runs on the Vercel Edge Runtime before any page render for protected routes. It uses the `@supabase/ssr` package to read the session cookie, which requires the Supabase client to be initialized with the `cookies()` API. Because the Edge Runtime does not support all Node.js APIs, the middleware only reads and validates the session — it does not query the database directly for role checks (that would require a full database connection not available at the Edge). Role checks beyond "is there a valid session" are performed server-side within each protected page.

### `next.config.ts`

Key configuration requirements:

- `images.remotePatterns`: allow the Supabase project's storage domain for Next.js Image optimization
- `experimental.serverActions`: confirm enabled (default in Next.js 14+)
- No public environment variables containing secrets

### Cache Invalidation

ISR cache invalidation via `revalidatePath` and `revalidateTag`:

- When an owner saves a Page edit, `revalidatePath('/[city-slug]/business/[listing-slug]')` is called
- When an admin publishes a new listing, both the listing page and its city/category page caches are revalidated
- When a listing is featured or sponsored status changes, the homepage and relevant city pages are revalidated

---

## 14. Monitoring and Logging

### Services

| Service            | Purpose                                                          | Phase                |
| ------------------ | ---------------------------------------------------------------- | -------------------- |
| Sentry             | Frontend and backend error tracking and alerting                 | Phase 0 (pre-launch) |
| Vercel Analytics   | Core Web Vitals, page performance, traffic                       | Phase 0              |
| Supabase Dashboard | DB query performance, connection pool utilization, storage usage | Phase 0              |
| Resend Dashboard   | Email delivery rates, bounces, complaints                        | MVP                  |
| Stripe Dashboard   | Subscription health, failed payments, dispute rate               | V1                   |

### Structured Logging

Server-side logs for Server Actions and Route Handlers use structured JSON format:

```
{
  "level": "info" | "warn" | "error",
  "action": "claim_approved",
  "listing_id": "uuid",
  "user_id": "uuid",
  "admin_id": "uuid",
  "result": "success" | "failure",
  "duration_ms": 143,
  "timestamp": "2026-05-07T14:23:00Z"
}
```

PII rules for logging:

- Never log email addresses, phone numbers, or physical addresses
- User IDs (UUIDs) are acceptable in logs for debugging
- Listing names are acceptable
- Stripe IDs are acceptable
- Never log request bodies that may contain passwords or payment card data

### Log Levels

| Level   | Use                                                                                            |
| ------- | ---------------------------------------------------------------------------------------------- |
| `info`  | Normal operations: successful auth, record created, record updated, job completed              |
| `warn`  | Recoverable issues: auth failure, permission denial, rate limit reached, external API degraded |
| `error` | Failures: unexpected server error, external API timeout, database error, job failure           |

### Alerting

Sentry alert rules (configured before launch):

- Error rate spike: alert if error rate increases > 5x baseline in a 5-minute window
- New error type: alert on first occurrence of any new error fingerprint
- P95 latency: Vercel analytics alert if P95 response time exceeds 3 seconds for entity pages

All alerts route to the engineering Slack channel and email. On-call rotation is not required at MVP — the founding team is the alert recipient.

### Logging Events Required

| Event                                 | Level   | Fields to capture                                     |
| ------------------------------------- | ------- | ----------------------------------------------------- |
| Successful sign in                    | `info`  | `user_id`, `method` (email or oauth), timestamp       |
| Failed sign in attempt                | `warn`  | IP address, timestamp (never log the attempted email) |
| Permission denial                     | `warn`  | `user_id`, route, operation                           |
| Claim submitted                       | `info`  | `user_id`, `listing_id`, `claim_id`                   |
| Claim approved                        | `info`  | `admin_user_id`, `claim_id`, `listing_id`             |
| Listing published                     | `info`  | `user_id`, `listing_id`, `entity_type`                |
| Listing flagged                       | `info`  | `admin_user_id`, `listing_id`, `flag_reason`          |
| File upload                           | `info`  | `user_id`, `bucket`, `file_size_bytes`, `entity_type` |
| Stripe webhook received               | `info`  | `event_type`, `stripe_event_id`                       |
| Stripe webhook failed                 | `error` | `event_type`, `stripe_event_id`, error details        |
| External API call (Resend, Anthropic) | `info`  | service, endpoint, `duration_ms`                      |
| External API failure                  | `error` | service, endpoint, HTTP status or error message       |
| Unexpected server error               | `error` | Full error, stack trace, request context (no PII)     |

---

## 15. Scalability Considerations

### Connection Pooling (Critical for Serverless)

Supabase PgBouncer in transaction mode is required from day one. Serverless functions (Vercel) do not hold long-lived connections — each invocation opens and closes a connection. Without PgBouncer, this exhausts PostgreSQL's connection limit under moderate traffic. The Supabase connection string for server-side clients must use the PgBouncer endpoint (port 6543), not the direct PostgreSQL endpoint (port 5432).

This is a deployment configuration requirement, not an application code requirement. It must be verified before the first production deployment.

### ISR as the Primary Performance Tool

For a directory platform, ISR is the single most impactful performance decision. Entity pages, city pages, and category pages served from Vercel's CDN edge cache require no database hit. At 50,000 monthly visitors with 5,000 listings, the vast majority of traffic is served from cached ISR pages without the database being touched. The database only receives load from search queries, authenticated dashboard pages, and admin operations.

This means the platform can handle significant traffic growth without database scaling as long as the ISR cache hit rate remains high. The ISR cache hit rate should be monitored via Vercel Analytics.

### Search Scale

PostgreSQL FTS with a GIN index handles up to approximately 50,000 listings with query times well under 100ms for typical queries. Beyond that threshold, or when search quality requirements exceed what FTS provides, the Algolia migration path documented in Section 7 is executed.

The search upgrade is the only infrastructure change with a defined scale trigger in the 12-month window. No other infrastructure scaling is anticipated before 1M monthly requests.

### Media and Storage Scale

The `listing-media` bucket is served through Supabase's built-in CDN. No additional CDN configuration is required at MVP or V1. Supabase Storage CDN handles cache headers and global distribution automatically.

At V2 when marketplace products are added, the volume of product images will increase substantially. Monitor Supabase Storage egress costs at that point and evaluate migrating to a dedicated object storage provider (Cloudflare R2 or AWS S3) if costs warrant it.

### Database Scale

A single Supabase project at MVP and V1. The `listings` table will reach approximately 5,000 rows at 12 months — well within single-instance PostgreSQL capability. No sharding, partitioning, or read replicas are required in the 12-month window.

At V1+ when analytics events accumulate at higher rates (page views _ listings _ months), the `analytics_events` table will grow fastest. Plan a time-based partitioning strategy for `analytics_events` at V1 if write volume exceeds 1M rows per month. This is a schema change that can be applied without downtime.

### Application Scale

Vercel auto-scales serverless functions horizontally with no configuration. The application layer does not require manual scaling decisions before approximately 1M monthly serverless function invocations. This is not a concern within the 12-month window.

### Idempotency and Duplicate Prevention at Scale

As the platform scales and more concurrent users submit forms, the duplicate detection service and idempotency patterns documented in the data model become increasingly important. The `INSERT ... ON CONFLICT DO UPDATE` patterns for attendance-style idempotent entries, and the `409 ALREADY_EXISTS` responses for entity creation, must be in place before any bulk data import or high-concurrency submission scenario.

---

## 16. What Stays Manual at MVP

The following operations are handled manually by the admin team at MVP. They are not automated because the volume does not yet justify the engineering cost and because manual execution allows the team to learn the patterns before encoding them.

### Trust Verification

The transition from `trust_tier = 'claimed'` to `trust_tier = 'verified'` requires a human admin to review submitted documents (business license, EIN confirmation). At MVP, this is done through the `/admin/claims` dashboard. The admin views the documents (via signed URL), confirms legitimacy, and clicks Approve. No automated document verification. The admin review queue surfaces all pending verification submissions in a prioritized list. Expected volume at MVP: single digits per day. Automation is evaluated at V1 when volume justifies it.

### Seed Data Import

Initial listing data (300+ listings across Atlanta, Houston, and Chicago) is imported via a CSV-to-Supabase import script run once before launch. The script is reviewed and approved before execution. No user-facing CSV upload UI at MVP. All imported listings are created with `source = 'import'` and `status = 'published'` (after admin review of the imported dataset). Duplicate detection runs against the imported dataset before the import executes.

### Sponsored Placements

Sponsored listing placement is entirely manual at MVP. When a business purchases a sponsored placement (through an offline sales conversation), an admin sets `is_sponsored = true`, `sponsored_expires_at` to the agreed expiry date, and `sponsored_placement_type` to the agreed placement context. No self-serve purchase flow. No automated billing for sponsorships. V1 introduces admin tooling for tracking placements. V1.5 introduces self-serve.

### City Guides and Editorial Content

City guide pages (`/guide/[city-slug]`) and BLACQLight articles are created manually by the internal team using the admin CMS (`/admin/guides`, `/admin/blacqlight`). At MVP, a placeholder or static page is acceptable for the guides section. The editorial CMS itself is a V1 feature. No automated content generation. AI-assisted drafting suggestions are V3.

### BLACQList Certified Grant

At MVP, the `trust_tier = 'certified'` elevation is set manually by a Super Admin for any listing that meets the criteria. The automated trigger (five simultaneous conditions including review count and verified status) is a V1 engineering deliverable. Until that trigger is built, manual grants by Super Admin are the only path to Certified status.

### Stale Listing Outreach

The stale listing detection job (flagging listings where `last_edited_by_owner_at` is older than 180 days) is a V1 background job. At MVP, a Super Admin periodically queries Supabase Studio for listings meeting the staleness criteria and sends outreach emails manually. The job is built in V1 when the platform has enough listings for automated detection to be worthwhile.
