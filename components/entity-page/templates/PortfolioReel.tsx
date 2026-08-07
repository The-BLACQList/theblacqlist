'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import type { GalleryImage } from '@/types'
import { cn } from '@/lib/utils'

interface Props {
  images: GalleryImage[]
}

/**
 * Horizontal featured-work reel for the Portfolio archetype (C-B "Cover
 * Story"). Scroll-snap with visible arrow controls; every frame is reachable
 * by swipe, arrows, and keyboard (the reel itself is a focusable scroll
 * region). Images are the studio's own uploaded work.
 */
export function PortfolioReel({ images }: Props) {
  const reelRef = useRef<HTMLDivElement>(null)

  function scrollByViewport(direction: 1 | -1) {
    const reel = reelRef.current
    if (!reel) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    reel.scrollBy({
      left: direction * reel.clientWidth * 0.8,
      behavior: reduceMotion ? 'auto' : 'smooth',
    })
  }

  if (images.length === 0) return null

  return (
    <div>
      <div
        ref={reelRef}
        role="region"
        aria-label="Featured work, horizontally scrollable"
        tabIndex={0}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-3 -mx-1 px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
      >
        {images.map((image, i) => (
          <figure
            key={image.id}
            className="group relative shrink-0 w-[78%] sm:w-[46%] snap-start rounded-xl overflow-hidden bg-deep-bg aspect-[16/10] m-0 transition-shadow duration-200 hover:shadow-[0_12px_36px_rgba(0,0,0,0.28)]"
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              sizes="(max-width: 640px) 78vw, 46vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              loading={i < 2 ? 'eager' : 'lazy'}
            />
            {image.alt && (
              <figcaption className="absolute inset-x-0 bottom-0 px-4 py-3 bg-gradient-to-t from-black/80 to-transparent">
                <span className="font-subhead text-[13px] font-semibold text-white">
                  {image.alt}
                </span>
              </figcaption>
            )}
          </figure>
        ))}
      </div>

      {images.length > 2 && (
        <div className="flex justify-end gap-2 mt-2">
          {(
            [
              [-1, 'Scroll work left', ArrowLeft],
              [1, 'Scroll work right', ArrowRight],
            ] as const
          ).map(([dir, label, Icon]) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              onClick={() => scrollByViewport(dir)}
              className={cn(
                'flex items-center justify-center size-11 rounded-full border-[1.5px] border-brand-black text-brand-black',
                'hover:bg-brand-black hover:text-white transition-colors duration-150',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber'
              )}
            >
              <Icon className="size-4.5" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
