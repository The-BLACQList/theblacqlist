# Ticket 067: Flow map data model — spend_events, flow_nodes, flow_edges migrations

## Status
Draft

## Phase
Phase 12: Flow Map Data and MVP Visualization

## Priority
P3

## Estimate
M (2–4h)

## Feature Area
Flow Map

---

## Context

The Dollar Flow Map is a future visualization showing how community dollars move between supporters, businesses, neighborhoods, and cities. Before any visualization can be built, the underlying data model must exist. This ticket creates the three tables that power the flow map — `spend_events`, `flow_nodes`, and `flow_edges` — and a PostgreSQL trigger that auto-populates them when a `receipt_uploads` row transitions to `status = 'approved'`.

`spend_events` is the event log: each approved receipt creates one spend event linking a supporter to a business to a city. `flow_nodes` aggregates business and city nodes for graph rendering. `flow_edges` tracks directed spend flows between nodes with running totals.

These tables are used by Ticket 068 (aggregate API) and Ticket 069 (personal impact API). No visualization is built in this ticket — only the schema and trigger.

Sources: `docs/blacqlist/data/database-schema-plan.md` § spend_events, flow_nodes, flow_edges; `docs/blacqlist/data/enums-and-statuses.md` § 2.10 (`receipt_uploads.status`), § 24 (`spend_events.source`).

---

## User Story

As a platform engineer, I want the spend data model in place, so that community spend data aggregates automatically when receipts are approved and downstream APIs can query impact statistics without complex denormalization work later.

---

## Scope

**In scope:**
- Migration file: `migrations/[timestamp]_create_flow_map_tables.sql`
- `spend_events` table creation (see Data Notes for full schema)
- `flow_nodes` table creation
- `flow_edges` table creation
- Indexes on all three tables (see Data Notes)
- A PostgreSQL `AFTER UPDATE ON receipt_uploads FOR EACH ROW` trigger function `create_spend_event_on_receipt_approval`:
  - Fires when `NEW.status = 'approved' AND OLD.status != 'approved'` (status transition only, not every update)
  - Inserts a row into `spend_events` with `source = 'receipt-upload'`
  - Upserts a `flow_nodes` row for the business (if `receipt.listing_id IS NOT NULL`)
  - Upserts a `flow_nodes` row for the city (if the listing has a `city_id`)
  - Upserts a `flow_edges` row for the supporter → business edge, incrementing `total_amount_cents` and `transaction_count`
  - Upserts a `flow_edges` row for the business → city edge similarly
  - All upserts are in the same transaction as the trigger — atomic
- RLS: `spend_events` readable by `anon` and `authenticated` (anonymized — `user_id` is NOT included in the publicly queryable columns; use a view or column-level security to exclude it); only service role can INSERT/UPDATE/DELETE
- RLS for `flow_nodes` and `flow_edges`: public SELECT; service role only for mutations

**Out of scope:**
- Dollar Flow Map visualization UI (V3)
- `GET /api/community-spend` aggregate endpoint (Ticket 068)
- `GET /api/flow/personal-impact` endpoint (Ticket 069)
- Marketplace purchase spend events (V2 — `source = 'marketplace-purchase'`; trigger connects to `orders` table, not `receipt_uploads`)
- Real-time spend event streaming (V3)
- Geographic coordinates / neighborhood-level aggregation (V2)

---

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| Ticket 002 — Supabase project setup (migration tooling) | Blocking ticket | Not started |
| `receipt_uploads` table and `status` column (from schema migration in Phase 11 scope) | Database | Must exist |
| `listings` table (Ticket 009) — for `listing_id` FK and `city_id` join in trigger | Blocking ticket | Not started |
| `cities` table (Ticket 006) — for `city_id` FK in `flow_nodes` | Blocking ticket | Not started |

---

## UX Notes

This is a database migration ticket — no UI is built. The tables power future API endpoints and the eventual V3 flow map visualization.

---

## Design Notes

No frontend design in this ticket.

---

## Data Notes

### spend_events

