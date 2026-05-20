-- Add targeting columns to sponsored_placements so admin can configure
-- which city + category a placement appears in, and at which position (1–3).

ALTER TABLE sponsored_placements
  ADD COLUMN IF NOT EXISTS position      integer CHECK (position BETWEEN 1 AND 3),
  ADD COLUMN IF NOT EXISTS city_id       uuid REFERENCES cities(id)      ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category_id   uuid REFERENCES categories(id)  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS sponsored_placements_city_cat_idx
  ON sponsored_placements (city_id, category_id, status)
  WHERE status IN ('active', 'scheduled');

-- Admin read/write (service-role bypass is sufficient for admin actions via
-- createServiceClient, but we also allow admin role users via RLS so the
-- select on the admin list page works through the regular client).
CREATE POLICY "admin_sponsored_placements_all"
  ON sponsored_placements
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin')
    )
  );
