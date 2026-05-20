# Ticket 007: Category taxonomy migration and seed data

## Status
Draft

## Phase
Phase 1: Database / Auth / RLS Foundation

## Priority
P0

## Feature Area
Database

## Context
The `categories` table is the classification backbone of the platform. Every listing has a required `category_id` FK into `categories`, and category pages (`/[city]/[category-slug]`) are among the most important SEO surfaces on the platform. The category taxonomy must be seeded before any listings can be created because `listings.category_id` is NOT NULL with an ON DELETE RESTRICT FK. The 25 top-level categories define the primary navigation and filter options throughout the discovery experience. Source documents: `docs/blacqlist/data/database-schema-plan.md` (Section 4: `categories`), `docs/blacqlist/data/rls-policy-plan.md` (Section 4: `categories`).

## User Story
As the platform, I need a fully seeded category taxonomy so that listings can be classified, category landing pages can exist, and the discovery filter UI can render category options.

## Scope
- Write SQL migration file `supabase/migrations/20260507000002_category_taxonomy.sql`
- Create `categories` table with exact fields from schema plan: `id` (uuid PK), `name` (text NOT NULL), `slug` (text NOT NULL UNIQUE), `parent_id` (uuid nullable FK → categories(id) ON DELETE SET NULL — self-referential), `description` (text nullable), `icon` (text nullable), `display_order` (integer NOT NULL DEFAULT 0), `is_active` (boolean NOT NULL DEFAULT true), `created_at` (timestamptz NOT NULL DEFAULT now()), `updated_at` (timestamptz NOT NULL DEFAULT now())
- Apply `updated_at` trigger to `categories`
- Create indexes: `UNIQUE(slug)`, `categories_parent_id_idx` on `(parent_id)`, `categories_display_order_idx` on `(parent_id, display_order)`
- Enable RLS on `categories`
- Write RLS policies: `anon` and `authenticated` SELECT where `is_active = true`; no INSERT/UPDATE/DELETE for either role; `service_role` bypasses RLS
- Seed all 25 top-level categories with `parent_id = NULL` (subcategories are V1 — deferred)
- All seeded categories must have `is_active = true`, sequential `display_order` starting at 1, lowercase kebab slugs, and human-readable names

## Out of Scope
- Subcategory rows (Beta/V1 per schema plan — `subcategory_ids` on `listings` is a UUID array, not a FK into a separate rows table at MVP)
- Category icon assets (icon field will be null at MVP; icons are added as a V1 enhancement)
- Category landing page UI (a separate product ticket)
- Admin category management UI

## Dependencies
- Depends on: Ticket 006 — geographic tables migration must run first (the `update_updated_at()` function is created in that migration; Ticket 007 reuses it)

## UX Notes
N/A — database migration ticket. No user-facing screens are built here.

## Design Notes
N/A — database migration ticket.

## Data Notes

**`categories` table — exact field spec:**

| Column | Type | Nullable | Default | Constraint |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `name` | `text` | NO | — | — |
| `slug` | `text` | NO | — | UNIQUE |
| `parent_id` | `uuid` | YES | — | FK → categories(id) ON DELETE SET NULL |
| `description` | `text` | YES | — | — |
| `icon` | `text` | YES | — | — |
| `display_order` | `integer` | NO | `0` | — |
| `is_active` | `boolean` | NO | `true` | — |
| `created_at` | `timestamptz` | NO | `now()` | — |
| `updated_at` | `timestamptz` | NO | `now()` | — |

**25 top-level categories to seed** (`parent_id = NULL`, `is_active = true`, `display_order` 1–25):

| # | Name | Slug |
|---|---|---|
| 1 | Food & Beverage | `food-beverage` |
| 2 | Health & Wellness | `health-wellness` |
| 3 | Beauty & Personal Care | `beauty-personal-care` |
| 4 | Fashion & Apparel | `fashion-apparel` |
| 5 | Home & Living | `home-living` |
| 6 | Professional Services | `professional-services` |
| 7 | Legal Services | `legal-services` |
| 8 | Financial Services | `financial-services` |
| 9 | Real Estate | `real-estate` |
| 10 | Technology & IT | `technology-it` |
| 11 | Creative & Arts | `creative-arts` |
| 12 | Media & Entertainment | `media-entertainment` |
| 13 | Music & Performing Arts | `music-performing-arts` |
| 14 | Education & Tutoring | `education-tutoring` |
| 15 | Childcare & Family Services | `childcare-family-services` |
| 16 | Fitness & Sports | `fitness-sports` |
| 17 | Events & Hospitality | `events-hospitality` |
| 18 | Travel & Tourism | `travel-tourism` |
| 19 | Automotive | `automotive` |
| 20 | Construction & Trades | `construction-trades` |
| 21 | Nonprofit & Social Services | `nonprofit-social-services` |
| 22 | Religious & Faith Organizations | `religious-faith` |
| 23 | Retail & Shopping | `retail-shopping` |
| 24 | Staffing & Recruiting | `staffing-recruiting` |
| 25 | Other | `other` |

**RLS policies:**

```sql
-- Public SELECT for active categories only
CREATE POLICY "categories_select_active" ON categories
  FOR SELECT USING (is_active = true);

-- Block all writes for anon and authenticated roles
-- (service_role bypasses RLS for admin category management)
```

**Migration file naming:** `supabase/migrations/20260507000002_category_taxonomy.sql`

## API Notes
N/A — no API routes in this ticket.

A future Server Component fetching categories for the navigation filter will use:
```typescript
const { data: categories } = await supabase
  .from('categories')
  .select('id, name, slug, icon, display_order')
  .is('parent_id', null)
  .eq('is_active', true)
  .order('display_order')
```

