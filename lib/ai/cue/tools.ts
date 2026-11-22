/**
 * Cue's tools (ticket 169).
 *
 * The model asks; this file answers from our own data. Every tool returns
 * public listing fields only, and every input is checked with zod before it
 * runs, because a streamed tool input can arrive cut short.
 *
 * ── Why search works the way it does ─────────────────────────────────────────
 * Most listings are filed on a top-level group only (621 of 707 on prod,
 * 2026-10-29), and owners describe themselves in their own words: a law firm
 * never says "lawyer". So `search_listings` turns the model's words into an
 * any-word search ("lawyer OR attorney OR "law firm" ..."), adds the words
 * people use for the category, and when a subcategory finds nothing it looks
 * once more in the parent group and says so. `search_prefix_tsquery` steps
 * aside for a query with OR or quotes, so the any-word query goes to
 * websearch_to_tsquery alone, which reads an uppercase OR and quoted phrases.
 *
 * ── Turn state ───────────────────────────────────────────────────────────────
 * The model may only show, or ask about, businesses a tool returned this turn
 * or the cards shown last turn. Anything else is refused, so it cannot put a
 * made-up id on screen.
 *
 * Nothing here logs, and nothing the visitor typed is stored.
 */

import type Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

import type { AssistantAction, AssistantCard } from '@/lib/ai/assistant-limits'
import { nameWords, nearestCities, type AssistantCategory } from '@/lib/ai/assistant'
import { sanitizeForPrompt } from '@/lib/ai/sanitize'
import type { PageContext } from '@/lib/assistant/page'
import { resolveMediaPath } from '@/lib/listings/coverImage'
import { formatTime } from '@/lib/listings/openStatus'
import { WEEK_DAYS } from '@/lib/listings/hours'
import { DEFAULT_RADIUS_MILES } from '@/lib/listings/location-params'
import type { ListingsParams } from '@/lib/listings/query'
import { buildEntityUrl } from '@/lib/listings/url'
import { distanceMiles, type LatLng } from '@/lib/map/distance'
import { FILLER_WORDS, findPlaces, matchCategories, type AssistCity } from '@/lib/search/assist'
import { CATEGORY_KEYWORDS } from '@/lib/search/categoryKeywords'
import { wantsRelated, type RelatedStats } from '@/lib/search/hybrid'
import { intentWords, isGenericObject, queryWords } from '@/lib/search/understand'
import type { DiscoveryEntity, WeeklyHours } from '@/types'

// ─── Limits ──────────────────────────────────────────────────────────────────

/** Results one search hands the model. */
export const CUE_SEARCH_RESULTS = 8
/** Cards one reply shows. */
export const CUE_MAX_CARDS = 6
/** Terms in one any-word query. More only dilutes the ranking. */
export const CUE_MAX_TERMS = 12
/** Nearest covered cities offered for a place we do not cover. */
const NEAREST_CITY_COUNT = 3
/** Close matches offered when a search finds nothing (ticket 256). */
export const CUE_CLOSE_RESULTS = 5
/** Close matches kept even when related businesses take the room (ticket 263). */
export const CUE_CLOSE_MIN = 2
const SNIPPET_CHARS = 160
const DETAIL_CHARS = 600

/** Words that say what the need is for, not what it is ("birthday cake" is a cake). */
export const OCCASION_WORDS: ReadonlySet<string> = new Set([
  'birthday',
  'party',
  'wedding',
  'baby',
  'shower',
  'graduation',
  'anniversary',
  'holiday',
])

/** The categories where an occasion word is the need itself ("party planner"). */
export const EVENTS_FAMILY: ReadonlySet<string> = new Set([
  'event-planning',
  'venue-rental',
  'party-supplies-rentals',
  'catering-events-food',
  'event-photography',
])

/** Category name words too broad to search a group by. */
const GENERIC_NAME_WORDS = new Set([
  'and',
  'shops',
  'shop',
  'stores',
  'store',
  'services',
  'service',
  'other',
  'live',
])

// ─── Inputs ──────────────────────────────────────────────────────────────────

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]{1,80}$/)
const listingId = z.string().uuid()

