import Image from 'next/image'
import { cn } from '@/lib/utils'
import { ImageFallback } from '@/components/media/ImageFallback'

interface Props {
  src: string | null
  alt: string
  /** Listing name — used for the designed fallback monogram when src is null */
  name: string
  categoryName?: string | null
  priority?: boolean
  sizes?: string
  /** Adaptive text scrim for content overlaid on the photo */
  scrim?: 'bottom' | 'none'
  fallbackSize?: 'hero' | 'card'
  className?: string
}

/**
 * Photographic cover primitive (Living Commerce Index, phase 1).
 * Fill-mode next/image with an adaptive bottom scrim for overlaid text,
 * degrading to the designed F-1 ImageFallback when no verified image exists.
 * Parent must be `relative` with an explicit height or aspect ratio.
 */
export function CoverImage({
  src,
  alt,
  name,
  categoryName,
  priority = false,
  sizes = '100vw',
  scrim = 'none',
  fallbackSize = 'hero',
  className,
}: Props) {
  return (
    <>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          className={cn('object-cover', className)}
        />
      ) : (
        <ImageFallback name={name} categoryName={categoryName} size={fallbackSize} />
      )}

      {scrim === 'bottom' && (
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to top, rgba(4,4,5,0.88) 0%, rgba(4,4,5,0.45) 42%, rgba(4,4,5,0.10) 70%, transparent 100%)',
          }}
          aria-hidden="true"
        />
      )}
    </>
  )
}
