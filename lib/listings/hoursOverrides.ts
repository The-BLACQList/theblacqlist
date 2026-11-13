import type { DayHours, HoursOverride } from '@/types'

/**
 * Holiday and one-off hours (ticket 196). Pure helpers shared by the open/closed
 * status, the Visit block, the fixtures and the tests. Dates are `YYYY-MM-DD`
 * keys in the listing's local calendar, which is also the viewer's for a shop
 * you can walk into, so they compare as strings.
 */

const pad = (n: number) => String(n).padStart(2, '0')

/** The date key for `now` in local time. */
export function localDateKey(now: Date): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** `days` after `now`, as a date key. Fixtures use it so sample overrides never go stale. */
export function futureDateKey(now: Date, days: number): string {
  const d = new Date(now)
  d.setDate(d.getDate() + days)
  return localDateKey(d)
}

/** Today's override, if the owner set one. */
export function overrideFor(
  overrides: readonly HoursOverride[] | undefined,
  now: Date
): HoursOverride | null {
  if (!overrides?.length) return null
  const key = localDateKey(now)
  return overrides.find((o) => o.date === key) ?? null
}

/** Soonest first; the input is not mutated. */
export function sortOverrides(overrides: readonly HoursOverride[]): HoursOverride[] {
  return [...overrides].sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Today through `days` ahead, soonest first. Ticket 196's loader applies this
 * before the page sees the list, so the page shows what it is handed and the
 * server and client never disagree about the window.
 */
export function upcomingOverrides(
  overrides: readonly HoursOverride[] | undefined,
  now: Date,
  days = 30
): HoursOverride[] {
  if (!overrides?.length) return []
  const from = localDateKey(now)
  const to = futureDateKey(now, days)
  return sortOverrides(overrides.filter((o) => o.date >= from && o.date <= to))
}

/**
 * The day's hours under an override: closed, or its own times. Null when an
 * open override has no times (bad data), so callers fall back to the week.
 */
export function overrideDayHours(o: HoursOverride): DayHours | null {
  if (o.closed) return { open: '00:00', close: '00:00', closed: true }
  if (!o.open || !o.close) return null
  return { open: o.open, close: o.close, closed: false }
}

/** "Thu, Nov 26". Parsed as local noon so the day never shifts across time zones. */
export function formatOverrideDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}
