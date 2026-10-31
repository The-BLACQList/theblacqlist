// =============================================================================
// Reading a receipt photo (ticket 163): checking the answer and finding the shop
// =============================================================================
// The model call lives in lib/actions/spend/readReceiptPhoto.ts. This file is
// the pure half, so it can be tested without a model or a database:
//
//   * parseReceiptRead turns the model's JSON into fields the form can use, and
//     drops anything the form would refuse anyway (a $0 total, a total over
//     the $10,000 cap, a date in the future or past the 90-day window);
//   * scoreListingMatch and pickMatches compare what was read with candidate
//     listings. Phone and ZIP help pick the right shop; they are never sent
//     back to the browser or stored.
//
// Every field this fills is a suggestion. The form marks it "From your photo"
// and the shopper can change it.
// =============================================================================

import { z } from 'zod'

import { nameTokens, normalizeBusinessName } from '@/lib/spend/business-name'
import { isoDay, MAX_RECEIPT_AMOUNT_CENTS, receiptDateBounds } from '@/lib/spend/receipt-input'

/** The hint under every field the read filled. */
export const FROM_PHOTO_LABEL = 'From your photo'

/** Photos the read takes. HEIC and PDF still upload; they just aren't read. */
const READABLE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function isReadablePhoto(file: { type: string }): boolean {
  return READABLE_TYPES.has(file.type)
}

/** The shape the model is held to (see RECEIPT_READ_JSON_SCHEMA). */
export const receiptReadSchema = z.object({
  business_name: z.string().nullable(),
  phone: z.string().nullable(),
  street_address: z.string().nullable(),
  zip: z.string().nullable(),
  total: z.string().nullable(),
  date: z.string().nullable(),
})

export type RawReceiptRead = z.infer<typeof receiptReadSchema>

/** What survived the checks. Every field is optional: a blank is left for the shopper. */
export interface ReceiptRead {
  businessName: string | null
  /** Digits only, last ten. Used for matching only. */
  phone: string | null
  /** First five digits. Used for matching only. */
  zip: string | null
  amountCents: number | null
  purchaseDate: string | null
}

const MAX_NAME_CHARS = 120

function cleanText(value: string | null, max: number): string | null {
  if (value === null) return null
  const trimmed = value.replace(/\s+/g, ' ').trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

/** "$1,234.50", "1234.5" or "23" in dollars, to cents. Null when it isn't a sane total. */
export function parseTotalToCents(value: string | null): number | null {
  if (value === null) return null
  const cleaned = value.replace(/[$,\s]/g, '')
  if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) return null
  const cents = Math.round(parseFloat(cleaned) * 100)
  if (!Number.isFinite(cents) || cents <= 0 || cents > MAX_RECEIPT_AMOUNT_CENTS) return null
  return cents
}

function isRealIsoDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !isNaN(parsed.getTime()) && isoDay(parsed) === value
}

function shiftIsoDay(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return isoDay(d)
}

/**
 * A purchase date the form would take. The server only knows UTC, so this
 * allows a day either side like parseReceiptFields does; the form then holds
 * it to the shopper's own calendar before filling the field.
 */
export function checkReadDate(value: string | null, today: Date): string | null {
  if (value === null) return null
  const day = value.trim()
  if (!isRealIsoDay(day)) return null
  const bounds = receiptDateBounds(isoDay(today))
  if (day > shiftIsoDay(bounds.max, 1) || day < shiftIsoDay(bounds.min, -1)) return null
  return day
}

function phoneDigits(value: string | null): string | null {
  if (value === null) return null
  const digits = value.replace(/\D/g, '')
  if (digits.length < 10) return null
  return digits.slice(-10)
}

function zip5(value: string | null): string | null {
  if (value === null) return null
  const match = /\b(\d{5})(?:-\d{4})?\b/.exec(value)
  return match ? match[1]! : null
}

/**
 * The model's answer, checked. Null when it isn't the JSON we asked for or has
 * nothing usable in it; the form then stays as the shopper left it.
 */
