import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { isFeatureEnabled } from '@/lib/env'
import { createServiceClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'
import { buildEntityUrl } from '@/lib/listings/url'
import { resolveMediaPath } from '@/lib/listings/coverImage'
import {
  inboxPlacement,
  isConversationUnread,
  matchesPageFilter,
  participantRole,
  resolveListingMessaging,
  type InboxTab,
  type ListingMessaging,
  type ParticipantRole,
} from './rules'

// Read side of messaging. Everything here reads with the REQUEST client, so the
// participant-only RLS policies decide what comes back. The one exception is a
// customer's display name and avatar on the owner side: profiles are readable
// only by their owner, so those two fields are read with the service client,
// and only for customers whose conversations RLS has already returned.

type Client = SupabaseClient<Database>

const THREAD_MESSAGE_LIMIT = 500
const LIST_LIMIT = 100

// ── Listing page ────────────────────────────────────────────────────────────

/**
 * How the message CTA behaves on a listing page for this viewer. undefined
 * means "no in-app messaging here": the flag is off, the listing is unclaimed,
 * or a read failed (e.g. the migration is not applied yet). The page then
 * keeps its old mailto: behavior, so a missing column never 404s a listing.
 */
export async function loadListingMessaging(
  supabase: Client,
  opts: { listingId: string; ownerUserId: string | null; viewerId: string | null; listingPath: string }
): Promise<ListingMessaging | undefined> {
  if (!isFeatureEnabled('messaging') || !opts.ownerUserId) return undefined

  try {
    const { data: row, error } = await supabase
      .from('listings')
      .select('messaging_enabled')
      .eq('id', opts.listingId)
      .maybeSingle()
    if (error || !row) return undefined

    let restricted = false
    let existingConversationId: string | null = null
    if (opts.viewerId && opts.viewerId !== opts.ownerUserId) {
      const [restriction, conversation] = await Promise.all([
        supabase.rpc('messaging_restricted', { p_listing_id: opts.listingId }),
        supabase
          .from('conversations')
          .select('id')
          .eq('listing_id', opts.listingId)
          .eq('customer_user_id', opts.viewerId)
          .maybeSingle(),
      ])
      if (restriction.error || conversation.error) return undefined
      restricted = restriction.data === true
      existingConversationId = conversation.data?.id ?? null
    }

    return resolveListingMessaging({
      listingId: opts.listingId,
      listingPath: opts.listingPath,
      ownerUserId: opts.ownerUserId,
      messagingEnabled: row.messaging_enabled === true,
      viewerId: opts.viewerId,
      restricted,
      existingConversationId,
    })
  } catch {
    return undefined
  }
}

// ── Badge ───────────────────────────────────────────────────────────────────

/** Unread messages for the signed-in user, both sides. 0 on any failure. */
export async function getUnreadMessageCount(supabase: Client): Promise<number> {
  if (!isFeatureEnabled('messaging')) return 0
  try {
    const { data, error } = await supabase.rpc('unread_message_count')
    if (error || typeof data !== 'number') return 0
    return data
  } catch {
    return 0
  }
}

// ── Lists ───────────────────────────────────────────────────────────────────

export interface ConversationListItem {
  id: string
  /** The other side: the business name for a customer, the customer's name for an owner. */
  title: string
  subtitle: string | null
  imageUrl: string | null
  preview: string | null
  lastMessageAt: string
  unread: boolean
}

type ListingLite = {
  id: string
  name: string
  slug: string | null
  entity_type: string
  logo_path: string | null
  cities: { slug: string } | null
}

async function readListings(supabase: Client, ids: string[]): Promise<Map<string, ListingLite>> {
  if (ids.length === 0) return new Map()
  const { data } = await supabase
    .from('listings')
    .select('id, name, slug, entity_type, logo_path, cities(slug)')
    .in('id', ids)
  return new Map(((data ?? []) as unknown as ListingLite[]).map((l) => [l.id, l]))
}

export type CustomerProfile = { displayName: string; avatarUrl: string | null }

/** See the header comment: only call with customer ids RLS has already returned. */
async function readCustomerProfiles(ids: string[]): Promise<Map<string, CustomerProfile>> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return new Map()
  try {
    const { data } = await createServiceClient()
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', unique)
    return new Map(
      (data ?? []).map((p) => [
        p.id,
        { displayName: p.display_name?.trim() || 'Customer', avatarUrl: p.avatar_url ?? null },
      ])
    )
  } catch {
    return new Map()
  }
}

