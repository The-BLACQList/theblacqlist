'use server'

/**
 * The site assistant (ticket 147).
 *
 * Checks, in the guide's order. Every "no" sends the visitor to plain search:
 *   1. the input: a message of 1 to 200 characters, up to 3 earlier messages,
 *      an optional Near me position (checked, then rounded to about 110 m)
 *   2. FEATURE_AI_ASSISTANT is on (read again here, at request time)
 *   3. the AI kill switch is off
 *   4. rate limit per IP: 8 a minute, 40 a day (bucket 'ai_assistant')
 *   5. paid calls only: the monthly AI ceiling
 *   6. paid calls only: the visitor share. Guide and assistant calls together
 *      stay under 40% of the monthly call budget.
 *
 * One model call per ask, no tool loop. The model names needs and filters;
 * every business comes from our own search, and every line the visitor reads
 * is fixed wording from lib/ai/assistant.ts.
 *
 * When a need finds nothing: its own kind of business without the keywords,
 * then the hand-picked close kinds (CLOSE_KINDS) in the same place, then the
 * same thing in the nearest city we cover, then "Not on The BLACQList yet."
 * A whole top-level category is never offered as close. A place we don't
 * cover gets a notice first.
 *
 * Nothing the visitor typed is stored or logged. The audit row keeps the
 * agent, the model and the outcome code only. There is no console call here on
 * purpose; please keep it that way.
 */

import { headers } from 'next/headers'

import { ASSISTANT_AGENT, ASSISTANT_PROMPT_VERSION, GUIDE_AGENT } from '@/lib/ai/agents'
import { callAnthropic, ProviderCallError, type TokenUsage } from '@/lib/ai/anthropic'
import {
  ASSISTANT_NEAREST_TRIES,
  ASSISTANT_PER_DAY,
  ASSISTANT_PER_MINUTE,
  ASSISTANT_SYSTEM_PROMPT,
  NO_LOCATION_NOTICE,
  nameWords,
  NOT_LISTED_LINE,
  assistantAskSchema,
  buildAssistantPrompt,
  buildAssistantSummary,
  buildHeading,
  closeKindsFor,
  closeLine,
  elsewhereLine,
  foundLine,
  isEmptyPlan,
  joinKinds,
  mockAssistantAnswer,
  nearestCities,
  nearestCloseLine,
  nearestLine,
  parseAssistantAnswer,
  rankTop,
  spreadTops,
  topLimit,
  typedWords,
  uncoveredNotice,
  visitorCallsUsed,
  type AssistantAllowList,
  type AssistantCard,
  type AssistantCategory,
  type AssistantNeedPlan,
  type AssistantNeedResult,
  type AssistantResponse,
} from '@/lib/ai/assistant'
import {
  GUIDE_MAX_NAME_MATCHES,
  GUIDE_PAGES,
  buildSeeAllHref,
  fallbackHref,
  isNameMatch,
  isNearOnlyText,
  nearOnlyFilters,
  normalizeWords,
  stripLinks,
  withinGuideBudget,
  type GuideNear,
} from '@/lib/ai/guide'
import { aiKillSwitchOn, resolveProvider } from '@/lib/ai/provider'
import { rejectionCode, sanitizeForPrompt } from '@/lib/ai/sanitize'
import {
  countAgentAttemptsThisMonth,
  monthlyCallBudget,
  monthlyCeilingUsd,
  withinMonthlyCeiling,
} from '@/lib/ai/spend'
import { wantsNearMe } from '@/lib/assistant/near'
import { isFeatureEnabled } from '@/lib/env'
import { resolveMediaPath } from '@/lib/listings/coverImage'
import { DEFAULT_RADIUS_MILES } from '@/lib/listings/location-params'
import { queryListings } from '@/lib/listings/query'
import { buildEntityUrl } from '@/lib/listings/url'
import type { LatLng } from '@/lib/map/distance'
import { findPlaces, matchCategories, type AssistCity, type PlaceHit } from '@/lib/search/assist'
import { CATEGORY_KEYWORDS } from '@/lib/search/categoryKeywords'
import { lookupPlace, matchLocalCity } from '@/lib/search/placeLookup'
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { DiscoveryEntity } from '@/types'

