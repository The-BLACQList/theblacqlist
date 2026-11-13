# 194: Documents — the menu, the rate card, the commission guide (PDF)

**Status:** Planned — from the 184 plan, founder 2026-11-13. Not started. Own branch and draft PR off `origin/main` once 184 has merged; **no merge before Wed 18 Nov 2026** (launch merge freeze).
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
