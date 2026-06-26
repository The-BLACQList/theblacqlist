-- B4: Listing FAQs — owner-managed Q&A shown on the public listing page.
-- Child table of listings; ownership-gated RLS identical to listing_links.

CREATE TABLE IF NOT EXISTS listing_faqs (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id    uuid        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  question      text        NOT NULL,
  answer        text        NOT NULL,
  display_order integer     NOT NULL DEFAULT 0,
  is_visible    boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listing_faqs_listing_id_idx ON listing_faqs (listing_id, display_order);

DROP TRIGGER IF EXISTS set_updated_at ON listing_faqs;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON listing_faqs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE listing_faqs ENABLE ROW LEVEL SECURITY;

-- Anon: read FAQs for published, non-deleted listings.
DROP POLICY IF EXISTS "listing_faqs: anon read published" ON listing_faqs;
CREATE POLICY "listing_faqs: anon read published"
  ON listing_faqs FOR SELECT TO anon
  USING (
    listing_id IN (
      SELECT id FROM listings
      WHERE status = 'published' AND deleted_at IS NULL
    )
  );

-- Authenticated: read FAQs for published listings or listings they own.
DROP POLICY IF EXISTS "listing_faqs: authenticated read" ON listing_faqs;
CREATE POLICY "listing_faqs: authenticated read"
  ON listing_faqs FOR SELECT TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings
      WHERE (status = 'published' AND deleted_at IS NULL)
         OR (owner_user_id = auth.uid() AND deleted_at IS NULL)
    )
  );

-- Owner: insert / update / delete FAQs on listings they own.
DROP POLICY IF EXISTS "listing_faqs: owner insert" ON listing_faqs;
CREATE POLICY "listing_faqs: owner insert"
  ON listing_faqs FOR INSERT TO authenticated
  WITH CHECK (
    listing_id IN (
      SELECT id FROM listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "listing_faqs: owner update" ON listing_faqs;
CREATE POLICY "listing_faqs: owner update"
  ON listing_faqs FOR UPDATE TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    listing_id IN (
      SELECT id FROM listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "listing_faqs: owner delete" ON listing_faqs;
CREATE POLICY "listing_faqs: owner delete"
  ON listing_faqs FOR DELETE TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );
