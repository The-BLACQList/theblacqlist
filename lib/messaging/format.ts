// Times on the inbox pages are rendered on the server, so they use one fixed
// zone (the site's convention, see lib/listings/jobPosting.ts) rather than the
// server's own clock zone, which would be UTC on Vercel.
const ZONE = 'America/New_York'

const dayKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: ZONE })

/** Inbox list: "3:42 PM" today, "Nov 12" this year, "Nov 12, 2025" before. */
export function formatListTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  if (dayKey(d) === dayKey(now)) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: ZONE })
  }
  const sameYear = d.toLocaleDateString('en-US', { year: 'numeric', timeZone: ZONE }) ===
    now.toLocaleDateString('en-US', { year: 'numeric', timeZone: ZONE })
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: ZONE,
  })
}

/** Thread bubbles: "Nov 12, 3:42 PM ET". */
export function formatMessageTime(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: ZONE })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: ZONE })
  return `${date}, ${time} ET`
}