export const searchInput = z
  .object({
    words: z
      .array(z.string().trim().min(1).max(40))
      .min(1)
      .max(8)
      .describe(
        'What the visitor wants, as short words or phrases: the kind of business, product or service, and synonyms. Never place names, never identity words.'
      ),
    category: slug.optional().describe('A category slug from the list, when one clearly fits.'),
    city: slug.optional().describe('A covered city slug. Leave out to search everywhere.'),
    near_me: z
      .boolean()
      .optional()
      .describe(
        'True to search near the visitor. Only when the context says their location is shared.'
      ),
    open_now: z.boolean().optional().describe('True only when the visitor asked for open now.'),
  })
  .strict()

export const findPlaceInput = z
  .object({
    place: z.string().trim().min(2).max(80).describe('A city, state, or area the visitor named.'),
  })
  .strict()

export const getListingInput = z
  .object({
    id: listingId.describe('An id from a search result this turn, or a card shown last turn.'),
  })
  .strict()

export const showInput = z
  .object({
    ids: z
      .array(listingId)
      .min(1)
      .max(CUE_MAX_CARDS)
      .describe('The businesses to show as cards, best first.'),
  })
  .strict()

export const pageActionInput = z
  .object({
    codes: z
      .array(z.string().trim().min(1).max(40))
      .min(1)
      .max(3)
      .describe('Action codes from the page context.'),
  })
  .strict()

/**
 * What show_businesses accepts, which is looser than what the model is told
 * (`showInput`). The model sometimes passes every search result (8) or one
 * garbled id; failing the whole call left the reply with no cards and a "the
 * cards failed, I'll retry" note (ticket 261). Ids that aren't ids are dropped
 * here, and the handler keeps the first CUE_MAX_CARDS it knows.
 */
const showParse = z
  .object({
    ids: z
      .array(z.string().max(64))
      .min(1)
      .max(CUE_SEARCH_RESULTS * 3)
      .transform((ids) => ids.filter((id) => listingId.safeParse(id).success)),
  })
  .strict()

const SCHEMAS = {
  search_listings: searchInput,
  find_place: findPlaceInput,
  get_listing: getListingInput,
  show_businesses: showParse,
  page_action: pageActionInput,
} as const

export type CueToolName = keyof typeof SCHEMAS

function jsonSchema(schema: z.ZodType): Anthropic.Tool.InputSchema {
  const out = z.toJSONSchema(schema) as Record<string, unknown>
  delete out.$schema
  return out as Anthropic.Tool.InputSchema
}

/**
 * The tool list. Frozen and in a fixed order so the prompt cache holds; the
 * cache mark on the last tool caches the whole list.
 */
/** The visitor tools that look something up: text written alongside them is a
 *  working note and is hidden (ticket 261). show_businesses and page_action
 *  are the answer's own parts, so text beside them is kept. */
export const CUE_LOOKUP_TOOLS: ReadonlySet<string> = new Set([
  'search_listings',
  'find_place',
  'get_listing',
])

export const CUE_TOOLS: readonly Anthropic.Tool[] = Object.freeze([
  {
    name: 'search_listings',
    description:
      'Search The BLACQList for businesses. Matches any of the words or phrases against names, descriptions and categories; a phrase needs all its words. Returns up to 8 results. When nothing matches, returns close matches from the nearest category, if any. When fewer than 3 match, may add related businesses found by meaning.',
    input_schema: jsonSchema(searchInput),
    eager_input_streaming: true,
  },
  {
    name: 'find_place',
    description:
      'Check whether a place the visitor named is a city we cover. For a place we do not cover yet, returns the nearest covered cities with distances.',
    input_schema: jsonSchema(findPlaceInput),
    eager_input_streaming: true,
  },
  {
    name: 'get_listing',
    description:
      'Details for one business: description, rating, and weekly hours. Use for follow-up questions like "are they open Sunday?".',
    input_schema: jsonSchema(getListingInput),
    eager_input_streaming: true,
  },
  {
    name: 'show_businesses',
    description:
      'Show businesses as cards under your reply, best first. Call once per reply with every business you mention. Only ids a tool returned.',
    input_schema: jsonSchema(showInput),
    eager_input_streaming: true,
  },
  {
    name: 'page_action',
    description: 'Offer buttons for the page the visitor is on, by code from the page context.',
    input_schema: jsonSchema(pageActionInput),
    eager_input_streaming: true,
    cache_control: { type: 'ephemeral' },
  },
])

