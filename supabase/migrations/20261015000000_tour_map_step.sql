-- Tester Tour: a seventh step, "Find businesses on the map" (map_opened).
--
-- WHY. Tester notes, 2026-10-14: "Would have loved to know earlier there was a
-- map", and another tester's favorite feature was the map. The tour never sent
-- anyone there.
--
-- WHAT CHANGES. Only the step_key CHECK on tour_step_completions, which now
-- also allows 'map_opened'. The list is kept in lockstep with TOUR_STEPS in
-- lib/tour/steps.ts, in the same order (tests/tester-tour-trial.test.ts reads
-- this file to check it).
--
-- WHAT DOES NOT CHANGE. map_opened is not reflection-gated: a page-render
-- witness on /map writes the row with a NULL reflection, the same as
-- listing_opened and collection_browsed. Finishing still needs the same three
-- written steps plus the final note, so testers who already finished keep
-- their finish and nobody's free month moves. No RLS change.
--
-- The original CHECK was written inline in 20260830000000_tester_tour.sql, so
-- Postgres named it. Rather than trust the generated name, the DO block drops
-- whichever CHECK on this table constrains step_key, then adds a named one.
-- Safe to re-run.
--
-- DOWN PLAN:
--   Revert the code FIRST, so nothing writes map_opened any more. Then:
--   DELETE FROM tour_step_completions WHERE step_key = 'map_opened';
--     (needs approval: it removes rows. They are progress ticks only, with
--      no reflection text.)
--   ALTER TABLE tour_step_completions DROP CONSTRAINT IF EXISTS tour_step_completions_step_key_check;
--   ALTER TABLE tour_step_completions ADD CONSTRAINT tour_step_completions_step_key_check
--     CHECK (step_key IN ('search_ran', 'listing_opened', 'listing_saved',
--                         'collection_browsed', 'review_or_correction', 'final_reflection'));

DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'public.tour_step_completions'::regclass
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%step_key%'
  LOOP
    EXECUTE format('ALTER TABLE public.tour_step_completions DROP CONSTRAINT %I', c.conname);
  END LOOP;
END
$$;

ALTER TABLE public.tour_step_completions
  ADD CONSTRAINT tour_step_completions_step_key_check CHECK (step_key IN (
    'search_ran',
    'listing_opened',
    'listing_saved',
    'map_opened',
    'collection_browsed',
    'review_or_correction',
    'final_reflection'
  ));
