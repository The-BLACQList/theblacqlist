// Pure rules for messaging. No I/O here, so every decision the actions and the
// listing page make can be unit-tested (tests/messaging-rules.test.ts).

import {
  COMPOSE_HASH,
  CUSTOMER_INBOX_PATH,
  MESSAGE_MAX_LENGTH,
  MESSAGE_PREVIEW_LENGTH,
  OWNER_INBOX_PATH,
  REPORT_NOTE_MAX_LENGTH,
  REPORT_REASONS,
  type ReportReason,
} from './constants'

// ── Listing page ────────────────────────────────────────────────────────────

/**
 * What "Send Message" does on a listing page for this viewer.
 *   compose     open the in-app composer (#send-message)
 *   sign_in     signed out, inbox open: sign in, then come back
 *   thread      the viewer already has a thread here: go to it (works even
 *               when the inbox is now closed, because existing threads stay open)
 *   owner       the viewer owns the listing: go to their inbox
 *   unavailable inbox closed, or the viewer is blocked / suspended. The page
 *               shows "Not accepting messages" and never says which.
 */
export type ListingMessagingMode = 'compose' | 'sign_in' | 'thread' | 'owner' | 'unavailable'

export interface ListingMessaging {
  mode: ListingMessagingMode
  /** Where the message CTA points. null only for 'unavailable'. */
  href: string | null
}

export interface ResolveListingMessagingInput {
  listingId: string
  listingPath: string
  ownerUserId: string | null
  messagingEnabled: boolean
  viewerId: string | null
  /** messaging_restricted(): the viewer is blocked by this owner or suspended. */
  restricted: boolean
  existingConversationId: string | null
}

export function resolveListingMessaging(input: ResolveListingMessagingInput): ListingMessaging | undefined {
  const { ownerUserId, viewerId } = input
  // Unclaimed: nobody would read the message. The old CTA logic stands.
  if (!ownerUserId) return undefined

  if (viewerId && viewerId === ownerUserId) {
    return { mode: 'owner', href: `${OWNER_INBOX_PATH}?listing=${encodeURIComponent(input.listingId)}` }
  }
  if (!viewerId) {
    return input.messagingEnabled
      ? { mode: 'sign_in', href: `/sign-in?next=${encodeURIComponent(input.listingPath)}` }
      : { mode: 'unavailable', href: null }
  }
  if (input.restricted) return { mode: 'unavailable', href: null }
  if (input.existingConversationId) {
    return { mode: 'thread', href: `${CUSTOMER_INBOX_PATH}/${input.existingConversationId}` }
  }
  return input.messagingEnabled ? { mode: 'compose', href: COMPOSE_HASH } : { mode: 'unavailable', href: null }
}

/** The hero/quick-bar label when the message CTA is in-app. */
export function messagingCtaLabel(mode: ListingMessagingMode, fallback: string): string {
  if (mode === 'owner') return 'View inbox'
  if (mode === 'thread') return 'View messages'
  return fallback
}

/**
 * Whether the listing page mounts the composer. 'thread' too: sending the
 * first message refreshes the page (the action revalidates), which flips the
 * mode from compose to thread. Unmounting then would close the dialog before
 * the customer sees "Message sent". In thread mode no link points at
 * #send-message, so the composer stays closed unless it was already open.
 */
export function composerMounted(mode: ListingMessagingMode | undefined): boolean {
  return mode === 'compose' || mode === 'thread'
}

// ── Message bodies ──────────────────────────────────────────────────────────

export type BodyResult = { ok: true; body: string } | { ok: false; error: string }

export function normalizeMessageBody(raw: unknown): BodyResult {
  if (typeof raw !== 'string') return { ok: false, error: 'Write a message first.' }
  // Normalize line endings and drop trailing whitespace on the whole message,
  // but keep the writer's own line breaks.
  const body = raw.replace(/\r\n?/g, '\n').trim()
  if (body.length === 0) return { ok: false, error: 'Write a message first.' }
  if (body.length > MESSAGE_MAX_LENGTH) {
    return { ok: false, error: `Messages can be up to ${MESSAGE_MAX_LENGTH.toLocaleString('en-US')} characters.` }
  }
  return { ok: true, body }
}