// ─── Context ─────────────────────────────────────────────────────────────────

/** One business's page details, public fields only. */
export interface CueListingDetails {
  entity: DiscoveryEntity
  hours: WeeklyHours | null
}

/** The data the tools read. Injected so tests run without a database. */
export interface CueToolDeps {
  search(params: ListingsParams): Promise<DiscoveryEntity[]>
  loadByIds(ids: readonly string[]): Promise<DiscoveryEntity[]>
  loadDetails(id: string): Promise<CueListingDetails | null>
  /** A point for a place we have no row for, or null. */
  locate(
    place: string,
    cities: readonly AssistCity[]
  ): Promise<{ label: string; point: LatLng } | null>
  /**
   * Businesses close in meaning to the words, best first (ticket 260). Empty
   * when meaning search is off. Optional: without it there are none.
   */
  related?(request: {
    text: string
    cityId?: string | null
    exclude?: Iterable<string>
    near?: LatLng | null
    onStats?: (stats: RelatedStats) => void
  }): Promise<DiscoveryEntity[]>
}

/** What this turn has found and chosen. */
export interface CueTurnState {
  /** Every business a tool returned this turn, by id. */
  seen: Map<string, DiscoveryEntity>
  /** Cards to show, in order. */
  shown: string[]
  /** Page action codes to offer. */
  actionCodes: string[]
  /** Searches run this turn, for the status line and the audit count. */
  searches: number
  /** Results that matched the words this turn, close matches not counted. */
  found: number
  /**
   * Ids found by meaning, not by the words (ticket 260). Their cards sit under
   * Related Businesses. An id a later search matches by the words leaves.
   */
  related: Set<string>
  /**
   * What meaning search scored this turn, for tuning the bar (ticket 263):
   * the best score across lookups and the most that reached the bar in one.
   * Null when no lookup ran.
   */
  relatedCheck: RelatedStats | null
}

export function newTurnState(): CueTurnState {
  return {
    seen: new Map(),
    shown: [],
    actionCodes: [],
    searches: 0,
    found: 0,
    related: new Set(),
    relatedCheck: null,
  }
}

/** Two lookups' scores as one: the best score and the most hits. Pure. */
export function mergeRelatedStats(a: RelatedStats | null, b: RelatedStats): RelatedStats {
  if (!a) return b
  const best = a.best === null ? b.best : b.best === null ? a.best : Math.max(a.best, b.best)
  return { best, hits: Math.max(a.hits, b.hits) }
}

export interface CueToolContext {
  categories: readonly AssistantCategory[]
  cities: readonly AssistCity[]
  near: LatLng | null
  page: PageContext
  /** Card ids shown last turn, sent back by the chat. */
  priorIds: ReadonlySet<string>
  state: CueTurnState
  deps: CueToolDeps
}

export interface CueToolResult {
  content: string
  isError: boolean
}

function ok(value: unknown): CueToolResult {
  return { content: JSON.stringify(value), isError: false }
}

function fail(message: string): CueToolResult {
  return { content: message, isError: true }
}

// ─── The any-word query ──────────────────────────────────────────────────────

/** Lowercase letters, digits and inner spaces only, so websearch reads it as words. */
export function cleanTerm(raw: string): string {
  return (
    raw
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9& ]+/g, ' ')
      .replace(/&/g, ' ')
      .split(/\s+/)
      // A typed "or" would read as the query's own OR.
      .filter((w) => w && w !== 'or')
      .join(' ')
  )
}

