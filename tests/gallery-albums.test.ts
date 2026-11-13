import { describe, expect, it } from 'vitest'

import { filterByAlbum, galleryAlbums } from '@/lib/listings/galleryAlbums'
import type { GalleryImage } from '@/types'

const img = (id: string, album?: string | null): GalleryImage => ({
  id,
  src: `/images/example/${id}.webp`,
  alt: id,
  ...(album === undefined ? {} : { album }),
})

describe('galleryAlbums', () => {
  it('lists each album once, in order of first appearance', () => {
    const images = [img('a', 'Food'), img('b', 'Drinks'), img('c', 'Food'), img('d', 'Interior')]
    expect(galleryAlbums(images)).toEqual(['Food', 'Drinks', 'Interior'])
  })

  it('ignores photos with no album, a null album or a blank one', () => {
    const images = [img('a'), img('b', null), img('c', '   '), img('d', 'Food')]
    expect(galleryAlbums(images)).toEqual(['Food'])
  })

  it('is empty for a live page, whose loader sets no album', () => {
    expect(galleryAlbums([img('a'), img('b')])).toEqual([])
    expect(galleryAlbums([])).toEqual([])
  })
})

describe('filterByAlbum', () => {
  const images = [img('a', 'Food'), img('b', 'Drinks'), img('c', 'Food'), img('d')]

  it('returns a copy of every photo for the "All" chip', () => {
    const all = filterByAlbum(images, null)
    expect(all).toEqual(images)
    expect(all).not.toBe(images)
  })

  it('keeps only the photos filed under the album, in gallery order', () => {
    expect(filterByAlbum(images, 'Food').map((i) => i.id)).toEqual(['a', 'c'])
    expect(filterByAlbum(images, 'Drinks').map((i) => i.id)).toEqual(['b'])
  })

  it('returns nothing for an album no photo is filed under', () => {
    expect(filterByAlbum(images, 'Events')).toEqual([])
  })
})