export interface OwnerListingOption {
  id: string
  name: string
  messagingEnabled: boolean
  published: boolean
}

export interface Inbox {
  items: ConversationListItem[]
  /** The viewer's own pages (for the chips and the inbox summary). Empty for a customer. */
  pages: OwnerListingOption[]
  /** Unread threads per tab, across all pages (from the rows loaded). */
  unread: Record<InboxTab, number>
  error: boolean
}

const CONVERSATION_COLUMNS =
  'id, listing_id, customer_user_id, customer_listing_id, last_message_at, last_message_preview, customer_last_read_at, owner_last_read_at'

/**
 * The one inbox (owner-experience round 2). Conversations on the viewer's own
 * pages plus conversations the viewer started, split into two tabs by
 * inboxPlacement(). A customer with no pages gets everything under
 * 'businesses', which /account/messages shows without tabs.
 *
 * Names and logos of OTHER pages (a page writing to me, a page I wrote to) are
 * read with the service client, and only for ids taken from conversations RLS
 * has already returned, like readCustomerProfiles.
 */
export async function listInbox(
  supabase: Client,
  userId: string,
  tab: InboxTab,
  listingFilter: string | null
): Promise<Inbox> {
  const empty = { items: [], pages: [], unread: { customers: 0, businesses: 0 } }
  const { data: owned, error: ownedError } = await supabase
    .from('listings')
    .select('id, name, status, messaging_enabled')
    .eq('owner_user_id', userId)
    .is('deleted_at', null)
    .order('name')
  if (ownedError) return { ...empty, error: true }

  const pages: OwnerListingOption[] = (owned ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    messagingEnabled: l.messaging_enabled,
    published: l.status === 'published',
  }))
  const ownedIds = new Set(pages.map((p) => p.id))
  const pageNames = new Map(pages.map((p) => [p.id, p.name]))

  const [incoming, outgoing] = await Promise.all([
    ownedIds.size === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from('conversations')
          .select(CONVERSATION_COLUMNS)
          .in('listing_id', [...ownedIds])
          .order('last_message_at', { ascending: false })
          .limit(LIST_LIMIT),
    supabase
      .from('conversations')
      .select(CONVERSATION_COLUMNS)
      .eq('customer_user_id', userId)
      .order('last_message_at', { ascending: false })
      .limit(LIST_LIMIT),
  ])
  if (incoming.error || outgoing.error) return { ...empty, pages, error: true }

  const byId = new Map([...(outgoing.data ?? []), ...(incoming.data ?? [])].map((c) => [c.id, c]))
  const placed = [...byId.values()]
    .map((c) => ({ c, place: inboxPlacement(c, userId, ownedIds) }))
    .filter((r): r is { c: (typeof r)['c']; place: NonNullable<(typeof r)['place']> } => r.place !== null)
    .sort((a, b) => b.c.last_message_at.localeCompare(a.c.last_message_at))

  const unread = { customers: 0, businesses: 0 }
  for (const { c, place } of placed) if (isConversationUnread(place.role, c)) unread[place.tab] += 1

  const shown = placed.filter(
    ({ c, place }) => place.tab === tab && matchesPageFilter(c, tab, listingFilter && ownedIds.has(listingFilter) ? listingFilter : null)
  )

  // Other pages' names: the business a page of mine wrote to, or the page that wrote to mine.
  const otherPageIds = new Set<string>()
  const customerIds: string[] = []
  for (const { c, place } of shown) {
    if (place.role === 'customer') otherPageIds.add(c.listing_id)
    else if (c.customer_listing_id) otherPageIds.add(c.customer_listing_id)
    else customerIds.push(c.customer_user_id)
  }
  const [otherPages, profiles] = await Promise.all([
    readListingsAsService([...otherPageIds]),
    readCustomerProfiles(customerIds),
  ])
  const many = pages.length > 1

  return {
    pages,
    unread,
    error: false,
    items: shown.map(({ c, place }) => {
      const base = {
        id: c.id,
        preview: c.last_message_preview,
        lastMessageAt: c.last_message_at,
        unread: isConversationUnread(place.role, c),
      }
      if (place.role === 'customer') {
        const to = otherPages.get(c.listing_id)
        const asPage = c.customer_listing_id ? pageNames.get(c.customer_listing_id) : null
        return {
          ...base,
          title: to?.name ?? 'A business',
          subtitle: asPage ? `You wrote as ${asPage}` : null,
          imageUrl: resolveMediaPath(to?.logo_path),
        }
      }
      const toMine = many ? (pageNames.get(c.listing_id) ?? null) : null
      if (c.customer_listing_id) {
        const from = otherPages.get(c.customer_listing_id)
        return {
          ...base,
          title: from?.name ?? 'A business',
          subtitle: toMine ? `To ${toMine}` : null,
          imageUrl: resolveMediaPath(from?.logo_path),
        }
      }
      const profile = profiles.get(c.customer_user_id)
      return {
        ...base,
        title: profile?.displayName ?? 'Customer',
        subtitle: toMine,
        imageUrl: profile?.avatarUrl ?? null,
      }
    }),
  }
}

