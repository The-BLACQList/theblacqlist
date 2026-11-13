import Image from 'next/image'
import { cn } from '@/lib/utils'
import type { ResolvedImage } from '@/types'

interface Props {
  logo: ResolvedImage
  /** Business name, for the alt text when the image has none of its own. */
  name: string
  size?: 'hero' | 'compact'
  className?: string
}

const SIZES: Record<NonNullable<Props['size']>, string> = {
  hero: 'size-16 md:size-20',
  compact: 'size-10',
}

const PX: Record<NonNullable<Props['size']>, number> = {
  hero: 80,
  compact: 40,
}

/**
 * The listing's logo as a rounded mark with a white ring, so it reads on a
 * photograph or on the dark fallback ground alike (ticket 184; wired to the
 * live loader in ticket 185). Only claimed listings ever carry one — the
 * registry gates `logo` on `requiresClaimed`.
 */
export function EntityLogo({ logo, name, size = 'hero', className }: Props) {
  return (
    <span
      className={cn(
        'relative inline-block shrink-0 overflow-hidden rounded-2xl bg-white ring-2 ring-white/90 shadow-md',
        SIZES[size],
        className
      )}
    >
      <Image
        src={logo.src}
        alt={logo.alt || `${name} logo`}
        width={PX[size]}
        height={PX[size]}
        className="size-full object-cover"
        unoptimized={logo.unoptimized}
      />
    </span>
  )
}
