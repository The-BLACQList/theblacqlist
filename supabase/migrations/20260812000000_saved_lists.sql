-- Checkpoint 3.5: Saved lists — named, private collections over a user's saves.
--
-- Board: In Progress › [V1] 🟡 P2 Supporter dashboard › "Saved lists
-- (create / rename / organize)". Today `/account/saved` renders one flat list
-- straight off `saves`; there is no way to group it.
--
-- Two founder decisions shape this schema [Decision — founder, 2026-08-12]:
--   * Many lists per business. A listing can sit in several lists at once, so
--     this is a join table, not a `list_id` column on `saves`.
--   * Private only. There is deliberately NO anon policy and no `is_public`
--     column anywhere below. Sharing was considered and deferred; adding it
--     later is additive (a visibility column + one anon SELECT policy) and does
--     not require reshaping either table.
--
-- THE JOIN COLUMN IS `save_id`, NOT `listing_id`, and that is the load-bearing
-- decision in this file. It makes "All saved" a guaranteed superset of every
-- list: unsaving cascades the row out of every list it was in, in the database,
-- with no application code to forget. Joining on `listing_id` would instead
-- permit a listing that sits in a list while absent from All saved — a state
-- with no coherent screen. `saves` already carries UNIQUE (user_id, listing_id),
-- so one save row per user per listing is guaranteed upstream of this table.
--
-- `saves` itself is untouched. The heart on a listing page stays one tap
-- [Decision — founder, 2026-08-12]; organizing happens on /account/saved.
--
-- Down plan (purely additive — nothing existing is altered, so rollback loses
-- only list data; every save survives):
--   DROP TABLE IF EXISTS saved_list_items;
--   DROP TABLE IF EXISTS saved_lists;

CREATE TABLE IF NOT EXISTS saved_lists (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Trim set is explicit. Bare btrim() strips spaces ONLY, so a name of a
  -- single tab would satisfy `char_length(btrim(name)) >= 1` and produce a list
  -- that renders blank — exactly what this CHECK exists to prevent.
  name        text        NOT NULL
                CHECK (char_length(btrim(name, E' \t\r\n')) BETWEEN 1 AND 60),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS saved_lists_user_id_idx ON saved_lists (user_id);

-- One list per name per user, case- and whitespace-insensitively. Without the
-- normalization a user ends up with "Brunch", "brunch " and "BRUNCH" as three
-- separate lists, which reads as a bug rather than a feature. The action layer
-- catches 23505 and returns a friendly message. Same trim set as the CHECK
-- above, so the two agree on where a name starts and ends.
CREATE UNIQUE INDEX IF NOT EXISTS saved_lists_user_name_idx
  ON saved_lists (user_id, lower(btrim(name, E' \t\r\n')));

CREATE TABLE IF NOT EXISTS saved_list_items (
  list_id     uuid        NOT NULL REFERENCES saved_lists(id) ON DELETE CASCADE,
  save_id     uuid        NOT NULL REFERENCES saves(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, save_id)
);

-- The PK covers (list_id, save_id); this covers the other direction — the
-- cascade on unsave, and "which lists is this save in?" on the saved page.
CREATE INDEX IF NOT EXISTS saved_list_items_save_id_idx ON saved_list_items (save_id);

DROP TRIGGER IF EXISTS set_updated_at ON saved_lists;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON saved_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────
-- RLS — mirrors the `saves` policies exactly (20260510000001:636-651).
-- Private user data: authenticated, own rows, no anon path at all.
-- `saved_lists` additionally allows UPDATE because rename is a feature; `saves`
-- deliberately has no UPDATE policy and still doesn't.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE saved_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_lists: authenticated read own" ON saved_lists;
CREATE POLICY "saved_lists: authenticated read own"
  ON saved_lists FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "saved_lists: authenticated insert own" ON saved_lists;
CREATE POLICY "saved_lists: authenticated insert own"
  ON saved_lists FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "saved_lists: authenticated update own" ON saved_lists;
CREATE POLICY "saved_lists: authenticated update own"
  ON saved_lists FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "saved_lists: authenticated delete own" ON saved_lists;
CREATE POLICY "saved_lists: authenticated delete own"
  ON saved_lists FOR DELETE TO authenticated
  USING (user_id = auth.uid());

ALTER TABLE saved_list_items ENABLE ROW LEVEL SECURITY;

-- Items carry no user_id of their own; ownership is derived through the list.
-- INSERT additionally checks the save, so a user cannot file someone else's save
-- into their own list — without it, the list would be a way to read the
-- existence of another user's saves.

DROP POLICY IF EXISTS "saved_list_items: authenticated read own" ON saved_list_items;
CREATE POLICY "saved_list_items: authenticated read own"
  ON saved_list_items FOR SELECT TO authenticated
  USING (list_id IN (SELECT id FROM saved_lists WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "saved_list_items: authenticated insert own" ON saved_list_items;
CREATE POLICY "saved_list_items: authenticated insert own"
  ON saved_list_items FOR INSERT TO authenticated
  WITH CHECK (
    list_id IN (SELECT id FROM saved_lists WHERE user_id = auth.uid())
    AND save_id IN (SELECT id FROM saves WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "saved_list_items: authenticated delete own" ON saved_list_items;
CREATE POLICY "saved_list_items: authenticated delete own"
  ON saved_list_items FOR DELETE TO authenticated
  USING (list_id IN (SELECT id FROM saved_lists WHERE user_id = auth.uid()));
