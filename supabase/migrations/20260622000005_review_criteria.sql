-- B2a: Multi-criteria review ratings.
-- The overall headline score stays on reviews.rating (its avg_rating trigger is
-- unchanged). These tables add optional per-dimension scores that ride the
-- review's existing moderation gate — they surface publicly only once the parent
-- review is published.

-- Master list of rating dimensions.
CREATE TABLE IF NOT EXISTS review_criteria (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name          text        NOT NULL,
  slug          text        NOT NULL UNIQUE,
  applies_to    text        NOT NULL DEFAULT 'all',  -- reserved for future per-category sets
  display_order integer     NOT NULL DEFAULT 0,
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Per-criterion score for a review. Overall rating remains on reviews.rating.
CREATE TABLE IF NOT EXISTS review_ratings (
  review_id    uuid        NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  criterion_id uuid        NOT NULL REFERENCES review_criteria(id) ON DELETE CASCADE,
  rating       integer     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, criterion_id)
);

CREATE INDEX IF NOT EXISTS review_ratings_criterion_idx ON review_ratings (criterion_id);

ALTER TABLE review_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_ratings ENABLE ROW LEVEL SECURITY;

-- review_criteria: world-readable reference data.
DROP POLICY IF EXISTS "review_criteria: anon read" ON review_criteria;
CREATE POLICY "review_criteria: anon read"
  ON review_criteria FOR SELECT TO anon USING (is_active);

DROP POLICY IF EXISTS "review_criteria: auth read" ON review_criteria;
CREATE POLICY "review_criteria: auth read"
  ON review_criteria FOR SELECT TO authenticated USING (is_active);

-- review_ratings: readable when the parent review is published (anon) or also
-- when it is the reader's own review (authenticated). Mirrors the reviews policy.
DROP POLICY IF EXISTS "review_ratings: anon read published" ON review_ratings;
CREATE POLICY "review_ratings: anon read published"
  ON review_ratings FOR SELECT TO anon
  USING (review_id IN (SELECT id FROM reviews WHERE status = 'published'));

DROP POLICY IF EXISTS "review_ratings: auth read" ON review_ratings;
CREATE POLICY "review_ratings: auth read"
  ON review_ratings FOR SELECT TO authenticated
  USING (
    review_id IN (
      SELECT id FROM reviews
      WHERE status = 'published' OR reviewer_user_id = auth.uid()
    )
  );

-- Insert only ratings attached to the reviewer's own review.
DROP POLICY IF EXISTS "review_ratings: insert own review" ON review_ratings;
CREATE POLICY "review_ratings: insert own review"
  ON review_ratings FOR INSERT TO authenticated
  WITH CHECK (
    review_id IN (SELECT id FROM reviews WHERE reviewer_user_id = auth.uid())
  );

-- Seed a universal four-dimension set (applies to every listing type for now).
INSERT INTO review_criteria (name, slug, display_order) VALUES
  ('Quality',    'quality',    1),
  ('Service',    'service',    2),
  ('Value',      'value',      3),
  ('Atmosphere', 'atmosphere', 4)
ON CONFLICT (slug) DO NOTHING;
