// Tabs on the owner edit page (owner-experience round 2, part C, 2026-11-13).
//
// The edit page used to be one long scroll of about 20 cards. In edit mode the
// cards are grouped into tabs; a new page (/add-business/finish) keeps the
// scroll. Every card keeps its anchor id (`#hours`, `#main-button`), which is
// also the id it saves under (useSectionSave), so the strength meter, a failed
// save and links like `/edit#photos` all find the tab a card is in from here.
//
// Pure and client-safe.

export const EDIT_TABS = [
  { id: 'basics', label: 'Basics' },
  { id: 'contact', label: 'Contact & buttons' },
  { id: 'media', label: 'Photos & video' },
  { id: 'services', label: 'Services' },
  { id: 'social', label: 'Social & links' },
  { id: 'more', label: 'More' },
] as const

export type EditTabId = (typeof EDIT_TABS)[number]['id']

/**
 * Every card on the page, by anchor id, in the order each tab shows them. A
 * card the page doesn't have (hours on a creator page) is simply skipped.
 */
export const TAB_SECTIONS: Record<EditTabId, readonly string[]> = {
  basics: ['basics', 'about', 'role', 'collective-name'],
  contact: ['contact', 'hours', 'main-button'],
  media: ['photos', 'video'],
  services: ['services', 'details'],
  social: ['social', 'links'],
  more: ['faq', 'partnerships', 'google'],
}

/** The order of the one long scroll a new page keeps. Same cards as the tabs. */
export const SCROLL_ORDER: readonly string[] = [
  'basics',
  'about',
  'contact',
  'hours',
  'photos',
  'main-button',
  'services',
  'role',
  'details',
  'partnerships',
  'collective-name',
  'social',
  'video',
  'links',
  'faq',
  'google',
]

export const DEFAULT_TAB: EditTabId = 'basics'

export function isEditTab(value: unknown): value is EditTabId {
  return typeof value === 'string' && EDIT_TABS.some((t) => t.id === value)
}

/** The tab a card is in. Accepts `#hours` or `hours`. Null for an unknown card. */
export function tabForAnchor(anchor: string | null | undefined): EditTabId | null {
  const id = (anchor ?? '').replace(/^#/, '')
  if (!id) return null
  for (const tab of EDIT_TABS) {
    if (TAB_SECTIONS[tab.id].includes(id)) return tab.id
  }
  return null
}

/**
 * The tab to open: a card in the address (`#photos`) wins, then `?tab=`, then
 * Basics. The card wins because it is the more specific link.
 */
export function initialTab(tabParam: unknown, hash?: string | null): EditTabId {
  // `?tab=a&tab=b` arrives as an array; the first one counts.
  const param: unknown = Array.isArray(tabParam) ? tabParam[0] : tabParam
  return tabForAnchor(hash) ?? (isEditTab(param) ? param : DEFAULT_TAB)
}

/** Tabs with a card that has unsaved changes, so the tab can say so. */
export function tabsWithChanges(dirtyIds: readonly string[]): Set<EditTabId> {
  const out = new Set<EditTabId>()
  for (const id of dirtyIds) {
    const tab = tabForAnchor(id)
    if (tab) out.add(tab)
  }
  return out
}

/** The tab after this one, for the "Next" button at the end of a tab. Null on the last. */
export function nextTab(id: EditTabId): (typeof EDIT_TABS)[number] | null {
  const i = EDIT_TABS.findIndex((t) => t.id === id)
  return i >= 0 ? (EDIT_TABS[i + 1] ?? null) : null
}
