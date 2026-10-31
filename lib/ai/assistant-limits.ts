/**
 * Cue's reply shapes (tickets 148 and 169): the cards, the page actions and
 * one reply as the chat keeps it.
 *
 * Kept apart from lib/ai/assistant.ts so client components can import these
 * without pulling server code into the browser bundle.
 */

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

/** Longest page path the chat sends. */
export const ASSISTANT_PAGE_MAX = 300

/**
 * One Cue reply as the chat keeps it (ticket 169). `text` is Cue's checked
 * reply in its own words; `cards` are the businesses it chose to show.
 */
export type CueReply =
  | {
      kind: 'reply'
      text: string
      cards: AssistantCard[]
      actions: AssistantAction[]
      /** The visitor's location went with this ask, so a follow-up asks again. */
      near: boolean
      /** The visitor pressed Stop before Cue finished. */
      stopped?: boolean
    }
  | { kind: 'fallback'; href: string; reason: 'limited' | 'error' }