function isEventsFamily(
  category: AssistantCategory | null,
  categories: readonly AssistantCategory[]
): boolean {
  if (!category) return false
  if (EVENTS_FAMILY.has(category.slug)) return true
  return categories.some((c) => c.parentId === category.id && EVENTS_FAMILY.has(c.slug))
}

/** Categories whose people-words include one of these terms. */
function categoriesForTerms(terms: readonly string[]): string[] {
  const hits: string[] = []
  for (const [key, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (terms.some((t) => words.includes(t))) hits.push(key)
  }
  return hits
}

export interface BuiltQuery {
  /** The text for `q`: one word, or terms joined by an uppercase OR. */
  q: string
  terms: string[]
}

/**
 * Every curated phrase people use for a category ("law firm", "baby shower").
 * Only these are searched as exact phrases (ticket 256).
 */
const CURATED_PHRASES: ReadonlySet<string> = new Set(
  Object.values(CATEGORY_KEYWORDS)
    .flat()
    .map(cleanTerm)
    .filter((t) => t.includes(' '))
)

/**
 * One of the model's words or phrases as a query term, or null when nothing
 * in it names a thing ("switch", "black owned", "products near me").
 *
 * A curated phrase stays a phrase. Any other phrase becomes its meaningful
 * words, which must all appear but not side by side: "natural deodorant"
 * finds "deodorant made with natural oils", which the quoted phrase missed.
 */
function reduceTerm(raw: string): string | null {
  const term = cleanTerm(raw)
  if (!term) return null
  if (CURATED_PHRASES.has(term)) return term
  const { words } = queryWords(term)
  return words.length > 0 ? words.join(' ') : null
}

/**
 * Rejoins single words that make a curated phrase: ["body", "wash"] is "body
 * wash", not "wash" once the lone "body" goes (ticket 257).
 */
function joinCuratedPairs(words: readonly string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < words.length; i++) {
    const pair = i + 1 < words.length ? cleanTerm(`${words[i]} ${words[i + 1]}`) : ''
    if (pair && CURATED_PHRASES.has(pair)) {
      out.push(pair)
      i++
    } else {
      out.push(words[i]!)
    }
  }
  return out
}

/**
 * Words that point at two trades when searched alone: "body" is body butter
 * and auto body. Searched only inside a phrase, or when nothing else is left.
 */
const NEVER_ALONE: ReadonlySet<string> = new Set(['body'])

/** A term without its occasion words, or null when that is all it was. */
function withoutOccasionWords(term: string): string | null {
  if (CURATED_PHRASES.has(term)) return term
  const rest = term.split(' ').filter((w) => !OCCASION_WORDS.has(w))
  return rest.length > 0 ? rest.join(' ') : null
}

function isSet<T>(v: T | null): v is T {
  return v !== null
}

/**
 * The model's words, plus the words people use for the category, as one
 * any-word query.
 *
 * - Each word or phrase is reduced first (reduceTerm): filler, "where can I
 *   get it" verbs and identity phrases go, the same rules as the grid's
 *   rescue (lib/search/understand.ts). A phrase that is only generic objects
 *   ("products"), or a lone "body", goes when another term is left.
 * - Occasion words ("party") stay when the category is an events one, or when
 *   they are all there is. Elsewhere "birthday cake" searches cake.
 * - Each single word gains its intent family: "bathroom" also searches bath,
 *   soap, lotion, toiletries.
 * - `withName` adds the category's own name words. Used when the category is
 *   also the filter: inside it, a listing whose text says none of the words
 *   still matches on its category name, so nothing filed there is dropped.
 * - Terms in order: typed, intent words, category words, then words of
 *   categories the typed words point at. Capped at CUE_MAX_TERMS.
 * - Curated phrases are quoted; any other phrase is left bare, so websearch
 *   needs all its words (an uppercase OR binds looser than the bare AND).
 */
