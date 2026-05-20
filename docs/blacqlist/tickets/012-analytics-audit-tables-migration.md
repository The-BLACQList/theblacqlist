# Ticket 012: Analytics and Audit Tables Migration

## Status

Draft

## Phase

Phase 1: Database / Auth / RLS Foundation

## Priority

P1

## Feature Area

Database

## Context

The analytics and audit tables capture event telemetry, search behavior, pre-aggregated per-listing metrics, immutable admin audit history, and the moderation queue. These tables are required before any analytics events can be fired, before admin actions can be logged, and before moderation workflows can function. Source: `docs/blacqlist/data/database-schema-plan.md` (Part B, Sections 10–13), `docs/blacqlist/data/rls-policy-plan.md` sections 4 and 6.

## User Story

As a platform engineer, I want the analytics, audit, and moderation tables created with correct schemas, indexes, and the audit log immutability trigger, so that the platform can record user behavior events, maintain a tamper-proof admin action history, and route content into the moderation queue from day one of operation.

## Scope

- SQL migration file `supabase/migrations/005_analytics_audit_tables.sql`
- Create `analytics_events` table with all fields and indexes
- Create `search_events` table with all fields and indexes
- Create `entity_analytics_daily` table with UNIQUE constraint on `(listing_id, date)`
- Create `admin_audit_log` table with all fields and the immutability trigger (BEFORE UPDATE OR DELETE raises EXCEPTION)
- Create `moderation_queue` table with all fields, status CHECK, and queue_type CHECK
- Apply `set_updated_at` trigger to `moderation_queue` only

## Out of Scope

- RLS policies for these tables (covered by Ticket 013)
- Application-layer analytics service or Server Action code
- Any admin dashboard UI for the moderation queue or audit log
- `platform_analytics_daily` (V1 table)
- `community_impact_daily` (V2 table)

## Dependencies

- Depends on: Ticket 009 — Core entity tables migration (listings table must exist for FKs)

## UX Notes

No user-facing UI in this ticket. Downstream impact: analytics events fired on every page view and user interaction depend on `analytics_events` and `search_events` tables existing. Admin moderation workflows depend on `moderation_queue`. Audit trail for all admin actions depends on `admin_audit_log`.

## Design Notes

No UI. Supabase migration file only.

## Data Notes

### `analytics_events`

| Field           | Type          | Nullable | Default             | Notes                                                                                            |
| --------------- | ------------- | -------- | ------------------- | ------------------------------------------------------------------------------------------------ |
| `id`            | `uuid`        | NO       | `gen_random_uuid()` | PK                                                                                               |
| `event_name`    | `text`        | NO       | —                   | e.g., `'listing_page_viewed'`, `'search_performed'`, `'listing_saved'`                           |
| `session_id`    | `text`        | NO       | —                   | Browser/device session identifier (not a user ID)                                                |
| `listing_id`    | `uuid`        | YES      | —                   | FK → `listings(id)` ON DELETE SET NULL; null for non-listing events                              |
| `city_slug`     | `text`        | YES      | —                   | Denormalized city slug for filter-free aggregate queries                                         |
| `category_slug` | `text`        | YES      | —                   | Denormalized category slug                                                                       |
| `user_id`       | `uuid`        | YES      | —                   | FK → `auth.users(id)` ON DELETE SET NULL; null for anonymous events                              |
| `referrer`      | `text`        | YES      | —                   | HTTP referrer string; null if no referrer                                                        |
| `properties`    | `jsonb`       | YES      | —                   | Event-specific payload. Shape varies per `event_name` — document per event type in service layer |
| `created_at`    | `timestamptz` | NO       | `now()`             |                                                                                                  |

- No `updated_at` — events are immutable append-only records
- Indexes: `analytics_events_created_at_idx` on `(created_at DESC)`, `analytics_events_listing_id_idx` on `(listing_id) WHERE listing_id IS NOT NULL` (partial), `analytics_events_event_name_idx` on `(event_name, created_at DESC)`
- Partitioning: At MVP scale, partitioning is deferred. Add a comment in the migration noting that monthly range partitioning on `created_at` should be evaluated at 10M+ rows.

### `search_events`

