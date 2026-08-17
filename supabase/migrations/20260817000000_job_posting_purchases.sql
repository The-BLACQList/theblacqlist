-- Paid job postings — the product's first one-time payment.
--
-- E-2, Model A (decision 2026-08-17): a job posting is bought once, per posting.
-- Events stay free to post; event promotion is sold separately through the
-- existing `sponsored_placements` table, which already carries `price_cents` and
-- `stripe_payment_intent_id`.
--
-- WHY A TABLE AND NOT A COLUMN ON `listing_details_job`:
-- This is money. A boolean `is_paid` answers "can it publish" and nothing else —
-- it cannot answer "how much, when, by whom, under which Stripe session, and was
-- it refunded", which is exactly what a support request about a payment asks.
-- The row is the local record of the transaction; Stripe remains the source of
-- truth for the money itself.
--
-- ONE PURCHASE PER LISTING, deliberately not enforced as a unique constraint on
-- `listing_id`: a renewal is a second purchase of the same listing. The unique
-- constraint that matters is on the Stripe session id, which is what makes
-- webhook redelivery a no-op at the database level as well as in the handler.
--
-- DOWN PLAN:
--   DROP TABLE IF EXISTS job_posting_purchases;   -- cascades its policies + indexes
--   -- Nothing else is touched. No existing column is altered, no data migrated.
--   -- Code side: set FEATURE_PAID_POSTINGS=off, which restores free job posting
--   -- without a redeploy of different code.

CREATE TABLE IF NOT EXISTS job_posting_purchases (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  listing_id                 uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  -- SET NULL, not CASCADE: if the buyer deletes their account the money record
  -- must survive for reconciliation. It carries no PII — only a user id.
  purchased_by               uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- The idempotency key at the storage layer. `stripe_events_processed` already
  -- makes webhook redelivery a no-op, but that table is keyed on the *event*;
  -- two different events can describe the same session. This is keyed on the
  -- purchase itself.
  stripe_checkout_session_id text NOT NULL UNIQUE,
  stripe_payment_intent_id   text,

  -- Never hardcoded anywhere in app code: written from what Stripe reports the
  -- customer was actually charged (`session.amount_total`), so a price change in
  -- the Stripe dashboard cannot desync from what the row claims was paid.
  amount_cents               integer NOT NULL CHECK (amount_cents >= 0),
  currency                   text    NOT NULL DEFAULT 'usd',

  status                     text    NOT NULL DEFAULT 'pending'
                                     CHECK (status IN ('pending', 'paid', 'refunded')),

  paid_at                    timestamptz,
  -- What was bought: a posting window. Expiry is RECORDED here and is NOT
  -- automatically enforced — nothing unpublishes a listing when this passes.
  -- See the tracked debt note in the E-2 runbook before assuming it does.
  expires_at                 timestamptz,

  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

-- The hot read: "has this listing been paid for?", run on every submit-for-review
-- of a job. Partial, because only paid rows can answer yes.
CREATE INDEX IF NOT EXISTS job_posting_purchases_listing_paid_idx
  ON job_posting_purchases (listing_id)
  WHERE status = 'paid';

CREATE INDEX IF NOT EXISTS job_posting_purchases_purchased_by_idx
  ON job_posting_purchases (purchased_by);

ALTER TABLE job_posting_purchases ENABLE ROW LEVEL SECURITY;

-- Buyers see their own receipts. Nobody writes through RLS at all: every write
-- comes from the Stripe webhook on the service role, which bypasses RLS. There
-- is deliberately no INSERT/UPDATE policy — a client that could insert a `paid`
-- row could publish a job without paying for it.
CREATE POLICY "Owners read their own job posting purchases"
  ON job_posting_purchases FOR SELECT
  USING (purchased_by = auth.uid());

CREATE POLICY "Admins read all job posting purchases"
  ON job_posting_purchases FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin')
    )
  );

COMMENT ON TABLE job_posting_purchases IS
  'One-time payments for job postings (E-2, Model A). Written only by the Stripe '
  'checkout.session.completed handler on the service role. Stripe is the source '
  'of truth for the money; this is the local record of it.';
