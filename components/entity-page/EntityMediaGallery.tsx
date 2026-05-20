'use client'

import { useState } from 'react'
import Image from 'next/image'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import type { EntityPageData, GalleryImage } from '@/types'

interface Props {
  entity: EntityPageData
  images?: GalleryImage[]
}

export function EntityMediaGallery({ entity, images }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  // Hidden entirely if no images — spec rule
  if (!images || images.length === 0) return null

  const openLightbox = (index: number) => setLightboxIndex(index)
  const closeLightbox = () => setLightboxIndex(null)
  const prev = () =>
    setLightboxIndex((i) => (i !== null ? (i - 1 + images.length) % images.length : null))
  const next = () => setLightboxIndex((i) => (i !== null ? (i + 1) % images.length : null))

  const currentImage = lightboxIndex !== null ? images[lightboxIndex] : null

  return (
    <section aria-labelledby="gallery-heading" className="bg-deep-bg py-12 md:py-16">
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8">
        <h2
          id="gallery-heading"
          className="font-headline text-[22px] md:text-[28px] text-white mb-8"
        >
          Gallery
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => openLightbox(i)}
              className="relative aspect-square overflow-hidden rounded-lg group focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-gold"
              aria-label={`View photo ${i + 1} of ${images.length}${img.alt ? `: ${img.alt}` : ''}`}
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

          {images.length > 1 && (
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

          <p className="absolute bottom-4 left-0 right-0 text-center font-subhead text-sm text-white/60">
            {lightboxIndex + 1} / {images.length}
          </p>
        </div>
      )}
    </section>
  )
}
