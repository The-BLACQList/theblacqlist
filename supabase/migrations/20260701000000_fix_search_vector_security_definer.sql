-- =============================================================================
-- Fix: account deletion failed with "Database error deleting user" — the REAL
-- Postgres error (from the DB log) was: 42P01 relation "categories" does not exist.
--
-- Root cause: deleting a user SET-NULLs listings.owner_user_id/submitted_by/
-- updated_by (FK ON DELETE SET NULL), which fires the BEFORE UPDATE trigger
-- `listings_search_vector_update` -> update_listings_search_vector(). The
-- extended version of that function (20260601000000) does
--   SELECT ... FROM categories WHERE id = NEW.category_id
-- but it was SECURITY INVOKER with no pinned search_path. auth.admin.deleteUser
-- runs as `supabase_auth_admin`, whose search_path does NOT include `public`, so
-- the unqualified `categories` (and `listing_details_business`) could not be
-- resolved -> 42P01 -> the whole user delete aborted.
--
-- Fix: redefine the two search-vector trigger functions as SECURITY DEFINER with
-- SET search_path = public, so they resolve public objects and run with the
-- owner's privileges regardless of which role fired the trigger — the same
-- pattern applied to the count triggers in 20260630000000. CREATE OR REPLACE
-- keeps the existing triggers wired. Idempotent.
-- =============================================================================

-- The blocker: fires on every listings INSERT/UPDATE, including the SET NULL
-- during a user delete.
CREATE OR REPLACE FUNCTION update_listings_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cat_name text;
  biz_desc text;
BEGIN
  SELECT name INTO cat_name FROM categories WHERE id = NEW.category_id;
  SELECT description INTO biz_desc FROM listing_details_business WHERE listing_id = NEW.id;

  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.tagline, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(cat_name, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(biz_desc, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.service_area_description, '')), 'D');
  RETURN NEW;
END;
$$;

-- Same pattern (references categories/listings unqualified); harden for
-- consistency so it can't fail under a restricted search_path either.
CREATE OR REPLACE FUNCTION refresh_listing_search_vector_from_details()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cat_name text;
BEGIN
  SELECT c.name INTO cat_name
  FROM categories c
  JOIN listings l ON l.category_id = c.id
  WHERE l.id = NEW.listing_id;

  UPDATE listings SET search_vector =
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(tagline, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(cat_name, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(service_area_description, '')), 'D')
  WHERE id = NEW.listing_id;
  RETURN NEW;
END;
$$;
