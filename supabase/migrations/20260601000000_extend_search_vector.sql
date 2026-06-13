-- Extend search_vector to include category name and business description.
-- Previously only name, tagline, and service_area_description were indexed,
-- causing category-based searches (e.g. "restaurant", "salon") to return no results.

-- Step 1: Update the trigger function on listings
CREATE OR REPLACE FUNCTION update_listings_search_vector()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Step 2: Add a trigger on listing_details_business so description changes
-- also refresh the parent listing's search_vector
CREATE OR REPLACE FUNCTION refresh_listing_search_vector_from_details()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS listing_details_search_vector_update ON listing_details_business;
CREATE TRIGGER listing_details_search_vector_update
  AFTER INSERT OR UPDATE OF description ON listing_details_business
  FOR EACH ROW EXECUTE FUNCTION refresh_listing_search_vector_from_details();

-- Step 3: Re-populate search_vector for all existing listings
UPDATE listings
SET search_vector =
  setweight(to_tsvector('english', coalesce(listings.name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(listings.tagline, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(sub.cat_name, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(sub.biz_desc, '')), 'C') ||
  setweight(to_tsvector('english', coalesce(listings.service_area_description, '')), 'D')
FROM (
  SELECT l.id, c.name AS cat_name, ldb.description AS biz_desc
  FROM listings l
  JOIN categories c ON c.id = l.category_id
  LEFT JOIN listing_details_business ldb ON ldb.listing_id = l.id
) sub
WHERE sub.id = listings.id;
