-- Allow listing owners to respond to approved reviews on their page.
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS owner_response      text,
  ADD COLUMN IF NOT EXISTS owner_responded_at  timestamptz;

-- Owners may update only the owner_response / owner_responded_at columns on
-- reviews that belong to their listing (status must be published).
CREATE POLICY "owner_can_respond_to_reviews"
  ON reviews
  FOR UPDATE
  TO authenticated
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = reviews.listing_id
        AND listings.owner_user_id = auth.uid()
        AND listings.deleted_at IS NULL
    )
  )
  WITH CHECK (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = reviews.listing_id
        AND listings.owner_user_id = auth.uid()
        AND listings.deleted_at IS NULL
    )
  );