export function buildSearchQuery(args: {
  words: readonly string[]
  category: AssistantCategory | null
  categories: readonly AssistantCategory[]
  withName?: boolean
}): BuiltQuery {
  const { category, categories } = args
  const words = joinCuratedPairs(args.words)
  const cleaned = [...new Set(words.map(cleanTerm).filter((t) => t && !FILLER_WORDS.has(t)))]
  const reduced = [...new Set(words.map(reduceTerm).filter(isSet))]
  // Nothing meaningful left: search what was sent rather than nothing.
  const all = reduced.length > 0 ? reduced : cleaned
  const specific = all.filter((t) => !t.split(' ').every(isGenericObject) && !NEVER_ALONE.has(t))
  const typed = specific.length > 0 ? specific : all

  const eventsCategory = isEventsFamily(category, categories)
  const eventsTyped = categoriesForTerms(typed).some((k) => EVENTS_FAMILY.has(k))
  const withoutOccasions = [...new Set(typed.map(withoutOccasionWords).filter(isSet))]
  const keepOccasions =
    eventsCategory || (!category && eventsTyped) || withoutOccasions.length === 0
  const kept = keepOccasions ? typed : withoutOccasions

  const terms: string[] = []
  const add = (t: string) => {
    const term = cleanTerm(t)
    if (!term || FILLER_WORDS.has(term) || terms.includes(term)) return
    if (!keepOccasions && OCCASION_WORDS.has(term)) return
    terms.push(term)
  }

  kept.forEach(add)
  const intents = kept.filter((t) => !t.includes(' ')).flatMap((t) => [...intentWords(t)])
  intents.forEach(add)
  if (category) {
    CATEGORY_KEYWORDS[category.slug]?.forEach(add)
    if (args.withName) {
      nameWords(category.name)
        .filter((w) => !GENERIC_NAME_WORDS.has(w))
        .forEach(add)
    }
  }
  for (const key of categoriesForTerms([...kept, ...intents])) {
    if (key !== category?.slug) CATEGORY_KEYWORDS[key]?.forEach(add)
  }

  const capped = terms.slice(0, CUE_MAX_TERMS)
  const q = capped.map((t) => (CURATED_PHRASES.has(t) ? `"${t}"` : t)).join(' OR ')
  return { q, terms: capped }
}

// ─── Shapes the model reads ──────────────────────────────────────────────────

function cityLabel(e: DiscoveryEntity): string | null {
  if (!e.city) return null
  return e.city.state_abbr ? `${e.city.name}, ${e.city.state_abbr}` : e.city.name
}

/** Listing text is the owner's. It goes to the model as data, cleaned. */
function snippet(e: DiscoveryEntity): string {
  return sanitizeForPrompt(e.tagline || e.description, SNIPPET_CHARS)
}

function resultFor(e: DiscoveryEntity) {
  return {
    id: e.id,
    name: e.name,
    category: e.category.name,
    city: cityLabel(e),
    ...(e.review_count > 0 ? { rating: e.avg_rating, reviews: e.review_count } : {}),
    about: snippet(e),
  }
}

export function formatHours(hours: WeeklyHours | null): string[] | null {
  if (!hours) return null
  return WEEK_DAYS.map((day) => {
    const h = hours[day]
    const name = day[0]!.toUpperCase() + day.slice(1)
    return h.closed ? `${name}: closed` : `${name}: ${formatTime(h.open)} to ${formatTime(h.close)}`
  })
}

/** A card for the chat. Same fields as the old assistant's cards. */
export function toCard(e: DiscoveryEntity): AssistantCard {
  return {
    id: e.id,
    name: e.name,
    href: buildEntityUrl(e.entity_type, e.city?.slug, e.slug),
    categoryName: e.category.name,
    cityLabel: cityLabel(e),
    rating: e.avg_rating,
    reviewCount: e.review_count,
    imageSrc: resolveMediaPath(e.cover_image_path) ?? resolveMediaPath(e.logo_path),
  }
}

// ─── The tools ───────────────────────────────────────────────────────────────

