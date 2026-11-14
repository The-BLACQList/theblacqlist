/**
 * Where the owner Cue can send an owner (ticket 203): a fixed list of edit
 * page cards and dashboard pages. `go_to` builds links from this list only, so
 * the model can never put a free URL on screen.
 *
 * Pure and client-safe.
 */

import type { FeatureFlag } from '@/lib/env'

interface EditSection {
  label: string
  /** The card's anchor on the edit page (lib/listings/editTabs.ts). */
  anchor: string
  flag?: FeatureFlag
}

interface PageSection {
  label: string
  /** The path under /dashboard/pages/[id]/, or a whole dashboard path. */
  path: string
  perPage: boolean
  flag?: FeatureFlag
}

export const EDIT_SECTIONS = {
  basics: { label: 'Basics', anchor: 'basics' },
  about: { label: 'About', anchor: 'about' },
  contact: { label: 'Contact', anchor: 'contact' },
  hours: { label: 'Hours', anchor: 'hours' },
  photos: { label: 'Photos', anchor: 'photos' },
  video: { label: 'Video', anchor: 'video' },
  main_button: { label: 'Buttons', anchor: 'main-button' },
  services: { label: 'Services', anchor: 'services' },
  details: { label: 'Details', anchor: 'details' },
  social: { label: 'Social links', anchor: 'social' },
  links: { label: 'Links', anchor: 'links' },
  faq: { label: 'Common questions', anchor: 'faq' },
  google: { label: 'Google', anchor: 'google' },
  happening_now: { label: 'Happening now', anchor: 'happening-now', flag: 'happeningNow' },
  deals: { label: 'Deals', anchor: 'deals', flag: 'coupons' },
  order_on: { label: 'Order on', anchor: 'order-on', flag: 'orderWhereSold' },
  where_sold: { label: 'Find us at', anchor: 'where-sold', flag: 'orderWhereSold' },
  location: { label: 'Where to find us', anchor: 'location', flag: 'orderWhereSold' },
} as const satisfies Record<string, EditSection>

export const PAGE_SECTIONS = {
  my_pages: { label: 'My pages', path: '/dashboard/pages', perPage: false },
  messages: { label: 'Messages', path: '/dashboard/messages', perPage: false, flag: 'messaging' },
  inbox_settings: {
    label: 'Inbox settings',
    path: '/dashboard/messages/settings',
    perPage: false,
    flag: 'messaging',
  },
  upgrade: { label: 'Upgrade', path: '/dashboard/upgrade', perPage: false },
  edit: { label: 'Edit content', path: 'edit', perPage: true },
  analytics: { label: 'Analytics', path: 'analytics', perPage: true },
  posts: { label: 'Happening now posts', path: 'posts', perPage: true, flag: 'happeningNow' },
  offerings: { label: 'Offerings', path: 'offerings', perPage: true },
  media: { label: 'Media', path: 'media', perPage: true },
  verification: { label: 'Get Verified', path: 'verification', perPage: true },
} as const satisfies Record<string, PageSection>

export type OwnerSection = keyof typeof EDIT_SECTIONS | keyof typeof PAGE_SECTIONS

export const OWNER_SECTION_IDS = [
  ...Object.keys(EDIT_SECTIONS),
  ...Object.keys(PAGE_SECTIONS),
] as OwnerSection[]

function flagOf(section: OwnerSection): FeatureFlag | undefined {
  const entry: EditSection | PageSection =
    section in EDIT_SECTIONS
      ? EDIT_SECTIONS[section as keyof typeof EDIT_SECTIONS]
      : PAGE_SECTIONS[section as keyof typeof PAGE_SECTIONS]
  return entry.flag
}

/** The sections this deployment has, given which flags are on. */
export function availableSections(isOn: (flag: FeatureFlag) => boolean): OwnerSection[] {
  return OWNER_SECTION_IDS.filter((s) => {
    const flag = flagOf(s)
    return !flag || isOn(flag)
  })
}

/**
 * The link for a section. Null for an unknown section, or a per-page one with
 * no page. The listing id must already be one the caller owns.
 */
export function sectionLink(
  section: string,
  listingId: string | null,
  pageName?: string | null
): { label: string; href: string } | null {
  if (section in EDIT_SECTIONS) {
    if (!listingId) return null
    const s = EDIT_SECTIONS[section as keyof typeof EDIT_SECTIONS]
    return {
      label: pageName ? `${s.label} on ${pageName}` : s.label,
      href: `/dashboard/pages/${listingId}/edit#${s.anchor}`,
    }
  }
  if (section in PAGE_SECTIONS) {
    const s: PageSection = PAGE_SECTIONS[section as keyof typeof PAGE_SECTIONS]
    if (!s.perPage) return { label: s.label, href: s.path }
    if (!listingId) return null
    return {
      label: pageName ? `${s.label} for ${pageName}` : s.label,
      href: `/dashboard/pages/${listingId}/${s.path}`,
    }
  }
  return null
}

/** The edit section a strength-meter anchor (`#hours`) belongs to. */
export function sectionForAnchor(anchor: string): OwnerSection | null {
  const id = anchor.replace(/^#/, '')
  for (const [key, s] of Object.entries(EDIT_SECTIONS)) {
    if (s.anchor === id) return key as OwnerSection
  }
  return null
}
