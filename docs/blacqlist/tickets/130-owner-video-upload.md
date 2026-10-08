# Ticket 130: Owners upload their own page video

**Phase:** V1.5 · **Priority:** P1 · **Status:** In review (draft PR, 2026-10-07)
**Depends on:** 119 (plan limits), 129 (finish view, where the video section lives)
**Gates:** GATE-DATA. Migration `20261007000000_listing_video_upload` adds a column, two CHECKs and a storage bucket. Apply on staging, then prod, each with a founder OK, before merge.

---

## Why

`[Decision — founder, 2026-10-07]` A page video should not be limited to YouTube or Vimeo. Owners can upload a video file of their own. Links stay as the other option. The Starter plan said "YouTube or Vimeo video embed", and that limit goes away with it.

## Scope

In:

- Upload one video file per page from the finish view's video section (new owner and edit mode).
- MP4, MOV and WebM, up to 50 MB.
- The public page plays an uploaded video in a native player.
- Starter plan copy: "A video on your page, your own upload or a link".

Out:

- Transcoding, thumbnails and adaptive streaming. The file plays as uploaded.
- More than one video per page.
- Videos on event and job pages, and in the photo gallery.

## How it works

**One video per page.** `listing_details_business` keeps `video_embed_url` for a link and gains `video_path` for an upload. A DB CHECK allows one or the other, never both. Saving either clears the other, and any uploaded file the page no longer uses is removed from storage.

**Upload path.** A Vercel function body tops out near 4.5 MB, far under a phone video, so the file goes straight from the browser to storage.

1. The browser checks type and size, then asks the server to start.
2. `startListingVideoUploadAction` checks ownership, the plan (Starter and up), the rate limit (10 an hour), type and size. It picks the path (`listings/<listing id>/video/<random uuid>.<ext>`) and returns a one-time signed upload URL.
3. The browser uploads with a progress bar and a Cancel button.
4. `finishListingVideoUploadAction` checks the path belongs to this listing, finds the object in storage, checks its stored type and size, and reads its first bytes to confirm it really is that video type. Anything that fails is removed. Then it saves the path and clears the link.

**Storage.** New public bucket `listing-video`: 50 MB per file, video/mp4, video/quicktime and video/webm only. No storage policies; only the service role writes, through signed URLs it issues. The photo bucket keeps its tighter image rules.

**Plan rules.** Adding or changing a video is Starter. Removing one is allowed on every plan. A Free page that still has a video keeps it until the owner removes it, as with links today.

**Public page.** `<video controls playsInline preload="metadata">` from the bucket's public URL. A link still renders the YouTube or Vimeo player.

| Need                              | Where                                             |
| --------------------------------- | ------------------------------------------------- |
| Shared rules (types, size, paths) | `lib/video/listingVideo.ts`                       |
| Server actions                    | `lib/actions/dashboard/updateListingVideo.ts`     |
| Byte check                        | `lib/security/file-signature.ts` (MP4, MOV, WebM) |
| Upload control                    | `components/dashboard/VideoUploadField.tsx`       |
| Video section                     | `components/dashboard/VideoSection.tsx`           |
| Public player                     | `components/entity-page/EntityVideoSection.tsx`   |

## Acceptance criteria

- Given a Starter owner on the finish view, when they choose an MP4, MOV or WebM up to 50 MB, then they see upload progress and the video appears on their page when it finishes.
- Given a file over 50 MB or of another type, then the owner sees why before anything uploads, and nothing is stored.
- Given a file whose bytes don't match its type, then the upload is refused and the file is removed from storage.
- Given a page with an uploaded video, when the owner saves a YouTube or Vimeo link, then the link replaces the upload and the old file is removed.
- Given a page with a link, when the owner uploads a video, then the upload replaces the link.
- Given a Free owner, then the upload control is replaced by the Starter upgrade note. Given a Free owner with a video, then they can remove it.
- Given an owner removes the video, then both columns are cleared and the file is removed.
- Given the migration has not run yet, then pages and the editor still load and link videos still play.

## Known limits

- **iPhone HEVC .mov files** may not play in every browser (Chrome on Windows, some Android). There is no transcoding. Owners can save as MP4 ("Most Compatible" on iPhone).
- **Egress.** Every play streams from Supabase storage and counts toward the plan's bandwidth.
- **Going past 50 MB** needs the project's storage upload limit raised first (Supabase Pro), then the bucket and `LISTING_VIDEO_MAX_BYTES`.
- **Orphans.** An upload that never finishes stays in storage until the owner's next video save or removal clears the folder.

## QA notes

- Unit: `tests/listing-video.test.ts`, `tests/listing-video-actions.test.ts`, `tests/file-signature.test.ts`, `tests/plan-copy.test.ts`.
- Migration: `tests/migrations/listing-video-upload.test.ts` (needs Docker).
- Browser: upload on desktop and a phone (camera roll .mov), cancel mid-upload, replace upload with link and back, Free page locked state, public page playback in Safari and Chrome.
- Previews read STAGING. Uploads can't work on a Preview until the staging migration runs.
