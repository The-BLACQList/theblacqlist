-- ============================================================================
-- launch_subscribers — coming-soon email capture (pre-launch)
-- ----------------------------------------------------------------------------
-- Append-only list of emails collected from the /coming-soon gate. Writes go
-- through the service-role server action (lib/actions/subscribers/subscribeLaunch.ts),
-- which bypasses RLS. RLS is enabled with NO anon/authenticated policies, so the
-- table is not directly readable or writable by public API clients — reads happen
-- via the service role / SQL editor only.
-- Idempotent: safe to paste directly into the Supabase SQL editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS launch_subscribers (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email       text        NOT NULL UNIQUE,
  source      text        NOT NULL DEFAULT 'coming-soon',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS launch_subscribers_created_at_idx
  ON launch_subscribers (created_at DESC);

ALTER TABLE launch_subscribers ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies by design: the coming-soon form inserts via the
-- service-role client. Direct public reads/writes are blocked.