/** Cities searched at once for a state with several live cities. */
const AREA_CITY_CAP = 3
/** Shared across every caller, per minute, same as the map's place lookup. */
const PLACE_UPSTREAM_LIMIT = 50

function fallback(text: string, reason: 'limited' | 'error'): AssistantResponse {
  return { kind: 'fallback', href: fallbackHref(text), reason }
}

function rawMessage(input: unknown): string {
  if (
    input &&
    typeof input === 'object' &&
    'message' in input &&
    typeof input.message === 'string'
  ) {
    return input.message.slice(0, 200)
  }
  return ''
}

function tokenColumns(usage: TokenUsage | null): {
  request_tokens?: number
  response_tokens?: number
} {
  return usage ? { request_tokens: usage.inputTokens, response_tokens: usage.outputTokens } : {}
}

/** Emails, phone numbers, street addresses and links never reach the model. */
function clean(text: string): string | null {
  try {
    const words = stripLinks(sanitizeForPrompt(text, 200)).trim()
    return words || null
  } catch {
    return null
  }
}

// ─── Lists ───────────────────────────────────────────────────────────────────

type CityRow = {
  id: string
  name: string
  slug: string
  is_active: boolean
  latitude: number | string | null
  longitude: number | string | null
  states: { code: string } | null
}

interface Lists {
  categories: AssistantCategory[]
  /** Every city row, live or not, so a place we don't cover still has a point. */
  cities: AssistCity[]
  allow: AssistantAllowList
}

async function loadLists(): Promise<Lists | null> {
  const supabase = await createClient()
  const [categories, cities] = await Promise.all([
    supabase.from('categories').select('id, name, slug, parent_id').eq('is_active', true),
    supabase
      .from('cities')
      .select('id, name, slug, is_active, latitude, longitude, states!cities_state_id_fkey(code)'),
  ])
  if (categories.error || cities.error) return null
  const cats: AssistantCategory[] = (categories.data ?? []).map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    parentId: c.parent_id ?? null,
  }))
  const allCities: AssistCity[] = ((cities.data as unknown as CityRow[] | null) ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    isActive: c.is_active,
    lat: c.latitude == null ? null : Number(c.latitude),
    lng: c.longitude == null ? null : Number(c.longitude),
    stateCode: c.states?.code ?? null,
  }))
  return {
    categories: cats,
    cities: allCities,
    allow: {
      categories: cats,
      cities: allCities.filter((c) => c.isActive).map((c) => ({ slug: c.slug, name: c.name })),
    },
  }
}

// ─── Where ───────────────────────────────────────────────────────────────────

type Scope =
  | { kind: 'city'; city: AssistCity }
  | { kind: 'area'; label: string; cities: AssistCity[]; anchor: LatLng | null }
  | { kind: 'uncovered'; label: string; anchor: LatLng | null }
  | { kind: 'near'; near: GuideNear }
  | { kind: 'national' }

function pointOf(c: AssistCity): LatLng | null {
  return c.lat != null && c.lng != null ? { lat: c.lat, lng: c.lng } : null
}

/** What findPlaces read in some words, as a scope. Null when it read nothing. */
function scopeFromPlaces(places: readonly PlaceHit[]): Scope | null {
  if (places.length === 0) return null
  const live = [...new Map(places.flatMap((p) => p.activeCities).map((c) => [c.slug, c])).values()]
  if (live.length === 1 && live[0]) return { kind: 'city', city: live[0] }
  const label = places.map((p) => p.label).join(' and ')
  if (live.length > 1) {
    return {
      kind: 'area',
      label,
      cities: live.slice(0, AREA_CITY_CAP),
      anchor: places.find((p) => p.anchor)?.anchor ?? null,
    }
  }
  return { kind: 'uncovered', label, anchor: places.find((p) => p.anchor)?.anchor ?? null }
}

