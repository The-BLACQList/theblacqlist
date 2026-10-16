/**
 * Writing help inside Edit content (ticket 138): the shared types, copy and the
 * per-field state machine. No server imports, so client components can use it.
 *
 * Each field with help (the about text, the search title, the search
 * description) keeps its value and its suggestion card in one reducer. That
 * keeps "Use this" and "Put mine back" honest: the value the owner had before
 * Use this is stored with the card that replaced it, and nothing else can
 * change it in between.
 */

export type HelpAgent =
  | 'listing_description'
  | 'seo_coach_title'
  | 'seo_coach_description'
  | 'social_caption_instagram'

export type WritingAllowance =
  | { state: 'off' }
  | { state: 'locked' }
  | {
      state: 'ready'
      /** Drafts the plan includes per 30 days. Null means no monthly cap. */
      limit: number | null
      /** Drafts left in the window. Null when there is no cap. */
      left: number | null
      /** When the oldest counted draft leaves the window (ISO), or null. */
      resetsOn: string | null
      /** Requests one page can make in 24 hours. */
      perDay: number
      /** True once this page has made the day's maximum requests. */
      dailyHit: boolean
    }

export interface Suggestion {
  id: string
  text: string
  /** True for the free sample writer that runs without a model key. */
  sample: boolean
}

/** Newest open suggestion per field, loaded with the page. */
export type InitialSuggestions = Partial<Record<HelpAgent, Suggestion>>

export const WRITE_BUTTON: Record<HelpAgent, string> = {
  listing_description: 'Write one for me',
  seo_coach_title: 'Write a search title',
  seo_coach_description: 'Write a search description',
  social_caption_instagram: 'Write an Instagram caption',
}

/** What the status line calls the field after a save. */
export const FIELD_NAME: Record<HelpAgent, string> = {
  listing_description: 'About text',
  seo_coach_title: 'Search title',
  seo_coach_description: 'Search description',
  social_caption_instagram: 'Caption',
}

export const CLOSING_NOTE =
  'You decide every word. A suggestion reaches your page only when you tap Use this and then save.'

export const UNCHANGED_NOTE = 'Your box above is unchanged.'

/** "November 3", in UTC so the server and the browser agree. */
export function formatResetDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })
}

export function monthlyUsedUpMessage(resetsOn: string | null): string {
  return resetsOn
    ? `No drafts left this month. More on ${formatResetDate(resetsOn)}.`
    : 'No drafts left this month.'
}

export function dailyLimitMessage(perDay: number, left: number | null): string {
  const base = `That's ${perDay} drafts for this page today. You can ask again tomorrow.`
  if (left === null) return base
  return `${base} You still have ${left} left this month.`
}

/** Why every Write button is off right now, or null when they can be used. */
export function writeBlockedReason(allowance: WritingAllowance): string | null {
  if (allowance.state !== 'ready') return null
  if (allowance.left === 0) return monthlyUsedUpMessage(allowance.resetsOn)
  if (allowance.dailyHit) return dailyLimitMessage(allowance.perDay, allowance.left)
  return null
}

// ── Per-field state ──────────────────────────────────────────────────────────

export type Card =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'shown'; suggestion: Suggestion }
  /** Use this was tapped: the text is in the field, not saved yet. */
  | { kind: 'used'; suggestion: Suggestion; previous: string }
  | { kind: 'whyNot'; suggestion: Suggestion }
  /** Not this was answered (Send or Skip). */
  | { kind: 'dismissed' }
  /** `limit` marks a daily or monthly limit: a grey note, not a red error. */
  | { kind: 'error'; message: string; limit?: boolean }
  /** The section saved with a used suggestion in it. */
  | { kind: 'saved' }

export interface FieldHelp {
  value: string
  card: Card
}

export type FieldHelpAction =
  | { type: 'edit'; value: string }
  | { type: 'request' }
  | { type: 'received'; suggestion: Suggestion }
  | { type: 'failed'; message: string; limit?: boolean }
  | { type: 'use' }
  | { type: 'putBack' }
  | { type: 'notThis' }
  | { type: 'rejected' }
  | { type: 'saved' }

export function initialFieldHelp(value: string, suggestion?: Suggestion): FieldHelp {
  return { value, card: suggestion ? { kind: 'shown', suggestion } : { kind: 'idle' } }
}

export function fieldHelpReducer(state: FieldHelp, action: FieldHelpAction): FieldHelp {
  const { card } = state
  switch (action.type) {
    case 'edit':
      return { ...state, value: action.value }
    case 'request':
      // A used card is waiting for Save or Put mine back; a new request would
      // throw away the owner's earlier text with no way back.
      if (card.kind === 'used' || card.kind === 'loading') return state
      return { ...state, card: { kind: 'loading' } }
    case 'received':
      return { ...state, card: { kind: 'shown', suggestion: action.suggestion } }
    case 'failed':
      return { ...state, card: { kind: 'error', message: action.message, limit: action.limit } }
    case 'use':
      if (card.kind !== 'shown') return state
      return {
        value: card.suggestion.text,
        card: { kind: 'used', suggestion: card.suggestion, previous: state.value },
      }
    case 'putBack':
      if (card.kind !== 'used') return state
      return { value: card.previous, card: { kind: 'shown', suggestion: card.suggestion } }
    case 'notThis':
      if (card.kind !== 'shown') return state
      return { ...state, card: { kind: 'whyNot', suggestion: card.suggestion } }
    case 'rejected':
      if (card.kind !== 'whyNot') return state
      return { ...state, card: { kind: 'dismissed' } }
    case 'saved':
      if (card.kind !== 'used') return state
      return { ...state, card: { kind: 'saved' } }
  }
}

/** The suggestion id a section's save should send, if any. */
export function usedSuggestionId(state: FieldHelp): string | null {
  return state.card.kind === 'used' ? state.card.suggestion.id : null
}
