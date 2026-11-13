# 193: Photo albums in the gallery

**Status:** Planned — from the 184 plan, founder 2026-11-13. Not started. Own branch and draft PR off `origin/main` once 184 has merged; **no merge before Wed 18 Nov 2026** (launch merge freeze).
**Follows:** 184 (album chips in `EntityMediaGallery`, `lib/listings/galleryAlbums.ts`)
**Area:** business pages, the owner dashboard (`MediaGrid`)
**Gates:** GATE-DATA for the migration (one nullable column).

## Why

Premium's 50-photo cap is only worth paying for if the gallery is navigable.

## Proposed shape

- `ALTER TABLE media_attachments ADD album text CHECK (char_length(album) <= 40)`; `MediaGrid` gets an album picker and a rename.
- Growth+ (decided here; the registry's nested `albums` entry is free today). Chips show only when photos sit under two or more albums, so a Starter gallery looks exactly as it does now.
- The loader sets `GalleryImage.album` from the column; the chip row, filtering and the lightbox already work from it.

## Checks

- Migration test; the album picker writes the column; chips appear at two albums and not at one.
