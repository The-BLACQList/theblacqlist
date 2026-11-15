// Booking requests (ticket 109): the rules both sides share. Request-and-
// confirm, never instant booking: a visitor asks, the owner answers, and the
// visitor hears back by email. Plain functions only, so the form, the owner's
// inbox and the server actions all check the same way the table's CHECKs do
// (supabase/migrations/20261121000000_booking_requests.sql).

export const BOOKING_NAME_MAX = 80
export const BOOKING_EMAIL_MAX = 254
export const BOOKING_PHONE_MAX = 30
export const BOOKING_NOTE_MAX = 1000
export const BOOKING_PROMPT_MAX = 200
export const BOOKING_REPLY_MAX = 500
export const BOOKING_PARTY_MAX = 500
/** How far ahead a visitor may ask for, in days. */
export const BOOKING_DAYS_AHEAD = 365

/** Requests a page's inbox shows. Older ones stay in the database. */
export const BOOKING_INBOX_MAX = 200

export const TIME_WINDOWS = ['any', 'morning', 'afternoon', 'evening'] as const
export type TimeWindow = (typeof TIME_WINDOWS)[number]

export const TIME_WINDOW_LABELS: Record<TimeWindow, string> = {
  any: 'Any time',
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
}

export const BOOKING_STATUSES = [
  'pending',
  'accepted',
  'declined',
  'proposed',
  'cancelled',
] as const
export type BookingStatus = (typeof BOOKING_STATUSES)[number]

export const BOOKING_UNAVAILABLE = 'This business isn’t taking requests right now.'
/** Per visitor IP: five requests an hour, across every page. */
export const BOOKING_IP_LIMIT = { limit: 5, windowSeconds: 60 * 60 } as const
/**
 * Per email address typed: three a day. Each request emails that address, so
 * this is what stops someone using the form to flood a stranger's inbox.
 */
export const BOOKING_EMAIL_LIMIT = { limit: 3, windowSeconds: 24 * 60 * 60 } as const

/** What the owner can answer. */
export type BookingDecision = 'accept' | 'decline' | 'propose'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// One @, something on each side, a dot in the domain, no spaces. The real
// check is the visitor getting the email.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

function oneLine(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

// ── The visitor's request ────────────────────────────────────────────────────

export interface BookingRequestInput {
  name: unknown
  email: unknown
  phone: unknown
  serviceId: unknown
  requestedDate: unknown
  timeWindow: unknown
  partySize: unknown
  note: unknown
}

export interface ParsedBookingRequest {
  requester_name: string
  requester_email: string
  requester_phone: string | null
  service_id: string | null
  requested_date: string | null
  time_window: TimeWindow
  party_size: number | null
  note: string | null
}

export type BookingFieldErrors = Partial<
  Record<'name' | 'email' | 'phone' | 'requested_date' | 'party_size' | 'message', string>
>

export type ParsedBookingResult =
  | { ok: true; value: ParsedBookingRequest }
  | { ok: false; fieldErrors: BookingFieldErrors }

/** YYYY-MM-DD in UTC for `date`. */
export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * The visitor's form, checked. `today` is the server's UTC date; a visitor a
 * day behind UTC can still ask for their own today, so one day of slack is
 * allowed on the early side.
 */
export function parseBookingRequest(input: BookingRequestInput, now: Date): ParsedBookingResult {
  const fieldErrors: BookingFieldErrors = {}

  const name = oneLine(input.name)
  if (!name) fieldErrors.name = 'Add your name.'
  else if (name.length > BOOKING_NAME_MAX) {
    fieldErrors.name = `Keep your name to ${BOOKING_NAME_MAX} characters.`
  }

  const email = oneLine(input.email).toLowerCase()
  if (!email) fieldErrors.email = 'Add your email so they can reply.'
  else if (email.length > BOOKING_EMAIL_MAX || !EMAIL_RE.test(email)) {
    fieldErrors.email = 'Check your email address.'
  }

  const phone = oneLine(input.phone)
  const digits = phone.replace(/\D/g, '')
  if (
    phone &&
    (phone.length > BOOKING_PHONE_MAX || digits.length < 7 || /[^\d\s()+.-]/.test(phone))
  ) {
    fieldErrors.phone = 'Check your phone number, or leave it blank.'
  }

  let requestedDate: string | null = null
  const rawDate = oneLine(input.requestedDate)
  if (rawDate) {
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? new Date(`${rawDate}T00:00:00Z`) : null
    const earliest = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const latest = new Date(now.getTime() + BOOKING_DAYS_AHEAD * 24 * 60 * 60 * 1000)
    if (!parsed || Number.isNaN(parsed.getTime()) || isoDay(parsed) !== rawDate) {
      fieldErrors.requested_date = 'Pick a date.'
    } else if (rawDate < isoDay(earliest)) {
      fieldErrors.requested_date = 'Pick a date from today on.'
    } else if (rawDate > isoDay(latest)) {
      fieldErrors.requested_date = 'Pick a date within the next year.'
    } else {
      requestedDate = rawDate
    }
  }

  const rawWindow = oneLine(input.timeWindow)
  const timeWindow: TimeWindow = (TIME_WINDOWS as readonly string[]).includes(rawWindow)
    ? (rawWindow as TimeWindow)
    : 'any'

  let partySize: number | null = null
  const rawParty = oneLine(input.partySize)
  if (rawParty) {
    const n = Number(rawParty)
    if (!Number.isInteger(n) || n < 1 || n > BOOKING_PARTY_MAX) {
      fieldErrors.party_size = `Enter a number from 1 to ${BOOKING_PARTY_MAX}.`
    } else {
      partySize = n
    }
  }

  const note = typeof input.note === 'string' ? input.note.trim() : ''
  if (note.length > BOOKING_NOTE_MAX) {
    fieldErrors.message = `Keep your note to ${BOOKING_NOTE_MAX} characters.`
  }

  const serviceId = isUuid(input.serviceId) ? input.serviceId : null

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors }
  return {
    ok: true,
    value: {
      requester_name: name,
      requester_email: email,
      requester_phone: phone || null,
      service_id: serviceId,
      requested_date: requestedDate,
      time_window: timeWindow,
      party_size: partySize,
      note: note || null,
    },
  }
}

