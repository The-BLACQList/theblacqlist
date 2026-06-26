-- B2b: Review photos — read access for media_attachments rows with entity_type='review'.
--
-- Photos are uploaded by the reviewer through the review server action using the
-- service client (which bypasses RLS, exactly like receipt uploads), so NO INSERT
-- policy is added here. These policies only WIDEN SELECT so approved review photos
-- on published reviews are publicly readable. They are additive — Postgres ORs them
-- with the existing entity_type='listing' policies.
--
-- entity_type='review' is already permitted by the media_attachments CHECK constraint.

DROP POLICY IF EXISTS "media_attachments: anon read approved review media" ON media_attachments;
CREATE POLICY "media_attachments: anon read approved review media"
  ON media_attachments FOR SELECT TO anon
  USING (
    entity_type = 'review'
    AND is_approved = true
    AND entity_id IN (SELECT id FROM reviews WHERE status = 'published')
  );

DROP POLICY IF EXISTS "media_attachments: authenticated read review media" ON media_attachments;
CREATE POLICY "media_attachments: authenticated read review media"
  ON media_attachments FOR SELECT TO authenticated
  USING (
    entity_type = 'review'
    AND (
      (is_approved = true AND entity_id IN (SELECT id FROM reviews WHERE status = 'published'))
      OR uploaded_by = auth.uid()
    )
  );
