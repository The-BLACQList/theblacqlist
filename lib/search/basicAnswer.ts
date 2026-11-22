// The quick answer above the /search grid (ticket 255).
//
// Cue's AI answer needs the flag, the kill switch off, the visitor's Cue
// allowance, the monthly ceiling and a working model. When any of those says
// no, the strip used to vanish, and a search like "How do I switch to Black
// Owned bathroom products" showed nothing at all (founder, 2026-11-21). The
// strip now always answers: this builds a short answer from our own listings,
// with no model call, in the same shape as Cue's reply.
//
//   * strict matches first: the same search the grid runs, including the
//     understood form from ticket 254
//   * fewer than three: close matches from the category the words point to,
//     or from its group when that category has no one in it yet (ticket 257)
//   * fewer than three: a Related Businesses row, found by meaning, when
//     meaning search is on (ticket 260). Strict matches stay first.
//   * a Browse {Category} link, and Suggest a Business when we came up short
//
// No remark on ownership (#299). No text the visitor typed is stored or
// logged; it only appears back to them in the answer.
//
// No server imports: the route hands in the search and the category list, and
// tests/search-basic-answer.test.ts runs it with fakes.

import type { AssistantAction, AssistantCard } from '@/lib/ai/assistant-limits'
import type { AssistantCategory } from '@/lib/ai/assistant'
import { CUE_MAX_CARDS, toCard } from '@/lib/ai/cue/tools'
import { DEFAULT_RADIUS_MILES } from '@/lib/listings/location-params'
import type { ListingsParams, ListingsResult } from '@/lib/listings/query'
import { categoryFilterHref } from '@/lib/listings/url'
import { matchCategories, normalizeQuery, stem } from '@/lib/search/assist'
import { CATEGORY_KEYWORDS } from '@/lib/search/categoryKeywords'
import { RELATED_MAX, wantsRelated } from '@/lib/search/hybrid'
import { echoWords, INTENT_FAMILIES, understandQuery, type UnderstoodQuery } from '@/lib/search/understand'

/** Below this many strict matches, close matches from the category are added. */
export const CLOSE_MATCH_BELOW = 3
/** The longest echo of the visitor's words in the answer text. */
const LABEL_MAX = 60

export const SUGGEST_BUSINESS: AssistantAction = {
  kind: 'link',
  href: '/add-business',
  label: 'Suggest a Business',
}

/** How many strict matches there were, as the analytics event counts them. */
export type ExactBucket = '0' | '1-2' | '3+'

export interface BasicAnswer {
  text: string
  cards: AssistantCard[]
  actions: AssistantAction[]
  exactBucket: ExactBucket
  /** Cards in the Related Businesses row (ticket 260). */
  related: number
}

export interface BasicAnswerParts {
  query: string
  understood: UnderstoodQuery
  exact: readonly AssistantCard[]
  close: readonly AssistantCard[]
  /** Found by meaning, best first (ticket 260). Shown after the matches. */
  related?: readonly AssistantCard[]
  category: { name: string; slug: string } | null
  near: boolean
  /**
   * Whether the strict matches came from the understood form (true) or the
   * search as typed (false). The echo follows the search that found them:
   * "The Shop ATL" found as typed is echoed as typed, not as "atl". Unset:
   * the understood words when there are some (ticket 255 behaviour).
   */
  rescued?: boolean
}

function bucket(n: number): ExactBucket {
  return n === 0 ? '0' : n < CLOSE_MATCH_BELOW ? '1-2' : '3+'
}

/** The words to echo back: what carried the search, or what was typed. */
function labelFor(query: string, understood: UnderstoodQuery, rescued: boolean | undefined): string {
  const words =
    rescued === false
      ? echoWords(query)
      : understood.mode === 'search'
        ? understood.words.join(' ')
        : normalizeQuery(query)
  if (words.length <= LABEL_MAX) return words
  return `${words.slice(0, LABEL_MAX).replace(/\s+\S*$/, '')}…`
}