| Field                | Type          | Nullable | Default             | Notes                                                                        |
| -------------------- | ------------- | -------- | ------------------- | ---------------------------------------------------------------------------- |
| `id`                 | `uuid`        | NO       | `gen_random_uuid()` | PK                                                                           |
| `query`              | `text`        | YES      | —                   | Search query string; null for browse-only events                             |
| `city_slug`          | `text`        | YES      | —                   | City filter applied                                                          |
| `category_slug`      | `text`        | YES      | —                   | Category filter applied                                                      |
| `result_count`       | `integer`     | YES      | —                   | Number of results returned                                                   |
| `clicked_listing_id` | `uuid`        | YES      | —                   | FK → `listings(id)` ON DELETE SET NULL; the listing the user clicked, if any |
| `session_id`         | `text`        | NO       | —                   | Browser/device session identifier                                            |
| `user_id`            | `uuid`        | YES      | —                   | FK → `auth.users(id)` ON DELETE SET NULL; null for anonymous searches        |
| `created_at`         | `timestamptz` | NO       | `now()`             |                                                                              |

- No `updated_at` — append-only
- Indexes: `search_events_created_at_idx` on `(created_at DESC)`, `search_events_query_idx` on `(query)` for search analytics

### `entity_analytics_daily`

| Field        | Type          | Nullable | Default             | Notes                                 |
| ------------ | ------------- | -------- | ------------------- | ------------------------------------- |
| `id`         | `uuid`        | NO       | `gen_random_uuid()` | PK                                    |
| `listing_id` | `uuid`        | NO       | —                   | FK → `listings(id)` ON DELETE CASCADE |
| `date`       | `date`        | NO       | —                   | The date this row covers              |
| `page_views` | `integer`     | NO       | `0`                 |                                       |
| `cta_clicks` | `integer`     | NO       | `0`                 |                                       |
| `saves`      | `integer`     | NO       | `0`                 |                                       |
| `shares`     | `integer`     | NO       | `0`                 |                                       |
| `created_at` | `timestamptz` | NO       | `now()`             |                                       |
| `updated_at` | `timestamptz` | NO       | `now()`             | Auto-updated via trigger              |

- `UNIQUE (listing_id, date)` — one aggregate row per listing per day
- Indexes: `entity_analytics_daily_listing_date_idx` on `(listing_id, date DESC)`

### `admin_audit_log`

**Special rule: immutable — no UPDATE or DELETE from any role including service_role (enforced by trigger)**

| Field           | Type          | Nullable | Default             | Notes                                                                                           |
| --------------- | ------------- | -------- | ------------------- | ----------------------------------------------------------------------------------------------- |
| `id`            | `uuid`        | NO       | `gen_random_uuid()` | PK                                                                                              |
| `admin_user_id` | `uuid`        | NO       | —                   | FK → `auth.users(id)` ON DELETE RESTRICT — audit records must not lose their admin reference    |
| `action`        | `text`        | NO       | —                   | Action performed, e.g., `'listing_published'`, `'claim_approved'`, `'review_rejected'`          |
| `target_table`  | `text`        | NO       | —                   | The table affected by the action                                                                |
| `target_id`     | `uuid`        | YES      | —                   | PK of the affected record; null for bulk operations                                             |
| `before_state`  | `jsonb`       | YES      | —                   | Sanitized snapshot of record before change; no raw `verification_doc_paths` or `receipts` paths |
| `after_state`   | `jsonb`       | YES      | —                   | Sanitized snapshot after change                                                                 |
| `ip_address`    | `text`        | YES      | —                   | Request IP extracted server-side                                                                |
| `created_at`    | `timestamptz` | NO       | `now()`             |                                                                                                 |

- No `updated_at` — immutable by design
- FK uses ON DELETE RESTRICT (not SET NULL) to preserve the link between admin action and admin account; admin account deletion must be handled before any audit log entries can be cleared
- Indexes: `admin_audit_log_admin_user_id_idx` on `(admin_user_id, created_at DESC)`, `admin_audit_log_target_table_id_idx` on `(target_table, target_id)`

**Immutability trigger (required in this migration):**

```sql
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_log is immutable. Records cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_log_immutability_guard
  BEFORE UPDATE OR DELETE ON admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
```

### `moderation_queue`

