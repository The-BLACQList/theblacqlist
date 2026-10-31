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
import { FILLER_WORDS, findPlaces, type AssistCity } from '@/lib/search/assist'
import { CATEGORY_KEYWORDS } from '@/lib/search/categoryKeywords'
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
const SNIPPET_CHARS = 160
const DETAIL_CHARS = 600

/** Words that say what the need is for, not what it is ("birthday cake" is a cake). */
export const OCCASION_WORDS: ReadonlySet<string> = new Set([
  'birthday', 'party', 'wedding', 'baby', 'shower', 'graduation', 'anniversary', 'holiday',
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
const GENERIC_NAME_WORDS = new Set(['and', 'shops', 'shop', 'stores', 'store', 'services', 'service', 'other', 'live'])

// ─── Inputs ──────────────────────────────────────────────────────────────────

const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9-]{1,80}$/)
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
      .describe('True to search near the visitor. Only when the context says their location is shared.'),
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
    codes: z.array(z.string().trim().min(1).max(40)).min(1).max(3).describe('Action codes from the page context.'),
  })
  .strict()

const SCHEMAS = {
  search_listings: searchInput,
  find_place: findPlaceInput,
  get_listing: getListingInput,
  show_businesses: showInput,
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
export const CUE_TOOLS: readonly Anthropic.Tool[] = Object.freeze([
  {
    name: 'search_listings',
    description:
      'Search The BLACQList for businesses. Matches any of the words against names, descriptions, tags and categories. Returns up to 8 results. If it finds nothing, try again with other words or a broader category before telling the visitor.',
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
  locate(place: string, cities: readonly AssistCity[]): Promise<{ label: string; point: LatLng } | null>
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
}

export function newTurnState(): CueTurnState {
  return { seen: new Map(), shown: [], actionCodes: [], searches: 0 }
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
  return raw
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
}

function isEventsFamily(category: AssistantCategory | null, categories: readonly AssistantCategory[]): boolean {
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
 * The model's words, plus the words people use for the category, as one
 * any-word query.
 *
 * - Occasion words ("party") stay when the category is an events one, or when
 *   they are all there is. Elsewhere "birthday cake" searches cake.
 * - `withName` adds the category's own name words. Used when the category is
 *   also the filter: inside it, a listing whose text says none of the words
 *   still matches on its category name, so nothing filed there is dropped.
 * - Terms in order: typed, category words, then words of categories the typed
 *   words point at. Capped at CUE_MAX_TERMS.
 */
export function buildSearchQuery(args: {
  words: readonly string[]
  category: AssistantCategory | null
  categories: readonly AssistantCategory[]
  withName?: boolean
}): BuiltQuery {
  const { words, category, categories } = args
  const typed = [...new Set(words.map(cleanTerm).filter((t) => t && !FILLER_WORDS.has(t)))]

  const eventsCategory = isEventsFamily(category, categories)
  const eventsTyped = categoriesForTerms(typed).some((k) => EVENTS_FAMILY.has(k))
  const withoutOccasions = typed.filter((t) => !OCCASION_WORDS.has(t))
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
  if (category) {
    CATEGORY_KEYWORDS[category.slug]?.forEach(add)
    if (args.withName) {
      nameWords(category.name)
        .filter((w) => !GENERIC_NAME_WORDS.has(w))
        .forEach(add)
    }
  }
  for (const key of categoriesForTerms(kept)) {
    if (key !== category?.slug) CATEGORY_KEYWORDS[key]?.forEach(add)
  }

  const capped = terms.slice(0, CUE_MAX_TERMS)
  const q = capped.map((t) => (t.includes(' ') ? `"${t}"` : t)).join(' OR ')
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

async function searchListings(input: z.infer<typeof searchInput>, ctx: CueToolContext): Promise<CueToolResult> {
  const category = input.category
    ? (ctx.categories.find((c) => c.slug === input.category) ?? null)
    : null
  if (input.category && !category) {
    return fail(`Unknown category "${input.category}". Use a slug from the list, or leave category out.`)
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

  const first = buildSearchQuery({ words: input.words, category, categories: ctx.categories, withName: true })
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
  for (const e of top) ctx.state.seen.set(e.id, e)

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
    ...(top.length === 0
      ? {
          next: 'Nothing found. Try other words or a broader category, or another city. If still nothing, say it is not listed yet.',
        }
      : {}),
  })
}

async function findPlace(input: z.infer<typeof findPlaceInput>, ctx: CueToolContext): Promise<CueToolResult> {
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

async function getListing(input: z.infer<typeof getListingInput>, ctx: CueToolContext): Promise<CueToolResult> {
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

async function showBusinesses(input: z.infer<typeof showInput>, ctx: CueToolContext): Promise<CueToolResult> {
  const ids = [...new Set(input.ids)]
  const unknown = ids.filter((id) => !knownId(id, ctx))
  const toLoad = ids.filter((id) => !ctx.state.seen.has(id) && ctx.priorIds.has(id))
  if (toLoad.length > 0) {
    for (const e of await ctx.deps.loadByIds(toLoad)) ctx.state.seen.set(e.id, e)
  }
  const shown = ids.filter((id) => ctx.state.seen.has(id))
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
export async function runCueTool(name: string, rawInput: unknown, ctx: CueToolContext): Promise<CueToolResult> {
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
      return showBusinesses(parsed.data as z.infer<typeof showInput>, ctx)
    case 'page_action':
      return pageAction(parsed.data as z.infer<typeof pageActionInput>, ctx)
  }
}

/** The cards and buttons this turn chose. */
export function turnOutput(ctx: CueToolContext): { cards: AssistantCard[]; actions: AssistantAction[] } {
  const cards = ctx.state.shown
    .map((id) => ctx.state.seen.get(id))
    .filter((e): e is DiscoveryEntity => !!e)
    .map(toCard)
  const actions = ctx.state.actionCodes
    .map((code) => ctx.page.actions[code])
    .filter((a): a is AssistantAction => !!a)
  return { cards, actions }
}

/** A short line for the status row while a tool runs. No visitor text. */
export function statusFor(name: string, rawInput: unknown, ctx: CueToolContext): string {
  const input = (rawInput && typeof rawInput === 'object' ? rawInput : {}) as Record<string, unknown>
  switch (name) {
    case 'search_listings': {
      const city = typeof input.city === 'string' ? ctx.cities.find((c) => c.slug === input.city) : null
      const cat = typeof input.category === 'string' ? ctx.categories.find((c) => c.slug === input.category) : null
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