**Purpose:** One row per approved receipt (or per marketplace purchase in V2). The atomic spend record.

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `receipt_upload_id` | `uuid` | YES | — | FK → `receipt_uploads(id)` ON DELETE SET NULL; null for marketplace source |
| `listing_id` | `uuid` | YES | — | FK → `listings(id)` ON DELETE SET NULL; the business where money was spent |
| `city_id` | `uuid` | YES | — | FK → `cities(id)` ON DELETE SET NULL; denormalized from `listings.city_id` at event creation |
| `amount_cents` | `integer` | NO | — | Amount spent in cents; copied from `receipt_uploads.amount_cents` |
| `purchase_date` | `date` | YES | — | Date of purchase; copied from `receipt_uploads.purchase_date` |
| `source` | `text` | NO | — | CHECK IN (`'marketplace-purchase'`, `'receipt-upload'`) |
| `created_at` | `timestamptz` | NO | `now()` | |

**Anonymization rule:** `user_id` of the submitting supporter is NOT stored on `spend_events`. The platform tracks aggregate spend, not individual spend history linked to a user record. Use `receipt_uploads.user_id` for personal impact queries (Ticket 069) — do NOT copy it onto `spend_events`.

**Indexes:**
- `PRIMARY KEY (id)`
- `spend_events_listing_id_idx` on `(listing_id)` — B-tree
- `spend_events_city_id_idx` on `(city_id)` — B-tree
- `spend_events_purchase_date_idx` on `(purchase_date)` — B-tree; date-range aggregations
- `spend_events_source_idx` on `(source)` — B-tree

**RLS:**
- `anon` and `authenticated` SELECT: allowed (no `user_id` exposed — public aggregate data)
- INSERT/UPDATE/DELETE: service role only (via trigger — no direct client mutations)

### flow_nodes

**Purpose:** Aggregate node records for graph rendering. One row per business, one row per city. Updated (upserted) on each spend event.

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `node_type` | `text` | NO | — | CHECK IN (`'business'`, `'city'`) |
| `entity_id` | `uuid` | NO | — | FK to `listings.id` (for business) or `cities.id` (for city); no formal FK constraint (polymorphic) |
| `total_amount_cents` | `bigint` | NO | `0` | Running total of all spend through this node |
| `transaction_count` | `integer` | NO | `0` | Running count of spend events touching this node |
| `last_transaction_at` | `timestamptz` | YES | — | Timestamp of the most recent spend event |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Trigger-updated |

**Unique constraint:** `UNIQUE (node_type, entity_id)` — one node per business, one node per city.

**Indexes:**
- `PRIMARY KEY (id)`
- `UNIQUE (node_type, entity_id)`
- `flow_nodes_entity_idx` on `(node_type, entity_id)` — covered by unique index

**RLS:** `anon` and `authenticated` SELECT allowed; service role only for mutations.

### flow_edges

**Purpose:** Directed spend flow between two nodes. One row per unique source → target node pair. Totals are updated (upserted) on each event.

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `source_node_id` | `uuid` | NO | — | FK → `flow_nodes(id)` ON DELETE CASCADE |
| `target_node_id` | `uuid` | NO | — | FK → `flow_nodes(id)` ON DELETE CASCADE |
| `total_amount_cents` | `bigint` | NO | `0` | Running total of spend on this edge |
| `transaction_count` | `integer` | NO | `0` | Running count |
| `last_transaction_at` | `timestamptz` | YES | — | |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |

**Unique constraint:** `UNIQUE (source_node_id, target_node_id)`.

**Indexes:**
- `PRIMARY KEY (id)`
- `UNIQUE (source_node_id, target_node_id)`
- `flow_edges_source_idx` on `(source_node_id)` — B-tree
- `flow_edges_target_idx` on `(target_node_id)` — B-tree

**RLS:** `anon` and `authenticated` SELECT allowed; service role only for mutations.

### Trigger function spec

