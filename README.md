# The BLACQList

The national directory of Black-owned businesses — built for discovery, trust, and economic visibility.

---

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) (`npm install -g pnpm`)
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started) (`brew install supabase/tap/supabase`)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (required for local Supabase)

---

## Local Development Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in the values. For local dev, use the Supabase local values (see step 3 — `supabase start` prints them). The `.env.example` comments indicate which section to use.

### 3. Start local Supabase

```bash
npx supabase start
```

This starts the full local Supabase stack (Postgres, Auth, Storage, Studio) and prints local API keys. Copy the `API URL` and `anon key` into `.env.local`.

Local services:
- API: `http://127.0.0.1:54321`
- Studio: `http://127.0.0.1:54323`
- Email (inbucket): `http://127.0.0.1:54324`

### 4. Seed the database

Migrations and seed data run automatically on first `supabase start`. To reset and reload:

```bash
npx supabase db reset
```

This re-runs all 16 migrations and seeds:
- Reference data (cities, categories, plans)
- 80 real Black-owned businesses across Atlanta, Houston, and Chicago

### 5. Start the dev server

```bash
pnpm dev
```

App runs at `http://localhost:3000`.

---

## Switching Between Local and Cloud

`.env.local` has both sets of values — local is active, cloud is commented out.

To switch to the cloud Supabase instance (staging/production), swap the comment blocks in `.env.local` for the `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` variables.

**Never commit `.env.local`.** The `.gitignore` blocks it.

---

## Granting Admin Access Locally

After signing up via `http://localhost:3000/sign-up`, open the verification email at `http://127.0.0.1:54324`, then grant yourself admin:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -c "UPDATE user_roles SET role = 'admin' WHERE user_id = (SELECT id FROM auth.users WHERE email = 'your@email.com');"
```

Then visit `http://localhost:3000/admin`.

---

## Key Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Start Next.js dev server at port 3000 |
| `pnpm build` | Production build |
| `pnpm lint` | Run ESLint |
| `npx tsc --noEmit` | TypeScript type check |
| `npx supabase start` | Start local Supabase stack |
| `npx supabase stop` | Stop local Supabase stack |
| `npx supabase db reset` | Reset DB and re-run all migrations + seeds |
| `npx supabase db diff` | Diff local schema vs migrations |
| `npx supabase migration new <name>` | Create a new migration file |

---

## Project Structure

```
app/                  Next.js App Router pages and layouts
  (auth)/             Sign-up, sign-in, email verification
  (public)/           Public-facing pages (homepage, discover, search)
  [citySlug]/         City + entity pages ([citySlug]/[entityType]/[slug])
  admin/              Admin dashboard (role-gated)
  dashboard/          Business owner dashboard (auth-gated)
  account/            Supporter account and saved list
components/           Shared UI components
lib/                  Supabase client, utilities, server actions
types/                Shared TypeScript types
supabase/
  migrations/         Ordered SQL migrations (source of truth for schema)
  seeds/              Seed data (reference data + listings)
  config.toml         Local Supabase configuration
docs/blacqlist/       Product docs, architecture, tickets, QA
```

---

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Components | shadcn/ui |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Email | Resend |
| Payments | Stripe |
| Error tracking | Sentry |
| Deployment | Vercel |
