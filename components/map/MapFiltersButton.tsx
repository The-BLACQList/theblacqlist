'use client'

import { SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  count: number
  expanded: boolean
  onToggle: () => void
  /** Phone shows an icon only; desktop shows the word. */
  iconOnly?: boolean
  controls: string
}

export function MapFiltersButton({ count, expanded, onToggle, iconOnly, controls }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls={controls}
      aria-label={count > 0 ? `Filters, ${count} on` : 'Filters'}
      className={cn(
        'relative inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-ink/80 bg-white px-4 text-[14px] font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber',
        iconOnly && 'w-11 px-0'
      )}
    >
      <SlidersHorizontal className="size-4" aria-hidden="true" />
      {!iconOnly && 'Filters'}
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-ink text-[11px] text-white"
        >
          {count}
        </span>
      )}
    </button>
  )
}
