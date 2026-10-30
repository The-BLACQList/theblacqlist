/**
 * The site assistant's limits and answer shapes (ticket 147, named Cue in
 * ticket 148).
 *
 * Kept apart from lib/ai/assistant.ts so client components can import these
 * without pulling the prompt templates into the browser bundle.
 */

/** Earlier visitor messages sent with each ask, so follow-ups make sense. */
export const ASSISTANT_HISTORY = 3
/** The most needs one answer lists. */
export const ASSISTANT_MAX_NEEDS = 6
/** Cards per need when the answer lists several needs. */
export const ASSISTANT_TOP = 3
/** Cards when the answer is one need, like the home guide. */
export const ASSISTANT_TOP_SINGLE = 6

/** A business card as the assistant shows it. Public listing data only. */
export interface AssistantCard {
  id: string
  name: string
  href: string
  categoryName: string
  /** "Detroit, MI", or null for online or multi-city listings. */
  cityLabel: string | null
  rating: number | null
  reviewCount: number
  imageSrc: string | null
}

/**
 * found: we list it where they asked.
 * close: nothing exact, a close kind of business in the same place.
 * nearest: nothing there, the same thing in the nearest city we cover.
 * none: not on The BLACQList yet.
 */
export type AssistantNeedStatus = 'found' | 'close' | 'nearest' | 'none'

/**
 * The checked search plan behind a need. The chat sends the last answer's
 * plans back as `previous`, so "in atlanta" re-runs only the last need.
 */
export interface AssistantSearchPlan {
  /** Category slug, or null when the need searches by words only. */
  category: string | null
  keywords: string[]
  openNow: boolean
}

export interface AssistantNeedResult {
  name: string
  status: AssistantNeedStatus
  /** Fixed wording built from checked values. */
  line: string
  total: number
  top: AssistantCard[]
  seeAllHref: string | null
  plan: AssistantSearchPlan
}

/**
 * Something Cue can do on the page the visitor is on (ticket 148). The server
 * builds every one from an allow-list; the model only picks codes.
 *
 * scroll: runs on its own, jumps to the first id found and highlights it.
 * link, external, ask: shown as buttons and wait for a tap.
 */
export type AssistantAction =
  | { kind: 'scroll'; ids: string[]; label: string }
  | { kind: 'link'; href: string; label: string }
  | { kind: 'external'; href: string; label: string }
  | { kind: 'ask'; text: string; label: string }

/** The most actions one answer offers. */
export const ASSISTANT_MAX_ACTIONS = 3
/** Longest opener Cue may write. */
export const ASSISTANT_OPENER_MAX = 160
/** Longest page path the chat sends. */
export const ASSISTANT_PAGE_MAX = 300

export type AssistantResponse =
  | {
      kind: 'answer'
      heading: string
      /** Cue's own first sentence, checked, or null when it failed a check. */
      opener: string | null
      /** "We don't list businesses in Alaska yet.", or null. */
      notice: string | null
      /** One line for the status region: "Found 3 of 4 needs, 1 not listed." */
      summary: string
      needs: AssistantNeedResult[]
      /** Businesses whose name holds the typed words. Shown first. */
      nameMatches: AssistantCard[]
      page: { label: string; href: string } | null
      /** Plain search with the visitor's words, for "Search instead". */
      searchHref: string
      /** Things Cue can do on this page. Empty off the pages it knows. */
      actions: AssistantAction[]
      /** The answer used the visitor's location, so a follow-up asks again. */
      near: boolean
    }
  | { kind: 'fallback'; href: string; reason: 'limited' | 'error' }
