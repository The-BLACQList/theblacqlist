# 193: Photo albums in the gallery

**Status:** In PR — stacked on 192 (#342). Migration `20261124000000_media_albums.sql` not applied anywhere yet: staging needs the founder's OK, production is GATE-DATA. Until it is applied the page loader shows the photos ungrouped and the editor shows no album controls (both read the column separately, fail-soft). What shipped: a nullable `media_attachments.album` (1–40 characters, CHECK), no policy change, and a new gated feature `photo_albums` at Growth (FEATURE_MIN_TIER 2); the section registry's `albums` gate moved from none to it. In the Photos editor each photo card gets an Album field (suggests the page's existing albums), and a Photo Albums panel lists the albums with photo counts, Rename and Remove (Remove takes the photos out of the album; the photos stay). Filing needs Growth; taking photos out of albums and renaming work on every plan. Below Growth the gallery shows the same photos ungrouped (applyTierGates drops the albums) and nothing is deleted (ticket 105 policy). A page holds at most 12 albums (a bound, not a plan limit). The gallery's chip row was already built: it shows at two or more albums, not at one. Writes go through a server action that checks the page is the owner's and then uses the service client scoped to that page's photos, because the media update policy only covers photos the owner uploaded themselves. Business-shaped pages only for now: the event and job media page passes no albums.
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
