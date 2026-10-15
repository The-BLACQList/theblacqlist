import type { DayHours, WeeklyHours } from '@/types'

// =============================================================================
// Weekly hours: one shape check for every writer (ticket 127)
// =============================================================================
// `listing_details_business.hours` is jsonb, so the database accepts anything.
// `isOpenNow` reads `hours[day].closed` for every day, so a missing day crashes
// the page. Every path that saves hours (the dashboard, /add-business, the site
// import) runs through `parseWeeklyHours` first.
// =============================================================================

export const WEEK_DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

export type WeekDay = (typeof WEEK_DAYS)[number]

const TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/

/** "HH:MM" or "HH:MM:SS" (a time input with seconds) becomes "HH:MM". */
function normalizeTime(value: unknown): string | null {
  if (typeof value !== 'string' || !TIME.test(value)) return null
  return value.slice(0, 5)
}

function parseDay(value: unknown): DayHours | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.closed !== 'boolean') return null
  const open = normalizeTime(record.open)
  const close = normalizeTime(record.close)
  // A closed day's times are never shown, so a cleared time box is fine there.
  if (record.closed) return { open: open ?? '09:00', close: close ?? '17:00', closed: true }
  if (!open || !close) return null
  return { open, close, closed: false }
}

/**
 * Returns a clean `WeeklyHours` when `value` has all seven days in the right
 * shape, otherwise null. Extra keys are dropped.
 */
export function parseWeeklyHours(value: unknown): WeeklyHours | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const source = value as Record<string, unknown>
  const out: Partial<WeeklyHours> = {}
  for (const day of WEEK_DAYS) {
    const parsed = parseDay(source[day])
    if (!parsed) return null
    out[day] = parsed
  }
  return out as WeeklyHours
}
