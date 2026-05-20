-- AI Foundation — The BLACQList
-- Brings forward V2 AI tables ahead of schedule.
-- Additive only: no existing tables modified, no destructive operations.
-- No provider connected yet; tables are empty until V2 Mock phase.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ai_suggestions
--    Stores all AI-generated content awaiting human approval.
--    status lifecycle: pending → approved → applied | rejected | expired
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_suggestions (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id      uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  suggestion_type text NOT NULL CHECK (suggestion_type IN (
    'page_optimization',
    'seo_title',
    'seo_description',
    'listing_description',
    'social_caption',
    'cta_copy',
    'review_response',
    'analytics_summary',
    'product_description',
    'collection_suggestion'
  )),
  agent_type      text NOT NULL,
  prompt_version  text,
  suggestion_text text NOT NULL,
  metadata        jsonb DEFAULT '{}'::jsonb NOT NULL,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'applied', 'expired')),
  reviewed_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at     timestamptz,
  applied_at      timestamptz,
  created_at      timestamptz DEFAULT now() NOT NULL,
  updated_at      timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS ai_suggestions_listing_id_idx ON ai_suggestions (listing_id);
CREATE INDEX IF NOT EXISTS ai_suggestions_status_idx     ON ai_suggestions (status);
CREATE INDEX IF NOT EXISTS ai_suggestions_type_idx       ON ai_suggestions (suggestion_type);
CREATE INDEX IF NOT EXISTS ai_suggestions_pending_idx    ON ai_suggestions (listing_id, created_at DESC)
  WHERE status = 'pending';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ai_generation_requests
--    Audit log for all AI generation attempts (mock or real).
--    Full prompt text is NEVER stored here — PII risk.
--    Token counts are logged for cost monitoring.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_generation_requests (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id      uuid REFERENCES listings(id) ON DELETE SET NULL,
  agent_type      text NOT NULL,
  prompt_version  text,
  model           text,
  provider        text NOT NULL DEFAULT 'mock'
                    CHECK (provider IN ('anthropic', 'openai', 'mock')),
  request_tokens  integer,
  response_tokens integer,
  status          text NOT NULL DEFAULT 'completed'
                    CHECK (status IN ('pending', 'completed', 'failed')),
  error_message   text,
  suggestion_id   uuid REFERENCES ai_suggestions(id) ON DELETE SET NULL,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS ai_generation_requests_listing_idx  ON ai_generation_requests (listing_id);
CREATE INDEX IF NOT EXISTS ai_generation_requests_status_idx   ON ai_generation_requests (status);
CREATE INDEX IF NOT EXISTS ai_generation_requests_created_idx  ON ai_generation_requests (created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. updated_at trigger for ai_suggestions
--    set_updated_at() already defined in migration 20260511000003.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TRIGGER ai_suggestions_updated_at
  BEFORE UPDATE ON ai_suggestions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE ai_suggestions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generation_requests ENABLE ROW LEVEL SECURITY;

-- Owners can read pending, approved, and applied suggestions for their own listings.
-- Rejected and expired suggestions are not surfaced to owners.
CREATE POLICY "Owner reads own listing suggestions" ON ai_suggestions
  FOR SELECT
  USING (
    listing_id IN (
      SELECT id FROM listings
      WHERE owner_user_id = auth.uid()
        AND deleted_at IS NULL
    )
    AND status IN ('pending', 'approved', 'applied')
  );

-- ai_generation_requests: no public-facing policies.
-- Admin access is via service role client only (bypasses RLS).
