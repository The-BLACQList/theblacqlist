/**
 * How long an event with no end time stays up after it starts. Without this, a
 * daily run at 08:00 UTC would take down an all-day event dated midnight local
 * time about four hours into its own day.
 */
export const EVENT_NO_END_GRACE_HOURS = 24

/**
 * Whether an event is over (ticket 106). Over means the end time has passed,
 * or, with no end time, the start was more than
 * {@link EVENT_NO_END_GRACE_HOURS} ago. An event with no usable date is not
 * over, because an unknown date is not a past one.
 *
 * One rule for the nightly sweep that unpublishes past events and for the
 * owner's Events tab that files them under "Past", so the two never disagree.
 */
export function isEventOver(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  now: Date = new Date()
): boolean {
  const nowMs = now.getTime()
  if (endsAt) {
    const end = new Date(endsAt).getTime()
    return !Number.isNaN(end) && end < nowMs
  }
  if (startsAt) {
    const start = new Date(startsAt).getTime()
    return !Number.isNaN(start) && start + EVENT_NO_END_GRACE_HOURS * 60 * 60 * 1_000 < nowMs
  }
  return false
}
