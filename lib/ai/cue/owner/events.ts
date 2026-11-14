/**
 * The wire format between /api/cue/owner and the dashboard panel (ticket 203).
 *
 * Same framing as the visitor Cue (one JSON object per line, lib/ai/cue/stream.ts),
 * with the owner's own events: `draft` cards the owner can use or set aside,
 * and `links` to places on the dashboard we built (never a free URL).
 *
 * Shared by the route and the browser, so no server imports.
 */

/** What draft_text can write, and the writing-help agent behind each. */
export const OWNER_DRAFT_KINDS = {
  about: { agentType: 'listing_description', label: 'About', replaces: 'your current About' },
  search_title: {
    agentType: 'seo_coach_title',
    label: 'Search title',
    replaces: 'your current search title',
  },
  search_description: {
    agentType: 'seo_coach_description',
    label: 'Search description',
    replaces: 'your current search description',
  },
} as const

export type OwnerDraftKind = keyof typeof OWNER_DRAFT_KINDS

export const OWNER_DRAFT_KIND_IDS = Object.keys(OWNER_DRAFT_KINDS) as OwnerDraftKind[]

/** A pending suggestion. Nothing is on the page until the owner chooses "Use this". */
export interface OwnerDraft {
  suggestionId: string
  kind: OwnerDraftKind
  listingId: string
  pageName: string
  text: string
  /** True when the scripted stand-in wrote it (no key on this deployment). */
  sample: boolean
}

export interface OwnerLink {
  label: string
  href: string
}

export type OwnerCueEvent =
  | { type: 'status'; text: string }
  | { type: 'text'; text: string }
  | { type: 'draft'; draft: OwnerDraft }
  | { type: 'links'; links: OwnerLink[] }
  | { type: 'done'; text: string }
  | { type: 'fallback'; reason: 'limited' | 'error' | 'auth' }

export const OWNER_CUE_EVENT_TYPES: ReadonlySet<string> = new Set([
  'status',
  'text',
  'draft',
  'links',
  'done',
  'fallback',
])

/** What the panel says for a fallback. */
export const OWNER_FALLBACK_TEXT: Record<'limited' | 'error' | 'auth', string> = {
  limited: "That's all Cue can answer for now. Try again later, or use the edit page directly.",
  error: "Cue couldn't answer that just now. Try again, or ask it another way.",
  auth: 'Sign in again to ask Cue.',
}