function titleCase(words: string): string {
  return words
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** A point for a place by name: our cities, a state, then OpenStreetMap. */
async function pointFor(
  label: string,
  cities: readonly AssistCity[]
): Promise<{ label: string; anchor: LatLng } | null> {
  try {
    const { place } = await lookupPlace(label, cities, {
      allowUpstream: () =>
        checkRateLimit({
          bucket: 'place_lookup_upstream',
          identifier: 'nominatim',
          limit: PLACE_UPSTREAM_LIMIT,
        }),
    })
    return place ? { label: place.label, anchor: { lat: place.lat, lng: place.lng } } : null
  } catch {
    // OpenStreetMap is a nice-to-have here. The notice still shows.
    return null
  }
}

/**
 * Where to search, in order: a place named in this message, Near me, the
 * model's city, a place named in the earlier messages (latest first), the
 * model's place (our names, then OpenStreetMap), then everywhere.
 */
async function resolveScope(args: {
  words: string
  history: readonly string[]
  near: GuideNear | null
  modelCity: string | null
  modelPlace: string | null
  cities: readonly AssistCity[]
}): Promise<Scope> {
  const scope = await pickScope(args)
  // A place we don't cover and have no city row near: find it on a map so the
  // nearest city we cover can still be offered.
  if (scope.kind === 'uncovered' && !scope.anchor) {
    const found = await pointFor(scope.label, args.cities)
    if (found) return { kind: 'uncovered', label: scope.label, anchor: found.anchor }
  }
  return scope
}

async function pickScope(args: {
  words: string
  history: readonly string[]
  near: GuideNear | null
  modelCity: string | null
  modelPlace: string | null
  cities: readonly AssistCity[]
}): Promise<Scope> {
  const { cities } = args
  const now = scopeFromPlaces(findPlaces(args.words, cities).places)
  if (now) return now
  if (args.near) return { kind: 'near', near: args.near }

  const modelCity = args.modelCity
    ? cities.find((c) => c.slug === args.modelCity && c.isActive)
    : undefined
  if (modelCity) return { kind: 'city', city: modelCity }

  for (let i = args.history.length - 1; i >= 0; i--) {
    const earlier = scopeFromPlaces(findPlaces(args.history[i] ?? '', cities).places)
    if (earlier) return earlier
  }

  if (args.modelPlace && args.modelPlace.length >= 2) {
    const ours = scopeFromPlaces(findPlaces(args.modelPlace, cities).places)
    if (ours) return ours
    const local = matchLocalCity(args.modelPlace, cities)
    if (local?.isActive) return { kind: 'city', city: local }
    const found = await pointFor(args.modelPlace, cities)
    if (found) return { kind: 'uncovered', label: found.label, anchor: found.anchor }
    return { kind: 'uncovered', label: titleCase(args.modelPlace), anchor: null }
  }

  return { kind: 'national' }
}

// ─── Search ──────────────────────────────────────────────────────────────────

interface Where {
  city: AssistCity | null
  near: GuideNear | null
}

interface Found {
  total: number
  items: DiscoveryEntity[]
  /** The keywords that actually found these, for See all. */
  keywords: string[]
  /** True when these are a kind of business close to the need, not the thing itself. */
  broad: boolean
  /** The category these came from, for the line and See all. */
  kind: AssistantCategory | null
  /**
   * Set when the cards came from the kind's parent group (see runOnce): See all
   * opens the group with the same words, since the kind itself has none.
   */
  see?: { category: AssistantCategory; keywords: string[] }
}

/**
 * The words that pick a kind out of its parent group: the kind's own single
 * search words ("cake OR cupcake OR pie"). Empty when it has none.
 */
function kindWords(kind: AssistantCategory): string[] {
  return (CATEGORY_KEYWORDS[kind.slug] ?? []).filter((w) => /^[a-z]+$/.test(w))
}

/**
 * One search. Most listings are filed on a top-level group only (Food & Dining,
 * not Bakeries), so when a subcategory finds nothing it looks once more in its
 * parent group: by the need's own words when it has some, else by the kind's
 * words joined with OR. The line still names the kind; See all opens the group.
 */
async function runOnce(
  need: AssistantNeedPlan,
  category: AssistantCategory | null,
  keywords: string[],
  where: Where,
  categories: readonly AssistantCategory[]
): Promise<Found> {
  const own = await runQuery(need, category, keywords.join(' '), where)
  const found: Found = { ...own, keywords, broad: false, kind: category }
  if (own.items.length > 0 || !category?.parentId) return found
  const parent = categories.find((c) => c.id === category.parentId)
  const q = keywords.length > 0 ? keywords.join(' ') : kindWords(category).join(' OR ')
  if (!parent || !q) return found
  const inParent = await runQuery(need, parent, q, where)
  if (inParent.items.length === 0) return found
  return { ...found, ...inParent, see: { category: parent, keywords: [q] } }
}

async function runQuery(
  need: AssistantNeedPlan,
  category: AssistantCategory | null,
  q: string,
  where: Where
): Promise<{ total: number; items: DiscoveryEntity[] }> {
  const { entities, total } = await queryListings({
    q: q || undefined,
    category: category?.slug,
    city: where.city?.slug,
    open_now: need.openNow || undefined,
    ...(where.near
      ? { lat: where.near.lat, lng: where.near.lng, radius: DEFAULT_RADIUS_MILES, sort: 'distance' }
      : { sort: 'rating' }),
    page: 1,
    // No paid slots, so the assistant never counts an impression and the
    // total counts only cards it can show.
    noSponsored: true,
  })
  const items = entities.filter((e) => !e.sponsored_placement_id)
  return { total: items.length === 0 ? 0 : Math.max(total, items.length), items }
}

/**
 * The kind of business to widen to when the keywords find nothing: the need's
 * own subcategory, or for a top-level category the subcategory that best fits
 * the need's words (cake: Bakeries, Thai: Restaurants). Never a whole
 * top-level category, which would offer grocery stores for a cake.
 */
function wideKindOf(
  need: AssistantNeedPlan,
  categories: readonly AssistantCategory[]
): AssistantCategory | null {
  const category = need.category
  if (!category) return null
  if (category.parentId) return category
  const children = categories.filter((c) => c.parentId === category.id)
  const best = matchCategories([need.name, ...need.keywords].join(' '), children)[0]
  return best ? (children.find((c) => c.id === best.category.id) ?? null) : null
}

/** One search; when the keywords find nothing, once more for the wider kind without them. */
async function search(
  need: AssistantNeedPlan,
  category: AssistantCategory | null,
  wideKind: AssistantCategory | null,
  where: Where,
  categories: readonly AssistantCategory[]
): Promise<Found> {
  const first = await runOnce(need, category, need.keywords, where, categories)
  if (first.items.length > 0 || need.keywords.length === 0 || !wideKind) return first
  const wide = await runOnce(need, wideKind, [], where, categories)
  // "Bakery" finding Bakeries is the thing itself; "Thai" finding Restaurants is close.
  return { ...wide, broad: wide.items.length > 0 && !namesTheKind(need.name, wideKind) }
}

/** True when every word of the need's name points at this kind ("Bakery", "Cakes"). */
function namesTheKind(name: string, kind: AssistantCategory): boolean {
  const words = nameWords(name)
  return words.length > 0 && words.every((w) => matchCategories(w, [kind]).length > 0)
}

/** The same search in several cities at once, merged. */
async function searchCities(
  need: AssistantNeedPlan,
  category: AssistantCategory | null,
  wideKind: AssistantCategory | null,
  cities: readonly AssistCity[],
  categories: readonly AssistantCategory[]
): Promise<Found> {
  const all = await Promise.all(
    cities.map((city) => search(need, category, wideKind, { city, near: null }, categories))
  )
  // Exact matches win; the wider kind only counts when no city had the exact thing.
  const exact = all.filter((f) => f.items.length > 0 && !f.broad)
  const use = exact.length > 0 ? exact : all
  const items = use.flatMap((f) => f.items)
  const first = use.find((f) => f.items.length > 0)
  return {
    total: use.reduce((n, f) => n + f.total, 0),
    items,
    keywords: first?.keywords ?? need.keywords,
    broad: exact.length === 0 && items.length > 0,
    kind: first?.kind ?? category,
    see: first?.see,
  }
}

/**
 * The hand-picked close kinds (CLOSE_KINDS) in one place, searched at once and
 * merged. Null when the need's kind has none listed or none of them has a card.
 */
async function searchClose(
  kind: AssistantCategory | null,
  categories: readonly AssistantCategory[],
  run: (category: AssistantCategory) => Promise<Found>
): Promise<(Found & { names: string[] }) | null> {
  const kinds = closeKindsFor(kind, categories)
  if (kinds.length === 0) return null
  const all = await Promise.all(kinds.map(run))
  const hits = all.filter((f) => f.items.length > 0)
  const [first] = hits
  if (!first) return null
  return {
    total: hits.reduce((n, f) => n + f.total, 0),
    items: hits.flatMap((f) => f.items),
    keywords: [],
    broad: true,
    kind: first.kind,
    see: first.see,
    names: hits.map((f) => f.kind?.name ?? '').filter(Boolean),
  }
}

/** The closest of our cities (up to three tried) that has the thing. */
async function searchNearest(
  need: AssistantNeedPlan,
  wideKind: AssistantCategory | null,
  from: LatLng,
  cities: readonly AssistCity[],
  exclude: readonly string[],
  categories: readonly AssistantCategory[]
): Promise<{ city: AssistCity; found: Found } | null> {
  const tries = nearestCities(from, cities, ASSISTANT_NEAREST_TRIES, exclude)
  const results = await Promise.all(
    tries.map((city) => search(need, need.category, wideKind, { city, near: null }, categories))
  )
  for (let i = 0; i < tries.length; i++) {
    const city = tries[i]
    const found = results[i]
    if (city && found && found.items.length > 0) return { city, found }
  }
  return null
}

// ─── Cards ───────────────────────────────────────────────────────────────────

function toCard(e: DiscoveryEntity): AssistantCard {
  return {
    id: e.id,
    name: e.name,
    href: buildEntityUrl(e.entity_type, e.city?.slug, e.slug),
    categoryName: e.category.name,
    cityLabel: e.city ? `${e.city.name}, ${e.city.state_abbr}` : null,
    rating: e.avg_rating,
    reviewCount: e.review_count,
    imageSrc: resolveMediaPath(e.cover_image_path) ?? resolveMediaPath(e.logo_path),
  }
}

function seeAll(
  need: AssistantNeedPlan,
  category: AssistantCategory | null,
  keywords: string[],
  where: Where
): string {
  return buildSeeAllHref({
    category,
    city: where.city ? { slug: where.city.slug, name: where.city.name } : null,
    keywords,
    openNow: need.openNow,
    page: null,
    near: where.near,
  })
}

/** See all for a find: the kind with its words, or the parent group when the cards came from there. */
function seeFound(need: AssistantNeedPlan, found: Found, where: Where): string {
  return found.see
    ? seeAll(need, found.see.category, found.see.keywords, where)
    : seeAll(need, found.kind, found.keywords, where)
}

// ─── One need ────────────────────────────────────────────────────────────────

interface NeedContext {
  scope: Scope
  cities: readonly AssistCity[]
  categories: readonly AssistantCategory[]
  /** Ranked cards kept per need, more than shown so spreadTops can skip repeats. */
  pool: number
  /** Cards already shown as name matches, left out of a single-need answer. */
  skip: ReadonlySet<string>
}

async function answerNeed(need: AssistantNeedPlan, ctx: NeedContext): Promise<AssistantNeedResult> {
  const { scope, cities, categories, pool, skip } = ctx
  const wideKind = wideKindOf(need, categories)
  const plain: AssistantNeedPlan = { ...need, keywords: [] }

  const result = (
    status: AssistantNeedResult['status'],
    line: string,
    found: Found,
    seeAllHref: string | null
  ): AssistantNeedResult => ({
    name: need.name,
    status,
    line,
    total: found.total,
    top: rankTop(
      found.items.filter((e) => !skip.has(e.id)),
      pool
    ).map(toCard),
    seeAllHref,
  })
  // A broad find is a kind close to the need, not the need itself, so it says so.
  const fromFound = (
    found: Found,
    where: Where,
    placeName: string | null,
    near: boolean
  ): AssistantNeedResult =>
    found.broad && found.kind
      ? result(
          'close',
          closeLine(
            need.name,
            placeName ?? (near ? 'your area' : null),
            found.kind.name,
            found.total
          ),
          found,
          seeFound(need, found, where)
        )
      : result(
          'found',
          foundLine(found.total, placeName, near),
          found,
          seeFound(need, found, where)
        )
  const fromClose = (
    close: Found & { names: string[] },
    where: Where,
    placeName: string | null
  ): AssistantNeedResult =>
    result(
      'close',
      closeLine(need.name, placeName, joinKinds(close.names), close.total),
      close,
      seeFound(need, close, where)
    )
  const fromNearest = (
    nearest: { city: AssistCity; found: Found },
    placeLabel: string | null
  ): AssistantNeedResult => {
    const where: Where = { city: nearest.city, near: null }
    const { found } = nearest
    return found.broad && found.kind
      ? result(
          'close',
          nearestCloseLine(placeLabel, need.name, nearest.city.name, found.kind.name, found.total),
          found,
          seeFound(need, found, where)
        )
      : result(
          'nearest',
          nearestLine(placeLabel, nearest.city.name, found.total),
          found,
          seeFound(need, found, where)
        )
  }
  const none = (): AssistantNeedResult => ({
    name: need.name,
    status: 'none',
    line: NOT_LISTED_LINE,
    total: 0,
    top: [],
    seeAllHref: null,
  })

  if (scope.kind === 'city' || scope.kind === 'near') {
    const where: Where =
      scope.kind === 'city' ? { city: scope.city, near: null } : { city: null, near: scope.near }
    const placeName = scope.kind === 'city' ? scope.city.name : null

    const found = await search(need, need.category, wideKind, where, categories)
    if (found.items.length > 0) {
      return fromFound(found, where, placeName, scope.kind === 'near')
    }
    const close = await searchClose(wideKind, categories, (kind) =>
      runOnce(plain, kind, [], where, categories)
    )
    if (close) return fromClose(close, where, placeName ?? 'your area')
    const from = scope.kind === 'city' ? pointOf(scope.city) : scope.near
    if (from) {
      const nearest = await searchNearest(
        need,
        wideKind,
        from,
        cities,
        scope.kind === 'city' ? [scope.city.slug] : [],
        categories
      )
      if (nearest) return fromNearest(nearest, placeName)
    }
    return none()
  }

  if (scope.kind === 'area') {
    const found = await searchCities(need, need.category, wideKind, scope.cities, categories)
    // See all can hold one city only, so it opens on the first.
    const firstCity = scope.cities[0] ?? null
    const where: Where = { city: firstCity, near: null }
    if (found.items.length > 0) {
      return fromFound(found, where, scope.label, false)
    }
    const close = await searchClose(wideKind, categories, (kind) =>
      searchCities(plain, kind, null, scope.cities, categories)
    )
    if (close) return fromClose(close, where, scope.label)
    if (scope.anchor) {
      const nearest = await searchNearest(
        need,
        wideKind,
        scope.anchor,
        cities,
        scope.cities.map((c) => c.slug),
        categories
      )
      if (nearest) return fromNearest(nearest, scope.label)
    }
    return none()
  }

  if (scope.kind === 'uncovered') {
    if (scope.anchor) {
      const nearest = await searchNearest(need, wideKind, scope.anchor, cities, [], categories)
      if (nearest) return fromNearest(nearest, scope.label)
      return none()
    }
    const anywhere: Where = { city: null, near: null }
    const found = await search(need, need.category, wideKind, anywhere, categories)
    if (found.items.length > 0) {
      return found.broad && found.kind
        ? result(
            'close',
            closeLine(need.name, scope.label, found.kind.name, found.total),
            found,
            seeFound(need, found, anywhere)
          )
        : result(
            'nearest',
            elsewhereLine(scope.label, found.total),
            found,
            seeFound(need, found, anywhere)
          )
    }
    return none()
  }

  // Everywhere.
  const anywhere: Where = { city: null, near: null }
  const found = await search(need, need.category, wideKind, anywhere, categories)
  if (found.items.length > 0) {
    return fromFound(found, anywhere, null, false)
  }
  const close = await searchClose(wideKind, categories, (kind) =>
    runOnce(plain, kind, [], anywhere, categories)
  )
  if (close) return fromClose(close, anywhere, null)
  return none()
}

function scopeLabel(scope: Scope): string | null {
  if (scope.kind === 'city') return scope.city.name
  if (scope.kind === 'area') return scope.label
  return null
}

/** The plain words search behind the bar: names that hold the words, no sponsored cards. */
async function findNameMatches(query: string): Promise<DiscoveryEntity[]> {
  const { entities } = await queryListings({ q: query, page: 1 })
  return entities
    .filter((e) => !e.sponsored_placement_id && isNameMatch(e.name, query))
    .slice(0, GUIDE_MAX_NAME_MATCHES)
}

// ─── The action ──────────────────────────────────────────────────────────────

export async function askAssistant(input: unknown): Promise<AssistantResponse> {
  // 1. Input.
  const parsed = assistantAskSchema.safeParse(input)
  if (!parsed.success) return fallback(rawMessage(input), 'error')
  const { message, history, near } = parsed.data

  // 2. Flag. 3. Kill switch.
  if (!isFeatureEnabled('aiAssistant')) return fallback(message, 'error')
  if (aiKillSwitchOn()) return fallback(message, 'error')

  // 4. Rate limit per IP. Both windows are charged on every ask.
  const ip = getClientIp(await headers())
  const [minuteOk, dayOk] = await Promise.all([
    checkRateLimit({
      bucket: 'ai_assistant',
      identifier: `min:${ip}`,
      limit: ASSISTANT_PER_MINUTE,
      windowSeconds: 60,
    }),
    checkRateLimit({
      bucket: 'ai_assistant',
      identifier: `day:${ip}`,
      limit: ASSISTANT_PER_DAY,
      windowSeconds: 86_400,
    }),
  ])
  if (!minuteOk || !dayOk) return fallback(message, 'limited')

  try {
    const lists = await loadLists()
    if (!lists) return fallback(message, 'error')

    const words = clean(message)
    if (!words) return fallback(message, 'error')
    const earlier = history.map(clean).filter((h): h is string => !!h)

    // Near me and nothing else: there is nothing for the model to read.
    if (near && isNearOnlyText(words)) {
      const { openNow } = nearOnlyFilters(words, near)
      const need: AssistantNeedPlan = { name: 'Places', category: null, keywords: [], openNow }
      const scope: Scope = { kind: 'near', near }
      const answered = await answerNeed(need, {
        scope,
        cities: lists.cities,
        categories: lists.categories,
        pool: topLimit(1),
        skip: new Set(),
      })
      return {
        kind: 'answer',
        heading: buildHeading([need], null, true),
        notice: null,
        summary: buildAssistantSummary([answered]),
        needs: [answered],
        nameMatches: [],
        page: null,
        searchHref: fallbackHref(message),
      }
    }

    // The name search runs while the model thinks. Its failure is never fatal.
    const nameQuery = normalizeWords(words)
    const names: Promise<DiscoveryEntity[]> =
      nameQuery.length >= 3 ? findNameMatches(nameQuery).catch(() => []) : Promise.resolve([])

    /** Any later "no": the name matches if there are some, else plain search. */
    async function namesOrFallback(reason: 'limited' | 'error'): Promise<AssistantResponse> {
      const nameMatches = await names
      if (nameMatches.length === 0) return fallback(message, reason)
      return {
        kind: 'answer',
        heading: 'Matching names',
        notice: null,
        summary: `Found ${nameMatches.length} matching ${nameMatches.length === 1 ? 'name' : 'names'}.`,
        needs: [],
        nameMatches: nameMatches.map(toCard),
        page: null,
        searchHref: fallbackHref(message),
      }
    }

    // 5. and 6. Paid calls only.
    const { provider, model } = resolveProvider(ASSISTANT_AGENT)
    if (provider === 'anthropic') {
      if (!(await withinMonthlyCeiling())) return namesOrFallback('limited')
      const ceiling = monthlyCeilingUsd()
      if (ceiling === null) return namesOrFallback('limited')
      const [guideUsed, assistantUsed] = await Promise.all([
        countAgentAttemptsThisMonth(GUIDE_AGENT.agentType),
        countAgentAttemptsThisMonth(ASSISTANT_AGENT.agentType),
      ])
      if (
        !withinGuideBudget(visitorCallsUsed(guideUsed, assistantUsed), monthlyCallBudget(ceiling))
      ) {
        return namesOrFallback('limited')
      }
    }

    const built = buildAssistantPrompt(words, earlier, lists.allow)
    if (!built) return namesOrFallback('error')

    const supabase = createServiceClient()
    const { data: row, error: rowError } = await supabase
      .from('ai_generation_requests')
      .insert({
        listing_id: null,
        agent_type: ASSISTANT_AGENT.agentType,
        prompt_version: ASSISTANT_PROMPT_VERSION,
        model,
        provider,
        status: 'pending',
        created_by: null,
      })
      .select('id')
      .single()
    if (rowError || !row) return namesOrFallback('error')
    const requestId = row.id

    async function close(errorCode: string | null, usage: TokenUsage | null = null): Promise<void> {
      await supabase
        .from('ai_generation_requests')
        .update(
          errorCode
            ? { status: 'failed', error_message: errorCode, ...tokenColumns(usage) }
            : { status: 'completed', ...tokenColumns(usage) }
        )
        .eq('id', requestId)
    }

    let answer: string
    let usage: TokenUsage | null = null
    try {
      if (provider === 'mock') {
        answer = mockAssistantAnswer(words, earlier, built.offered)
      } else {
        const result = await callAnthropic({
          model,
          prompt: built.prompt,
          maxOutputChars: ASSISTANT_AGENT.maxOutputChars,
          system: ASSISTANT_SYSTEM_PROMPT,
        })
        answer = result.text
        usage = { inputTokens: result.inputTokens, outputTokens: result.outputTokens }
      }
    } catch (err) {
      await close(
        err instanceof ProviderCallError ? err.code : 'provider_error',
        err instanceof ProviderCallError ? err.usage : null
      )
      return namesOrFallback('error')
    }

    const checked = parseAssistantAnswer(answer, built.offered, typedWords(words, earlier))
    if (!checked.ok) {
      await close(rejectionCode(checked.reason), usage)
      return namesOrFallback('error')
    }
    await close(null, usage)

    const plan = checked.plan
    if (isEmptyPlan(plan)) return namesOrFallback('error')

    const page = plan.page ? { ...GUIDE_PAGES[plan.page] } : null
    if (plan.needs.length === 0) {
      return {
        kind: 'answer',
        heading: buildHeading([], null, false),
        notice: null,
        summary: buildAssistantSummary([]),
        needs: [],
        nameMatches: (await names).map(toCard),
        page,
        searchHref: fallbackHref(message),
      }
    }

    const scope = await resolveScope({
      words,
      history: earlier,
      near,
      modelCity: plan.city?.slug ?? null,
      modelPlace: plan.place,
      cities: lists.cities,
    })

    const nameMatches = await names
    const limit = topLimit(plan.needs.length)
    // Name matches are left out of a single-need answer so a card never shows twice.
    const skip = new Set(plan.needs.length === 1 ? nameMatches.map((e) => e.id) : [])
    const ctx: NeedContext = {
      scope,
      cities: lists.cities,
      categories: lists.categories,
      pool: limit * 3,
      skip,
    }
    const pools = await Promise.all(plan.needs.map((need) => answerNeed(need, ctx)))
    const tops = spreadTops(
      pools.map((n) => n.top),
      limit
    )
    const needs = pools.map((n, i) => ({ ...n, top: tops[i] ?? [] }))

    return {
      kind: 'answer',
      heading: buildHeading(plan.needs, scopeLabel(scope), scope.kind === 'near'),
      notice:
        scope.kind === 'uncovered'
          ? uncoveredNotice(scope.label)
          : scope.kind === 'national' && wantsNearMe(message)
            ? NO_LOCATION_NOTICE
            : null,
      summary: buildAssistantSummary(needs),
      needs,
      nameMatches: nameMatches.map(toCard),
      page,
      searchHref: fallbackHref(message),
    }
  } catch {
    // A database or search outage. Deliberately drops the error: it could
    // carry the query.
    return fallback(message, 'error')
  }
}
