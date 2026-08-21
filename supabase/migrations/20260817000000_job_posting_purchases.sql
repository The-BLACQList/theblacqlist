-- Job posting entitlements and purchases — the product's first one-time payment.
--
-- E-2, Model C (decision 2026-08-21, superseding the Model A decision of
-- 2026-08-17): a paid plan includes a job posting allowance, and postings beyond
-- the allowance are bought one at a time. Growth includes 1, Premium includes 3,
-- free and starter include 0. Everyone can buy additional postings.
--
-- Events stay free to post; event promotion is sold separately through the
-- existing `sponsored_placements` table, which already carries `price_cents` and
-- `stripe_payment_intent_id`.
--
-- TWO WRITERS, ONE LIFECYCLE. Every posting — included or purchased — gets the
-- same 30-day window recorded the same way, so `hasPaidJobPosting()` and the
-- nightly expiry sweep need no knowledge of which kind it is:
--   * `source = 'stripe'`      — written by the checkout.session.completed
--                                handler on the service role. Carries a Stripe
--                                session id and a real `amount_cents`.
--   * `source = 'entitlement'` — written by submitListingForReview when the
--                                owner's plan allowance covers the posting.
--                                No Stripe session, `amount_cents = 0`.
-- The paired CHECK below makes the two shapes non-overlapping so a row can never
-- be half of each.
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
-- `entitlement_key` is the same idea for the free path — see its comment.
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

  -- Which writer produced this row. Kept separate from `amount_cents = 0`, which
  -- would be ambiguous with a fully-discounted purchase: revenue reporting reads
  -- `source`, not the amount.
  source                     text NOT NULL DEFAULT 'stripe'
                                  CHECK (source IN ('stripe', 'entitlement')),

  -- The idempotency key at the storage layer for the paid path.
  -- `stripe_events_processed` already makes webhook redelivery a no-op, but that
  -- table is keyed on the *event*; two different events can describe the same
  -- session. This is keyed on the purchase itself.
  -- Nullable because an included posting has no Stripe session. Postgres UNIQUE
  -- permits many NULLs, so entitlement rows coexist here without collision.
  stripe_checkout_session_id text UNIQUE,
  stripe_payment_intent_id   text,

  -- The idempotency key for the free path: '<listing_id>:<YYYY-MM-DD>'. A
  -- double-submit on the same day is ON CONFLICT DO NOTHING, while a genuine
  -- renewal 30 days later gets a different key and is allowed. A partial unique
  -- index on `listing_id` would have blocked renewals; a predicate using now()
  -- is not immutable and cannot be indexed.
  entitlement_key            text UNIQUE,

  -- Never hardcoded anywhere in app code: written from what Stripe reports the
  -- customer was actually charged (`session.amount_total`), so a price change in
  -- the Stripe dashboard cannot desync from what the row claims was paid.
  -- Entitlement rows are always 0, enforced by the CHECK below.
  amount_cents               integer NOT NULL CHECK (amount_cents >= 0),
  currency                   text    NOT NULL DEFAULT 'usd',

  -- Entitlement rows are created already `paid`. That is deliberate: it keeps
  -- hasPaidJobPosting(), the partial index, and the expiry sweep identical for
  -- both writers. `source` is what distinguishes them.
  status                     text    NOT NULL DEFAULT 'pending'
                                     CHECK (status IN ('pending', 'paid', 'refunded')),

  paid_at                    timestamptz,
  -- What was bought (or granted): a posting window. Expiry IS enforced —
  -- `unpublishExpiredJobPostings` in lib/services/expiry/sweeps.ts runs nightly
  -- from the /api/cron/expiry schedule declared in vercel.ts and unpublishes any
  -- job whose every window has lapsed. A job with no row at all is never touched.
  expires_at                 timestamptz,

  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),

  -- The two row shapes, kept non-overlapping. Without this, a bug could write an
  -- 'entitlement' row carrying a session id (double-counting revenue) or a
  -- 'stripe' row with neither key (unreconcilable).
  CONSTRAINT job_posting_purchases_source_shape CHECK (
    (source = 'stripe'
       AND stripe_checkout_session_id IS NOT NULL
       AND entitlement_key IS NULL)
    OR
    (source = 'entitlement'
       AND stripe_checkout_session_id IS NULL
       AND entitlement_key IS NOT NULL
       AND amount_cents = 0)
  )
);

-- The hot read: "has this listing been paid for?", run on every submit-for-review
-- of a job. Partial, because only paid rows can answer yes.
CREATE INDEX IF NOT EXISTS job_posting_purchases_listing_paid_idx
  ON job_posting_purchases (listing_id)
  WHERE status = 'paid';

CREATE INDEX IF NOT EXISTS job_posting_purchases_purchased_by_idx
  ON job_posting_purchases (purchased_by);

-- The quota read: "how many included postings has this owner used?", run on every
-- submit-for-review of a job that isn't already covered. Narrower than the index
-- above because purchased postings never count against an allowance.
CREATE INDEX IF NOT EXISTS job_posting_purchases_entitlement_quota_idx
  ON job_posting_purchases (purchased_by)
  WHERE status = 'paid' AND source = 'entitlement';

ALTER TABLE job_posting_purchases ENABLE ROW LEVEL SECURITY;

-- Buyers see their own receipts. Nobody writes through RLS at all: every write
-- comes from the service role — the Stripe webhook for purchases, and
-- submitListingForReview for entitlements, which has already verified ownership,
-- draft status, and the remaining allowance before it writes. There is
-- deliberately no INSERT/UPDATE policy — a client that could insert a `paid`
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
  'Job posting windows (E-2, Model C). Two writers, both on the service role: the '
  'Stripe checkout.session.completed handler (source=stripe) and '
  'submitListingForReview when a plan allowance covers the posting '
  '(source=entitlement, amount_cents=0). Stripe is the source of truth for the '
  'money; this is the local record of it.';
