/**
 * The home page visitor guide's limits and its way out (ticket 146).
 *
 * Kept apart from lib/ai/guide.ts so the client component can import these
 * without pulling the prompt templates into the browser bundle.
 */

/** The most a visitor can type into the guide. */
export const GUIDE_MAX_INPUT = 200
/** Cards shown inline under the guide. */
export const GUIDE_MAX_RESULTS = 6
/** Businesses whose name matches the typed words, shown above the guide's own cards. */
export const GUIDE_MAX_NAME_MATCHES = 3

/** Where any failure sends the visitor: plain search with their own words. */
export function fallbackHref(text: string): string {
  const trimmed = text.trim().slice(0, GUIDE_MAX_INPUT)
  return trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search'
}

/** A chip tapped under the bar: its words join what the visitor typed, unless already there. */
export function withChip(text: string, label: string): string {
  const words = label.toLowerCase()
  const base = text.trim()
  if (!base) return words
  if (base.toLowerCase().includes(words)) return base
  return `${base} ${words}`.slice(0, GUIDE_MAX_INPUT)
}
