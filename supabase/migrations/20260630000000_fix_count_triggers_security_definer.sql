-- =============================================================================
-- Fix: account deletion failed with "Database error deleting user".
--
-- Root cause: auth.admin.deleteUser() runs as the `supabase_auth_admin` role.
-- Deleting the user CASCADE-deletes their `saves` rows, which fires the
-- `saves_update_listing_save_count` trigger. Its function was SECURITY INVOKER,
-- so it ran `UPDATE public.listings ...` AS `supabase_auth_admin` — a role with
-- no privileges on public tables — so Postgres raised "permission denied for
-- table listings" and the whole user delete aborted. This blocked deletion for
-- ANY user who had saved a business.
--
-- Fix: make the cross-table denormalization trigger functions SECURITY DEFINER
-- so they execute as the owner (postgres) regardless of which role fired the
-- trigger — the standard Supabase pattern for triggers that can run during auth
-- operations. `SET search_path = public` pins resolution (required hygiene for
-- SECURITY DEFINER). CREATE OR REPLACE keeps the existing triggers wired (they
-- reference the function by name) — no trigger drop/recreate needed.
--
-- Idempotent: safe to run multiple times.
-- =============================================================================

-- The confirmed blocker: maintains listings.save_count on save insert/delete.
CREATE OR REPLACE FUNCTION update_listing_save_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE listings SET save_count = save_count + 1 WHERE id = NEW.listing_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE listings SET save_count = GREATEST(save_count - 1, 0) WHERE id = OLD.listing_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Same latent issue (cross-table UPDATE on listings); harden it too so deletion
-- stays robust if review rows are ever removed during an auth operation.
CREATE OR REPLACE FUNCTION update_listing_review_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_listing_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_listing_id := OLD.listing_id;
  ELSE
    target_listing_id := NEW.listing_id;
  END IF;

  UPDATE listings
  SET
    review_count = (
      SELECT COUNT(*)
      FROM reviews
      WHERE listing_id = target_listing_id AND status = 'published'
    ),
    avg_rating = (
      SELECT ROUND(AVG(rating)::numeric, 2)
      FROM reviews
      WHERE listing_id = target_listing_id AND status = 'published'
    )
  WHERE id = target_listing_id;

  RETURN NULL;
END;
$$;