/** See listInbox: only call with listing ids from conversations RLS has already returned. */
async function readListingsAsService(ids: string[]): Promise<Map<string, ListingLite>> {
  try {
    // Same Database type; the two client factories only differ in options.
    return await readListings(createServiceClient() as unknown as Client, ids)
  } catch {
    return new Map()
  }
}

/** Has at least one page (any status). Page owners use the dashboard inbox. */
export async function ownsAnyPage(supabase: Client, userId: string): Promise<boolean> {
  const { count } = await supabase
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('owner_user_id', userId)
    .is('deleted_at', null)
  return (count ?? 0) > 0
}

/** The viewer's published pages, for "Send as" in the composer. */
export async function listSendAsPages(
  supabase: Client,
  userId: string,
  excludeListingId: string
): Promise<{ id: string; name: string }[]> {
  if (!isFeatureEnabled('messaging')) return []
  try {
    const { data, error } = await supabase
      .from('listings')
      .select('id, name')
      .eq('owner_user_id', userId)
      .eq('status', 'published')
      .is('deleted_at', null)
      .neq('id', excludeListingId)
      .order('name')
      .limit(20)
    if (error) return []
    return data ?? []
  } catch {
    return []
  }
}

// ── Thread ──────────────────────────────────────────────────────────────────

export interface ThreadMessage {
  id: string
  body: string
  createdAt: string
  mine: boolean
}

export interface Thread {
  id: string
  role: ParticipantRole
  listingId: string
  /** The other side's name. */
  counterpartName: string
  counterpartImageUrl: string | null
  /** Public URL of the listing, when the viewer can see it. */
  listingName: string
  listingUrl: string | null
  messages: ThreadMessage[]
  unread: boolean
  /** Owner side only: this customer is blocked. */
  blockedByMe: boolean
  /** The viewer may reply now. */
  canReply: boolean
  /** Shown above the reply box when canReply is false. */
  replyNotice: string | null
  customerUserId: string
  /**
   * The customer side wrote as one of their pages. For the owner it is who
   * wrote in (counterpartName is that page); for the customer it is the page
   * they are writing as.
   */
  sentAsPageName: string | null
}

