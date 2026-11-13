import { CalendarClock } from 'lucide-react'
import { formatOverrideDate, sortOverrides } from '@/lib/listings/hoursOverrides'
import { formatTime } from '@/lib/listings/openStatus'
import type { HoursOverride } from '@/types'

interface Props {
  overrides: HoursOverride[]
}

/**
 * Holiday and one-off hours under the weekly table (ticket 196). The loader
 * hands over the next 30 days; this lists them soonest first.
 */
export function EntityHoursOverrides({ overrides }: Props) {
  if (overrides.length === 0) return null
  return (
    <div className="mt-4" data-testid="hours-overrides">
      <p className="inline-flex items-center gap-1.5 font-subhead text-xs font-semibold text-charcoal uppercase tracking-wide mb-1.5">
        <CalendarClock className="size-3.5 text-amber" aria-hidden="true" />
        Special hours
      </p>
      <ul className="list-none p-0 m-0 text-sm font-body text-charcoal">
        {sortOverrides(overrides).map((o) => (
          <li
            key={o.date}
            className="flex items-baseline justify-between gap-3 py-1 border-b border-charcoal/8 last:border-0"
          >
            <span>
              <time dateTime={o.date} className="font-subhead font-medium">
                {formatOverrideDate(o.date)}
              </time>
              {o.label && <span className="text-charcoal-soft"> · {o.label}</span>}
            </span>
            <span className="shrink-0">
              {o.closed
                ? 'Closed'
                : o.open && o.close
                  ? `${formatTime(o.open)} – ${formatTime(o.close)}`
                  : 'Hours vary'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
