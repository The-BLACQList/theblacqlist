// =============================================================================
// Businesses shoppers buy from that are not on The BLACQList yet (ticket 168)
// =============================================================================
// Two halves:
//   * the shopper's invite: a line on the receipt form and on My receipts, and
//     the text they share with the business themselves. We send nothing.
//   * the founder's list: unmatched receipts grouped by business, with no
//     shopper data, plus the copy for "Email this business".
//
// receipt_uploads has no city, so groups are by normalized name only and the
// city shows as "City not known". business_invite_sends keeps a city column
// for the day a receipt can carry one.
// =============================================================================

import { normalizeBusinessName } from './business-name'

/** Shown under an unmatched business name on the form and on My receipts. */
export const UNLISTED_INVITE_LEAD = "This business isn't on The BLACQList yet."
/** The tappable half of the line. */
export const UNLISTED_INVITE_ACTION = 'Invite them.'
export const UNLISTED_INVITE_LINE = `${UNLISTED_INVITE_LEAD} ${UNLISTED_INVITE_ACTION}`

/** The path the shopper's invite and the founder's email both point at. */
export const ADD_BUSINESS_PATH = '/add-business'

/** What the shopper shares with the business. The link is absolute. */
export function inviteMessage(origin: string): string {
  return `I shop at your business and would love to see you on The BLACQList. You can add your business here: ${origin}${ADD_BUSINESS_PATH}`
}

// ── The founder's email (O2 B) ───────────────────────────────────────────────

export const BUSINESS_INVITE_SUBJECT = 'Customers are adding your receipts on The BLACQList'

export function businessInviteBody(businessName: string, origin: string): string {
  return `Shoppers have been adding receipts from ${businessName} to The BLACQList. Add your business for free so they can find you: ${origin}${ADD_BUSINESS_PATH}`
}

/** The physical address, as in the policy-update notice footer. */
export const BUSINESS_INVITE_ADDRESS =
  'The BLACQList, LLC · 3133 Maple Dr NE, Ste 240 #1130 · Atlanta, GA 30305'

export const BUSINESS_INVITE_STOP_LINE = "Reply STOP and we won't email you again."

/** Shown when a group's city is unknown, which today is every group. */
export const CITY_NOT_KNOWN = 'City not known'

/** "Add as a listing" opens /add-business with the name filled in. */
export function addListingHref(businessName: string): string {
  return `${ADD_BUSINESS_PATH}?name=${encodeURIComponent(businessName)}`
}

// ── Grouping ─────────────────────────────────────────────────────────────────

/** Only the two columns the grouping reads. Nothing about the shopper. */
export interface UnlistedReceiptRow {
  raw_business_name: string | null
  created_at: string
}

export interface UnlistedGroup {
  /** normalizedName plus city, the same key business_invite_sends is unique on. */
  key: string
  normalizedName: string
  /** The spelling shoppers used most, the latest on a tie. */
  displayName: string
  city: string | null
  count: number
  /** ISO time of the newest receipt in the group. */
  lastSeen: string
}

export function groupKey(normalizedName: string, city: string | null): string {
  return `${normalizedName}|${city ?? ''}`
}

/**
 * Group unmatched receipts by business. Blank names are skipped. Most receipts
 * first, then the most recent. The output carries names, counts and dates
 * only, so a group can never point back at a shopper.
 */
export function groupUnlistedReceipts(rows: readonly UnlistedReceiptRow[]): UnlistedGroup[] {
  const groups = new Map<
    string,
    {
      normalizedName: string
      count: number
      lastSeen: string
      spellings: Map<string, { n: number; last: string }>
    }
  >()

  for (const row of rows) {
    const raw = row.raw_business_name?.trim().replace(/\s+/g, ' ') ?? ''
    if (!raw) continue
    const normalizedName = normalizeBusinessName(raw)
    if (!normalizedName) continue

    const key = groupKey(normalizedName, null)
    const group = groups.get(key) ?? {
      normalizedName,
      count: 0,
      lastSeen: row.created_at,
      spellings: new Map(),
    }
    group.count += 1
    if (row.created_at > group.lastSeen) group.lastSeen = row.created_at
    const spelling = group.spellings.get(raw) ?? { n: 0, last: row.created_at }
    spelling.n += 1
    if (row.created_at > spelling.last) spelling.last = row.created_at
    group.spellings.set(raw, spelling)
    groups.set(key, group)
  }

  return [...groups.entries()]
    .map(([key, g]) => {
      let displayName = ''
      let best = { n: -1, last: '' }
      for (const [name, s] of g.spellings) {
        if (s.n > best.n || (s.n === best.n && s.last > best.last)) {
          displayName = name
          best = s
        }
      }
      return {
        key,
        normalizedName: g.normalizedName,
        displayName,
        city: null,
        count: g.count,
        lastSeen: g.lastSeen,
      }
    })
    .sort(
      (a, b) =>
        b.count - a.count || (a.lastSeen < b.lastSeen ? 1 : a.lastSeen > b.lastSeen ? -1 : 0)
    )
}

/** "Oct 31, 2026", read in UTC so a date never shifts a day. */
export function formatShortDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