async function searchListings(
  input: z.infer<typeof searchInput>,
  ctx: CueToolContext
): Promise<CueToolResult> {
  const category = input.category
    ? (ctx.categories.find((c) => c.slug === input.category) ?? null)
    : null
  if (input.category && !category) {
    return fail(
      `Unknown category "${input.category}". Use a slug from the list, or leave category out.`
    )
  }

  const city = input.city ? ctx.cities.find((c) => c.slug === input.city && c.isActive) : null
  if (input.city && !city) {
    return fail(`"${input.city}" is not a city we cover. Call find_place to see the nearest ones.`)
  }

  if (input.near_me && !ctx.near) {
    return fail('The visitor has not shared their location. Search by city, or ask which city.')
  }

  const base: ListingsParams = {
    city: city?.slug,
    open_now: input.open_now || undefined,
    ...(input.near_me && ctx.near
      ? { lat: ctx.near.lat, lng: ctx.near.lng, radius: DEFAULT_RADIUS_MILES, sort: 'distance' }
      : { sort: 'relevance' }),
    page: 1,
    // No paid slots: the chat never counts an impression.
    noSponsored: true,
  }

  const run = async (cat: AssistantCategory | null, q: string): Promise<DiscoveryEntity[]> => {
    ctx.state.searches += 1
    const found = await ctx.deps.search({ ...base, q: q || undefined, category: cat?.slug })
    return found.filter((e) => !e.sponsored_placement_id)
  }

  const first = buildSearchQuery({
    words: input.words,
    category,
    categories: ctx.categories,
    withName: true,
  })
  let items = await run(category, first.q)
  let widenedTo: string | null = null

  // Most listings sit on the parent group only. Look there once, by the words
  // alone, and say so: the parent's own name would match the whole group.
  if (items.length === 0 && category?.parentId) {
    const parent = ctx.categories.find((c) => c.id === category.parentId)
    const words = buildSearchQuery({ words: input.words, category, categories: ctx.categories })
    if (parent && words.q) {
      items = await run(parent, words.q)
      if (items.length > 0) widenedTo = parent.name
    }
  }

  const top = items.slice(0, CUE_SEARCH_RESULTS)
  for (const e of top) {
    ctx.state.seen.set(e.id, e)
    ctx.state.related.delete(e.id)
  }
  ctx.state.found += top.length

  // Fewer than three by the words: add businesses close in meaning (ticket
  // 260). Never with open now, which meaning search can't check. Asked before
  // the close matches (ticket 263): meaning reaches past one category, so
  // "stress relief" can find a counsellor as well as a spa.
  let related: DiscoveryEntity[] = []
  if (ctx.deps.related && wantsRelated(top.length) && !input.open_now) {
    try {
      related = await ctx.deps.related({
        text: input.words.join(' '),
        cityId: city?.id ?? null,
        exclude: top.map((e) => e.id),
        near: input.near_me ? ctx.near : null,
        onStats: (stats) => {
          ctx.state.relatedCheck = mergeRelatedStats(ctx.state.relatedCheck, stats)
        },
      })
    } catch {
      related = []
    }
    for (const e of related) {
      if (ctx.state.seen.has(e.id)) continue
      ctx.state.seen.set(e.id, e)
      ctx.state.related.add(e.id)
    }
  }

  // Nothing matched: never leave the model with only "not listed". Name the
  // categories the words point to, and offer the nearest one's businesses as
  // close matches (ticket 256). Related ones take the room first (ticket
  // 263); close matches fill what is left, at least two, never repeating one.
  let nearest: AssistantCategory[] = []
  let close: DiscoveryEntity[] = []
  if (top.length === 0) {
    const pointed = matchCategories(first.terms.join(' '), ctx.categories, CATEGORY_KEYWORDS, 3)
    nearest = pointed
      .map((m) => ctx.categories.find((c) => c.slug === m.category.slug))
      .filter((c): c is AssistantCategory => !!c && c.slug !== category?.slug)
    if (nearest[0]) {
      const relatedIds = new Set(related.map((e) => e.id))
      const room = Math.max(CUE_CLOSE_MIN, CUE_CLOSE_RESULTS - related.length)
      close = (await run(nearest[0], '')).filter((e) => !relatedIds.has(e.id)).slice(0, room)
      for (const e of close) ctx.state.seen.set(e.id, e)
    }
  }

  return ok({
    searched: {
      words: first.terms,
      category: category?.name ?? null,
      where: input.near_me ? 'near the visitor' : city ? city.name : 'everywhere we cover',
      openNow: !!input.open_now,
    },
    ...(widenedTo
      ? {
          note: `Nothing is filed under ${category!.name} there, so these are from ${widenedTo} matching the words. Call them close matches unless their text shows they are what was asked for.`,
        }
      : {}),
    results: top.map(resultFor),
    ...(top.length === 0 && nearest.length > 0
      ? { nearestCategories: nearest.map((c) => c.name) }
      : {}),
    ...(related.length > 0
      ? {
          related: {
            results: related.map(resultFor),
            note: 'These are close in meaning, not matches for the words. Read their text: show the ones that fit as related businesses, never as exact matches.',
          },
        }
      : {}),
    ...(close.length > 0
      ? {
          closeMatches: { category: nearest[0]!.name, results: close.map(resultFor) },
          next:
            related.length > 0
              ? `Nothing matched the words. Lead with the related businesses whose text fits, then the close matches from ${nearest[0]!.name}. Never reply only that it is not listed.`
              : `Nothing matched the words. These are close matches from ${nearest[0]!.name}: show them as close matches, or search again with other words. Never reply only that it is not listed.`,
        }
      : top.length === 0 && related.length > 0
        ? {
            next: 'Nothing matched the words. Show the related businesses whose text fits, as related businesses. Never reply only that it is not listed.',
          }
        : top.length === 0
          ? {
              next: 'Nothing found. Try other words or a broader category, or another city. If still nothing, say it is not on The BLACQList yet, name the nearest category if there is one, and give one short tip on what to look for.',
            }
          : {}),
  })
}