| Field         | Type          | Nullable | Default             | Notes                                                                 |
| ------------- | ------------- | -------- | ------------------- | --------------------------------------------------------------------- |
| `id`          | `uuid`        | NO       | `gen_random_uuid()` | PK                                                                    |
| `queue_type`  | `text`        | NO       | —                   | CHECK IN (`'claim'`, `'review'`, `'correction'`, `'media_flag'`)      |
| `entity_id`   | `uuid`        | NO       | —                   | PK of the entity being reviewed (claim ID, review ID, etc.)           |
| `entity_type` | `text`        | NO       | —                   | The table name of the entity, e.g., `'claims'`, `'reviews'`           |
| `status`      | `text`        | NO       | `'pending'`         | CHECK IN (`'pending'`, `'in_review'`, `'resolved'`)                   |
| `assigned_to` | `uuid`        | YES      | —                   | FK → `auth.users(id)` ON DELETE SET NULL; admin assigned to this item |
| `created_at`  | `timestamptz` | NO       | `now()`             |                                                                       |
| `updated_at`  | `timestamptz` | NO       | `now()`             | Auto-updated via trigger                                              |

- Indexes: `moderation_queue_status_idx` on `(status) WHERE status IN ('pending', 'in_review')` (partial), `moderation_queue_queue_type_idx` on `(queue_type, status)`

### Migration required

Yes — `supabase/migrations/005_analytics_audit_tables.sql`

## API Notes

No API endpoints defined in this ticket. These tables are written to by:

- Server Actions and Route Handlers that fire `analytics_events` on every listing page view, search, save, and CTA click
- Service-layer admin actions that write `admin_audit_log` on every mutation
- Moderation Service Actions that create `moderation_queue` entries when content is flagged

## Implementation Notes

**File to create:**

- `supabase/migrations/005_analytics_audit_tables.sql`

**Ordering matters:** Create tables in this order to satisfy FK resolution:

1. `analytics_events`
2. `search_events`
3. `entity_analytics_daily`
4. `admin_audit_log` + trigger
5. `moderation_queue`

**Key patterns:**

- `analytics_events` is INSERT-only at the application layer. Do not create any UPDATE or DELETE paths. The table will grow; add a migration comment noting partition strategy for scale.
- `admin_audit_log` INSERT is performed via the service role client only, inside the same transaction as the mutation it records where possible. If the mutation is multi-step, the audit log entry is written on the final step.
- `admin_audit_log` MUST NOT use `ON DELETE CASCADE` for `admin_user_id` FK — use `RESTRICT` so admin accounts cannot be deleted while audit history exists.
- `entity_analytics_daily` rows are upserted by the analytics aggregation job using `INSERT ... ON CONFLICT (listing_id, date) DO UPDATE SET page_views = entity_analytics_daily.page_views + EXCLUDED.page_views, ...`

**Trigger test requirement:** Before the PR is merged, the engineer must verify the immutability trigger by running both of these statements against the dev DB and confirming both raise an exception:

```sql
UPDATE admin_audit_log SET action = 'tampered' WHERE id = '[any-id]';
DELETE FROM admin_audit_log WHERE id = '[any-id]';
```

**Files to modify:**

- `supabase/migrations/004_engagement_tables.sql` — no modification needed unless `claims` or `reviews` need a FK reference to `moderation_queue` (they do not at MVP)

## Acceptance Criteria

- [ ] Migration `005_analytics_audit_tables.sql` runs without error on a fresh Supabase dev instance after 004 has been applied
- [ ] `analytics_events` table exists with all 9 defined columns and correct types
- [ ] `entity_analytics_daily` has `UNIQUE (listing_id, date)` — verified by duplicate INSERT raising `23505`
- [ ] `admin_audit_log` immutability trigger fires on UPDATE — confirmed by attempting `UPDATE admin_audit_log SET action = 'test'` which raises `EXCEPTION 'admin_audit_log is immutable...'`
- [ ] `admin_audit_log` immutability trigger fires on DELETE — confirmed by attempting `DELETE FROM admin_audit_log WHERE id = '...'` which raises the same exception
- [ ] `moderation_queue.status` CHECK constraint works — confirmed by INSERT with `status = 'archived'` raising `23514`
- [ ] `moderation_queue.queue_type` CHECK constraint works — confirmed by INSERT with `queue_type = 'spam'` raising `23514`
- [ ] `entity_analytics_daily` `set_updated_at` trigger fires — confirmed by UPDATE and observing `updated_at` change
- [ ] `moderation_queue` `set_updated_at` trigger fires — confirmed by UPDATE and observing `updated_at` change
- [ ] `tsc --noEmit` passes after running `supabase gen types typescript` to regenerate types

