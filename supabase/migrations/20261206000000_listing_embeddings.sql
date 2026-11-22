-- =============================================================================
-- Meaning search setup (ticket 259)
-- =============================================================================
-- "How do I switch to Black Owned bathroom products" found nothing on
-- production (founder, 2026-11-21). Keyword search needs the words to match;
-- meaning search finds a soap maker for "bathroom products" because the two
-- mean close to the same thing. The founder picked Voyage AI for it.
--
-- This migration only sets up the store. It changes no search result:
--
--   * listing_embeddings: one row per searchable listing, holding the
--     listing's meaning as 1024 numbers (made by Voyage from public page
--     text), the model that made it, and a hash of the text it was made from.
--   * listing_embedding_text(): the public words a listing is embedded from.
--   * listing_embeddings_pending(): listings with no row, or whose words (or
--     the model) changed since. The daily cron embeds these.
--   * listing_embeddings_prune(): drops rows for listings no longer shown.
--   * search_listings_semantic(): the closest searchable listings to a
--     query's meaning. Used by Cue and the quick answer from ticket 260 only,
--     never the strict grid (founder, 2026-11-21).
--
-- No triggers. A changed page is found by its hash on the next cron run, so
-- an owner's edit, a new tag or a category move all count without a trigger
-- on each table.
--
-- Everything is service-role only: RLS on with no policies, and EXECUTE
-- revoked from anon and authenticated. The numbers are made from public page
-- text, but nothing in the browser needs them.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS search_listings_semantic(extensions.vector, text, integer, double precision, uuid);
--   DROP FUNCTION IF EXISTS listing_embeddings_prune();
--   DROP FUNCTION IF EXISTS listing_embeddings_pending(text, integer);
--   DROP FUNCTION IF EXISTS listing_embedding_text(uuid);
--   DROP TABLE IF EXISTS listing_embeddings;
-- (The vector extension can stay; nothing else uses it.)
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.listing_embeddings (
  listing_id   uuid                     NOT NULL PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
  embedding    extensions.vector(1024)  NOT NULL,
  model        text                     NOT NULL,
  content_hash text                     NOT NULL,
  embedded_at  timestamptz              NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.listing_embeddings IS
  'Ticket 259. Each searchable listing''s meaning (Voyage, 1024 dims) from its public text. Service role only.';

CREATE INDEX IF NOT EXISTS listing_embeddings_hnsw_idx
  ON public.listing_embeddings USING hnsw (embedding extensions.vector_cosine_ops);

ALTER TABLE public.listing_embeddings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.listing_embeddings FROM anon, authenticated;


-- The public words a listing is embedded from: what its page already shows
-- anyone. Name, tagline, category (with its group), description (capped),
-- service area, place words and active tags. No owner details, no reviews.
CREATE OR REPLACE FUNCTION public.listing_embedding_text(p_listing_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT concat_ws(E'\n',
    nullif(trim(l.name), ''),
    nullif(trim(l.tagline), ''),
    nullif(concat_ws(' > ', p.name, c.name), ''),
    nullif(trim(left(d.description, 1500)), ''),
    nullif(trim(l.service_area_description), ''),
    nullif(trim(listing_place_text(l.city_id, l.id)), ''),
    (SELECT string_agg(t.name, ', ' ORDER BY t.name)
       FROM listing_tags lt
       JOIN tags t ON t.id = lt.tag_id
      WHERE lt.listing_id = l.id AND t.is_active)
  )
  FROM listings l
  LEFT JOIN listing_details_business d ON d.listing_id = l.id
  LEFT JOIN categories c ON c.id = l.category_id
  LEFT JOIN categories p ON p.id = c.parent_id
  WHERE l.id = p_listing_id
$$;


-- Searchable listings whose row is missing or out of date: the words changed,
-- or another model made the row. The hash covers the model too, so changing
-- models re-embeds everything.
CREATE OR REPLACE FUNCTION public.listing_embeddings_pending(p_model text, p_limit integer DEFAULT 500)
RETURNS TABLE (listing_id uuid, content text, content_hash text)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH src AS (
    SELECT l.id, listing_embedding_text(l.id) AS content
    FROM listings l
    WHERE l.status = 'published'
      AND l.deleted_at IS NULL
      AND l.flag_status = 'none'
  ), hashed AS (
    SELECT s.id, s.content, md5(p_model || E'\n' || s.content) AS content_hash
    FROM src s
    WHERE s.content IS NOT NULL AND s.content <> ''
  )
  SELECT h.id, h.content, h.content_hash
  FROM hashed h
  LEFT JOIN listing_embeddings e ON e.listing_id = h.id
  WHERE e.listing_id IS NULL OR e.content_hash <> h.content_hash
  ORDER BY h.id
  LIMIT greatest(1, least(coalesce(p_limit, 500), 2000))
$$;


-- Rows for listings that are no longer shown (unpublished, deleted, flagged).
-- search_listings_semantic already skips them; this keeps the table tidy.
CREATE OR REPLACE FUNCTION public.listing_embeddings_prune()
RETURNS integer
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  WITH gone AS (
    DELETE FROM listing_embeddings e
    USING listings l
    WHERE l.id = e.listing_id
      AND (l.status <> 'published' OR l.deleted_at IS NOT NULL OR l.flag_status <> 'none')
    RETURNING 1
  )
  SELECT count(*)::integer FROM gone
$$;


-- The searchable listings closest in meaning to a query, best first, with
-- similarity from 0 to 1. Only rows made by p_model are compared, and only
-- above p_min_similarity. Optional city filter.
CREATE OR REPLACE FUNCTION public.search_listings_semantic(
  p_embedding      extensions.vector,
  p_model          text,
  p_limit          integer          DEFAULT 10,
  p_min_similarity double precision DEFAULT 0.45,
  p_city_id        uuid             DEFAULT NULL
)
RETURNS TABLE (listing_id uuid, similarity double precision)
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  SELECT ranked.listing_id, ranked.similarity
  FROM (
    SELECT e.listing_id, 1 - (e.embedding <=> p_embedding) AS similarity
    FROM listing_embeddings e
    JOIN listings l ON l.id = e.listing_id
    WHERE e.model = p_model
      AND l.status = 'published'
      AND l.deleted_at IS NULL
      AND l.flag_status = 'none'
      AND (p_city_id IS NULL OR l.city_id = p_city_id)
    ORDER BY e.embedding <=> p_embedding
    LIMIT greatest(1, least(coalesce(p_limit, 10), 50))
  ) ranked
  WHERE ranked.similarity >= coalesce(p_min_similarity, 0)
  ORDER BY ranked.similarity DESC
$$;


REVOKE ALL ON FUNCTION public.listing_embedding_text(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.listing_embeddings_pending(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.listing_embeddings_prune() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.search_listings_semantic(extensions.vector, text, integer, double precision, uuid)
  FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_embeddings TO service_role;
    GRANT EXECUTE ON FUNCTION public.listing_embedding_text(uuid) TO service_role;
    GRANT EXECUTE ON FUNCTION public.listing_embeddings_pending(text, integer) TO service_role;
    GRANT EXECUTE ON FUNCTION public.listing_embeddings_prune() TO service_role;
    GRANT EXECUTE ON FUNCTION public.search_listings_semantic(extensions.vector, text, integer, double precision, uuid)
      TO service_role;
  END IF;
END
$$;
