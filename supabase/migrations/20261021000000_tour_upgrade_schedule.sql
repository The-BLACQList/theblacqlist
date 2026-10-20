-- Ticket 136: the tester's free month on a page that already pays.
--
-- WHY. A tester who already pays for Starter could not use their free month:
-- the claim route refused with 409 ALREADY_SUBSCRIBED and the card said the
-- month was saved for later. Founder decision 2026-10-20: the free month now
-- lands on the existing subscription as 30 days of the higher tier, with no
-- proration. Starter billing pauses for those 30 days and comes back on day 31.
--
-- HOW. The claim route puts a Stripe subscription schedule on the existing
-- subscription (three phases: the current period up to now, the free month on
-- the higher tier as a trial, then Starter again, released when done). The
-- schedule is the record of the claim, the same way the checkout session is
-- for a tester with no plan. A daily sweep sends one reminder email five days
-- before the free month ends.
--
-- WHAT CHANGES. Three nullable columns on tour_enrollments, and four CHECKs
-- that keep them in a sane order. No RLS change: tour_enrollments is still
-- SELECT-own for testers with no write policies; only the service role writes.
--
--   stripe_subscription_schedule_id  the schedule the claim made (UNIQUE)
--   upgrade_trial_ends_at            when the free month ends (from Stripe)
--   upgrade_reminder_sent_at         when the day-25 reminder was claimed
--
-- DOWN PLAN:
--   No row may lose a live schedule silently. First list them:
--     SELECT id, stripe_subscription_schedule_id FROM tour_enrollments
--      WHERE stripe_subscription_schedule_id IS NOT NULL;
--   Those schedules keep running in Stripe whatever this table says; the
--   webhook keeps listings.tier right from the live price. Then:
--     ALTER TABLE tour_enrollments
--       DROP CONSTRAINT IF EXISTS tour_enrollments_schedule_requires_claim,
--       DROP CONSTRAINT IF EXISTS tour_enrollments_one_claim_record,
--       DROP CONSTRAINT IF EXISTS tour_enrollments_trial_end_requires_schedule,
--       DROP CONSTRAINT IF EXISTS tour_enrollments_reminder_requires_trial_end,
--       DROP COLUMN IF EXISTS upgrade_reminder_sent_at,
--       DROP COLUMN IF EXISTS upgrade_trial_ends_at,
--       DROP COLUMN IF EXISTS stripe_subscription_schedule_id;
--   Then revert the code. A tester whose schedule row is dropped would see the
--   card offer the month again; the claim route would refuse it because the
--   subscription already has a schedule on it.

ALTER TABLE tour_enrollments
  ADD COLUMN IF NOT EXISTS stripe_subscription_schedule_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS upgrade_trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS upgrade_reminder_sent_at timestamptz;

COMMENT ON COLUMN tour_enrollments.stripe_subscription_schedule_id IS
  'Stripe subscription schedule that put the free month on an existing subscription (ticket 136).';
COMMENT ON COLUMN tour_enrollments.upgrade_trial_ends_at IS
  'When the free month on an existing subscription ends, as Stripe reported it.';
COMMENT ON COLUMN tour_enrollments.upgrade_reminder_sent_at IS
  'When the reminder email before the free month ends was claimed. Set once.';

-- Same rule as the checkout session: Stripe is only called after the claim is
-- taken, so a schedule without a claim is an ordering bug made unrepresentable.
ALTER TABLE tour_enrollments DROP CONSTRAINT IF EXISTS tour_enrollments_schedule_requires_claim;
ALTER TABLE tour_enrollments ADD CONSTRAINT tour_enrollments_schedule_requires_claim CHECK (
  stripe_subscription_schedule_id IS NULL OR trial_granted_at IS NOT NULL
);

-- A claim is spent one way or the other: a new checkout or an upgrade, never both.
ALTER TABLE tour_enrollments DROP CONSTRAINT IF EXISTS tour_enrollments_one_claim_record;
ALTER TABLE tour_enrollments ADD CONSTRAINT tour_enrollments_one_claim_record CHECK (
  stripe_subscription_schedule_id IS NULL OR stripe_checkout_session_id IS NULL
);

ALTER TABLE tour_enrollments DROP CONSTRAINT IF EXISTS tour_enrollments_trial_end_requires_schedule;
ALTER TABLE tour_enrollments ADD CONSTRAINT tour_enrollments_trial_end_requires_schedule CHECK (
  upgrade_trial_ends_at IS NULL OR stripe_subscription_schedule_id IS NOT NULL
);

ALTER TABLE tour_enrollments DROP CONSTRAINT IF EXISTS tour_enrollments_reminder_requires_trial_end;
ALTER TABLE tour_enrollments ADD CONSTRAINT tour_enrollments_reminder_requires_trial_end CHECK (
  upgrade_reminder_sent_at IS NULL OR upgrade_trial_ends_at IS NOT NULL
);

-- The reminder sweep reads only rows still waiting for their reminder.
CREATE INDEX IF NOT EXISTS tour_enrollments_upgrade_reminder_due_idx
  ON tour_enrollments (upgrade_trial_ends_at)
  WHERE upgrade_trial_ends_at IS NOT NULL AND upgrade_reminder_sent_at IS NULL;