// ── The owner's settings ─────────────────────────────────────────────────────

export interface BookingSettings {
  enabled: boolean
  prompt: string | null
  ask_date: boolean
  ask_party_size: boolean
}

export const DEFAULT_BOOKING_SETTINGS: BookingSettings = {
  enabled: false,
  prompt: null,
  ask_date: true,
  ask_party_size: false,
}

/** A settings row from the database, or the defaults when there is none. */
export function toBookingSettings(row: unknown): BookingSettings {
  if (!row || typeof row !== 'object') return { ...DEFAULT_BOOKING_SETTINGS }
  const r = row as Record<string, unknown>
  return {
    enabled: r.enabled === true,
    prompt: typeof r.prompt === 'string' && r.prompt.trim() ? r.prompt.trim() : null,
    ask_date: r.ask_date !== false,
    ask_party_size: r.ask_party_size === true,
  }
}

export function parseBookingSettings(input: {
  enabled: unknown
  prompt: unknown
  askDate: unknown
  askPartySize: unknown
}): { ok: true; value: BookingSettings } | { ok: false; error: string } {
  const prompt = oneLine(input.prompt)
  if (prompt.length > BOOKING_PROMPT_MAX) {
    return { ok: false, error: `Keep the line above the form to ${BOOKING_PROMPT_MAX} characters.` }
  }
  return {
    ok: true,
    value: {
      enabled: input.enabled === true,
      prompt: prompt || null,
      ask_date: input.askDate === true,
      ask_party_size: input.askPartySize === true,
    },
  }
}

// ── The owner's inbox ────────────────────────────────────────────────────────

export const BOOKING_REQUEST_COLUMNS =
  'id, requester_name, requester_email, requester_phone, service_id, requested_date, time_window, party_size, note, status, owner_reply, responded_at, created_at'

export interface OwnerBookingRequest {
  id: string
  requester_name: string
  requester_email: string
  requester_phone: string | null
  service_id: string | null
  requested_date: string | null
  time_window: TimeWindow
  party_size: number | null
  note: string | null
  status: BookingStatus
  owner_reply: string | null
  responded_at: string | null
  created_at: string
}

/** Rows from the database, checked, newest first. Bad rows are dropped. */
export function toOwnerBookings(rows: unknown): OwnerBookingRequest[] {
  if (!Array.isArray(rows)) return []
  const out: OwnerBookingRequest[] = []
  for (const r of rows as Record<string, unknown>[]) {
    if (
      typeof r?.id !== 'string' ||
      typeof r.requester_name !== 'string' ||
      typeof r.requester_email !== 'string' ||
      typeof r.created_at !== 'string' ||
      !(BOOKING_STATUSES as readonly unknown[]).includes(r.status)
    ) {
      continue
    }
    out.push({
      id: r.id,
      requester_name: r.requester_name,
      requester_email: r.requester_email,
      requester_phone: typeof r.requester_phone === 'string' ? r.requester_phone : null,
      service_id: typeof r.service_id === 'string' ? r.service_id : null,
      requested_date: typeof r.requested_date === 'string' ? r.requested_date : null,
      time_window: (TIME_WINDOWS as readonly unknown[]).includes(r.time_window)
        ? (r.time_window as TimeWindow)
        : 'any',
      party_size: typeof r.party_size === 'number' ? r.party_size : null,
      note: typeof r.note === 'string' ? r.note : null,
      status: r.status as BookingStatus,
      owner_reply: typeof r.owner_reply === 'string' ? r.owner_reply : null,
      responded_at: typeof r.responded_at === 'string' ? r.responded_at : null,
      created_at: r.created_at,
    })
  }
  return out.sort((a, b) =>
    a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0
  )
}

/** The owner can answer a request that is waiting, or change their mind on a suggestion. */
export function canRespond(status: BookingStatus): boolean {
  return status === 'pending' || status === 'proposed'
}

export const DECISION_STATUS: Record<BookingDecision, BookingStatus> = {
  accept: 'accepted',
  decline: 'declined',
  propose: 'proposed',
}

export function parseBookingReply(
  decision: unknown,
  reply: unknown
): { ok: true; decision: BookingDecision; reply: string | null } | { ok: false; error: string } {
  if (decision !== 'accept' && decision !== 'decline' && decision !== 'propose') {
    return { ok: false, error: 'Pick Accept, Decline or Suggest Another Time.' }
  }
  const text = typeof reply === 'string' ? reply.trim() : ''
  if (text.length > BOOKING_REPLY_MAX) {
    return { ok: false, error: `Keep your note to ${BOOKING_REPLY_MAX} characters.` }
  }
  if (decision === 'propose' && !text) {
    return { ok: false, error: 'Say which time works for you.' }
  }
  return { ok: true, decision, reply: text || null }
}

/** "Sat, Dec 6 · Morning", "Any day · Evening", for emails and the inbox. */
export function whenLabel(requestedDate: string | null, timeWindow: TimeWindow): string {
  const day = requestedDate
    ? new Date(`${requestedDate}T12:00:00Z`).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      })
    : 'Any day'
  return `${day} · ${TIME_WINDOW_LABELS[timeWindow]}`
}
