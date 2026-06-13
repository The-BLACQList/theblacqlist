-- Track whether the submitter attested to majority Black ownership at submission time.
-- Set to true only when status transitions to 'pending' (Submit for review).
-- Drafts intentionally remain false until the submitter confirms and submits.
ALTER TABLE listings ADD COLUMN IF NOT EXISTS ownership_attested boolean NOT NULL DEFAULT false;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS ownership_attested_at timestamptz;
