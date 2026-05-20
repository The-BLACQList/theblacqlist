-- Add three fields required by the claim submission and admin review flows.
-- These were present in the application code but missing from the initial schema.
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS verification_email text,
  ADD COLUMN IF NOT EXISTS verification_phone text,
  ADD COLUMN IF NOT EXISTS role_at_business   text
    CHECK (role_at_business IN ('owner', 'manager', 'authorized_agent'));
