'use client'

import { useState } from 'react'
import Image from 'next/image'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { SectionMark } from '@/components/entity-page/SectionMark'
import { filterByAlbum, galleryAlbums } from '@/lib/listings/galleryAlbums'
import type { EntityRenderMode } from '@/lib/entity-page/template'
import type { EntityPageData, GalleryImage } from '@/types'

interface Props {
  entity: EntityPageData
  images?: GalleryImage[]
  /**
   * Captions (the alt text, on hover and in the lightbox) show in example mode
   * only until ticket 189 turns them on for live pages. Album chips need no
   * gate: the live loader sets no `album`, so they never appear there.
   */
  mode?: EntityRenderMode
}

function AlbumChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full px-4 font-subhead text-xs font-bold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
        active ? 'bg-gold text-brand-black' : 'bg-white/10 text-white/85 hover:bg-white/20'
      }`}
    >
      {label}
      <span className={`font-medium ${active ? 'text-brand-black/70' : 'text-white/55'}`}>
        {count}
      </span>
    </button>
  )
}

export function EntityMediaGallery({ entity, images, mode = 'live' }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [activeAlbum, setActiveAlbum] = useState<string | null>(null)

  // Hidden entirely if no images — spec rule
  if (!images || images.length === 0) return null

  const showCaptions = mode === 'example'
  const albums = galleryAlbums(images)
  const shown = filterByAlbum(images, activeAlbum)
  const selectAlbum = (album: string | null) => {
    setActiveAlbum(album)
    setLightboxIndex(null)
  }

  const openLightbox = (index: number) => setLightboxIndex(index)
  const closeLightbox = () => setLightboxIndex(null)
  const prev = () =>
    setLightboxIndex((i) => (i !== null ? (i - 1 + shown.length) % shown.length : null))
  const next = () => setLightboxIndex((i) => (i !== null ? (i + 1) % shown.length : null))

  const currentImage = lightboxIndex !== null ? shown[lightboxIndex] : null

  return (
    <section aria-labelledby="gallery-heading" className="bg-deep-bg py-12 md:py-16">
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8">
        <h2
          id="gallery-heading"
          className="font-headline text-[22px] md:text-[28px] text-white mb-8"
        >
          Gallery
        </h2>

        {albums.length >= 2 && (
          <SectionMark id="albums">
            <div
              data-testid="gallery-albums"
              role="group"
              aria-label="Photo albums"
              className="mb-6 flex flex-wrap gap-2"
            >
              <AlbumChip
                label="All"
                count={images.length}
                active={activeAlbum === null}
                onClick={() => selectAlbum(null)}
              />
              {albums.map((album) => (
                <AlbumChip
                  key={album}
                  label={album}
                  count={filterByAlbum(images, album).length}
                  active={activeAlbum === album}
                  onClick={() => selectAlbum(album)}
                />
              ))}
            </div>
          </SectionMark>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
          {shown.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => openLightbox(i)}
              className="relative aspect-square overflow-hidden rounded-lg group focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-gold"
              aria-label={`View photo ${i + 1} of ${shown.length}${img.alt ? `: ${img.alt}` : ''}`}
            >
              <Image
                src={img.src}
                alt={img.alt || ''}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
                sizes="(max-width: 640px) 50vw, 33vw"
              />
              <div
                className="absolute inset-0 bg-brand-black/0 group-hover:bg-brand-black/20 transition-colors"
                aria-hidden="true"
              />
              {showCaptions && img.alt && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-black/85 to-transparent px-3 pb-2.5 pt-8 text-left font-body text-xs leading-snug text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 line-clamp-2"
                >
                  {img.alt}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && currentImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Photo gallery for ${entity.name}`}
          className="fixed inset-0 z-50 bg-brand-black/95 flex items-center justify-center"
          onClick={closeLightbox}
        >
          <button
            type="button"
            onClick={closeLightbox}
            aria-label="Close gallery"
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors z-10"
          >
            <X className="size-6" aria-hidden="true" />
          </button>

          {shown.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  prev()
                }}
                aria-label="Previous photo"
                className="absolute left-4 text-white/70 hover:text-white transition-colors z-10 p-2"
              >
                <ChevronLeft className="size-8" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  next()
                }}
                aria-label="Next photo"
                className="absolute right-14 md:right-4 text-white/70 hover:text-white transition-colors z-10 p-2"
              >
                <ChevronRight className="size-8" aria-hidden="true" />
              </button>
            </>
          )}

          <div
            className="relative max-w-[90vw] max-h-[85vh] w-[90vw] h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={currentImage.src}
              alt={currentImage.alt || ''}
              fill
              className="object-contain rounded-lg"
              sizes="90vw"
            />
          </div>

          <div className="absolute bottom-4 left-0 right-0 px-6 text-center">
            {showCaptions && currentImage.alt && (
              <p className="mx-auto mb-1 max-w-2xl font-body text-sm text-white/90">
                {currentImage.alt}
              </p>
            )}
            <p className="font-subhead text-sm text-white/60">
              {lightboxIndex + 1} / {shown.length}
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
