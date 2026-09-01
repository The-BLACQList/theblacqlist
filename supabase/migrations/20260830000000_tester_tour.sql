-- Tester Tour — invited testers walk the real product, and finishing mints a
-- 30-day Stripe-native Starter trial on a listing they already own.
--
-- WHY THIS EXISTS. Going public without a finished board means the first honest
-- read of the product comes from people using it, not from the board. The tour
-- is that read: a short guided walk (search, open someone else's listing, save
-- it, browse a collection, leave a review or correction, reflect) whose reward
-- is a real trial rather than a thank-you page.
--
-- WHY TWO TABLES AND NOT A JSONB PROGRESS BLOB ON `auth.users`:
-- Progress is append-only evidence, and evidence needs row identity — when a
-- step was satisfied, and what the tester wrote about it. A blob cannot carry a
-- UNIQUE constraint per step, cannot be partially indexed, and turns "did this
-- tester actually search?" into a JSON path expression in every read.
--
-- ══ THE SECURITY BOUNDARY IS THE ABSENCE OF WRITE POLICIES ══
-- Both tables get SELECT-only RLS and deliberately **no INSERT or UPDATE
-- policy at all**. This is not an oversight to be tidied up later:
--   * a tester who could UPDATE `tour_enrollments` would set their own
--     `completed_at` and `trial_granted_at` and mint themselves a free Starter
--     subscription without walking anything;
--   * a tester who could INSERT into `tour_step_completions` would forge the
--     six evidence rows directly.
-- Every write comes from the service role: witness rows are written inside real
-- page renders (lib/tour/witness.ts), reflections through a server action, and
-- the trial claim through the checkout route. If a future migration adds a write
-- policy here, it is reintroducing a free-subscription vulnerability.
--
-- WHY EVIDENCE IS NOT READ FROM `analytics_events`:
-- That table is client-writable by design (20260808000000_analytics_events_self_read.sql),
-- so a tester could POST six events and "finish" the tour in a console. The tour
-- reads only these two tables plus first-party `saves` / `reviews` /
-- `moderation_queue` rows. Nothing here references analytics_events, and the
-- test suite enforces that with a double whose analytics_events reads throw.
--
-- WHY `trial_granted_at` IS THE CLAIM TOKEN:
-- The claim is a compare-and-set — UPDATE ... WHERE id = $1 AND trial_granted_at
-- IS NULL, with a RETURNING that makes a zero-row update observable — performed
-- BEFORE Stripe is called. Two concurrent claims therefore produce one winner and
-- one 409 rather than two subscriptions. The partial unique indexes below are the
-- database backstop for the same property, so a bug in the application path
-- cannot produce a second trial even if the compare-and-set is bypassed.
--
-- DOWN PLAN:
--   DROP TABLE IF EXISTS tour_step_completions;   -- cascades its policies + indexes
--   DROP TABLE IF EXISTS tour_enrollments;        -- drop children first (FK)
--   -- Nothing else is touched. No existing table is altered, no data migrated,
--   -- no column added to listings or auth.users.
--   -- Code side: FEATURE_TESTER_TOUR unset (lib/env.ts defaults it off in
--   -- production), which removes the rail and the claim route without a
--   -- redeploy of different code.
--   -- Stripe side: any trial already granted is a real subscription and is NOT
--   -- undone by this. Cancel those in the Stripe dashboard deliberately.

-- ============================================================================
-- tour_enrollments — one row per invitation
-- ============================================================================
CREATE TABLE IF NOT EXISTS tour_enrollments (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- CASCADE, unlike job_posting_purchases.purchased_by: an enrollment is not a
  -- money record. If the tester deletes their account there is nothing here
  -- worth reconciling, and a dangling enrollment would keep its slot in the
  -- "one live enrollment per tester" index forever.
  tester_user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- The listing the trial will land on. Bound at invitation time, and the admin
  -- action verifies the tester already owns it — a trial is worth nothing on a
  -- listing they cannot edit. Not re-checked here: ownership lives in
  -- `listings.owner_user_id` and can legitimately change after enrollment.
  listing_id                 uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,

  -- SET NULL: who invited them is audit colour, not a dependency.
  invited_by                 uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  started_at                 timestamptz NOT NULL DEFAULT now(),

  -- Set by the completion check when every gated step has evidence. Separate
  -- from `trial_granted_at` because finishing the tour and claiming the reward
  -- are two events, and a tester may finish and never claim.
  completed_at               timestamptz,

  -- Admin-set. An ended enrollment frees the tester's slot in the live-enrollment
  -- index so they can be re-invited; it does not delete their evidence.
  ended_at                   timestamptz,

  -- The claim token. NULL means unclaimed and claimable; non-NULL means spent.
  -- Written by the compare-and-set described in the header, never by a client.
  trial_granted_at           timestamptz,

  -- Recorded after Stripe returns. UNIQUE so a webhook redelivery or a retry
  -- that reuses the session cannot attach it to a second enrollment.
  stripe_checkout_session_id text UNIQUE,

  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),

  -- A trial cannot exist without a finished tour. The application checks this
  -- too; the CHECK is what makes it true even if the check is refactored away.
  CONSTRAINT tour_enrollments_trial_requires_completion CHECK (
    trial_granted_at IS NULL OR completed_at IS NOT NULL
  ),

  -- A session id without a claim would mean Stripe was called before the claim
  -- was taken — the exact ordering bug the claim-before-Stripe rule exists to
  -- prevent. Make that state unrepresentable rather than merely unlikely.
  CONSTRAINT tour_enrollments_session_requires_claim CHECK (
    stripe_checkout_session_id IS NULL OR trial_granted_at IS NOT NULL
  )
);

