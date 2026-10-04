-- ============================================================================
-- launch_subscribers: attribution and optional signup role (pre-launch R2, R3)
-- ----------------------------------------------------------------------------
-- NOT APPLIED. Applying this is a GATE-DATA decision for the founder. The code
-- that writes these columns (lib/actions/subscribers/subscribeLaunch.ts) works
-- with or without them: it sends only non-null values, and if PostgREST rejects
-- an unknown column it retries the insert as { email, source }. Merging the
-- code first is safe; applying this migration is what turns attribution on.
--
-- Adds six nullable columns. Every existing row keeps NULL in all of them.
--
--   utm_source, utm_medium, utm_campaign, utm_content
--       From the landing URL, kept through the / -> /coming-soon redirect
--       (proxy.ts). The action stores a value only if it is 1 to 100 plain
--       characters (lib/marketing/launch-attribution.ts); the CHECKs below
--       hold the same length limit at the database.
--   referrer
--       The referring page's ORIGIN only (https://l.instagram.com), never a
--       full URL, which can carry a search query or a token. Max 255.
--   signup_role
--       The optional "Which describes you?" answer: 'owner' or 'supporter'.
--       NULL means the person did not answer. The CHECK must match
--       SIGNUP_ROLES in lib/marketing/launch-attribution.ts (a test compares them).
--
-- PRIVACY. None of these identifies a person. RLS on this table is unchanged:
-- enabled, no anon/authenticated policies, service role only.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, and each CHECK is dropped if present
-- before it is added. Safe to paste into the Supabase SQL editor more than once.
--
-- ROLLBACK (its own GATE-DATA decision; it deletes the attribution data):
--   ALTER TABLE launch_subscribers
--     DROP COLUMN IF EXISTS utm_source,
--     DROP COLUMN IF EXISTS utm_medium,
--     DROP COLUMN IF EXISTS utm_campaign,
--     DROP COLUMN IF EXISTS utm_content,
--     DROP COLUMN IF EXISTS referrer,
--     DROP COLUMN IF EXISTS signup_role;
--   The code keeps working after a rollback (it falls back to email + source).
-- ============================================================================

ALTER TABLE launch_subscribers
  ADD COLUMN IF NOT EXISTS utm_source   text,
  ADD COLUMN IF NOT EXISTS utm_medium   text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content  text,
  ADD COLUMN IF NOT EXISTS referrer     text,
  ADD COLUMN IF NOT EXISTS signup_role  text;

ALTER TABLE launch_subscribers DROP CONSTRAINT IF EXISTS launch_subscribers_signup_role_check;
ALTER TABLE launch_subscribers ADD CONSTRAINT launch_subscribers_signup_role_check CHECK (
  signup_role IS NULL OR signup_role IN ('owner', 'supporter')
);

ALTER TABLE launch_subscribers DROP CONSTRAINT IF EXISTS launch_subscribers_utm_length_check;
ALTER TABLE launch_subscribers ADD CONSTRAINT launch_subscribers_utm_length_check CHECK (
      (utm_source   IS NULL OR char_length(utm_source)   BETWEEN 1 AND 100)
  AND (utm_medium   IS NULL OR char_length(utm_medium)   BETWEEN 1 AND 100)
  AND (utm_campaign IS NULL OR char_length(utm_campaign) BETWEEN 1 AND 100)
  AND (utm_content  IS NULL OR char_length(utm_content)  BETWEEN 1 AND 100)
);

ALTER TABLE launch_subscribers DROP CONSTRAINT IF EXISTS launch_subscribers_referrer_length_check;
ALTER TABLE launch_subscribers ADD CONSTRAINT launch_subscribers_referrer_length_check CHECK (
  referrer IS NULL OR char_length(referrer) BETWEEN 1 AND 255
);

COMMENT ON COLUMN launch_subscribers.referrer IS
  'Referring page origin only (scheme + host), never a full URL.';
COMMENT ON COLUMN launch_subscribers.signup_role IS
  'Optional self-declared role on the launch-list form: owner | supporter. NULL = not answered.';

-- PostgREST caches the schema. Supabase reloads it on DDL, but say so
-- explicitly so the new columns are writable straight away.
NOTIFY pgrst, 'reload schema';
