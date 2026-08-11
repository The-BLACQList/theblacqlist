-- ============================================================================
-- launch_subscribe_attempts — durable throttle for the /coming-soon capture
-- ----------------------------------------------------------------------------
-- lib/actions/subscribers/subscribeLaunch.ts is an UNAUTHENTICATED server action
-- that inserts with the service-role client. Before this table it had no throttle
-- at all, so anyone could drive unbounded writes into launch_subscribers.
--
-- The two limiters already in the repo (app/api/search/route.ts,
-- app/api/analytics/event/route.ts) are in-memory Maps. On Vercel those reset on
-- every cold start and are not shared between concurrent function instances, so
-- they do not actually bound anything. This one is durable because it lives in
-- Postgres.
--
-- PRIVACY: no raw IP is ever stored. The action writes sha256(salt + ip) and this
-- table only ever sees that digest. See .claude/rules/data-privacy.md.
--
-- Writes go through the service role, which bypasses RLS. RLS is enabled with NO
-- policies, so anon/authenticated clients cannot read or write it at all.
-- Idempotent: safe to paste directly into the Supabase SQL editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS launch_subscribe_attempts (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_hash       text        NOT NULL,
  attempted_at  timestamptz NOT NULL DEFAULT now()
);

-- The only query this table serves: count one hash's attempts inside a window.
CREATE INDEX IF NOT EXISTS launch_subscribe_attempts_hash_time_idx
  ON launch_subscribe_attempts (ip_hash, attempted_at DESC);

ALTER TABLE launch_subscribe_attempts ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies by design, exactly as with launch_subscribers:
-- the server action writes via the service-role client. Direct public access is
-- blocked. This is deliberate, not an omission.

COMMENT ON TABLE launch_subscribe_attempts IS
  'Rate-limit ledger for the coming-soon email capture. ip_hash is sha256(salt + ip) — never a raw IP.';

-- ─── Cleanup ────────────────────────────────────────────────────────────────
-- Rows are only meaningful inside the rate-limit window (10 minutes). Keeping an
-- hour gives generous slack for clock skew and window-length changes without
-- letting the table grow forever.
CREATE OR REPLACE FUNCTION prune_launch_subscribe_attempts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM launch_subscribe_attempts
  WHERE attempted_at < now() - interval '1 hour';
END;
$$;

-- Hourly prune. No-ops cleanly if pg_cron is not enabled (local dev); enable via
-- Supabase Dashboard → Database → Extensions → pg_cron for production. Same
-- idempotent pattern as 20260515000001_analytics_cron_schedule.sql.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'prune-launch-subscribe-attempts',
      '7 * * * *',
      'SELECT prune_launch_subscribe_attempts()'
    );
  ELSE
    RAISE NOTICE 'pg_cron not enabled — skipping prune-launch-subscribe-attempts schedule. Enable via Supabase Dashboard > Database > Extensions.';
  END IF;
END $$;
