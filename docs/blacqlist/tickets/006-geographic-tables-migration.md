# Ticket 006: Geographic reference tables migration (states, cities)

## Status
Draft

## Phase
Phase 1: Database / Auth / RLS Foundation

## Priority
P0

## Feature Area
Database

## Context
The `cities` and `states` tables are the geographic foundation of the entire platform. Every listing has a `city_id` FK into `cities`, and every city page URL is built from `cities.slug`. These tables must exist and be seeded with all 13 launch cities and their states before any listing data can be inserted and before any city landing page can function. The cities table also contains the `is_active` and `launch_phase` fields that control which cities are live on the platform. Source documents: `docs/blacqlist/data/database-schema-plan.md` (Section 4: `cities`, `states`), `docs/blacqlist/data/rls-policy-plan.md` (Section 4: `cities`, `states`).

## User Story
As the platform, I need canonical city and state records with URL-safe slugs and geographic coordinates so that city landing pages can render, listings can be associated with cities, and geographic filtering in search can work.

## Scope
- Write SQL migration file `supabase/migrations/001_geographic_reference.sql`
- Create `states` table with exact fields from schema plan: `id` (uuid PK), `name` (text NOT NULL), `code` (text NOT NULL UNIQUE), `country` (text NOT NULL DEFAULT `'US'`), `created_at` (timestamptz NOT NULL DEFAULT now())
- Create `cities` table with exact fields: `id` (uuid PK), `name` (text NOT NULL), `slug` (text NOT NULL UNIQUE), `state_id` (uuid NOT NULL FK → states.id ON DELETE RESTRICT), `metro_area` (text nullable), `latitude` (numeric(10,6) NOT NULL), `longitude` (numeric(10,6) NOT NULL), `population` (integer nullable), `is_active` (boolean NOT NULL DEFAULT false), `launch_phase` (text NOT NULL DEFAULT 'later' CHECK IN ('launch', 'v1', 'v2', 'later')), `created_at` (timestamptz NOT NULL DEFAULT now()), `updated_at` (timestamptz NOT NULL DEFAULT now())
- Apply `updated_at` trigger to `cities` table (states has no `updated_at` per the schema plan)
- Create indexes: `UNIQUE(slug)` on cities, `cities_state_id_idx` on `(state_id)`, partial index `cities_is_active_idx` on `(is_active) WHERE is_active = true`
- Enable RLS on both tables
- Write RLS policies: `anon` and `authenticated` SELECT all rows (`true`); no INSERT/UPDATE/DELETE for either role; `service_role` bypasses RLS
- Seed all 50 US states in the migration
- Seed all 13 launch cities with `launch_phase = 'launch'` and `is_active = false` (cities are activated manually before go-live; they are not auto-active)
- Grant SELECT to `anon` role on both tables

## Out of Scope
- Neighborhood sub-table (Beta phase per schema plan)
- Latitude/longitude geocoding pipeline (coordinates are seeded as static values from authoritative sources)
- City landing page UI (a later product ticket)
- Activating cities (`is_active = true`) — this is an admin operation before launch, not part of this migration

## Dependencies
- Depends on: Ticket 002 — Supabase project setup (both staging and production Supabase projects must exist and the Supabase CLI must be configured locally)

## UX Notes
N/A — database migration ticket. No user-facing screens are built here.

## Design Notes
N/A — database migration ticket.

## Data Notes

**`states` table — exact field spec:**

| Column | Type | Nullable | Default | Constraint |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `name` | `text` | NO | — | — |
| `code` | `text` | NO | — | UNIQUE |
| `country` | `text` | NO | `'US'` | — |
| `created_at` | `timestamptz` | NO | `now()` | — |

**`cities` table — exact field spec:**

| Column | Type | Nullable | Default | Constraint |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `name` | `text` | NO | — | — |
| `slug` | `text` | NO | — | UNIQUE |
| `state_id` | `uuid` | NO | — | FK → states(id) ON DELETE RESTRICT |
| `metro_area` | `text` | YES | — | — |
| `latitude` | `numeric(10,6)` | NO | — | — |
| `longitude` | `numeric(10,6)` | NO | — | — |
| `population` | `integer` | YES | — | — |
| `is_active` | `boolean` | NO | `false` | — |
| `launch_phase` | `text` | NO | `'later'` | CHECK IN ('launch','v1','v2','later') |
| `created_at` | `timestamptz` | NO | `now()` | — |
| `updated_at` | `timestamptz` | NO | `now()` | — |

