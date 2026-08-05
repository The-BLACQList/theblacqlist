-- =============================================================================
-- Migration: Stripe webhook hardening
-- =============================================================================
-- Adds the infrastructure ticket 078 requires for reliable, idempotent
-- subscription-lifecycle processing:
--
--   1. stripe_events_processed — one row per successfully-handled Stripe event,
--      keyed by the Stripe event id. The webhook checks this table before doing
--      any work so a redelivered/duplicate event is a no-op.
--   2. failed_webhooks — records events whose handler threw, so the webhook can
--      return 500 (Stripe retries) while leaving an on-call trail. A partial
--      index supports the "unresolved > 2h" alert.
--   3. subscriptions.canceled_at — when a subscription is canceled, so the
--      cancellation time is queryable (ticket 078).
--
-- All changes are additive and reversible. Service-role only (RLS enabled, no
-- policies = default deny for anon/authenticated).
--
-- Down / rollback (run manually if needed):
--   DROP TABLE IF EXISTS stripe_events_processed;
--   DROP TABLE IF EXISTS failed_webhooks;
--   ALTER TABLE subscriptions DROP COLUMN IF EXISTS canceled_at;
-- =============================================================================

CREATE TABLE IF NOT EXISTS stripe_events_processed (
  id              uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_event_id text        NOT NULL UNIQUE,
  event_type      text        NOT NULL,
  processed_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stripe_events_processed ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS failed_webhooks (
  id              uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_event_id text,
  event_type      text        NOT NULL,
  payload_json    jsonb,
  error_message   text        NOT NULL,
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS failed_webhooks_unresolved_idx
  ON failed_webhooks (created_at)
  WHERE resolved_at IS NULL;

ALTER TABLE failed_webhooks ENABLE ROW LEVEL SECURITY;

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS canceled_at timestamptz;