export async function loadThread(
  supabase: Client,
  conversationId: string,
  viewerId: string
): Promise<Thread | null> {
  const { data: conversation } = await supabase
    .from('conversations')
    .select(
      'id, listing_id, customer_user_id, customer_listing_id, last_message_at, customer_last_read_at, owner_last_read_at, last_message_preview'
    )
    .eq('id', conversationId)
    .maybeSingle()
  // RLS returned nothing: not a participant, or no such thread.
  if (!conversation) return null

  const [{ data: listingRow }, { data: messages }, restriction, sentAs] = await Promise.all([
    supabase
      .from('listings')
      .select('id, name, slug, status, entity_type, logo_path, owner_user_id, cities(slug)')
      .eq('id', conversation.listing_id)
      .maybeSingle(),
    supabase
      .from('messages')
      .select('id, body, created_at, sender_user_id')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(THREAD_MESSAGE_LIMIT),
    supabase.rpc('messaging_restricted', { p_listing_id: conversation.listing_id }),
    // RLS returned this conversation, so its sending page may be named.
    conversation.customer_listing_id
      ? readListingsAsService([conversation.customer_listing_id]).then((m) => m.get(conversation.customer_listing_id!) ?? null)
      : Promise.resolve(null),
  ])

  const listing = listingRow as unknown as
    | (ListingLite & { status: string; owner_user_id: string | null })
    | null
  const role = participantRole(viewerId, conversation, listing?.owner_user_id ?? null)
  if (!role) return null

  let blockedByMe = false
  let counterpartName = listing?.name ?? 'A business'
  let counterpartImageUrl = resolveMediaPath(listing?.logo_path)
  if (role === 'owner') {
    const [{ data: block }, profiles] = await Promise.all([
      supabase
        .from('message_blocks')
        .select('blocked_user_id')
        .eq('owner_user_id', viewerId)
        .eq('blocked_user_id', conversation.customer_user_id)
        .maybeSingle(),
      readCustomerProfiles([conversation.customer_user_id]),
    ])
    blockedByMe = !!block
    const profile = profiles.get(conversation.customer_user_id)
    counterpartName = sentAs?.name ?? profile?.displayName ?? 'Customer'
    counterpartImageUrl = sentAs ? resolveMediaPath(sentAs.logo_path) : (profile?.avatarUrl ?? null)
  }

  // For a customer, messaging_restricted() is true when blocked or suspended.
  // For an owner it can only mean suspended (an owner never blocks themselves).
  const restricted = restriction.data === true
  let replyNotice: string | null = null
  if (role === 'owner' && blockedByMe) replyNotice = 'You blocked this sender. Unblock them to reply.'
  else if (restricted) replyNotice = "You can't message this business."
  if (role === 'owner' && restricted && !blockedByMe) replyNotice = 'Your messaging is turned off.'

  const citySlug = listing?.cities?.slug
  const listingUrl =
    listing && listing.status === 'published' && citySlug && listing.slug
      ? buildEntityUrl(listing.entity_type, citySlug, listing.slug)
      : null

  return {
    id: conversation.id,
    role,
    listingId: conversation.listing_id,
    counterpartName,
    counterpartImageUrl,
    listingName: listing?.name ?? 'A business',
    listingUrl,
    messages: (messages ?? [])
      .map((m) => ({ id: m.id, body: m.body, createdAt: m.created_at, mine: m.sender_user_id === viewerId }))
      .reverse(),
    unread: isConversationUnread(role, conversation),
    blockedByMe,
    canReply: replyNotice === null,
    replyNotice,
    customerUserId: conversation.customer_user_id,
    sentAsPageName: sentAs?.name ?? null,
  }
}

// ── Blocks ──────────────────────────────────────────────────────────────────

export async function listBlockedCustomers(
  supabase: Client,
  ownerId: string
): Promise<{ userId: string; displayName: string; blockedAt: string }[]> {
  const { data, error } = await supabase
    .from('message_blocks')
    .select('blocked_user_id, created_at')
    .eq('owner_user_id', ownerId)
    .order('created_at', { ascending: false })
  if (error || !data || data.length === 0) return []
  const profiles = await readCustomerProfiles(data.map((b) => b.blocked_user_id))
  return data.map((b) => ({
    userId: b.blocked_user_id,
    displayName: profiles.get(b.blocked_user_id)?.displayName ?? 'Customer',
    blockedAt: b.created_at,
  }))
}
