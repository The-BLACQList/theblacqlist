# Supabase Setup Guide: The BLACQList

**Last updated:** 2026-05-10
**Status:** Active — source of truth for Supabase configuration

---

## Current State (as of 2026-05-10)

### What is configured

| Item | Status |
|---|---|
| `@supabase/supabase-js@2.105.4` installed | ✅ |
| `@supabase/ssr@0.10.3` installed | ✅ |
| `lib/supabase/client.ts` — browser client | ✅ |
| `lib/supabase/server.ts` — server client + service client | ✅ |
| `lib/supabase/types.ts` — placeholder Database type | ✅ (placeholder only) |
| `.env.example` updated to match `environment-plan.md` | ✅ |
| `.env.local` — `NEXT_PUBLIC_SUPABASE_URL` | ✅ present |
| `.env.local` — `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ present |
| `.env.local` — `SUPABASE_SERVICE_ROLE_KEY` | ✅ present |
| `.env.local` — `AUTH_SECRET` | ✅ present |
| `middleware.ts` — session refresh + route protection | ✅ |
| `next.config.ts` — Supabase Storage `remotePatterns` | ✅ |
| Health check route `app/api/health/supabase` | ✅ |
| TypeScript — zero errors | ✅ |
| Lint — zero errors | ✅ |
| Supabase project reachable (cloud) | Not yet verified — run `pnpm dev` and GET `/api/health/supabase` |
| `supabase/` directory (CLI init) | ❌ not yet — needed before migrations |
| Database schema migrations | ❌ not yet |
| Storage buckets created | ❌ not yet |
| Auth redirect URLs configured | ❌ not yet |

### Middleware and image config

**`middleware.ts`** (project root) runs on the Vercel Edge before every non-asset request. It:
- Calls `supabase.auth.getUser()` on every request to refresh the session token in the cookie — this is required by `@supabase/ssr` and must not be skipped
- Redirects unauthenticated users to `/sign-in?next=[path]` for all protected route prefixes: `/dashboard`, `/account`, `/claim`, `/add-business`, `/onboarding`, `/admin`
- Redirects authenticated users away from `/sign-in` and `/sign-up` to `/dashboard`
- Does NOT query `user_roles` — the Edge Runtime cannot hold a full DB connection. Admin role checks are performed server-side within each `/admin` page as a second enforcement layer.

**`next.config.ts`** has `images.remotePatterns` set to allow `*.supabase.co/storage/v1/object/public/**`. This is required for `next/image` to serve assets from the `listing-media` bucket.

### What still needs to be done on Supabase

In the Supabase Dashboard, before the first migration or auth flow:

1. **Auth → Settings:**
   - Enable Email provider
   - Enable email confirmation (required before account is active)
   - Add redirect URLs: `http://localhost:3000`, `https://*.vercel.app` (staging), `https://theblacqlist.com` (production)
   - Set JWT expiry: 7 days

2. **Auth → Email Templates:** Customize confirmation, password reset, and magic link emails with BLACQList branding

3. **Storage:** Create three buckets — see Section 8 for settings

4. **Settings → Database:** For the production project, enable PgBouncer in transaction mode and enable Point-in-Time Recovery (PITR)

5. **Extensions (SQL editor):**
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   ```

### How to create `.env.local`

```bash
cp .env.example .env.local
```

Then fill in from **Supabase Dashboard → Settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
AUTH_SECRET=<output of: openssl rand -base64 32>
```

> **Never commit `.env.local`.** It is gitignored. Real values must never appear in `.env.example`, source code, or any committed file.

### Verify the connection

With `.env.local` populated and `pnpm dev` running:

```
GET http://localhost:3000/api/health/supabase
```

Expected response when all env vars are present and the project is reachable:

```json
{
  "status": "ok",
  "message": "Supabase server client initialized and project reachable",
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": true,
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": true,
    "SUPABASE_SERVICE_ROLE_KEY": true,
    "AUTH_SECRET": true
  }
}
```

If `AUTH_SECRET` is missing, the response will list it under `"missing"` — the Supabase connection itself will still succeed.

### Next step: Supabase CLI init and database migrations

```bash
# Install the Supabase CLI (once per machine)
brew install supabase/tap/supabase   # macOS
# or: npm install -g supabase

# Initialize the supabase/ directory in the project root
supabase init

# Link to your cloud project (get project-ref from the Dashboard URL)
supabase link --project-ref [project-ref]

# Start local Supabase (requires Docker Desktop running)
supabase start
```

Once the CLI is initialized, create the first migration:

```bash
supabase migration new initial-schema
```

Write the core schema SQL in the generated file (`supabase/migrations/[timestamp]_initial-schema.sql`), then apply it:

```bash
supabase db push         # local
supabase db push --linked  # cloud (staging/production)
```

After the first migration, regenerate `lib/supabase/types.ts`:

```bash
supabase gen types typescript --local > lib/supabase/types.ts
```

See `data-model.md` for entity definitions, field types, relationships, and RLS policy requirements to include in the initial migration.

---

## 1. Overview

The BLACQList uses Supabase for:
- **PostgreSQL** — primary application database
- **Auth** — email/password authentication with httpOnly cookie sessions
- **Storage** — three buckets for listing media, verification documents, and receipts
- **Row Level Security (RLS)** — database-level access control, enabled by default on all tables

Three environments exist, each backed by a separate Supabase project. See `environment-plan.md` for the full environment configuration reference.

---

## 2. Packages Installed

```
@supabase/supabase-js@2.105.4   — core Supabase client
@supabase/ssr@0.10.3            — SSR/App Router cookie session handling
```

`@supabase/ssr` is required for Next.js App Router. It manages auth sessions via httpOnly cookies rather than localStorage, enabling proper session access in Server Components, Route Handlers, and Server Actions.

---

## 3. Client Files

Three Supabase client utilities live in `lib/supabase/`:

| File | Context | What it does |
|---|---|---|
| `lib/supabase/client.ts` | Client Components (`"use client"`) | Browser client using `createBrowserClient`. Reads/writes cookies via the browser. |
| `lib/supabase/server.ts` | Server Components, Route Handlers, Server Actions | `createClient()` — server client with cookie access. `createServiceClient()` — bypasses RLS entirely, admin use only. |
| `lib/supabase/types.ts` | Shared — imported by both client files | Placeholder Database type. Regenerate from schema after running migrations. |

### Usage patterns

**In a Server Component or Server Action:**
```typescript
import { createClient } from "@/lib/supabase/server"

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // ...
}
```

**In a Client Component:**
```typescript
"use client"
import { createClient } from "@/lib/supabase/client"

const supabase = createClient()
// Use for real-time subscriptions, client-side auth state, etc.
```

**Service role (admin only):**
```typescript
import { createServiceClient } from "@/lib/supabase/server"

// In a Route Handler or Server Action only — never in a Client Component
const supabase = createServiceClient()
```

### Service role safety rules

The `createServiceClient()` function uses `SUPABASE_SERVICE_ROLE_KEY`, which bypasses **all** RLS policies. Apply these rules without exception:

- Never import `createServiceClient` in a Client Component or any file with `"use client"`
- Never pass the service client to a Client Component as a prop
- Never log the service role key
- Use only in Route Handlers, Server Actions, or background jobs where elevated access is explicitly required

---

## 4. Creating a Supabase Project

### Step 1: Create the project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Create a **new project** — use a descriptive name: `theblacqlist-staging` or `theblacqlist-production`
3. Choose the region closest to your primary users (recommended: `us-east-1`)
4. Set a strong database password and store it securely — you will need it for direct DB connections

### Step 2: Get API credentials

Go to **Settings → API** in the Supabase Dashboard and copy:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **Anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Service role key** → `SUPABASE_SERVICE_ROLE_KEY` (click the eye icon to reveal)

### Step 3: Configure `.env.local`

```bash
cp .env.example .env.local
```

Fill in the values from Step 2:

```
NEXT_PUBLIC_SUPABASE_URL=https://[your-project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
AUTH_SECRET=$(openssl rand -base64 32)
```

**Never commit `.env.local`.** It is gitignored. `.env.example` (no real values) is the only env file committed to the repository.

---

## 5. Local Development with Supabase CLI

For local development, run the full Supabase stack via Docker instead of connecting to the cloud project.

### Prerequisites

- Docker Desktop (must be running)
- Supabase CLI: `brew install supabase/tap/supabase` or `npm install -g supabase`

### Start local Supabase

```bash
supabase start
```

First run downloads Docker images (~2–3 minutes). Subsequent starts are faster. The command outputs local credentials — use these in `.env.local` (not the cloud project credentials).

```
API URL:          http://localhost:54321
Studio URL:       http://localhost:54323
Anon key:         eyJ...
Service role key: eyJ...
```

### Apply migrations

```bash
supabase db push
```

Runs all migration files from `supabase/migrations/` against the local database. Run this whenever new migration files are added.

### Seed the database

```bash
supabase db seed
```

Populates the local DB with development fixtures from `supabase/seed.sql`. See `environment-plan.md` for seed data requirements.

### Stop local Supabase

```bash
supabase stop
```

Stops Docker containers. Data persists across restarts unless you use `supabase stop --no-backup`.

---

## 6. Generating TypeScript Types

After running migrations, regenerate `lib/supabase/types.ts` to get full type safety:

```bash
supabase gen types typescript --local > lib/supabase/types.ts
```

For cloud projects (staging/production):

```bash
supabase gen types typescript --project-id [your-project-ref] > lib/supabase/types.ts
```

**When to regenerate:** After every schema migration that adds, removes, or modifies tables, columns, or enums. Commit the updated `types.ts` alongside the migration file.

---

## 7. Running Migrations

All schema changes must be represented as migration files — never alter tables directly in the Supabase Dashboard SQL editor in production.

### Create a new migration

```bash
supabase migration new [descriptive-name]
```

This creates a timestamped file in `supabase/migrations/`. Write the migration SQL in that file.

### Apply to local database

```bash
supabase db push
```

### Apply to staging/production

Via Supabase CLI with your project linked:

```bash
supabase db push --linked
```

Or via CI/CD pipeline using `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD`.

**Never run a destructive migration (DROP TABLE, DROP COLUMN, TRUNCATE) without a confirmed backup and a written rollback plan.**

---

## 8. Storage Buckets

Three buckets are required. Create each in **Supabase Dashboard → Storage** for both staging and production projects.

| Bucket | Visibility | File size limit | Purpose |
|---|---|---|---|
| `listing-media` | **Public** | 10MB | Business listing photos — logos, cover photos, gallery images |
| `verification-docs` | **Private** | 10MB | Ownership verification documents uploaded during the claim flow |
| `receipts` | **Private** | 10MB | Receipt photos uploaded by business owners |

**Important:** Store the Supabase Storage **path** in the database, not the full URL. Generate signed URLs at read time for private buckets (expire in 15 minutes). The public URL for `listing-media` follows this pattern:

```
[NEXT_PUBLIC_SUPABASE_URL]/storage/v1/object/public/listing-media/[path]
```

---

## 9. Authentication Configuration

In **Supabase Dashboard → Authentication → Settings**, configure:

- **Email provider**: Enabled
- **Email confirmation**: Required — users must verify before their account is active
- **Redirect URLs** (add all of these):
  - `http://localhost:3000` (local development)
  - `https://*.vercel.app` (staging/preview — staging project only)
  - `https://theblacqlist.com` (production — production project only)
- **JWT expiry**: 7 days (default)

### Auth email templates

Customize the confirmation email, password reset email, and magic link email in **Authentication → Email Templates** with BLACQList branding before the product launches.

---

## 10. Row Level Security

RLS is enabled by default on all tables. The default policy is **deny all** — no data is readable or writable until explicit policies are added.

Three roles:

| Role | Context | Notes |
|---|---|---|
| `anon` | Unauthenticated requests | Can read public listing data only |
| `authenticated` | Logged-in users | Can read/write their own data per RLS policies |
| `service_role` | `createServiceClient()` | Bypasses all RLS — admin use only |

RLS policies are defined per migration file alongside the table they protect. Do not add policies manually in the Dashboard for production — policies must be version-controlled in migration files.

---

## 11. Connection Pooling (Production)

Vercel serverless functions open and close database connections on every invocation. Enable **PgBouncer in transaction mode** on the production Supabase project to prevent connection exhaustion.

- **Pooled connection port**: 6543 (transaction mode)
- **Direct connection port**: 5432 (use for migrations only, not for app queries)

The `@supabase/ssr` client handles connection management automatically when using the API (not direct DB connections). This is relevant if you add Drizzle ORM or direct `postgres` connections in the future.

---

## 12. Verification

After completing setup, verify the connection is working:

```bash
# Start local Supabase
supabase start

# Start the app
pnpm dev

# Open http://localhost:3000 — the app should load without Supabase errors
# Open http://localhost:54323 — Supabase Studio should be accessible

# TypeScript check
pnpm tsc --noEmit

# Lint check
pnpm lint
```

If `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` are missing from `.env.local`, the app will throw at runtime when any Supabase client is instantiated.

---

## 13. Reference

- `environment-plan.md` — full environment variable inventory and environment strategy
- `data-model.md` — entity definitions, field types, relationships, and RLS requirements for migrations
- `auth-permissions.md` — role definitions and permission boundaries
