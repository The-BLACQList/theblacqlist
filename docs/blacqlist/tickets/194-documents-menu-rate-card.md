# 194: Documents — the menu, the rate card, the commission guide (PDF)

**Status:** In PR — stacked on 193 (#343). Migration `20261125000000_listing_documents.sql` not applied anywhere yet: staging needs the founder's OK, production is GATE-DATA. Until it is applied the page loader shows no documents row (the read is fail-soft) and Dashboard → Documents says it couldn't load. What shipped: `listing_documents` (label 1–60, path pinned to `listings/{id}/documents/{uuid}.pdf` in the row's own listing folder, size 1 B–10 MB, RLS as `listing_faqs`), a new gated feature `documents` at Starter with `TIER_LIMITS.documents` Free 0 / Starter 1 / Growth 3 / Premium 10, and Dashboard → Documents (add, rename, Move Up/Down, remove). The page shows the first ones the plan allows in the owner's order; nothing is deleted when a page moves down a plan (ticket 105). Business pages only, not jobs or events. **Three changes from the proposed shape:** (1) PDFs go in their own public bucket `listing-documents` (PDF only, 10 MB, created by the migration) instead of `listing-media`, so the photo bucket keeps its 5 MB image-only rules. (2) Uploads go straight to storage on a one-time signed URL, the same flow as uploaded videos (ticket 130), instead of `/api/upload`, because a Vercel function body tops out near 4.5 MB; `/api/upload` is unchanged. The server then checks the stored type, size and the `%PDF-` first bytes before a row points at the file, and removes anything that fails; uploads are rate-limited at 20 an hour per owner. (3) Download-only is done with storage's `?download=<name>.pdf`, which sends the file as an attachment.
**Follows:** 184 (`EntityDocumentsRow`, the `documents` nested mark)
**Area:** business pages, the owner dashboard (`/dashboard/pages/[id]/media`), `/api/upload`
**Gates:** GATE-DATA for the migration; a storage-policy check for the new path.

## Why

Restaurants and professionals both hand out a PDF today; a page that hosts it is their website.

## Proposed shape

- `LISTING_MEDIA_ROLES += 'document'`: PDF only, ≤ 10 MB, stored at `listings/{id}/documents/{uuid}.pdf` in `listing-media`; `listing_documents(id, listing_id fk cascade, label ≤60, path, size_bytes, sort_order, created_at, updated_at)`; RLS as `listing_faqs`.
- Limits: Starter 1 / Growth 3 / Premium 10 (decided here; the registry entry is free today). Served through the public bucket URL, **download-only, never rendered inline**; virus scanning is out of scope.
- The loader fills `entity.documents` with `label`, `href` and a `sizeLabel` from `size_bytes`.

## Checks

- Upload route rejects non-PDF and oversized files; migration and limit tests; the row shows in the Offerings, Services and Capabilities headings.