## Implementation Notes

**Files to create:**
- `supabase/migrations/20260507000002_category_taxonomy.sql`

**Migration structure:**

```sql
-- 1. Create categories table (self-referential FK requires deferring until after table creation)
CREATE TABLE categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL,
  parent_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  description text,
  icon text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Indexes
CREATE UNIQUE INDEX categories_slug_unique ON categories (slug);
CREATE INDEX categories_parent_id_idx ON categories (parent_id);
CREATE INDEX categories_display_order_idx ON categories (parent_id, display_order);

-- 3. updated_at trigger
CREATE TRIGGER set_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4. Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- 5. RLS policy: public SELECT on active categories
CREATE POLICY "categories_select_active" ON categories
  FOR SELECT USING (is_active = true);

-- 6. Seed 25 top-level categories
INSERT INTO categories (name, slug, display_order) VALUES
  ('Food & Beverage', 'food-beverage', 1),
  ('Health & Wellness', 'health-wellness', 2),
  ...
  ('Other', 'other', 25);
```

**Key patterns:**
- The `parent_id` self-referential FK is created as part of the table definition — PostgreSQL supports this because the column references the same table
- `display_order` starts at 1, not 0, for the top-level seed data — this is a UX convention (easier to reason about ordering starting at 1)
- Icon values are `NULL` for all seeded categories at MVP — icons will be added via an admin migration at V1 when the icon design system is finalized
- Category names use ampersands in display names but hyphens in slugs — verify the slug generation convention is applied consistently
- `is_active = true` by default; new categories added by admin are immediately visible unless explicitly set to false

**Do not:**
- Seed subcategories in this ticket — subcategory support is explicitly V1
- Use the `description` field for placeholder text — leave it NULL; descriptions are added by content team later
- Create a `description` in any category slug that would conflict with a city slug (e.g., avoid slugs that match city names)

## Acceptance Criteria
- [ ] `supabase db push` applies the migration without errors
- [ ] `SELECT COUNT(*) FROM categories WHERE parent_id IS NULL` returns 25
- [ ] `SELECT COUNT(*) FROM categories WHERE is_active = true` returns 25
- [ ] All category slugs are lowercase kebab case — `SELECT slug FROM categories WHERE slug ~ '[^a-z0-9-]'` returns 0 rows
- [ ] `SELECT slug FROM categories` contains no duplicates (UNIQUE constraint is enforced)
- [ ] RLS is enabled on the `categories` table
- [ ] An anonymous Supabase client querying `categories` receives all 25 active rows
- [ ] An anonymous Supabase client attempting to INSERT a category receives permission denied (`42501`)
- [ ] `display_order` values for top-level categories are sequential 1–25 with no gaps
- [ ] The `categories_display_order_idx` index exists (verify with `pg_indexes`)

## Failure States
| Failure | User-visible behavior |
|---|---|
| Duplicate slug in seed data | Migration fails with UNIQUE constraint violation; engineer deduplicates slugs |
| `update_updated_at()` function missing | Trigger creation fails with `ERROR: function update_updated_at() does not exist`; engineer ensures Ticket 006 migration ran before this one |
| Self-referential FK causes circular reference during seed | No circular reference is possible for top-level seed data (all `parent_id = NULL`); risk is for subcategory inserts only |
| Category count mismatch | `SELECT COUNT(*) FROM categories` returns != 25; engineer checks the seed INSERT statement for any accidentally omitted or duplicated rows |

## Edge Cases
- If a future migration adds subcategories and uses the same slug as a top-level category (e.g., both `food-beverage` at top level and `food-beverage` as a child of another category), the UNIQUE constraint will block it — slugs must be globally unique across all category levels
- The `Other` category (slug: `other`) will be used as a catch-all classification — it should always remain active and should never be deleted or deactivated
- The self-referential FK means deleting a parent category sets `parent_id = NULL` on its children (ON DELETE SET NULL) rather than cascading — this is correct behavior for an admin deactivation scenario, but should be noted for future admin tooling

## Accessibility Notes
- [ ] N/A — database migration ticket.

## QA Test Cases
| # | Scenario | Role | Steps | Expected result |
|---|---|---|---|---|
| 1 | Migration applies | Engineer | Run `supabase db push` against local Supabase | Zero errors; 25 category rows inserted |
| 2 | Anon SELECT | Engineer | Use anon Supabase client to `SELECT * FROM categories ORDER BY display_order` | 25 rows returned in display_order sequence |
| 3 | Anon INSERT blocked | Engineer | Use anon Supabase client to INSERT a test category | `42501 permission denied` error |
| 4 | Slug uniqueness | Engineer | `SELECT slug, COUNT(*) FROM categories GROUP BY slug HAVING COUNT(*) > 1` | Zero rows returned |
| 5 | All top-level | Engineer | `SELECT COUNT(*) FROM categories WHERE parent_id IS NULL` | Returns 25 |

## Security Notes
- Category data is fully public reference data — anonymous SELECT is correct and intentional; no PII is stored in the categories table
- Admin-only writes are enforced by denying INSERT/UPDATE/DELETE to both `anon` and `authenticated` roles in RLS — `service_role` is used for admin category management
- Do not store any user-submitted content in the `categories` table — it is admin-curated only

## Completion Checklist
- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`) — N/A for pure SQL migration
- [ ] Lint: zero errors (`npm run lint`) — N/A for SQL files
- [ ] All acceptance criteria verified
- [ ] All four states implemented (loading, empty, error, success) — N/A for database migration
- [ ] Mobile tested at 375px — N/A for database migration
- [ ] Keyboard navigation tested — N/A for database migration
- [ ] Accessibility requirements met — N/A for database migration
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