/** Pure: the answer text, cards and actions. Never empty. */
export function composeBasicAnswer(parts: BasicAnswerParts): BasicAnswer {
  const { understood, category, near } = parts
  const label = labelFor(parts.query, understood, parts.rescued)
  const exactIds = new Set(parts.exact.map((c) => c.id))
  const exact = parts.exact.slice(0, CUE_MAX_CARDS)
  // Related ones take their room first: they are about the words, close
  // matches are only the category (ticket 260).
  const related = (parts.related ?? [])
    .filter((c) => !exactIds.has(c.id))
    .slice(0, Math.min(RELATED_MAX, CUE_MAX_CARDS - exact.length))
    .map((c) => ({ ...c, related: true }))
  const relatedIds = new Set(related.map((c) => c.id))
  const close = parts.close
    .filter((c) => !exactIds.has(c.id) && !relatedIds.has(c.id))
    .slice(0, CUE_MAX_CARDS - exact.length - related.length)
  const cards = [...exact, ...close, ...related]
  const where = near ? ' near you' : ''

  let text: string
  if (understood.mode === 'browse') {
    text = exact.length > 0
      ? `Here are a few businesses to start with${where}. Add what you need, like a kind of business or a city, to narrow it down.`
      : 'Add what you need, like a kind of business or a city, and we’ll find it.'
  } else if (exact.length > 0) {
    const lead = exact.length === 1 ? 'Here’s the business' : 'Here are businesses'
    const match = exact.length === 1 ? 'matches' : 'match'
    text = `${lead}${where} that ${match} “${label}”.`
    if (close.length > 0 && category) text += ` A few more in ${category.name} follow.`
    else if (related.length > 0) text += ' Related businesses follow.'
  } else if (related.length > 0) {
    text = `Nothing${where} matches “${label}” word for word yet. Here are related businesses.`
    if (close.length > 0 && category) text += ` More in ${category.name} too.`
  } else if (close.length > 0 && category) {
    text = `Nothing${where} matches “${label}” yet, so here are the closest: businesses in ${category.name}.`
  } else {
    text = `Nothing${where} matches “${label}” yet. Try a broader word, or suggest a business you know so we can add it.`
  }

  const actions: AssistantAction[] = []
  const categoryHref = category ? categoryFilterHref(category) : null
  if (category && categoryHref) actions.push({ kind: 'link', href: categoryHref, label: `Browse ${category.name}` })
  if (understood.mode !== 'browse' && exact.length < CLOSE_MATCH_BELOW) actions.push(SUGGEST_BUSINESS)

  return { text, cards, actions, exactBucket: bucket(parts.exact.length), related: related.length }
}

export interface BasicAnswerDeps {
  /**
   * queryListings: the entities, and `understood` when they came from the
   * understood form rather than the search as typed.
   */
  search: (params: ListingsParams) => Promise<Pick<ListingsResult, 'entities' | 'understood'>>
  /** Active categories, or null when they could not be read. */
  categories: readonly AssistantCategory[] | null
  /**
   * Businesses close in meaning to the words, best first (ticket 260). Unset
   * or empty when meaning search is off.
   */
  related?: (request: {
    text: string
    exclude: readonly string[]
    near: { lat: number; lng: number } | null
  }) => Promise<AssistantCard[]>
}

/** The words that point to a category: what carried the search, plus intent words. */
function categoryText(query: string, understood: UnderstoodQuery): string {
  if (understood.mode === 'browse') return ''
  if (understood.words.length === 0) return query
  const intent = understood.words.flatMap((w) => INTENT_FAMILIES[w] ?? INTENT_FAMILIES[stem(w)] ?? [])
  return [...understood.words, ...intent].join(' ')
}

/**
 * The quick answer for one search. Each read that fails counts as nothing
 * found, so this always resolves with something to show.
 */
export async function buildBasicAnswer(
  query: string,
  near: { lat: number; lng: number } | null,
  deps: BasicAnswerDeps
): Promise<BasicAnswer> {
  const understood = understandQuery(query)
  const base: ListingsParams = {
    page: 1,
    // No paid slots: the strip never counts an impression.
    noSponsored: true,
    ...(near
      ? { lat: near.lat, lng: near.lng, radius: DEFAULT_RADIUS_MILES, sort: 'distance' }
      : { sort: 'relevance' }),
  }
  const find = async (params: ListingsParams): Promise<{ cards: AssistantCard[]; rescued: boolean }> => {
    try {
      const found = await deps.search({ ...base, ...params })
      return {
        cards: found.entities.filter((e) => !e.sponsored_placement_id).map(toCard),
        rescued: found.understood !== undefined,
      }
    } catch {
      return { cards: [], rescued: false }
    }
  }

  const text = categoryText(query, understood)
  const match = deps.categories && text ? matchCategories(text, deps.categories, CATEGORY_KEYWORDS, 1)[0] : undefined
  let category = match ? { name: match.category.name, slug: match.category.slug } : null

  const exact = await find({ q: query })
  let close: AssistantCard[] = []
  if (category && exact.cards.length < CLOSE_MATCH_BELOW) {
    close = (await find({ category: category.slug })).cards
    // No one filed there yet ("computer support" → IT Support, empty on
    // production): the group it sits in, and Browse that instead.
    const parent = match?.category.parentId
      ? deps.categories?.find((c) => c.id === match.category.parentId)
      : undefined
    if (close.length === 0 && parent) {
      const wider = (await find({ category: parent.slug })).cards
      if (wider.length > 0) {
        close = wider
        category = { name: parent.name, slug: parent.slug }
      }
    }
  }

  // Meaning search on the understood words: "bathroom", not "how do I switch
  // to Black Owned". Browse mode has none, so nothing is looked up; with
  // nothing to understand, the words as typed.
  let related: AssistantCard[] = []
  const relatedText =
    understood.mode === 'browse'
      ? ''
      : understood.mode === 'search' && understood.words.length > 0
        ? understood.words.join(' ')
        : normalizeQuery(query)
  if (deps.related && relatedText && wantsRelated(exact.cards.length)) {
    try {
      related = await deps.related({ text: relatedText, exclude: exact.cards.map((c) => c.id), near })
    } catch {
      related = []
    }
  }

  return composeBasicAnswer({
    query,
    understood,
    exact: exact.cards,
    close,
    related,
    category,
    near: near !== null,
    // Only meaningful when something was found; an empty search echoes as before.
    rescued: exact.cards.length > 0 ? exact.rescued : undefined,
  })
}