```sql
CREATE OR REPLACE FUNCTION create_spend_event_on_receipt_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_listing_id uuid;
  v_city_id uuid;
  v_amount_cents integer;
  v_purchase_date date;
  v_spend_event_id uuid;
  v_business_node_id uuid;
  v_city_node_id uuid;
BEGIN
  -- Only fire on status transition to 'approved'
  IF NEW.status != 'approved' OR OLD.status = 'approved' THEN
    RETURN NEW;
  END IF;

  v_listing_id := NEW.listing_id;
  v_amount_cents := COALESCE(NEW.amount_cents, 0);
  v_purchase_date := NEW.purchase_date;

  -- Get city_id from the listing (if listing_id is set)
  IF v_listing_id IS NOT NULL THEN
    SELECT city_id INTO v_city_id FROM listings WHERE id = v_listing_id;
  END IF;

  -- Insert spend_event
  INSERT INTO spend_events (receipt_upload_id, listing_id, city_id, amount_cents, purchase_date, source)
  VALUES (NEW.id, v_listing_id, v_city_id, v_amount_cents, v_purchase_date, 'receipt-upload')
  RETURNING id INTO v_spend_event_id;

  -- Upsert business flow_node (only if listing_id is set)
  IF v_listing_id IS NOT NULL THEN
    INSERT INTO flow_nodes (node_type, entity_id, total_amount_cents, transaction_count, last_transaction_at)
    VALUES ('business', v_listing_id, v_amount_cents, 1, now())
    ON CONFLICT (node_type, entity_id) DO UPDATE
      SET total_amount_cents = flow_nodes.total_amount_cents + EXCLUDED.total_amount_cents,
          transaction_count = flow_nodes.transaction_count + 1,
          last_transaction_at = now()
    RETURNING id INTO v_business_node_id;
  END IF;

  -- Upsert city flow_node (only if city_id is set)
  IF v_city_id IS NOT NULL THEN
    INSERT INTO flow_nodes (node_type, entity_id, total_amount_cents, transaction_count, last_transaction_at)
    VALUES ('city', v_city_id, v_amount_cents, 1, now())
    ON CONFLICT (node_type, entity_id) DO UPDATE
      SET total_amount_cents = flow_nodes.total_amount_cents + EXCLUDED.total_amount_cents,
          transaction_count = flow_nodes.transaction_count + 1,
          last_transaction_at = now()
    RETURNING id INTO v_city_node_id;
  END IF;

  -- Upsert business → city edge (only if both nodes exist)
  IF v_business_node_id IS NOT NULL AND v_city_node_id IS NOT NULL THEN
    INSERT INTO flow_edges (source_node_id, target_node_id, total_amount_cents, transaction_count, last_transaction_at)
    VALUES (v_business_node_id, v_city_node_id, v_amount_cents, 1, now())
    ON CONFLICT (source_node_id, target_node_id) DO UPDATE
      SET total_amount_cents = flow_edges.total_amount_cents + EXCLUDED.total_amount_cents,
          transaction_count = flow_edges.transaction_count + 1,
          last_transaction_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER receipt_approval_spend_event
  AFTER UPDATE ON receipt_uploads
  FOR EACH ROW
  EXECUTE FUNCTION create_spend_event_on_receipt_approval();
```

---

## API Notes

No API endpoints in this ticket. The tables created here are used by Ticket 068 and Ticket 069.

---

## Implementation Notes

**Files to create:**
- `migrations/[timestamp]_create_flow_map_tables.sql` — full migration SQL: CREATE TABLE for all three tables, indexes, unique constraints, RLS policies, trigger function, and trigger

**Files to modify:**
- None

**Key patterns:**
- The trigger function uses `SECURITY DEFINER` so it runs with the definer's privileges (superuser at migration time), bypassing RLS on the tables it writes to — this is necessary because the trigger is called in the context of the `authenticated` user doing the receipt approval, not the service role
- The `ON CONFLICT ... DO UPDATE` upsert pattern avoids race conditions on concurrent approvals — PostgreSQL row-level locking ensures correctness
- `flow_nodes.total_amount_cents` and `flow_edges.total_amount_cents` use `bigint` (not `integer`) — community-scale spend could eventually exceed `integer` maximum (~$21M in cents); `bigint` is safe to petabytes
- If `receipt_uploads.amount_cents` is NULL when approved (user submitted without entering amount): use `COALESCE(NEW.amount_cents, 0)` — a zero-amount spend event is recorded rather than skipping the event
- The trigger does NOT write to `admin_audit_log` — receipt approval itself is logged by the `approveReceipt` SA (Ticket 065); the trigger is a data-pipeline side effect, not an auditable admin action

**Do not:**
- Store `user_id` on `spend_events` — see anonymization rule above
- Create the flow map visualization in this ticket
- Add Marketplace purchase trigger logic (V2 scope)

---

## Acceptance Criteria