export function messagePreview(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim()
  return flat.length <= MESSAGE_PREVIEW_LENGTH ? flat : `${flat.slice(0, MESSAGE_PREVIEW_LENGTH - 1)}…`
}

// ── Participants ────────────────────────────────────────────────────────────

export type ParticipantRole = 'customer' | 'owner'

export function participantRole(
  viewerId: string,
  conversation: { customer_user_id: string },
  listingOwnerId: string | null
): ParticipantRole | null {
  if (conversation.customer_user_id === viewerId) return 'customer'
  if (listingOwnerId && listingOwnerId === viewerId) return 'owner'
  return null
}

// ── One inbox, two tabs (owner-experience round 2, 2026-11-13) ─────────────

export type InboxTab = 'customers' | 'businesses'

/** ?tab= on /dashboard/messages. Anything unknown is the Customers tab. */
export function parseInboxTab(raw: unknown): InboxTab {
  return raw === 'businesses' ? 'businesses' : 'customers'
}

type InboxRow = { listing_id: string; customer_user_id: string; customer_listing_id: string | null }

/**
 * Where a conversation sits in this viewer's inbox, and which side they are on.
 *   - On one of my pages, from a person          → Customers (I am the owner)
 *   - On one of my pages, from another business  → Businesses (I am the owner)
 *   - I wrote to someone else's page (as me or as one of my pages) → Businesses
 * null: not mine (RLS should never return it).
 */
export function inboxPlacement(
  conversation: InboxRow,
  viewerId: string,
  ownedListingIds: ReadonlySet<string>
): { tab: InboxTab; role: ParticipantRole } | null {
  if (ownedListingIds.has(conversation.listing_id)) {
    return { role: 'owner', tab: conversation.customer_listing_id ? 'businesses' : 'customers' }
  }
  if (conversation.customer_user_id === viewerId) return { role: 'customer', tab: 'businesses' }
  return null
}

/**
 * The page chips. On Customers a chip means "sent to this page". On Businesses
 * it also means "sent from this page", so a page's outgoing threads are there.
 */
export function matchesPageFilter(conversation: InboxRow, tab: InboxTab, listingFilter: string | null): boolean {
  if (!listingFilter) return true
  if (conversation.listing_id === listingFilter) return true
  return tab === 'businesses' && conversation.customer_listing_id === listingFilter
}

/**
 * Unread for this side: the thread moved after this side last read it. A send
 * stamps the sender's own read marker with the same instant as
 * last_message_at, so a person's own message never counts as unread.
 */
export function isConversationUnread(
  role: ParticipantRole,
  conversation: { last_message_at: string; customer_last_read_at: string | null; owner_last_read_at: string | null }
): boolean {
  const readAt = role === 'customer' ? conversation.customer_last_read_at : conversation.owner_last_read_at
  if (!readAt) return true
  return new Date(conversation.last_message_at).getTime() > new Date(readAt).getTime()
}

// ── Reports ─────────────────────────────────────────────────────────────────

export type ReportInput = { reason: ReportReason; note: string | null }

export function parseReportInput(rawReason: unknown, rawNote: unknown): { ok: true; value: ReportInput } | { ok: false; error: string } {
  if (typeof rawReason !== 'string' || !(REPORT_REASONS as readonly string[]).includes(rawReason)) {
    return { ok: false, error: 'Choose a reason.' }
  }
  const note = typeof rawNote === 'string' ? rawNote.trim() : ''
  if (note.length > REPORT_NOTE_MAX_LENGTH) {
    return { ok: false, error: `Notes can be up to ${REPORT_NOTE_MAX_LENGTH} characters.` }
  }
  return { ok: true, value: { reason: rawReason as ReportReason, note: note || null } }
}

/** Scam and harassment reports sort above spam in the admin queue. */
export function reportPriority(reason: ReportReason): number {
  return reason === 'harassment' || reason === 'scam' ? 2 : 1
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}
