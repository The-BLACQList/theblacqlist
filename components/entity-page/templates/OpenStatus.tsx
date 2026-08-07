'use client'

import type { WeeklyHours } from '@/types'
import { isOpenNow } from '@/lib/listings/openStatus'
import { cn } from '@/lib/utils'

interface Props {
  hours: WeeklyHours | null
  /** dark = hero (gold-on-dark greens); light = info rail */
  surface: 'light' | 'dark'
  className?: string
}

/**
 * Live open/closed indicator for the microsite templates, using the
 * semantic success tokens (success on light surfaces, success-on-dark on
 * dark). Client-side so the status reflects the viewer's clock rather
 * than the ISR render time.
 */
export function OpenStatus({ hours, surface, className }: Props) {
  if (!hours) return null
  // suppressHydrationWarning is intentional: time differs between server and client renders.
  const status = isOpenNow(hours)

  return (
    <span
      suppressHydrationWarning
      className={cn(
        'inline-flex items-center gap-1.5 font-subhead text-sm font-semibold',
        status.open
          ? surface === 'dark'
            ? 'text-success-on-dark'
            : 'text-success'
          : surface === 'dark'
            ? 'text-off-white/70'
            : 'text-charcoal-soft',
        className
      )}
    >
      <span
        suppressHydrationWarning
        className={cn(
          'size-2 rounded-full',
          status.open
            ? surface === 'dark'
              ? 'bg-success-on-dark'
              : 'bg-success'
            : surface === 'dark'
              ? 'bg-off-white/40'
              : 'bg-charcoal/40'
        )}
        aria-hidden="true"
      />
      {status.label}
    </span>
  )
}
