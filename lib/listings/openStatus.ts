import type { DayHours, WeeklyHours } from '@/types'

const DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

export function formatTime(t: string): string {
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr ?? '0')
  const m = mStr ?? '00'
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${m} ${suffix}`
}

/**
 * Open/closed status from a listing's weekly hours, evaluated in the
 * viewer's local time — call from client components only (the same
 * pattern as EntityAtAGlance's indicator).
 */
export function isOpenNow(hours: WeeklyHours): { open: boolean; label: string } {
  const now = new Date()
  const dayIndex = now.getDay() // 0=Sun, 1=Mon, ...
  const dayKey = DAYS[dayIndex === 0 ? 6 : dayIndex - 1] as (typeof DAYS)[number]
  const today: DayHours = hours[dayKey]

  if (today.closed) return { open: false, label: 'Closed today' }

  const [oh, om] = today.open.split(':').map(Number)
  const [ch, cm] = today.close.split(':').map(Number)
  const nowMins = now.getHours() * 60 + now.getMinutes()
  const openMins = (oh ?? 0) * 60 + (om ?? 0)
  const closeMins = (ch ?? 0) * 60 + (cm ?? 0)

  if (nowMins >= openMins && nowMins < closeMins) {
    return { open: true, label: `Open · Closes ${formatTime(today.close)}` }
  }
  if (nowMins < openMins) {
    return { open: false, label: `Closed · Opens ${formatTime(today.open)}` }
  }
  return { open: false, label: 'Closed now' }
}