export function parseReceiptRead(text: string, { today = new Date() }: { today?: Date } = {}): ReceiptRead | null {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return null
  }
  const parsed = receiptReadSchema.safeParse(json)
  if (!parsed.success) return null
  const raw = parsed.data

  const read: ReceiptRead = {
    businessName: cleanText(raw.business_name, MAX_NAME_CHARS),
    phone: phoneDigits(raw.phone),
    zip: zip5(raw.zip) ?? zip5(raw.street_address),
    amountCents: parseTotalToCents(raw.total),
    purchaseDate: checkReadDate(raw.date, today),
  }
  if (!read.businessName && read.amountCents === null && read.purchaseDate === null) return null
  return read
}

// ─── Matching ─────────────────────────────────────────────────────────────────

export interface MatchCandidate {
  id: string
  name: string
  cityName: string | null
  phone: string | null
  zip: string | null
}

/** What the browser gets: no phone, no ZIP. */
export interface MatchedListing {
  id: string
  name: string
  cityName: string | null
}

/** Dice overlap of the two names' words, 0 to 1. */
function nameSimilarity(a: string, b: string): number {
  const ta = new Set(nameTokens(a))
  const tb = new Set(nameTokens(b))
  if (ta.size === 0 || tb.size === 0) return 0
  let shared = 0
  for (const t of ta) if (tb.has(t)) shared += 1
  return (2 * shared) / (ta.size + tb.size)
}

/**
 * How well a listing fits what was read, 0 and up. The name carries most of
 * it; a matching phone is close to proof, a matching ZIP a nudge.
 */
export function scoreListingMatch(read: Pick<ReceiptRead, 'businessName' | 'phone' | 'zip'>, candidate: MatchCandidate): number {
  let score = 0
  if (read.businessName) {
    score += normalizeBusinessName(read.businessName) === normalizeBusinessName(candidate.name)
      ? 1
      : nameSimilarity(read.businessName, candidate.name)
  }
  if (read.phone && phoneDigits(candidate.phone) === read.phone) score += 1
  if (read.zip && zip5(candidate.zip) === read.zip) score += 0.25
  return score
}

/** Below this, a listing isn't offered at all. */
export const MATCH_MIN_SCORE = 0.5
/** At or above this, with a clear lead, the listing is picked for the shopper. */
export const MATCH_STRONG_SCORE = 1
/** How far the top listing must lead the next to be picked. */
export const MATCH_STRONG_MARGIN = 0.25
export const MAX_MATCHES = 3

export interface MatchPick {
  /** Filled into the business field. Null when no listing clearly wins. */
  strong: MatchedListing | null
  /** Offered as buttons when there is no strong match. */
  matches: MatchedListing[]
}

function publicFields(c: MatchCandidate): MatchedListing {
  return { id: c.id, name: c.name, cityName: c.cityName }
}

export function pickMatches(read: Pick<ReceiptRead, 'businessName' | 'phone' | 'zip'>, candidates: MatchCandidate[]): MatchPick {
  const seen = new Set<string>()
  const scored = candidates
    .filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)))
    .map((c) => ({ c, score: scoreListingMatch(read, c) }))
    .filter((s) => s.score >= MATCH_MIN_SCORE)
    .sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name))

  const [top, next] = scored
  if (top && top.score >= MATCH_STRONG_SCORE && (!next || top.score - next.score >= MATCH_STRONG_MARGIN)) {
    return { strong: publicFields(top.c), matches: [] }
  }
  return { strong: null, matches: scored.slice(0, MAX_MATCHES).map((s) => publicFields(s.c)) }
}

/**
 * The words worth searching listing names for: the two longest, three letters
 * or more. "Sweet Spot Bakery" searches "bakery" and "sweet".
 */
export function searchWords(businessName: string): string[] {
  return nameTokens(businessName)
    .filter((t) => t.length >= 3 && t !== 'and')
    .sort((a, b) => b.length - a.length)
    .slice(0, 2)
}
