'use client'

import { useId, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'

interface Props {
  /** Filters set inside the group. Any above zero keeps the group open. */
  count: number
  children: ReactNode
}

/**
 * The one disclosure that holds the less-used Discover filters. A real button
 * with aria-expanded / aria-controls. It starts open when a filter inside is
 * already set, and opens again if one gets set later (a chip, a link), so an
 * active filter is never hidden. The panel is hidden rather than unmounted, so
 * each section inside keeps its own open state. Open state lives in memory only.
 */
export function MoreFilters({ count, children }: Props) {
  const panelId = useId()
  const [open, setOpen] = useState(count > 0)

  // Adjusted during render, not in an effect, so there is no closed-then-open flash.
  const [hadActive, setHadActive] = useState(count > 0)
  if ((count > 0) !== hadActive) {
    setHadActive(count > 0)
    if (count > 0) setOpen(true)
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex min-h-11 w-full items-center justify-between rounded-md py-1',
          'font-subhead text-sm font-semibold text-brand-black',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-black/40'
        )}
      >
        {count > 0 ? `More filters (${count})` : 'More filters'}
        <ChevronDown
          className={cn(
            'size-4 shrink-0 transition-transform motion-reduce:transition-none',
            open && 'rotate-180'
          )}
          aria-hidden="true"
        />
      </button>
      <div id={panelId} hidden={!open} className="flex flex-col gap-3">
        {children}
      </div>
    </div>
  )
}
