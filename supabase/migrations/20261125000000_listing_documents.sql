-- =============================================================================
-- Documents: the menu, the rate card, the commission guide (ticket 194,
-- 2026-11-15).
--
-- A business page offers PDFs to download, shown as a pill row on the
-- Offerings, Services and Capabilities heading. Plan limits: Free 0,
-- Starter 1, Growth 3, Premium 10 (TIER_LIMITS.documents). The limit is
-- checked by the server action when a document is added; the page shows the
-- first ones the plan allows, in the owner's order, and nothing is deleted
-- when a page moves down a plan (ticket 105).
--
-- * listing-documents is its own public bucket, PDF only, 10 MB. The browser
--   uploads straight to storage with a signed upload URL the server issues
--   for a path it chose (a Vercel function body tops out near 4.5 MB), and
--   the server then checks the stored type, size and first bytes before a
--   row points at it. Keeping PDFs off listing-media keeps the photo bucket's
--   5 MB image-only rules as tight as they are. No storage.objects policies,
--   same as the other buckets: only the service role writes.
-- * The page links to the file with `?download=`, so storage sends it as an
--   attachment: download-only, never rendered inline. Virus scanning is out
--   of scope (ledger 6.3, a spend decision).
-- * `path` is pinned to this listing's documents folder, so a row can only
--   point at a file under its own page.
--
-- RLS: as listing_faqs. Anyone reads documents on published, non-deleted
-- pages; the owner reads and writes their own.
--
-- Down:
--   DROP TABLE IF EXISTS public.listing_documents;
--   DELETE FROM storage.buckets WHERE id = 'listing-documents';  -- once empty
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.listing_documents (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id  uuid        NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  label       text        NOT NULL,
  path        text        NOT NULL,
  size_bytes  integer     NOT NULL,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_documents_label_check
    CHECK (char_length(btrim(label)) BETWEEN 1 AND 60),
  CONSTRAINT listing_documents_path_shape
    CHECK (path ~ '^listings/[0-9a-f-]{36}/documents/[0-9a-f-]{36}\.pdf$'),
  CONSTRAINT listing_documents_path_own_folder
    CHECK (path LIKE 'listings/' || listing_id::text || '/documents/%'),
  CONSTRAINT listing_documents_size_check
    CHECK (size_bytes BETWEEN 1 AND 10485760),
  CONSTRAINT listing_documents_path_key UNIQUE (path)
);

-- The page read and the owner's list, in the owner's order.
CREATE INDEX IF NOT EXISTS listing_documents_listing_idx
  ON public.listing_documents (listing_id, sort_order);

DROP TRIGGER IF EXISTS set_updated_at ON public.listing_documents;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.listing_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.listing_documents ENABLE ROW LEVEL SECURITY;

-- Anon: read documents on published, non-deleted pages.
DROP POLICY IF EXISTS "listing_documents: anon read" ON public.listing_documents;
CREATE POLICY "listing_documents: anon read"
  ON public.listing_documents FOR SELECT TO anon
  USING (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE status = 'published' AND deleted_at IS NULL
    )
  );

-- Authenticated: read documents on published pages, and every item on pages they own.
DROP POLICY IF EXISTS "listing_documents: authenticated read" ON public.listing_documents;
CREATE POLICY "listing_documents: authenticated read"
  ON public.listing_documents FOR SELECT TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE (status = 'published' AND deleted_at IS NULL)
         OR (owner_user_id = auth.uid() AND deleted_at IS NULL)
    )
  );

-- Owner: insert / update / delete documents on pages they own.
DROP POLICY IF EXISTS "listing_documents: owner insert" ON public.listing_documents;
CREATE POLICY "listing_documents: owner insert"
  ON public.listing_documents FOR INSERT TO authenticated
  WITH CHECK (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "listing_documents: owner update" ON public.listing_documents;
CREATE POLICY "listing_documents: owner update"
  ON public.listing_documents FOR UPDATE TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "listing_documents: owner delete" ON public.listing_documents;
CREATE POLICY "listing_documents: owner delete"
  ON public.listing_documents FOR DELETE TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM public.listings
      WHERE owner_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

-- 10 MB, PDF only. Raising it means raising LISTING_DOCUMENT_MAX_BYTES in
-- lib/listings/documents.ts and the size CHECK above with it.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('listing-documents', 'listing-documents', true, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;
