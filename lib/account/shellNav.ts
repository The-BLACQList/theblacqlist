// One signed-in menu for members and owners (ticket 252). Replaces the light
// account card (AccountNav) and the separate owner sidebar (DashboardSidebar):
// the founder found the owner tools "buried" in My Account and the two areas
// "so separate". Mockup A, Dark Rail, picked 2026-11-21.
//
// Owners see You, then Your Business (Home, Edit Page, Insights, Messages,
// Plan), then the page's tools by job (What You Offer, Photos and Updates,
// Hours and Trust), then Account. Members see You and Account, and an "Own a
// Business?" card. Every /account and
// /dashboard address stays the same.

import type { RailGroup, RailItem } from '@/lib/nav/rail'

export interface ShellPage {
  id: string
  name: string
  /** The page's plan tier ('free', 'starter', ...). */
  tier: string | null
}

export interface ShellCounts {
  saved: number
  reviews: number
  claims: number
  claimsPending: number
  receipts: number
  /** Unread messages. Undefined hides Messages (messaging off). */
  messagesUnread?: number
  /** Receipts waiting for this owner to verify (ticket 183). */
  receiptsToVerify: number
}

export interface ShellFlags {
  /** ownerReceiptReview: Receipts to Review shows. */
  ownerReceipts: boolean
  /** happeningNow: Happening Now shows under the page tools. */
  posts: boolean
  /** bookingRequests: Bookings shows under the page tools. */
  bookings: boolean
  /** The Collective isn't open yet (ticket 122): one row with a Soon pill. */
  collectiveSoon: boolean
}

export interface ShellNavInput {
  isOwner: boolean
  isAdmin: boolean
  /** The page the business links point at. Null when the owner has none readable. */
  pageId: string | null
  counts: ShellCounts
  flags: ShellFlags
}

/** localStorage key for which groups are open. */
export const SHELL_NAV_PREF_KEY = 'blacq-account-nav-groups'

/**
 * Open on a first visit. The group holding the current page is always open
 * too. Owners start with You closed so it does not push the business tools
 * off the screen now that You comes first.
 */
export const SHELL_DEFAULT_OPEN = ['business', 'you']
export const SHELL_DEFAULT_OPEN_OWNER = ['business']

/** Cookie holding the owner's chosen page, so Home and the menu agree (ticket 253 reads it). */
export const PAGE_COOKIE = 'blacq-page'

/**
 * Receipts, My Spending and The Collective all sit behind the one `collective`
 * flag (lib/features/opening-soon.ts), so they open and close together. While
 * it is covered they collapse into a single "The Collective" row with a Soon
 * pill [Decision: founder, 2026-10-15, simplicity pass H4]. Once it opens, the
 * three real rows come back.
 */
export function collectiveItems(receiptCount: number, covered: boolean): RailItem[] {
  if (covered) return [{ href: '/account/community-spend', label: 'The Collective', soon: true }]
  // Receipts (what you submit) -> My Spending (your own rollup) ->
  // The Collective (everyone's, aggregate only): widening scope.
  return [
    { href: '/account/receipts', label: 'Receipts', count: receiptCount },
    { href: '/account/spending', label: 'My Spending' },
    { href: '/account/community-spend', label: 'The Collective' },
  ]
}

/** The page id in a /dashboard/pages/<id>/... address, or null. */
export function pageIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/dashboard\/pages\/([^/]+)/)
  const id = m?.[1]
  return id && id !== 'new' ? id : null
}

/**
 * Which page the business links point at: the one in the address, else the
 * one last chosen (cookie), else the newest. Only the owner's own pages count.
 */
export function pickPageId(
  pathname: string,
  pages: readonly ShellPage[],
  cookieId: string | null | undefined
): string | null {
  const owned = (id: string | null | undefined) =>
    id && pages.some((p) => p.id === id) ? id : null
  return owned(pageIdFromPath(pathname)) ?? owned(cookieId) ?? pages[0]?.id ?? null
}

/**
 * The page's tools, grouped by the job the owner came to do (founder
 * 2026-11-21: "something better than Page Tools and More Page Tools"; picked
 * "By job").
 */
