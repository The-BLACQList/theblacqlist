// =============================================================================
// Migration test: 20261007000000_listing_video_upload.sql
// =============================================================================
// Ticket 130: owners upload their own page video. Three things to prove:
//
//   * listing_details_business gets a video_path column that only takes a
//     path shaped like the app builds them (listings/<uuid>/video/<uuid>.ext).
//   * A row holds a link or an uploaded path, never both (one video per page).
//   * The listing-video bucket is created public with a 50 MB cap and only the
//     three video types, and re-running the migration changes nothing.
//
// The fixture is a minimal listing_details_business plus a storage.buckets
// table with the columns the INSERT names, standing in for Supabase storage.
//
// Skipped when no local Postgres is reachable (DB_REACHABLE). These tests CREATE
// and DROP databases. The harness must never point at staging or production.
// =============================================================================

import { describe, it, expect } from 'vitest'
import path from 'node:path'
import {
  DB_REACHABLE,
  MIGRATIONS_DIR,
  applyFile,
  exec,
  query,
  raises,
  withScratchDb,
} from './helpers'

const MIGRATION = path.join(MIGRATIONS_DIR, '20261007000000_listing_video_upload.sql')

const LISTING = '0b6f5c7e-1d2a-4c3b-9e8f-7a6b5c4d3e2f'
const FILE = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d'
const GOOD_PATH = `listings/${LISTING}/video/${FILE}.mp4`

const FIXTURE = `
  CREATE SCHEMA IF NOT EXISTS storage;
  CREATE TABLE storage.buckets (
    id                 text PRIMARY KEY,
    name               text NOT NULL,
    public             boolean DEFAULT false,
    file_size_limit    bigint,
    allowed_mime_types text[]
  );

  CREATE TABLE listing_details_business (
    listing_id      uuid PRIMARY KEY,
    video_embed_url text
  );
  INSERT INTO listing_details_business (listing_id) VALUES ('${LISTING}');
`

const setVideo = (url: string, cols: string): boolean =>
  raises(url, `UPDATE listing_details_business SET ${cols} WHERE listing_id = '${LISTING}';`)

describe.skipIf(!DB_REACHABLE)('20261007000000_listing_video_upload', () => {
  it('adds video_path and accepts only app-shaped paths', async () => {
    await withScratchDb('video_path_shape', (url) => {
      exec(url, FIXTURE)
      applyFile(url, MIGRATION)

      expect(setVideo(url, `video_path = '${GOOD_PATH}'`)).toBe(false)
      for (const ext of ['mov', 'webm']) {
        expect(setVideo(url, `video_path = 'listings/${LISTING}/video/${FILE}.${ext}'`)).toBe(false)
      }
      expect(setVideo(url, `video_path = NULL`)).toBe(false)

      // A URL, another extension, another folder, or a traversal are all refused.
      expect(setVideo(url, `video_path = 'https://example.com/clip.mp4'`)).toBe(true)
      expect(setVideo(url, `video_path = 'listings/${LISTING}/video/${FILE}.avi'`)).toBe(true)
      expect(setVideo(url, `video_path = 'listings/${LISTING}/gallery/${FILE}.mp4'`)).toBe(true)
      expect(setVideo(url, `video_path = 'listings/${LISTING}/video/../${FILE}.mp4'`)).toBe(true)
    })
  })

  it('keeps one video per page', async () => {
    await withScratchDb('video_one_per_page', (url) => {
      exec(url, FIXTURE)
      applyFile(url, MIGRATION)

      expect(
        setVideo(url, `video_path = '${GOOD_PATH}', video_embed_url = 'https://youtu.be/abc'`)
      ).toBe(true)
      expect(setVideo(url, `video_path = NULL, video_embed_url = 'https://youtu.be/abc'`)).toBe(
        false
      )
      // Swapping in one statement, as the server action does, is fine.
      expect(setVideo(url, `video_path = '${GOOD_PATH}', video_embed_url = NULL`)).toBe(false)
    })
  })

  it('creates the public listing-video bucket with its limits, once', async () => {
    await withScratchDb('video_bucket', (url) => {
      exec(url, FIXTURE)
      applyFile(url, MIGRATION)
      applyFile(url, MIGRATION)

      const buckets = query(url, `SELECT * FROM storage.buckets`)
      expect(buckets).toEqual([
        {
          id: 'listing-video',
          name: 'listing-video',
          public: true,
          file_size_limit: 52428800,
          allowed_mime_types: ['video/mp4', 'video/quicktime', 'video/webm'],
        },
      ])

      const constraints = query<{ conname: string }>(
        url,
        `SELECT conname FROM pg_constraint
          WHERE conrelid = 'listing_details_business'::regclass AND contype = 'c' ORDER BY conname`
      )
      expect(constraints.map((c) => c.conname)).toEqual([
        'listing_details_business_one_video',
        'listing_details_business_video_path_shape',
      ])
    })
  })
})
