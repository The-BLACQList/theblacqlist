-- =============================================================================
-- Review author names: tidy the short name
--
-- [Decision — founder, 2026-11-19] "fix it", on Creative's notes after #360
-- (first name + last initial, 20261129000000_review_author_names.sql). Only
-- short_display_name() changes; review_author_names() and its grants stay as
-- they are.
--
-- What changes, by example:
--   "jasmine roberts"     -> "Jasmine R."  (first letter capitalised; the rest
--                                            stays as typed, so "DeShawn" keeps
--                                            its capital S)
--   "Marcus Taylor Jr."   -> "Marcus T."   (Jr, Sr, II, III, IV are not a last name)
--   "Dr. Priya Nair"      -> "Priya N."    (Dr, Mr, Mrs, Ms, Mx, Prof, Rev are
--                                            not a first name)
--   "Dr. Nair"            -> "Dr. N."      (title kept when only a last name
--                                            would follow, so a last name is
--                                            never shown on its own)
--   "Roberts, Jasmine"    -> "Jasmine R."  (last name typed first)
--   "Kofi (KA)"           -> "Kofi K."     (the initial is the first letter)
--   "Kofi 🙂"             -> "Kofi"        (words with no letter are dropped)
-- Unchanged: anything with an @ returns NULL; blank returns NULL; one word
-- shows as that word.
--
-- Letters are matched with [[:alpha:]], which on staging and prod
-- (en_US.UTF-8) covers accented letters and excludes emoji (checked
-- 2026-11-19). Runtime cases: tests/migrations/review-name-format.test.ts.
--
-- GATE-DATA: staging after the founder's OK; production with the merge.
--
-- Down: re-run the short_display_name block of
-- 20261129000000_review_author_names.sql, then NOTIFY pgrst, 'reload schema';
-- =============================================================================

CREATE OR REPLACE FUNCTION short_display_name(p_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  w text[];
  n int;
  first_word text;
BEGIN
  IF p_name IS NULL OR position('@' IN p_name) > 0 THEN
    RETURN NULL;
  END IF;

  -- Words that hold at least one letter, in order.
  SELECT coalesce(array_agg(t.word ORDER BY t.ord), '{}')
    INTO w
    FROM regexp_split_to_table(btrim(p_name), '\s+') WITH ORDINALITY AS t(word, ord)
   WHERE t.word ~ '[[:alpha:]]';
  n := cardinality(w);
  IF n = 0 THEN
    RETURN NULL;
  END IF;

  -- A trailing suffix is not a last name.
  IF n >= 2 AND w[n] ~* '^(jr|sr|ii|iii|iv)\.?$' THEN
    n := n - 1;
    w := w[1:n];
  END IF;

  -- "Roberts, Jasmine": last name typed first.
  IF n >= 2 AND w[1] ~ ',$' THEN
    w := w[2:n] || rtrim(w[1], ',');
  END IF;

  -- A leading title is not a first name, unless only a last name would follow.
  IF n >= 3 AND w[1] ~* '^(dr|mr|mrs|ms|mx|prof|rev)\.?$' THEN
    w := w[2:n];
    n := n - 1;
  END IF;

  first_word := rtrim(w[1], ',');
  first_word := upper(left(first_word, 1)) || substr(first_word, 2);
  IF n = 1 THEN
    RETURN first_word;
  END IF;
  RETURN first_word || ' ' || upper(substring(w[n] FROM '[[:alpha:]]')) || '.';
END
$$;

NOTIFY pgrst, 'reload schema';