async function findPlace(
  input: z.infer<typeof findPlaceInput>,
  ctx: CueToolContext
): Promise<CueToolResult> {
  const active = ctx.cities.filter((c) => c.isActive)
  const cityRow = (c: AssistCity) => ({
    slug: c.slug,
    name: c.stateCode ? `${c.name}, ${c.stateCode}` : c.name,
  })
  const nearest = (point: LatLng, exclude: readonly string[] = []) =>
    nearestCities(point, active, NEAREST_CITY_COUNT, exclude).map((c) => ({
      ...cityRow(c),
      miles: Math.round(distanceMiles(point, { lat: c.lat!, lng: c.lng! })),
    }))

  const { places } = findPlaces(input.place, ctx.cities)
  const hit = places[0]
  if (hit && hit.activeCities.length > 0) {
    return ok({ place: hit.label, covered: true, cities: hit.activeCities.map(cityRow) })
  }
  if (hit?.anchor) {
    return ok({ place: hit.label, covered: false, nearest: nearest(hit.anchor) })
  }

  const located = await ctx.deps.locate(input.place, ctx.cities)
  if (located) {
    return ok({ place: located.label, covered: false, nearest: nearest(located.point) })
  }
  return ok({
    place: input.place,
    covered: false,
    nearest: [],
    next: 'Could not place it on a map. Ask the visitor which city, or list the cities we cover.',
  })
}

function knownId(id: string, ctx: CueToolContext): boolean {
  return ctx.state.seen.has(id) || ctx.priorIds.has(id)
}

async function getListing(
  input: z.infer<typeof getListingInput>,
  ctx: CueToolContext
): Promise<CueToolResult> {
  if (!knownId(input.id, ctx)) {
    return fail('Unknown id. Use an id from a search result this turn or a card shown last turn.')
  }
  const details = await ctx.deps.loadDetails(input.id)
  if (!details) return fail('That business is no longer listed.')
  ctx.state.seen.set(details.entity.id, details.entity)
  const e = details.entity
  return ok({
    ...resultFor(e),
    description: sanitizeForPrompt(e.description, DETAIL_CHARS),
    hours: formatHours(details.hours) ?? 'not listed',
  })
}

