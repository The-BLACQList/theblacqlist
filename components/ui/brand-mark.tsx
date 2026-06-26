import { cn } from '@/lib/utils'

/**
 * The BLACQList node-Q mark (2026 brand refresh).
 * Single-color, recolorable via `currentColor` — set the color with a text-* class
 * (e.g. `text-gold` on dark, `text-brand-black` on light). Paths transcribed from
 * the delivered `blacqlist-mark-*.svg`; viewBox cropped tight to the mark.
 *
 * Decorative by default (aria-hidden). When the mark stands alone as the logo,
 * pass an accessible `title`.
 */
interface BrandMarkProps {
  className?: string
  title?: string
}

export function BrandMark({ className, title }: BrandMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="140 45 700 705"
      className={cn('h-7 w-7', className)}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      {/* Q ring */}
      <path
        transform="matrix(0.749908, 0, 0, 0.749908, 202.884895, 114.15935)"
        fill="none"
        stroke="currentColor"
        strokeWidth="140"
        strokeLinecap="butt"
        strokeLinejoin="miter"
        strokeMiterlimit="4"
        d="M 361.328168 0.00107577 C 161.772349 0.00107577 0.0024322 160.651063 0.0024322 358.821295 C 0.0024322 556.991527 161.772349 717.636305 361.328168 717.636305 C 560.883987 717.636305 722.653904 556.991527 722.653904 358.821295 C 722.653904 160.651063 560.883987 0.00107577 361.328168 0.00107577 Z M 361.328168 0.00107577 "
      />
      {/* Center node */}
      <circle fill="currentColor" cx="473.85" cy="385.1" r="90.35" />
      {/* Tail connector */}
      <path
        transform="matrix(0.51528, 0.544837, -0.544837, 0.51528, 526.840776, 429.252805)"
        fill="none"
        stroke="currentColor"
        strokeWidth="32"
        strokeLinecap="butt"
        strokeLinejoin="miter"
        strokeMiterlimit="4"
        d="M 0.000327983 15.997333 L 364.5715 15.998903 "
      />
      {/* Outer network node */}
      <circle fill="currentColor" cx="737.3" cy="668.8" r="45.4" />
    </svg>
  )
}
