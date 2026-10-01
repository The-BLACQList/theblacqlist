'use client'

import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  onChange: (value: string) => void
  id: string
  className?: string
}

/** Searches the loaded businesses by name or category. Filters as you type. */
export function MapSearchInput({ value, onChange, id, className }: Props) {
  return (
    <div className={cn('relative min-w-0 flex-1', className)}>
      <label htmlFor={id} className="sr-only">
        Search businesses on the map
      </label>
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-charcoal"
        aria-hidden="true"
      />
      <input
        id={id}
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        placeholder="Search businesses"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 w-full rounded-xl border border-hairline bg-white pl-10 pr-3 text-[15px] text-ink placeholder:text-charcoal-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
      />
    </div>
  )
}