async function showBusinesses(
  input: z.output<typeof showParse>,
  ctx: CueToolContext
): Promise<CueToolResult> {
  const ids = [...new Set(input.ids)]
  const unknown = ids.filter((id) => !knownId(id, ctx))
  const toLoad = ids.filter((id) => !ctx.state.seen.has(id) && ctx.priorIds.has(id))
  if (toLoad.length > 0) {
    for (const e of await ctx.deps.loadByIds(toLoad)) ctx.state.seen.set(e.id, e)
  }
  const shown = ids.filter((id) => ctx.state.seen.has(id)).slice(0, CUE_MAX_CARDS)
  if (shown.length === 0) {
    return fail('None of those ids came from a tool. Search first, then show what it returned.')
  }
  ctx.state.shown = shown
  const ignored = ids.filter((id) => !shown.includes(id) || unknown.includes(id))
  return ok({ showing: shown.length, ...(ignored.length > 0 ? { ignored } : {}) })
}

function pageAction(input: z.infer<typeof pageActionInput>, ctx: CueToolContext): CueToolResult {
  const codes = [...new Set(input.codes)]
  const valid = codes.filter((c) => c in ctx.page.actions)
  if (valid.length === 0) return fail('None of those codes are on this page.')
  ctx.state.actionCodes = valid
  const ignored = codes.filter((c) => !valid.includes(c))
  return ok({ offered: valid, ...(ignored.length > 0 ? { ignored } : {}) })
}

// ─── Dispatch ────────────────────────────────────────────────────────────────

export function isCueTool(name: string): name is CueToolName {
  return Object.hasOwn(SCHEMAS, name)
}

/**
 * Runs one tool call. A bad name or input comes back as an error result for
 * the model to fix, never a throw. A data failure does throw, and the agent
 * closes the reply with what it already has.
 */
export async function runCueTool(
  name: string,
  rawInput: unknown,
  ctx: CueToolContext
): Promise<CueToolResult> {
  if (!isCueTool(name)) return fail(`No tool named "${name}".`)
  const parsed = SCHEMAS[name].safeParse(rawInput)
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join('.') || 'input').join(', ')
    return fail(`INVALID_INPUT: check ${fields} and call again.`)
  }
  switch (name) {
    case 'search_listings':
      return searchListings(parsed.data as z.infer<typeof searchInput>, ctx)
    case 'find_place':
      return findPlace(parsed.data as z.infer<typeof findPlaceInput>, ctx)
    case 'get_listing':
      return getListing(parsed.data as z.infer<typeof getListingInput>, ctx)
    case 'show_businesses':
      return showBusinesses(parsed.data as z.output<typeof showParse>, ctx)
    case 'page_action':
      return pageAction(parsed.data as z.infer<typeof pageActionInput>, ctx)
  }
}

/** The cards and buttons this turn chose. */
export function turnOutput(ctx: CueToolContext): {
  cards: AssistantCard[]
  actions: AssistantAction[]
} {
  const cards = ctx.state.shown
    .map((id) => ctx.state.seen.get(id))
    .filter((e): e is DiscoveryEntity => !!e)
    .map((e) => (ctx.state.related.has(e.id) ? { ...toCard(e), related: true } : toCard(e)))
  const actions = ctx.state.actionCodes
    .map((code) => ctx.page.actions[code])
    .filter((a): a is AssistantAction => !!a)
  return { cards, actions }
}

/** A short line for the status row while a tool runs. No visitor text. */
export function statusFor(name: string, rawInput: unknown, ctx: CueToolContext): string {
  const input = (rawInput && typeof rawInput === 'object' ? rawInput : {}) as Record<
    string,
    unknown
  >
  switch (name) {
    case 'search_listings': {
      const city =
        typeof input.city === 'string' ? ctx.cities.find((c) => c.slug === input.city) : null
      const cat =
        typeof input.category === 'string'
          ? ctx.categories.find((c) => c.slug === input.category)
          : null
      const what = cat ? cat.name : 'listings'
      if (input.near_me) return `Searching ${what} near you`
      return city ? `Searching ${what} in ${city.name}` : `Searching ${what}`
    }
    case 'find_place':
      return 'Checking which cities we cover'
    case 'get_listing':
      return 'Reading the business page'
    default:
      return 'Putting it together'
  }
}
