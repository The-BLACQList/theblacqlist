'use client'

import { CITY_VIEWS } from '@/components/map/mapStyle'
import { cn } from '@/lib/utils'

interface Props {
  citySlug: string
  onCity: (slug: string) => void
}

/** Underline tabs. They scroll sideways inside their own box, never the page. */
export function MapCityTabs({ citySlug, onCity }: Props) {
  return (
    <div
      role="group"
      aria-label="City"
      className="flex gap-5 overflow-x-auto border-b border-hairline"
    >
      {Object.entries(CITY_VIEWS).map(([slug, view]) => {
        const active = slug === citySlug
        return (
          <button
            key={slug}
            type="button"
            aria-pressed={active}
            onClick={() => onCity(slug)}
            className={cn(
              '-mb-px min-h-11 shrink-0 border-b-2 text-[14px] font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber',
              active ? 'border-ink text-ink' : 'border-transparent text-charcoal hover:text-ink'
            )}
          >
            {view.label}
          </button>
        )
      })}
    </div>
  )
}
