# Ticket 091: Supabase Production Project Migration and Configuration

## Status
Draft

## Phase
Phase 18: Production Deployment and Post-Launch Hardening

## Priority
P0

## Feature Area
Deployment

## Context
The production Supabase project is a separate project from staging. All migrations must be run in the correct order, RLS policies verified, storage buckets created with correct access settings, Point-in-Time Recovery enabled, and production environment variables set in Vercel. This ticket is the database prerequisite for Ticket 092 (Vercel production deployment) and Ticket 093 (seed data import). Source of truth for migration order: `data/database-schema-plan.md` Section 15 (MVP priority order).

## User Story
As the engineering lead, I want the production Supabase project fully configured with correct schema, RLS, and backups, so that the platform launches with a secure and reliable database foundation.

## Scope
- Create production Supabase project (separate from staging)
- Run all MVP migrations in order per `database-schema-plan.md` Section 15:
  `states` → `cities` → `categories` → `profiles` → `user_roles` → `listings` → `listing_details_business` → `listing_hours` → `listing_links` → `services` → `media_attachments` → `claims` → `saves` → `reviews` → `collections` → `collection_items` → `analytics_events` → `search_events` → `entity_analytics_daily` → `admin_audit_log` → `moderation_queue`
- Apply all RLS policies from `rls-policy-plan.md`
- Enable `pg_trgm` extension for search
- Enable `pg_cron` extension for analytics aggregation (Ticket 082)
- Create storage buckets: `listing-media` (public), `verification-docs` (private), `receipts` (private)
- Apply storage bucket RLS policies per `rls-policy-plan.md` storage section
- Enable Point-in-Time Recovery (PITR) on production project
- Verify RLS with 5 critical manual tests (see Acceptance Criteria)
- Set production environment variables in Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Out of Scope
- Seed data (Ticket 093)
- Vercel domain configuration (Ticket 092)
- Monitoring setup (Ticket 094)

## Dependencies
- Depends on: Ticket 013 (RLS policies — finalized policy definitions)

## UX Notes
Not applicable — infrastructure setup ticket.

## Design Notes
Not applicable.

## Data Notes
- Migration order is critical — follow Section 15 of `database-schema-plan.md` exactly
- RLS policies: reference `data/rls-policy-plan.md` — all 65 tables
- `admin_audit_log` INSERT-only trigger must be applied after table creation
- `updated_at` triggers must be applied to all tables that have `updated_at` column

## API Notes
Not applicable — no new API routes.

## Implementation Notes
- Run migrations via Supabase CLI: `supabase db push` against production project (or via the Supabase dashboard SQL editor for initial setup)
- After migrations: run `SELECT tablename FROM pg_tables WHERE schemaname = 'public'` to confirm all 21 MVP tables exist
- Bucket creation via Supabase dashboard Storage tab (not CLI)
- PITR: enabled via Supabase dashboard → Settings → Database → Point in Time Recovery

## Acceptance Criteria
- [ ] All 21 MVP tables exist in production Supabase (confirmed via dashboard)
- [ ] `pg_trgm` extension enabled: `SELECT * FROM pg_extension WHERE extname = 'pg_trgm'` returns a row
- [ ] `pg_cron` extension enabled
- [ ] Three storage buckets created: `listing-media` (public), `verification-docs` (private), `receipts` (private)
- [ ] PITR enabled on production project
- [ ] RLS verification test 1: unauthenticated request to `listings` returns only published rows
- [ ] RLS verification test 2: authenticated non-owner request to another owner's `listing_details_business` returns no rows
- [ ] RLS verification test 3: INSERT to `admin_audit_log` succeeds; UPDATE attempt returns error
- [ ] RLS verification test 4: unauthenticated request to `verification-docs` bucket returns 403
- [ ] RLS verification test 5: owner can UPDATE their own `listings` row; non-owner cannot
- [ ] All production environment variables set in Vercel (confirmed via Vercel dashboard)

## Failure States
| Failure | User-visible behavior |
|---|---|
| Migration fails (FK constraint) | Stop migration run; diagnose FK order issue; do not proceed to next migration |
| RLS verification fails | Block launch; fix policy; re-verify |
| PITR not available on plan | Upgrade Supabase plan before launch |

## Edge Cases
- Circular FK between `listings` and `claims`: resolved by adding the FK as a deferred `ALTER TABLE` after both tables exist (Ticket 011 pattern)
- `pg_cron` may not be available on free tier — confirm plan before enabling

## Accessibility Notes
Not applicable.

## QA Test Cases
| # | Scenario | Role | Steps | Expected result |
|---|---|---|---|---|
| 1 | Unauthenticated listings read | None | Direct Supabase API call: SELECT * FROM listings | Only published rows returned |
| 2 | Non-owner listing write | Auth user (not owner) | UPDATE listings SET name='x' WHERE id=[other owner's listing] | 0 rows updated (RLS blocked) |
| 3 | Audit log immutability | Admin | INSERT to admin_audit_log; attempt UPDATE on same row | INSERT succeeds; UPDATE returns trigger error |
| 4 | Verification doc access | None | GET /storage/v1/object/verification-docs/[path] | 403 Unauthorized |
| 5 | Migration count | — | SELECT COUNT(*) FROM pg_tables WHERE schemaname='public' | >= 21 tables |

## Security Notes
- `SUPABASE_SERVICE_ROLE_KEY` must NEVER be exposed to the client — server-side only
- Production RLS must be verified before any public traffic is allowed
- Backup verification: confirm PITR is enabled and functional before launch
- No direct database access from application code — all access via Supabase client or RLS-enforced policies

## Completion Checklist
- [ ] All 21 MVP tables created in production
- [ ] All RLS policies applied and verified (5 manual tests passed)
- [ ] Extensions enabled: pg_trgm, pg_cron
- [ ] Storage buckets created with correct access settings
- [ ] PITR enabled
- [ ] Production env vars set in Vercel
- [ ] Migration run logged and saved (with timestamp and git commit)
- [ ] PR opened and linked to this ticket
