// Unit coverage for lib/video/listingVideo.ts (ticket 130): the path rules the
// upload actions and the database CHECK both rely on, and the file-type guess
// the picker uses when a browser leaves `file.type` empty.

import { describe, it, expect } from 'vitest'
import {
  LISTING_VIDEO_MAX_BYTES,
  buildListingVideoPath,
  formatMegabytes,
  isListingVideoPath,
  isListingVideoType,
  listingVideoFolder,
  listingVideoPublicUrl,
  resolveListingVideoType,
} from '@/lib/video/listingVideo'

const LISTING = '0b6f5c7e-1d2a-4c3b-9e8f-7a6b5c4d3e2f'
const OTHER = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'

// The same pattern as the migration's listing_details_business_video_path_shape.
const DB_SHAPE = /^listings\/[0-9a-f-]{36}\/video\/[0-9a-f-]{36}\.(mp4|mov|webm)$/

describe('isListingVideoType', () => {
  it('takes the three video types and nothing else', () => {
    expect(isListingVideoType('video/mp4')).toBe(true)
    expect(isListingVideoType('video/quicktime')).toBe(true)
    expect(isListingVideoType('video/webm')).toBe(true)
    expect(isListingVideoType('video/x-matroska')).toBe(false)
    expect(isListingVideoType('image/png')).toBe(false)
    expect(isListingVideoType('toString')).toBe(false)
    expect(isListingVideoType('')).toBe(false)
  })
})

describe('buildListingVideoPath', () => {
  it('builds a path in the listing folder with the extension from the type', () => {
    const mp4 = buildListingVideoPath(LISTING, 'video/mp4')!
    const mov = buildListingVideoPath(LISTING, 'video/quicktime')!
    expect(mp4.startsWith(`${listingVideoFolder(LISTING)}/`)).toBe(true)
    expect(mp4.endsWith('.mp4')).toBe(true)
    expect(mov.endsWith('.mov')).toBe(true)
  })

  it('matches the database CHECK and its own validator', () => {
    for (const type of ['video/mp4', 'video/quicktime', 'video/webm']) {
      const path = buildListingVideoPath(LISTING, type)!
      expect(path).toMatch(DB_SHAPE)
      expect(isListingVideoPath(path, LISTING)).toBe(true)
    }
  })

  it('gives every upload a new name', () => {
    expect(buildListingVideoPath(LISTING, 'video/mp4')).not.toBe(
      buildListingVideoPath(LISTING, 'video/mp4')
    )
  })

  it('refuses a type it does not take', () => {
    expect(buildListingVideoPath(LISTING, 'image/png')).toBeNull()
  })
})

describe('isListingVideoPath', () => {
  const good = `listings/${LISTING}/video/1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d.mp4`

  it('rejects a path for another listing', () => {
    expect(isListingVideoPath(good, OTHER)).toBe(false)
  })

  it('rejects traversal, other folders and other extensions', () => {
    expect(isListingVideoPath(`listings/${LISTING}/video/../../x.mp4`, LISTING)).toBe(false)
    expect(isListingVideoPath(good.replace('/video/', '/photos/'), LISTING)).toBe(false)
    expect(isListingVideoPath(good.replace('.mp4', '.html'), LISTING)).toBe(false)
    expect(isListingVideoPath(`${good}?x=1`, LISTING)).toBe(false)
    expect(isListingVideoPath(`/${good}`, LISTING)).toBe(false)
  })
})

describe('resolveListingVideoType', () => {
  it('keeps a type the browser already knows', () => {
    expect(resolveListingVideoType('video/quicktime', 'clip.mov')).toBe('video/quicktime')
  })

  it('falls back to the extension when the type is empty or m4v', () => {
    expect(resolveListingVideoType('', 'clip.MOV')).toBe('video/quicktime')
    expect(resolveListingVideoType('', 'clip.webm')).toBe('video/webm')
    expect(resolveListingVideoType('video/x-m4v', 'clip.m4v')).toBe('video/mp4')
  })

  it('does not let an extension override a type the browser named', () => {
    expect(resolveListingVideoType('image/png', 'clip.mp4')).toBeNull()
    expect(resolveListingVideoType('video/x-msvideo', 'clip.avi')).toBeNull()
    expect(resolveListingVideoType('', 'clip.avi')).toBeNull()
    expect(resolveListingVideoType('', 'clip')).toBeNull()
  })
})

describe('copy helpers', () => {
  it('formats the cap as 50 MB', () => {
    expect(formatMegabytes(LISTING_VIDEO_MAX_BYTES)).toBe('50 MB')
  })

  it('builds the public URL in the listing-video bucket', () => {
    expect(listingVideoPublicUrl('https://x.supabase.co', 'listings/a/video/b.mp4')).toBe(
      'https://x.supabase.co/storage/v1/object/public/listing-video/listings/a/video/b.mp4'
    )
  })
})
