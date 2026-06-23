-- B6.1: Events as a first-class entity type.
-- Re-adds 'event' to the listings entity_type CHECK (it was dropped in
-- 20260524000001) and adds a 1:1 detail table mirroring listing_details_business.

ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_entity_type_check;
ALTER TABLE listings ADD CONSTRAINT listings_entity_type_check
  CHECK (entity_type IN (
    'business','restaurant','service_provider','professional','creative','vendor','event'
  ));

CREATE TABLE IF NOT EXISTS listing_details_event (
  listing_id            uuid        NOT NULL PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
  description           text,
  starts_at             timestamptz NOT NULL,
  ends_at               timestamptz,
  timezone              text,
  is_online             boolean     NOT NULL DEFAULT false,
  venue_name            text,
  venue_address         text,
  city_text             text,
  state                 text,
  zip                   text,
  ticket_url            text,
  price_text            text,        -- human-readable: 'Free', '$20', '$10–$50'
  organizer_listing_id  uuid        REFERENCES listings(id) ON DELETE SET NULL,
  cta_type              text        NOT NULL DEFAULT 'get-tickets'
                                    CHECK (cta_type IN (
                                      'get-tickets','rsvp','register','learn-more','visit','contact'
                                    )),
  cta_url               text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX IF NOT EXISTS listing_details_event_organizer_idx
  ON listing_details_event (organizer_listing_id);
CREATE INDEX IF NOT EXISTS listing_details_event_starts_at_idx
  ON listing_details_event (starts_at);

DROP TRIGGER IF EXISTS set_updated_at ON listing_details_event;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON listing_details_event
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE listing_details_event ENABLE ROW LEVEL SECURITY;

-- Access mirrors the parent listing visibility (same as listing_details_business).
DROP POLICY IF EXISTS "listing_details_event: anon read published" ON listing_details_event;
CREATE POLICY "listing_details_event: anon read published"
  ON listing_details_event FOR SELECT TO anon
  USING (
    listing_id IN (SELECT id FROM listings WHERE status = 'published' AND deleted_at IS NULL)
  );

DROP POLICY IF EXISTS "listing_details_event: authenticated read" ON listing_details_event;
CREATE POLICY "listing_details_event: authenticated read"
  ON listing_details_event FOR SELECT TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings
      WHERE (status = 'published' AND deleted_at IS NULL)
         OR (owner_user_id = auth.uid() AND deleted_at IS NULL)
    )
  );

DROP POLICY IF EXISTS "listing_details_event: owner insert" ON listing_details_event;
CREATE POLICY "listing_details_event: owner insert"
  ON listing_details_event FOR INSERT TO authenticated
  WITH CHECK (
    listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)
  );

DROP POLICY IF EXISTS "listing_details_event: owner update" ON listing_details_event;
CREATE POLICY "listing_details_event: owner update"
  ON listing_details_event FOR UPDATE TO authenticated
  USING (
    listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)
  )
  WITH CHECK (
    listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)
  );

DROP POLICY IF EXISTS "listing_details_event: owner delete" ON listing_details_event;
CREATE POLICY "listing_details_event: owner delete"
  ON listing_details_event FOR DELETE TO authenticated
  USING (
    listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)
  );
