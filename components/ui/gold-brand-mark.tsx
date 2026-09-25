import Image from 'next/image'

import { cn } from '@/lib/utils'
import goldMark from '@/public/brand/blacqlist-mark-gold-256.png'

/**
 * The gold node-Q, from the founder's artwork (public/brand/blacqlist-mark-gold.svg).
 * That SVG is 187 KB with an embedded raster, so `pnpm brand:assets` renders a
 * trimmed, transparent PNG from it and this component serves that.
 *
 * Unlike BrandMark it cannot be recolored with text-* classes. Size it with h-/w-
 * classes exactly as before; the artwork is a hair narrower than it is tall and
 * `object-contain` keeps it from stretching.
 *
 * Decorative by default (empty alt). When the mark stands alone as the logo, pass
 * a `title` and it becomes the image's alt text.
 */
interface GoldBrandMarkProps {
  className?: string
  title?: string
  /** Above-the-fold logo spots (the site header) should preload. */
  preload?: boolean
}

export function GoldBrandMark({ className, title, preload = false }: GoldBrandMarkProps) {
  return (
    <Image
      src={goldMark}
      // The largest logo spot is 48px. 62×64 keeps the artwork's aspect ratio and
      // gives next/image a 1x/2x srcset that stays sharp everywhere it is used.
      width={62}
      height={64}
      alt={title ?? ''}
      aria-hidden={title ? undefined : true}
      preload={preload}
      className={cn('h-7 w-7 object-contain', className)}
    />
  )
}
