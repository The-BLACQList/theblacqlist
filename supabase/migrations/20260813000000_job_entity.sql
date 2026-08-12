-- 3.6a: Jobs as a first-class entity type.
--
-- Re-adds 'job' to the listings entity_type CHECK and adds a 1:1 detail table,
-- structured after 20260622000007_event_entity.sql.
--
-- WHY THIS IS NEEDED: 'job' was silently dropped from the CHECK by
-- 20260524000001_fix_entity_location_cta_constraints.sql:3-4 and never restored,
-- so the database has physically rejected `entity_type = 'job'` since May, even
-- though types/index.ts and lib/validations/search.ts both still declare it.
--
-- The value list below is copied from the LIVE constraint (see the header of
-- lib/constants/listing.ts) plus 'job'. Do NOT reconcile it against the initial
-- schema — 20260524000001 + 20260622000007 are the truth.

ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_entity_type_check;
ALTER TABLE listings ADD CONSTRAINT listings_entity_type_check
  CHECK (entity_type IN (
    'business','restaurant','service_provider','professional','creative','vendor','event','job'
  ));

-- A job's place of work is the parent listing's city_id plus workplace_type.
-- No venue columns here: buildJsonLd already joins `cities`, and duplicating the
-- address on the detail row creates two answers to one question.
CREATE TABLE IF NOT EXISTS listing_details_job (
  listing_id         uuid        NOT NULL PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
  description        text,
  employment_type    text        NOT NULL
                                 CHECK (employment_type IN (
                                   'full-time','part-time','contract','temporary','internship','volunteer'
                                 )),
  workplace_type     text        NOT NULL DEFAULT 'on-site'
                                 CHECK (workplace_type IN ('on-site','hybrid','remote')),
  salary_min         numeric,
  salary_max         numeric,
  salary_period      text        CHECK (salary_period IN ('hour','day','week','month','year')),
  salary_currency    text        NOT NULL DEFAULT 'USD',
  apply_url          text,
  apply_email        text,
  -- Drives JobPosting.datePosted, and lets an owner re-post a role without
  -- creating a second listing.
  posted_at          timestamptz NOT NULL DEFAULT now(),
  closes_at          timestamptz,               -- JobPosting.validThrough
  -- The hiring company. Mirrors listing_details_event.organizer_listing_id.
  hiring_listing_id  uuid        REFERENCES listings(id) ON DELETE SET NULL,
  cta_type           text        NOT NULL DEFAULT 'apply'
                                 CHECK (cta_type IN ('apply','learn-more','visit','contact')),
  cta_url            text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  -- An inverted range has no coherent render.
  CHECK (salary_min IS NULL OR salary_max IS NULL OR salary_max >= salary_min),
  -- A pay figure without a period is unreadable ("$65,000" per what?) and
  -- cannot be emitted as JobPosting.baseSalary.
  CHECK ((salary_min IS NULL AND salary_max IS NULL) OR salary_period IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS listing_details_job_hiring_idx
  ON listing_details_job (hiring_listing_id);
CREATE INDEX IF NOT EXISTS listing_details_job_posted_at_idx
  ON listing_details_job (posted_at);

DROP TRIGGER IF EXISTS set_updated_at ON listing_details_job;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON listing_details_job
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE listing_details_job ENABLE ROW LEVEL SECURITY;

-- Access mirrors the parent listing visibility (same as listing_details_event).
DROP POLICY IF EXISTS "listing_details_job: anon read published" ON listing_details_job;
CREATE POLICY "listing_details_job: anon read published"
  ON listing_details_job FOR SELECT TO anon
  USING (
    listing_id IN (SELECT id FROM listings WHERE status = 'published' AND deleted_at IS NULL)
  );

DROP POLICY IF EXISTS "listing_details_job: authenticated read" ON listing_details_job;
CREATE POLICY "listing_details_job: authenticated read"
  ON listing_details_job FOR SELECT TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings
      WHERE (status = 'published' AND deleted_at IS NULL)
         OR (owner_user_id = auth.uid() AND deleted_at IS NULL)
    )
  );

DROP POLICY IF EXISTS "listing_details_job: owner insert" ON listing_details_job;
CREATE POLICY "listing_details_job: owner insert"
  ON listing_details_job FOR INSERT TO authenticated
  WITH CHECK (
    listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)
  );

DROP POLICY IF EXISTS "listing_details_job: owner update" ON listing_details_job;
CREATE POLICY "listing_details_job: owner update"
  ON listing_details_job FOR UPDATE TO authenticated
  USING (
    listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)
  )
  WITH CHECK (
    listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)
  );

DROP POLICY IF EXISTS "listing_details_job: owner delete" ON listing_details_job;
CREATE POLICY "listing_details_job: owner delete"
  ON listing_details_job FOR DELETE TO authenticated
  USING (
    listing_id IN (SELECT id FROM listings WHERE owner_user_id = auth.uid() AND deleted_at IS NULL)
  );