**13 launch cities to seed** (with `launch_phase = 'launch'`, `is_active = false`):

| City | State | Slug | Approx. lat | Approx. lng |
|---|---|---|---|---|
| Atlanta | GA | `atlanta` | 33.749 | -84.388 |
| Houston | TX | `houston` | 29.760 | -95.370 |
| Chicago | IL | `chicago` | 41.878 | -87.630 |
| Washington | DC | `washington-dc` | 38.907 | -77.037 |
| New York | NY | `new-york` | 40.713 | -74.006 |
| Los Angeles | CA | `los-angeles` | 34.052 | -118.244 |
| Philadelphia | PA | `philadelphia` | 39.952 | -75.165 |
| Detroit | MI | `detroit` | 42.331 | -83.046 |
| Baltimore | MD | `baltimore` | 39.290 | -76.612 |
| Dallas | TX | `dallas` | 32.777 | -96.797 |
| Charlotte | NC | `charlotte` | 35.227 | -80.843 |
| Miami | FL | `miami` | 25.775 | -80.208 |
| Memphis | TN | `memphis` | 35.148 | -90.048 |

**RLS policies:**

```sql
-- states: public SELECT
CREATE POLICY "states_select_all" ON states
  FOR SELECT USING (true);

-- cities: public SELECT
CREATE POLICY "cities_select_all" ON cities
  FOR SELECT USING (true);

-- No INSERT/UPDATE/DELETE for anon or authenticated — admin via service_role only
```

**Migration file naming:** `supabase/migrations/20260507000001_geographic_reference.sql` (timestamp prefix per Supabase convention)

## API Notes
N/A — no API routes in this ticket. The cities and states tables are queried by later tickets via the Supabase client or direct Server Actions.

A future Server Action or Route Handler for city listing pages will use:
```typescript
const { data: cities } = await supabase
  .from('cities')
  .select('id, name, slug, metro_area, state_id')
  .eq('is_active', true)
  .order('name')
```

## Implementation Notes

**Files to create:**
- `supabase/migrations/20260507000001_geographic_reference.sql` — full migration including table creation, triggers, indexes, RLS, and seed INSERT statements

**Migration structure:**

```sql
-- 1. Enable extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create states table
CREATE TABLE states (...);
ALTER TABLE states ENABLE ROW LEVEL SECURITY;

-- 3. Create cities table
CREATE TABLE cities (...);
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;

-- 4. updated_at trigger on cities only (states has no updated_at column)
CREATE TRIGGER set_cities_updated_at
  BEFORE UPDATE ON cities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
-- Note: update_updated_at() function is created in this same migration
-- if not already present from a prior migration

-- 5. Indexes
CREATE UNIQUE INDEX cities_slug_unique ON cities (slug);
CREATE INDEX cities_state_id_idx ON cities (state_id);
CREATE INDEX cities_is_active_idx ON cities (is_active) WHERE is_active = true;

-- 6. RLS policies
CREATE POLICY "states_select_all" ON states FOR SELECT USING (true);
CREATE POLICY "cities_select_all" ON cities FOR SELECT USING (true);

-- 7. Seed states (all 50 + DC)
INSERT INTO states (name, code) VALUES ('Alabama', 'AL'), ...;

-- 8. Seed launch cities
-- (13 cities with state_id from the seeded states rows above)
```

**Key patterns:**
- Use `gen_random_uuid()` for all PK defaults — not `uuid_generate_v4()` (requires uuid-ossp extension; gen_random_uuid is built into PostgreSQL 13+)
- The `update_updated_at()` function may already exist if this migration runs after a future trigger-creating migration — use `CREATE OR REPLACE FUNCTION` to make it idempotent
- City slugs must be lowercase kebab case with no special characters beyond hyphens — validate this against the seed data before applying
- Seed the states first, then the cities (cities.state_id references states.id — insert order matters)
- `is_active = false` for all seeded cities — a separate admin operation activates them before launch; do not activate in the migration

**Do not:**
- Create triggers or helper functions that duplicate the `update_updated_at` function if it will be reused across multiple migrations — define it once, use `CREATE OR REPLACE FUNCTION` in subsequent migrations
- Use sequential integer IDs for any reference table — UUIDs are used per the global schema convention
- Hard-code city latitude/longitude to more decimal places than `numeric(10,6)` allows

