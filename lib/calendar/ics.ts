// Minimal RFC 5545 iCalendar builder for a single event — no dependency.

export interface IcsInput {
  uid: string
  title: string
  start: string // ISO 8601
  end?: string | null // ISO 8601
  description?: string | null
  location?: string | null
  url?: string | null
}

/** ISO → iCalendar UTC basic format: YYYYMMDDTHHMMSSZ */
function toIcsUtc(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** Escape per RFC 5545 §3.3.11 (backslash, newline, comma, semicolon). */
function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

export function buildEventIcs(input: IcsInput): string {
  const dtstamp = toIcsUtc(new Date().toISOString())
  const dtstart = toIcsUtc(input.start)

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//theblacqlist.com//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${input.uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
  ]

  const dtend = input.end ? toIcsUtc(input.end) : ''
  if (dtend) lines.push(`DTEND:${dtend}`)

  lines.push(`SUMMARY:${escapeText(input.title)}`)
  if (input.location) lines.push(`LOCATION:${escapeText(input.location)}`)
  if (input.description) lines.push(`DESCRIPTION:${escapeText(input.description)}`)
  if (input.url) lines.push(`URL:${escapeText(input.url)}`)

  lines.push('END:VEVENT', 'END:VCALENDAR')

  return lines.join('\r\n')
}
