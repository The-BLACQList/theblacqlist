'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'

interface FilterSectionProps {
  title: string
  /** A filter in this section is set. The section opens, and reopens if one gets set later. */
  active?: boolean
  /** Open on first render even with nothing selected (Type, Category). */
  defaultOpen?: boolean
  children: ReactNode
}

/**
 * One collapsible block of the discover sidebar. A native <details>, so it opens
 * with Enter or Space on the summary and needs no script to work.
 *
 * Controls inside keep their own role="group" / aria-label, so a section being
 * collapsed never changes what a control is called.
 */
export function FilterSection({ title, active = false, defaultOpen = false, children }: FilterSectionProps) {
  const [open, setOpen] = useState(defaultOpen || active)

  // A filter chosen somewhere else (a chip, a link, the mobile sheet) opens the
  // section that holds it. Adjusted during render rather than in an effect, so
  // there is no closed-then-open flash.
  const [wasActive, setWasActive] = useState(active)
  if (active !== wasActive) {
    setWasActive(active)
    if (active) setOpen(true)
  }

  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="group border-b border-charcoal/10 pb-3 last:border-b-0"
    >
      <summary
        className={cn(
          'flex cursor-pointer list-none items-center justify-between rounded-md py-1',
          'font-subhead text-xs font-semibold uppercase tracking-wide text-charcoal',
          'hover:text-brand-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-black/40',
          '[&::-webkit-details-marker]:hidden'
        )}
      >
        {title}
        <ChevronDown
          className="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </summary>
      <div className="pt-2">{children}</div>
    </details>
  )
}
