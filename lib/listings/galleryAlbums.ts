import type { GalleryImage } from '@/types'

/**
 * Album names in order of first appearance, with blanks and nulls dropped
 * (ticket 193). The gallery shows chips only when there are two or more.
 */
export function galleryAlbums(images: readonly GalleryImage[]): string[] {
  const seen = new Set<string>()
  for (const img of images) {
    const album = img.album?.trim()
    if (album) seen.add(album)
  }
  return [...seen]
}

/** The images filed under `album`; `null` means every image. */
export function filterByAlbum(
  images: readonly GalleryImage[],
  album: string | null
): GalleryImage[] {
  if (album === null) return [...images]
  return images.filter((img) => img.album?.trim() === album)
}
