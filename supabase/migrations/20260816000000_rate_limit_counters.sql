-- ============================================================================
-- rate_limit_counters — durable ledger for the API route limiters
-- ----------------------------------------------------------------------------
-- app/api/search/route.ts and app/api/analytics/event/route.ts each keep their
-- own in-memory `Map` of hits. On Vercel Fluid Compute an instance is reused
-- across concurrent requests but is still replaced, and concurrent instances do
-- not share memory — so neither Map actually bounds anything under real traffic.
-- 20260811000000_launch_subscribe_rate_limit.sql already called this out as a
-- known gap; this migration is the fix for it.
--
-- WHY A COUNTER TABLE AND NOT ROW-PER-ATTEMPT
-- launch_subscribe_attempts writes one row per attempt and counts them, which is
-- right for a form that a human submits a handful of times. Search allows 60
-- requests per IP per minute, so row-per-attempt would mean up to 60 inserts +
-- one COUNT round trip per IP per minute. This table instead holds ONE row per
-- (bucket, key, window) and increments it, so a sustained flood from a single
-- client costs one row per minute rather than one row per request.
--
-- WHY A FUNCTION AND NOT A CLIENT-SIDE READ-MODIFY-WRITE
-- check_rate_limit() does the whole thing in a single INSERT .. ON CONFLICT DO
-- UPDATE .. RETURNING statement. That is atomic under concurrency: two requests
-- arriving at the same instant cannot both read "59" and both decide they are
-- allowed. A read-then-write limiter would undercount exactly when it matters
-- most — under a burst.
--
-- PRIVACY: no raw IP is ever stored. Callers pass sha256(salt + identifier) and
-- this table only ever sees that digest. See .claude/rules/data-privacy.md.
--
-- ACCESS: RLS is enabled with NO policies, and EXECUTE on the function is
-- revoked from PUBLIC/anon/authenticated and granted only to service_role. The
-- ledger is reachable exclusively through the service-role client, exactly as
-- with launch_subscribe_attempts. This is deliberate, not an omission.
--
-- Idempotent: safe to paste directly into the Supabase SQL editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS rate_limit_counters (
  bucket        text        NOT NULL,
  key_hash      text        NOT NULL,
  window_start  timestamptz NOT NULL,
  hits          integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, key_hash, window_start)
);

-- The primary key IS the access path: every call looks up exactly one
-- (bucket, key_hash, window_start) triple. No secondary index is needed, and
-- adding one would only slow the write that happens on every request.

ALTER TABLE rate_limit_counters ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies by design. Same posture as
-- launch_subscribe_attempts: the service-role client bypasses RLS, and nothing
-- else may reach this table by any path.

COMMENT ON TABLE rate_limit_counters IS
  'Durable hit counters for API route rate limits. key_hash is sha256(salt + identifier) — never a raw IP or bare user id.';

-- ─── The limiter ────────────────────────────────────────────────────────────
-- Returns TRUE when the request is allowed, FALSE when it is over the limit.
-- The caller is charged for the request either way — being throttled still
-- increments, so a client that keeps hammering stays throttled for the rest of
-- the window instead of being let back in.
--
-- Fixed windows, not sliding: a window is [floor(now/W)*W, +W). This matches the
-- semantics of the in-memory limiters being replaced. The known trade-off is
-- that a client can send `limit` requests at the end of one window and `limit`
-- more at the start of the next. For abuse control at these ceilings that is
-- acceptable; a sliding window would cost a range scan on every request.
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_bucket         text,
  p_key_hash       text,
  p_limit          integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz;
  v_hits         integer;
BEGIN
  IF p_window_seconds IS NULL OR p_window_seconds <= 0 THEN
    RAISE EXCEPTION 'p_window_seconds must be a positive integer, got %', p_window_seconds;
  END IF;

  IF p_limit IS NULL OR p_limit < 0 THEN
    RAISE EXCEPTION 'p_limit must be zero or greater, got %', p_limit;
  END IF;

  v_window_start := to_timestamp(
    floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds
  );

  -- One statement. Atomic under concurrency — the ON CONFLICT path takes a row
  -- lock, so simultaneous callers serialize on this key and each sees a distinct
  -- incremented value.
  INSERT INTO rate_limit_counters (bucket, key_hash, window_start, hits)
  VALUES (p_bucket, p_key_hash, v_window_start, 1)
  ON CONFLICT (bucket, key_hash, window_start)
  DO UPDATE SET hits = rate_limit_counters.hits + 1
  RETURNING hits INTO v_hits;

  -- <= so that exactly p_limit requests succeed per window, matching the
  -- `if (entry.count >= limit) return false` semantics of the Maps replaced here.
  RETURN v_hits <= p_limit;
END;
$$;

COMMENT ON FUNCTION check_rate_limit(text, text, integer, integer) IS
  'Atomically charges one hit against (bucket, key_hash) in the current fixed window. Returns true if allowed.';

-- SECURITY DEFINER functions are executable by PUBLIC by default. Without this
-- revoke, any anonymous client could call the limiter directly with arbitrary
-- arguments and inflate counters. Only the service role may charge hits.
REVOKE ALL ON FUNCTION check_rate_limit(text, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION check_rate_limit(text, text, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION check_rate_limit(text, text, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION check_rate_limit(text, text, integer, integer) TO service_role;

-- ─── Cleanup ────────────────────────────────────────────────────────────────
-- A row is only meaningful inside its own window (60 seconds today). Keeping an
-- hour gives generous slack for clock skew and for raising a window length later
-- without letting the table grow forever.
CREATE OR REPLACE FUNCTION prune_rate_limit_counters()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM rate_limit_counters
  WHERE window_start < now() - interval '1 hour';
END;
$$;

REVOKE ALL ON FUNCTION prune_rate_limit_counters() FROM PUBLIC;
REVOKE ALL ON FUNCTION prune_rate_limit_counters() FROM anon;
REVOKE ALL ON FUNCTION prune_rate_limit_counters() FROM authenticated;

-- Every 15 minutes. This table churns far faster than launch_subscribe_attempts
-- (one row per key per minute, across every search and analytics caller), so it
-- is pruned more often than that table's hourly schedule.
--
-- No-ops cleanly if pg_cron is not enabled (local dev); enable via Supabase
-- Dashboard → Database → Extensions → pg_cron for production. Same idempotent
-- pattern as 20260811000000_launch_subscribe_rate_limit.sql.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'prune-rate-limit-counters',
      '*/15 * * * *',
      'SELECT prune_rate_limit_counters()'
    );
  ELSE
    RAISE NOTICE 'pg_cron not enabled — skipping prune-rate-limit-counters schedule. Enable via Supabase Dashboard > Database > Extensions.';
  END IF;
END $$;

-- ============================================================================
-- DOWN / ROLLBACK
-- ----------------------------------------------------------------------------
-- Safe to run at any time. The limiter in lib/security/rate-limit.ts FAILS OPEN,
-- so dropping these objects degrades the routes back to unlimited — the same
-- state they are in today with the in-memory Maps — rather than taking them
-- down. Nothing else in the app reads this table.
--
--   DO $$
--   BEGIN
--     IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
--       PERFORM cron.unschedule('prune-rate-limit-counters');
--     END IF;
--   END $$;
--
--   DROP FUNCTION IF EXISTS prune_rate_limit_counters();
--   DROP FUNCTION IF EXISTS check_rate_limit(text, text, integer, integer);
--   DROP TABLE IF EXISTS rate_limit_counters;
-- ============================================================================