- [ ] After running the migration, `spend_events`, `flow_nodes`, and `flow_edges` tables exist with all columns, constraints, and indexes as specified
- [ ] Given a `receipt_uploads` row is updated from any non-`approved` status to `status = 'approved'`, then a `spend_events` row is automatically inserted by the trigger with correct `listing_id`, `city_id`, `amount_cents`, `purchase_date`, and `source = 'receipt-upload'`
- [ ] Given the same business's receipt is approved twice, then `flow_nodes` has one row for that business with `total_amount_cents` equal to the sum of both receipt amounts and `transaction_count = 2`
- [ ] Given a receipt with `listing_id = NULL` is approved, then a `spend_events` row is inserted with `listing_id = NULL`; no `flow_nodes` or `flow_edges` rows are created for that event
- [ ] `anon` SELECT on `spend_events` succeeds (public aggregate data); INSERT from `authenticated` user fails (service role only)
- [ ] The `UNIQUE (node_type, entity_id)` constraint on `flow_nodes` is enforced — no duplicate node rows
- [ ] The `UNIQUE (source_node_id, target_node_id)` constraint on `flow_edges` is enforced

---

## Failure States

| Failure | User-visible behavior |
|---|---|
| Trigger function raises an exception | The `receipt_uploads` UPDATE rolls back (the approval fails) — admin sees SA error in Ticket 065's UI; receipt remains in previous status |
| `listings` row not found for `listing_id` (orphaned FK) | `city_id` is NULL; spend event recorded with `listing_id` and `city_id = NULL`; no flow_nodes upsert for city |
| Migration fails on staging | Migration must not run on production until it passes on staging — follow migration testing procedure from deployment plan |

---

## Edge Cases

- `receipt_uploads.amount_cents = 0`: spend event is recorded (zero-amount); `flow_nodes.total_amount_cents` incremented by 0 (no harm)
- `receipt_uploads.purchase_date = NULL`: `spend_events.purchase_date` is NULL; date-range queries on `spend_events` skip this row (correct behavior)
- Trigger fires on a manual service-role UPDATE that sets `status = 'approved'` (e.g., via Supabase Studio): trigger fires and creates the spend event — this is the correct and expected behavior
- Two simultaneous approvals of different receipts for the same business: PostgreSQL row-level locking in `ON CONFLICT DO UPDATE` handles this correctly — no lost updates

---

## Accessibility Notes

Not applicable — this is a database migration ticket with no UI.

---

## QA Test Cases

| # | Scenario | Role | Steps | Expected result |
|---|---|---|---|---|
| QA-1 | Tables exist after migration | DBA | Run migration; query `information_schema.tables` | All three tables exist with correct columns |
| QA-2 | Trigger fires on approval | admin | Approve a receipt via Ticket 065 admin SA | `spend_events` row inserted; `flow_nodes` upserted for business and city; `flow_edges` upserted |
| QA-3 | Deduplication on multiple approvals | admin | Approve two receipts for the same business | One `flow_nodes` row with `transaction_count = 2`; one `flow_edges` row with summed amounts |
| QA-4 | NULL listing_id receipt | admin | Approve a receipt with no `listing_id` | `spend_events` row inserted with `listing_id = NULL`; no `flow_nodes` or `flow_edges` created |
| QA-5 | RLS — public read | anonymous (psql) | SELECT from `spend_events` without auth | Rows returned; no `user_id` column visible |
| QA-6 | RLS — INSERT blocked | authenticated (psql) | INSERT directly into `spend_events` | Permission denied |

---

## Security Notes

- `spend_events` does not store `user_id` — individual supporters' purchase history is not publicly queryable
- Personal impact queries (Ticket 069) join through `receipt_uploads.user_id` — the join stays server-side under auth control
- Trigger function uses `SECURITY DEFINER` — the definer must be a Supabase service role or superuser to allow writes to the three tables which are otherwise protected by RLS
- `flow_nodes` and `flow_edges` are aggregate tables — no PII stored

---

## Completion Checklist

- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`) — N/A (SQL migration only)
- [ ] Lint: zero errors (`npm run lint`) — N/A
- [ ] All acceptance criteria verified
- [ ] Migration tested on a staging Supabase instance before production
- [ ] Trigger tested with both `listing_id` set and `listing_id = NULL` receipts
- [ ] RLS policies verified with both anon and authenticated roles
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