export function pageToolGroups(
  pageId: string,
  counts: ShellCounts,
  flags: ShellFlags
): RailGroup[] {
  return [
    {
      slug: 'offer',
      label: 'What You Offer',
      items: [
        { href: '/dashboard/products', label: 'Products' },
        { href: '/dashboard/services', label: 'Services' },
        { href: `/dashboard/pages/${pageId}/offerings`, label: 'Offerings' },
        { href: `/dashboard/pages/${pageId}/events`, label: 'Events' },
        ...(flags.bookings
          ? [{ href: `/dashboard/pages/${pageId}/bookings`, label: 'Bookings' }]
          : []),
      ],
    },
    {
      slug: 'show',
      label: 'Photos and Updates',
      items: [
        { href: `/dashboard/pages/${pageId}/media`, label: 'Photos and Media' },
        ...(flags.posts
          ? [{ href: `/dashboard/pages/${pageId}/posts`, label: 'Happening Now' }]
          : []),
        { href: `/dashboard/pages/${pageId}/highlights`, label: 'Highlights' },
        { href: `/dashboard/pages/${pageId}/team`, label: 'Team' },
      ],
    },
    {
      slug: 'trust',
      label: 'Hours and Trust',
      items: [
        { href: `/dashboard/pages/${pageId}/special-hours`, label: 'Special Hours' },
        { href: `/dashboard/pages/${pageId}/locations`, label: 'Locations' },
        { href: `/dashboard/pages/${pageId}/verification`, label: 'Get Verified' },
        { href: `/dashboard/pages/${pageId}/credentials`, label: 'Credentials' },
        { href: `/dashboard/pages/${pageId}/documents`, label: 'Documents' },
        ...(flags.ownerReceipts
          ? [
              {
                href: '/dashboard/receipts',
                label: 'Receipts to Review',
                badge: counts.receiptsToVerify,
                badgeLabel: 'waiting',
              },
            ]
          : []),
      ],
    },
  ]
}

export function buildShellGroups(input: ShellNavInput): RailGroup[] {
  const { isOwner, isAdmin, pageId, counts, flags } = input
  const messages = (href: string): RailItem[] =>
    counts.messagesUnread === undefined
      ? []
      : [{ href, label: 'Messages', badge: counts.messagesUnread, badgeLabel: 'unread' }]

  const business: RailGroup[] = isOwner
    ? [
        {
          slug: 'business',
          label: 'Your Business',
          items: [
            { href: '/dashboard', label: 'Home', exact: true },
            ...(pageId
              ? [
                  { href: `/dashboard/pages/${pageId}/edit`, label: 'Edit Page' },
                  { href: `/dashboard/pages/${pageId}/analytics`, label: 'Insights' },
                ]
              : []),
            // Owners read everything in the dashboard inbox (one inbox).
            ...messages('/dashboard/messages'),
            { href: '/dashboard/upgrade', label: 'Plan' },
          ],
        },
        ...(pageId ? pageToolGroups(pageId, counts, flags) : []),
      ]
    : []

  // You first, then the business (founder 2026-11-21: "Put the you section
  // before the your business section").
  return [
    {
      slug: 'you',
      label: 'You',
      items: [
        { href: '/account', label: 'Overview', exact: true },
        ...(isOwner ? [] : messages('/account/messages')),
        { href: '/account/saved', label: 'Saved', count: counts.saved },
        { href: '/account/reviews', label: 'Reviews', count: counts.reviews },
        {
          href: '/account/claims',
          label: 'Claims',
          count: counts.claims,
          badge: counts.claimsPending,
          badgeLabel: 'pending',
        },
        { href: '/account/activity', label: 'Recently Viewed' },
        { href: '/account/recommended', label: 'Recommended' },
        ...collectiveItems(counts.receipts, flags.collectiveSoon),
      ],
    },
    ...business,
    {
      slug: 'account',
      label: 'Account',
      items: [
        { href: '/account/settings', label: 'Settings' },
        // Gates the link only; /admin still guards itself.
        ...(isAdmin ? [{ href: '/admin', label: 'Admin' }] : []),
      ],
    },
  ]
}

/** Two letters for the page square: "Dana's Kitchen" -> "DK". */
export function pageInitials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const letters = words.slice(0, 2).map((w) => w[0]!.toUpperCase())
  return letters.join('') || 'B'
}
