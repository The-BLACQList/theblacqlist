import { canAccess, highlightLimit } from '@/lib/stripe/features'
import { isHighlightIcon, type HighlightIconName } from '@/components/entity-page/highlightIcons'
import type { HighlightItem } from '@/types'

// Highlights and process steps (ticket 195): "Why Choose Us" icon bullets or
// "How It Works" numbered steps. The rules shared by the owner's actions, the
// dashboard and the page loader. Pure.

export type HighlightKind = HighlightItem['kind']

export const HIGHLIGHT_KINDS: readonly HighlightKind[] = ['highlight', 'step']

/** The style picker's names, which are also the section's default headings. */
export const HIGHLIGHT_KIND_LABEL: Record<HighlightKind, string> = {
  highlight: 'Why Choose Us',
  step: 'How It Works',
}

export const HIGHLIGHT_TITLE_MAX = 60
export const HIGHLIGHT_TEXT_MAX = 160
export const HIGHLIGHT_COLUMNS = 'id, kind, icon, title, text, sort_order'

/** A row as the owner's editor and the page loader read it. */
export interface OwnerHighlight {
  id: string
  kind: HighlightKind
  icon: HighlightIconName | null
  title: string
  text: string | null
  sort_order: number
}

/** Highlights show on Starter and up, on business pages. */
export function highlightsShowOn(listing: { tier: string | null; entity_type: string }): boolean {
  if (listing.entity_type === 'job' || listing.entity_type === 'event') return false
  return canAccess(listing.tier, 'highlights')
}

/** Adding one: needs room under the plan's limit. Editing, reordering and removing always work. */
export function checkHighlightAdd(tier: string | null, savedCount: number): string | null {
  const limit = highlightLimit(tier)
  if (limit === 0) return 'Highlights come with Starter. Upgrade to add yours.'
  if (savedCount >= limit) {
    return `Your plan includes ${limit} highlights. Remove one to add another.`
  }
  return null
}

export function isHighlightKind(value: unknown): value is HighlightKind {
  return typeof value === 'string' && (HIGHLIGHT_KINDS as readonly string[]).includes(value)
}

/**
 * The kind a new item takes: the page's current one, so a page holds one
 * kind, or the one the owner picked when the list is empty.
 */
export function kindForNew(items: readonly OwnerHighlight[], picked: unknown): HighlightKind {
  if (items[0]) return items[0].kind
  return isHighlightKind(picked) ? picked : 'highlight'
}

/** Rows from the database, checked and in the owner's order. Bad rows are dropped. */
export function toOwnerHighlights(rows: unknown): OwnerHighlight[] {
  if (!Array.isArray(rows)) return []
  const out: OwnerHighlight[] = []
  for (const r of rows as Record<string, unknown>[]) {
    if (typeof r?.id !== 'string' || !isHighlightKind(r.kind)) continue
    if (typeof r.title !== 'string' || !r.title.trim()) continue
    out.push({
      id: r.id,
      kind: r.kind,
      icon: typeof r.icon === 'string' && isHighlightIcon(r.icon) ? r.icon : null,
      title: r.title,
      text: typeof r.text === 'string' && r.text.trim() ? r.text : null,
      sort_order: typeof r.sort_order === 'number' ? r.sort_order : 0,
    })
  }
  return out.sort((a, b) => a.sort_order - b.sort_order)
}

export function toPublicHighlights(items: readonly OwnerHighlight[]): HighlightItem[] {
  return items.map((h) => ({
    id: h.id,
    kind: h.kind,
    icon: h.icon,
    title: h.title.trim(),
    text: h.text?.trim() || null,
  }))
}

export type ParsedHighlight =
  | { ok: true; value: { icon: HighlightIconName | null; title: string; text: string | null } }
  | { ok: false; error: string }

function oneLine(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

/** The owner's form, checked the way the table's CHECKs will, plus the icon allow-list. */
export function parseHighlight(input: {
  icon: unknown
  title: unknown
  text: unknown
}): ParsedHighlight {
  const title = oneLine(input.title)
  const text = oneLine(input.text)
  if (!title) return { ok: false, error: 'Add a title.' }
  if (title.length > HIGHLIGHT_TITLE_MAX) {
    return { ok: false, error: `Keep the title to ${HIGHLIGHT_TITLE_MAX} characters.` }
  }
  if (text.length > HIGHLIGHT_TEXT_MAX) {
    return { ok: false, error: `Keep the description to ${HIGHLIGHT_TEXT_MAX} characters.` }
  }
  let icon: HighlightIconName | null = null
  if (input.icon !== null && input.icon !== undefined && input.icon !== '') {
    if (typeof input.icon !== 'string' || !isHighlightIcon(input.icon)) {
      return { ok: false, error: 'Choose an icon from the list.' }
    }
    icon = input.icon
  }
  return { ok: true, value: { icon, title, text: text || null } }
}