-- One live enrollment per tester. Partial on `ended_at IS NULL` so ending an
-- enrollment is what re-opens the slot — an admin decision, not a side effect of
-- the tester finishing.
CREATE UNIQUE INDEX IF NOT EXISTS tour_enrollments_one_live_per_tester_idx
  ON tour_enrollments (tester_user_id)
  WHERE ended_at IS NULL;

-- One trial per tester, ever — across ended enrollments too, which is why this
-- is a separate index and not a clause on the one above. Re-inviting a tester
-- for a second walk is fine; minting them a second free Starter is not.
CREATE UNIQUE INDEX IF NOT EXISTS tour_enrollments_one_trial_per_tester_idx
  ON tour_enrollments (tester_user_id)
  WHERE trial_granted_at IS NOT NULL;

-- One trial per listing, ever. Without this, two co-owners of the same business
-- could each be enrolled and each mint a trial onto it — two subscriptions on
-- one listing, which the entitlement reads are not written to expect.
CREATE UNIQUE INDEX IF NOT EXISTS tour_enrollments_one_trial_per_listing_idx
  ON tour_enrollments (listing_id)
  WHERE trial_granted_at IS NOT NULL;

ALTER TABLE tour_enrollments ENABLE ROW LEVEL SECURITY;

-- SELECT only. See the header: the absence of INSERT/UPDATE policies is the
-- control that stops a tester minting their own trial.
CREATE POLICY "Testers read their own enrollment"
  ON tour_enrollments FOR SELECT
  USING (tester_user_id = auth.uid());

CREATE POLICY "Admins read all enrollments"
  ON tour_enrollments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin')
    )
  );

COMMENT ON TABLE tour_enrollments IS
  'Tester Tour invitations. One row per invited tester, bound to a listing they '
  'already own. `trial_granted_at` is the compare-and-set claim token for the '
  '30-day Starter trial and is written only by the service role — RLS here is '
  'SELECT-only on purpose, because a tester who could UPDATE this row could mint '
  'themselves a free subscription.';

-- ============================================================================
-- tour_step_completions — one row per (enrollment, step)
-- ============================================================================
-- Written twice, by two different paths, in this order:
--   1. a service-role witness inside a real page render inserts the row with a
--      NULL reflection — this is the part a tester cannot forge, because it is
--      produced by the server actually rendering the page they visited;
--   2. the reflection server action UPDATEs that row with the tester's text.
-- Steps that are not reflection-gated (`listing_opened`, `collection_browsed`)
-- only ever get step 1 and stay at reflection IS NULL. That is a complete row,
-- not a half-written one.
CREATE TABLE IF NOT EXISTS tour_step_completions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  enrollment_id uuid NOT NULL REFERENCES tour_enrollments(id) ON DELETE CASCADE,

  -- Kept in lockstep with TOUR_STEPS in lib/tour/steps.ts. A test asserts this
  -- list and that constant match, because a step added on one side only would
  -- either be silently unrecordable (added in TS) or permanently unreachable
  -- (added here) — both fail quietly rather than loudly.
  step_key      text NOT NULL CHECK (step_key IN (
                  'search_ran',
                  'listing_opened',
                  'listing_saved',
                  'collection_browsed',
                  'review_or_correction',
                  'final_reflection'
                )),

  -- NULL for the two un-gated progress steps, and NULL for a gated step between
  -- the witness insert and the tester writing anything.
  reflection    text,
  reflected_at  timestamptz,

  completed_at  timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- The witness is fire-and-forget inside a page render, so the same step is
  -- re-witnessed on every visit. This is what makes those writes ON CONFLICT
  -- DO NOTHING rather than a growing pile of duplicate evidence.
  CONSTRAINT tour_step_completions_one_per_step UNIQUE (enrollment_id, step_key),

  -- The 20-character floor the rail advertises, enforced where it cannot be
  -- bypassed by calling the action with a different payload. Trimmed, so twenty
  -- spaces is not a reflection.
  CONSTRAINT tour_step_completions_reflection_substantive CHECK (
    reflection IS NULL OR char_length(btrim(reflection)) >= 20
  ),

  -- The two reflection columns move together or the "when did they write this"
  -- answer is unreliable.
  CONSTRAINT tour_step_completions_reflected_at_pairs CHECK (
    (reflection IS NULL AND reflected_at IS NULL)
    OR (reflection IS NOT NULL AND reflected_at IS NOT NULL)
  )
);

-- The hot read: the rail loads every completion for one enrollment on each page
-- view while the flag is on, so this is the index that keeps that cheap.
-- The UNIQUE constraint above already indexes (enrollment_id, step_key), which
-- serves this prefix — no separate enrollment_id index is added.

ALTER TABLE tour_step_completions ENABLE ROW LEVEL SECURITY;

-- SELECT only, same reasoning as tour_enrollments: a tester who could INSERT
-- here would forge the evidence rows the completion check reads.
CREATE POLICY "Testers read their own step completions"
  ON tour_step_completions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tour_enrollments
      WHERE tour_enrollments.id = tour_step_completions.enrollment_id
        AND tour_enrollments.tester_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins read all step completions"
  ON tour_step_completions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin')
    )
  );

COMMENT ON TABLE tour_step_completions IS
  'Tester Tour evidence. One row per (enrollment, step). Inserted by a '
  'service-role witness inside a real page render — never from the client, and '
  'never derived from analytics_events, which is client-writable and therefore '
  'forgeable. Reflection text is added by a later UPDATE on the same row.';