## Failure States

| Failure                                                        | User-visible behavior                                                                                                                                                       |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migration run before Ticket 009 (listings table missing)       | Migration fails with `relation "listings" does not exist`; run Ticket 009 migration first                                                                                   |
| `update_updated_at()` function missing                         | Migration fails with `function update_updated_at() does not exist`; earlier migration must create it                                                                        |
| Attempt to UPDATE admin_audit_log                              | Postgres raises `EXCEPTION 'admin_audit_log is immutable.'`; any code path that attempts an UPDATE is a bug                                                                 |
| Attempt to DELETE admin_audit_log                              | Same exception; these records are compliance artifacts and must never be deleted                                                                                            |
| analytics_events table grows without partitioning at >10M rows | Query performance degrades on date-range analytics queries; engineer must add monthly partitioning at that threshold (documented as known future work in migration comment) |

## Edge Cases

- `analytics_events.properties` is a free-form `jsonb` column; the shape must be documented per `event_name` in the analytics service code, not in the migration itself
- `admin_audit_log.before_state` and `after_state` must be sanitized by the service layer before INSERT — remove `verification_doc_paths`, `receipts` paths, and any secrets. The migration cannot enforce this; a comment in the migration must flag it.
- `admin_audit_log.ip_address` is nullable — some server environments may not expose the client IP (Vercel Edge, proxies). The service layer must handle null gracefully and not block the audit log write.
- The `admin_audit_log.admin_user_id FK ON DELETE RESTRICT` means a super_admin account deletion flow must `SET NULL` or migrate the `admin_user_id` to a system account before deleting — this is a V1 ops concern but must be noted.

## Accessibility Notes

Not applicable — database migration ticket.

## QA Test Cases

| #    | Scenario                                 | Role     | Steps                                                                                                                               | Expected result                                                                 |
| ---- | ---------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| QA-1 | Immutability trigger on UPDATE           | Engineer | Run migration; INSERT one row into `admin_audit_log`; attempt `UPDATE admin_audit_log SET action = 'test' WHERE id = [inserted-id]` | `ERROR: admin_audit_log is immutable. Records cannot be updated or deleted.`    |
| QA-2 | Immutability trigger on DELETE           | Engineer | Same setup; attempt `DELETE FROM admin_audit_log WHERE id = [inserted-id]`                                                          | Same exception                                                                  |
| QA-3 | entity_analytics_daily UNIQUE constraint | Engineer | Run migration; INSERT two rows with same `(listing_id, date)`; second INSERT fails                                                  | `ERROR 23505 unique_violation`                                                  |
| QA-4 | moderation_queue queue_type CHECK        | Engineer | INSERT with `queue_type = 'listing'` (not in allowed set)                                                                           | `ERROR 23514 check_violation`                                                   |
| QA-5 | analytics_events append-only pattern     | Engineer | INSERT an analytics event row; confirm row exists; confirm no UPDATE or DELETE paths exist in application code by grep              | No UPDATE or DELETE statements found for `analytics_events` in application code |

## Security Notes

- `admin_audit_log` INSERT must only be called from server-side service role code. No RLS policy permits `authenticated` role INSERT — this is enforced at the RLS level (Ticket 013) and at the code review level.
- `analytics_events.user_id` is nullable and must never be included in any aggregate query result or API response. The column exists for internal admin analysis only.
- The `admin_audit_log.before_state` and `after_state` jsonb fields must be sanitized in the service layer to remove any storage paths pointing to private buckets (`verification-docs`, `receipts`). A TODO comment must appear in the migration explaining this requirement.

## Completion Checklist

- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`) after type regeneration
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] Immutability trigger manually tested with both UPDATE and DELETE attempts
- [ ] Rollback SQL documented in a comment at the bottom of the migration file
- [ ] All four states implemented (loading, empty, error, success) — N/A for migration ticket
- [ ] Mobile tested at 375px — N/A for migration ticket
- [ ] PR opened and linked to this ticket
