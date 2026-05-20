# Ticket 093: Seed Data Import Script — Launch Listings

## Status
Draft

## Phase
Phase 18: Production Deployment and Post-Launch Hardening

## Priority
P0

## Feature Area
Deployment / Data

## Context
The platform needs real, curated listing data at launch. An empty discovery platform provides no value. This ticket creates the import infrastructure and seeds 250+ listings across Atlanta (150+), Houston (50+), and Chicago (50+) across multiple categories. The import script reads structured JSON input and inserts via the Supabase service_role client. Must be idempotent (re-running does not create duplicates). After import, FTS search vectors must be refreshed. Source of truth for what to seed: `data/seed-data-plan.md`.

## User Story
As a platform operator, I want to populate the production database with curated launch listings, so that visitors on day one can discover real Black-owned businesses rather than an empty platform.

## Scope
- `scripts/seed-launch-listings.ts` — TypeScript seed script, runs via `npx ts-node scripts/seed-launch-listings.ts`
- Input: JSON files at `scripts/data/listings-atlanta.json`, `listings-houston.json`, `listings-chicago.json`
- JSON schema per listing: `{ name, slug, description, listing_type, city_slug, category_slug, subcategory_slug, phone, email, website, address, latitude, longitude, primary_cta_type, primary_cta_value, cover_image_path, logo_path, hours: [{ day, open_time, close_time, is_closed }], links: [{ platform, url }] }`
- Insert via service_role client: `listings`, `listing_details_business`, `listing_hours`, `listing_links`
- Set `status = 'published'`, `published_at = now()`, `created_by = seed_user_id` (a designated seed admin user)
- Idempotent: `INSERT ... ON CONFLICT (slug) DO NOTHING`
- After all inserts: run FTS vector refresh: `UPDATE listings SET search_vector = to_tsvector(...)` for all seeded rows
- Progress logging: log each inserted/skipped record to console
- Minimum counts: 150 Atlanta, 50 Houston, 50 Chicago across categories per `seed-data-plan.md`

## Out of Scope
- Media file upload (cover images and logos are pre-uploaded to Supabase Storage before running the script; paths are included in the JSON)
- User accounts (seeded separately via `seed-users.ts`)
- Analytics data seeding
- Review or claim seeding

## Dependencies
- Depends on: Ticket 091 (production Supabase — tables must exist before seed runs)

## UX Notes
Not applicable — data import script.

## Design Notes
Not applicable.

## Data Notes
- Tables written: `listings`, `listing_details_business`, `listing_hours`, `listing_links`
- `listings.slug` must be globally unique — generated as `[business-name-kebab]-[city]`
- `listings.status` = `'published'` for all seed records
- `listings.tier` = `'free'` for all seed records at launch
- `listing_hours`: 7 rows per listing (one per day of week: 0=Sun, 6=Sat)
- FTS refresh: `UPDATE listings SET search_vector = to_tsvector('english', COALESCE(name,'') || ' ' || COALESCE(description,'') || ' ' || ...) WHERE slug = ANY($1)` using the array of seeded slugs

## API Notes
Not applicable — script uses Supabase client directly with service_role key.

## Implementation Notes
```typescript
// scripts/seed-launch-listings.ts (outline)
import { createClient } from '@supabase/supabase-js'
import atlantaListings from './data/listings-atlanta.json'
import houstonListings from './data/listings-houston.json'
import chicagoListings from './data/listings-chicago.json'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function seedListing(listing: ListingInput) {
  const { data, error } = await supabase
    .from('listings')
    .upsert({ ...listingRow }, { onConflict: 'slug', ignoreDuplicates: true })
  // ... insert listing_details_business, listing_hours, listing_links
}
```
- Run: `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx ts-node scripts/seed-launch-listings.ts`
- Must be run AFTER migrations, BEFORE smoke tests
- Script outputs: "Inserted: [N]", "Skipped (already exists): [N]", "Errors: [N]"

## Acceptance Criteria
- [ ] Script runs to completion without unhandled errors
- [ ] At least 150 Atlanta listings inserted with `status = 'published'`
- [ ] At least 50 Houston listings inserted with `status = 'published'`
- [ ] At least 50 Chicago listings inserted with `status = 'published'`
- [ ] Re-running the script inserts 0 new rows (idempotent — all conflict on slug)
- [ ] Search returns results for "barbershop atlanta" after seed (FTS vectors refreshed)
- [ ] Each seeded listing has a corresponding `listing_details_business` row
- [ ] Each seeded listing has exactly 7 `listing_hours` rows (one per day)
- [ ] Script output logs "Inserted: N, Skipped: 0, Errors: 0" on first run

## Failure States
| Failure | User-visible behavior |
|---|---|
| Script fails midway | Partial data in DB — re-run (idempotent), check error log |
| Slug collision | ON CONFLICT DO NOTHING — logged as "Skipped"; investigate slug generation |
| Missing city_slug or category_slug | FK violation — pre-validate JSON against seeded cities/categories before running |

## Edge Cases
- Listing with no hours (e.g., online-only): insert 7 rows with `is_closed = true`
- Listing with no phone or email: insert as NULL — these fields are nullable
- Category slug that doesn't exist yet: script must validate all category/city slugs against DB before attempting insert

## Accessibility Notes
Not applicable.

## QA Test Cases
| # | Test | Steps | Expected result |
|---|---|---|---|
| 1 | First run | Run script against staging DB | 250+ rows inserted; 0 errors |
| 2 | Idempotent re-run | Run script again | 0 inserted, 250+ skipped; 0 errors |
| 3 | Search after seed | Search "restaurant atlanta" | Results include seeded Atlanta restaurants |
| 4 | Listing page loads | Navigate to /atlanta/business/[seeded-slug] | BLACQList Page renders with seeded data |

## Security Notes
- Script requires `SUPABASE_SERVICE_ROLE_KEY` — run only in trusted environments (local or CI with secrets)
- Never commit the JSON data files if they contain sensitive business owner PII
- Script must not be exposed as an API endpoint

## Completion Checklist
- [ ] `scripts/seed-launch-listings.ts` written and tested on staging
- [ ] All JSON data files prepared and validated (city slugs, category slugs checked)
- [ ] Script run on production Supabase (after Ticket 091)
- [ ] Counts verified: 150+ Atlanta, 50+ Houston, 50+ Chicago
- [ ] Idempotency verified (second run = 0 new rows)
- [ ] FTS search verified post-seed
- [ ] PR opened and linked to this ticket
