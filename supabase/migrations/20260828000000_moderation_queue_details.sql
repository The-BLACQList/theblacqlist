-- Give moderation_queue somewhere to put what the reporter actually wrote.
--
-- THE BUG THIS FIXES. `submitCorrectionAction` (lib/actions/corrections/
-- submitCorrection.ts) validates the selected issue types and up to 500
-- characters of notes, then inserts a queue row carrying only entity_id,
-- entity_type, queue_type, status and priority. There is no column on this
-- table that could hold either one, so both are discarded. The in-file comment
-- claiming they are "stored as a JSON priority note in the queue" describes
-- something the code has never done — `priority` is an integer.
--
-- The user is told "Suggest a correction", types what is wrong, and the text is
-- thrown away. An admin then sees "listing X has a correction pending" with
-- zero information about what to fix, and no record of who reported it. That is
-- a correction path that cannot be acted on, and it is shipping to the public.
--
-- WHY jsonb AND NOT TWO TYPED COLUMNS. `queue_type` is already polymorphic
-- across five kinds of item (claim / correction / review / flagged_listing /
-- verification) and each kind carries a different payload. A `notes text` +
-- `issue_types text[]` pair would be correction-shaped columns sitting NULL on
-- every other row type. One `details jsonb` holds each kind's own shape without
-- the table growing a column per queue_type. Nothing filters or sorts on the
-- contents — the admin page reads them for display only — so the usual
-- "don't put queryable data in jsonb" objection does not apply here.
--
-- WHY submitted_by IS NULLABLE. Corrections are accepted from signed-out
-- visitors; that is deliberate and stays. NULL means "reported anonymously",
-- which is a real and expected value, not missing data. SET NULL on user
-- deletion for the same reason job_posting_purchases.purchased_by does it: the
-- queue item survives the account, and it carries no PII — only a user id.
--
-- ADDITIVE ONLY. Both columns are new and nullable, no existing column is
-- altered, no data is migrated, and no code reads them until the PR that
-- follows this migration. Applying this against production changes nothing
-- observable on its own.
--
-- DOWN PLAN:
--   ALTER TABLE moderation_queue
--     DROP COLUMN IF EXISTS details,
--     DROP COLUMN IF EXISTS submitted_by;
--   -- Safe at any point before the follow-on code PR ships. After that PR,
--   -- dropping these reverts to discarding correction text again — revert the
--   -- code first, then the columns.

ALTER TABLE moderation_queue
  ADD COLUMN IF NOT EXISTS details      jsonb,
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- "Show me everything this person has reported" — the read behind judging
-- whether a stream of corrections is a helpful regular or a single griefer.
-- Partial, because anonymous rows can never answer it.
CREATE INDEX IF NOT EXISTS moderation_queue_submitted_by_idx
  ON moderation_queue (submitted_by)
  WHERE submitted_by IS NOT NULL;

COMMENT ON COLUMN moderation_queue.details IS
  'Queue-type-specific payload for admin display only — never filtered or sorted on. '
  'For queue_type=''correction'': { issue_types: text[], notes: text|null }.';

COMMENT ON COLUMN moderation_queue.submitted_by IS
  'Who reported the item. NULL means reported anonymously, which is a supported '
  'case — corrections are accepted from signed-out visitors.';