## Acceptance Criteria
- [ ] `supabase db push` applies the migration without errors against both the local and staging databases
- [ ] `SELECT COUNT(*) FROM states` returns 51 (50 states + District of Columbia)
- [ ] `SELECT COUNT(*) FROM cities WHERE launch_phase = 'launch'` returns 13
- [ ] All 13 launch city `slug` values are lowercase and contain only letters, numbers, and hyphens (verified by `SELECT slug FROM cities WHERE slug ~ '[^a-z0-9-]'` returning 0 rows)
- [ ] `SELECT * FROM cities WHERE is_active = true` returns 0 rows (all cities seeded as inactive)
- [ ] RLS is enabled on both `states` and `cities` tables (verify with Supabase Studio or `SELECT tablename FROM pg_tables WHERE schemaname = 'public'` and the RLS column)
- [ ] An anonymous Supabase client can `SELECT * FROM cities` and receive all rows without a 403 error
- [ ] An anonymous Supabase client attempting `INSERT INTO cities (name, slug, ...)` receives a `42501` permission denied error
- [ ] `cities.state_id` references a valid state for each of the 13 seeded cities (verify with a JOIN query)
- [ ] The `cities_is_active_idx` partial index exists (verify with `SELECT indexname FROM pg_indexes WHERE tablename = 'cities'`)

## Failure States
| Failure | User-visible behavior |
|---|---|
| Migration fails due to `update_updated_at` function not existing | `supabase db push` returns `ERROR: function update_updated_at() does not exist`; engineer adds the function definition before the trigger creation in the same migration |
| Duplicate city slug in seed data | Migration fails with UNIQUE constraint violation; engineer corrects the duplicate slug in the seed INSERT |
| `cities.state_id` references a state ID that does not exist | FK constraint violation during seed INSERT; engineer ensures states are seeded before cities in the migration |
| RLS not enabled on a table | Anonymous users can INSERT or DELETE geographic data; engineer enables RLS and adds the correct policies |
| `pg_trgm` extension not enabled before this migration runs | If any index uses trigram operations, migration fails; for this ticket, no trigram indexes are created — but the risk is flagged for Ticket 009 |

## Edge Cases
- Washington D.C. is not a state — it must be seeded with a dedicated row in the `states` table (code: `'DC'`, name: `'District of Columbia'`) before the `washington-dc` city row is inserted
- Some states will be represented multiple times in the cities seed (Texas has both Houston and Dallas) — the FK is to `states.id`, not to `states.code`; make sure the FK joins are to the correct ID, not a hard-coded UUID
- The `update_updated_at()` trigger function will be needed by many tables — define it early (in this migration or a dedicated `000_functions.sql` migration) and use `CREATE OR REPLACE FUNCTION` to keep it idempotent across all migrations

## Accessibility Notes
- [ ] N/A — database migration ticket.

## QA Test Cases
| # | Scenario | Role | Steps | Expected result |
|---|---|---|---|---|
| 1 | Migration applies cleanly | Engineer | Run `supabase db push` against local database | Zero errors; migration recorded in `supabase_migrations` history table |
| 2 | Anon SELECT succeeds | Engineer | Use the Supabase anon client to query `cities` | All 13 launch cities returned; no error |
| 3 | Anon INSERT blocked | Engineer | Use the Supabase anon client to insert a test city row | RLS returns `42501 permission denied` |
| 4 | DC is present and correct | Engineer | `SELECT * FROM states WHERE code = 'DC'` | Row exists with `name = 'District of Columbia'` |
| 5 | All launch cities have valid state references | Engineer | `SELECT c.name, s.name FROM cities c JOIN states s ON c.state_id = s.id WHERE c.launch_phase = 'launch'` | 13 rows returned, each with correct state name (e.g., Atlanta → Georgia) |

## Security Notes
- Geographic reference data is fully public — no PII is stored in these tables; `anon` SELECT on all rows is correct and intentional
- Admin-only INSERT/UPDATE/DELETE is enforced by RLS denying all writes to `anon` and `authenticated` roles — only `service_role` can modify geographic data
- The `is_active` field controls whether a city's listing pages are live — setting it to `true` before the city's content is ready would expose an empty city page; never activate a city in a migration

## Completion Checklist
- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`) — N/A for a pure SQL migration; applies to any TypeScript utility files added
- [ ] Lint: zero errors (`npm run lint`) — N/A for SQL files
- [ ] All acceptance criteria verified
- [ ] All four states implemented (loading, empty, error, success) — N/A for database migration
- [ ] Mobile tested at 375px — N/A for database migration
- [ ] Keyboard navigation tested — N/A for database migration
- [ ] Accessibility requirements met — N/A for database migration
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
