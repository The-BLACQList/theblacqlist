// Messages about job and event postings (owner-experience round 2, part H,
// 2026-11-13). Pure rules, no I/O, so the listing page, the start action and
// the inbox all decide the same way (tests/messaging-postings.test.ts).
//
// A message about a posting is filed under the posting itself
// (conversations.listing_id is the job or event listing), so one person has one
// thread per posting and the existing RLS (owns_listing) already covers it.

import { isEventOver } from '@/lib/events/eventOver'
import { isRoleClosed } from '@/lib/listings/jobPosting'

export type PostingKind = 'job' | 'event'

export function postingKind(entityType: string | null | undefined): PostingKind | null {
  return entityType === 'job' || entityType === 'event' ? entityType : null
}

/** The page a posting is linked to: a job's hiring business, an event's organizer. */
export interface LinkedPage {
  id: string
  ownerUserId: string | null
  messagingEnabled: boolean
}

export interface PostingInboxInput {
  kind: PostingKind
  /** The posting's own owner. */
  ownerUserId: string | null
  /** The posting's own listings.messaging_enabled (used when it is not linked). */
  ownMessagingEnabled: boolean
  linkedPage: LinkedPage | null
  closesAt?: string | null
  startsAt?: string | null
  endsAt?: string | null
}

/**
 * Whose switch a posting follows. Linked to one of the SAME owner's pages: that
 * page's inbox switch, so an owner turns messages on once per business. Linked
 * to someone else's page, or not linked: the posting's own switch, which Inbox
 * settings shows for exactly these postings.
 */
export function postingFollowsPage(input: Pick<PostingInboxInput, 'ownerUserId' | 'linkedPage'>): boolean {
  const { ownerUserId, linkedPage } = input
  return Boolean(ownerUserId && linkedPage && linkedPage.ownerUserId === ownerUserId)
}

/**
 * The role has closed or the event is over: no NEW conversations. Existing
 * threads can still reply (sendMessage never checks this). Same rules as the
 * closing sweep (isRoleClosed) and the event sweep (isEventOver: no end time
 * means 24 hours after the start).
 */
export function postingEnded(
  input: Pick<PostingInboxInput, 'kind' | 'closesAt' | 'startsAt' | 'endsAt'>,
  now: Date = new Date()
): boolean {
  if (input.kind === 'job') return isRoleClosed(input.closesAt, now)
  return isEventOver(input.startsAt, input.endsAt, now)
}

/** Whether a posting takes new conversations. */
export function postingInboxOpen(input: PostingInboxInput, now: Date = new Date()): boolean {
  if (postingEnded(input, now)) return false
  return postingFollowsPage(input) ? input.linkedPage!.messagingEnabled : input.ownMessagingEnabled
}

/** The listing page's secondary message button. */
export function messageButtonLabel(mode: string | undefined, kind: PostingKind | null): string {
  if (mode === 'thread') return 'View messages'
  if (kind === 'job') return 'Ask about this role'
  if (kind === 'event') return 'Ask about this event'
  return 'Message'
}

/** "Job · Line cook" / "Event · Spring market", for inbox rows and the thread header. */
export function postingTag(kind: PostingKind, title: string): string {
  return `${kind === 'job' ? 'Job' : 'Event'} · ${title}`
}

// ── The details card at the top of a thread ────────────────────────────────

export type PostingDetails =
  | {
      kind: 'job'
      title: string
      url: string | null
      facts: { label: string; value: string }[]
      applyUrl: string | null
      applyEmail: string | null
      closed: boolean
    }
  | {
      kind: 'event'
      title: string
      url: string | null
      when: string | null
      where: string | null
      ticketUrl: string | null
      priceText: string | null
      over: boolean
    }

/**
 * "Saturday, March 7 at 6:00 PM", in the event's own time zone when it has a
 * valid one, else Eastern (the jobs' default audience). null when unparseable.
 */
export function formatEventWhen(startsAt: string | null | undefined, timezone?: string | null): string | null {
  if (!startsAt) return null
  const d = new Date(startsAt)
  if (Number.isNaN(d.getTime())) return null
  const format = (timeZone: string) =>
    `${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone })} at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone })}`
  try {
    return format(timezone || 'America/New_York')
  } catch {
    // An unknown zone name makes Intl throw.
    return format('America/New_York')
  }
}

export function formatEventWhere(input: {
  isOnline: boolean
  venueName: string | null
  cityText: string | null
}): string | null {
  if (input.isOnline) return 'Online'
  const parts = [input.venueName?.trim(), input.cityText?.trim()].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : null
}
