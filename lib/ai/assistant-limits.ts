/**
 * The site assistant's limits and answer shapes (ticket 147).
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

export interface AssistantNeedResult {
  name: string
  status: AssistantNeedStatus
  /** Fixed wording built from checked values. */
  line: string
  total: number
  top: AssistantCard[]
  seeAllHref: string | null
}

export type AssistantResponse =
  | {
      kind: 'answer'
      heading: string
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
    }
  | { kind: 'fallback'; href: string; reason: 'limited' | 'error' }
