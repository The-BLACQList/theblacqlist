// The thinking behind "search never ends in a blank" (PR 5).
//
// The search RPC needs every word to match, so "how do I travel solo to Japan"
// asks for travel AND solo AND Japan and gets nothing. This module works out
// what to try instead, with no database access, so every rule here is unit
// tested (tests/search-assist.test.ts):
//
//   * meaningfulWords   drops the filler ("how do I ... near me") from a search
//   * findPlaces        spots a city or state in it ("plumber ohio")
//   * matchCategories   matches the words to categories, typos and plurals too
//   * nearestCity       the closest city we cover, for "nothing near you"
//
// lib/services/searchAssist.ts runs these against real data. Nothing here
// invents a result: it only decides which real questions to ask next.

import { CATEGORY_KEYWORDS } from '@/lib/search/categoryKeywords'
import { US_STATES } from '@/lib/search/usStates'
import { distanceMiles, type LatLng } from '@/lib/map/distance'

/** Help shows when a search finds fewer than this many listings. */
export const ASSIST_BELOW = 3

/** Long enough for any real question, short enough to keep the work bounded. */
const MAX_QUERY_LENGTH = 300
const MAX_WORDS = 6

// Words that shape a question but never name what someone is looking for.
// "black" and "owned" are here because every listing is Black-owned or Ally:
// as a search word they narrow nothing and only make an all-words match fail.
export const FILLER_WORDS: ReadonlySet<string> = new Set([
  'how', 'what', 'where', 'who', 'can', 'do', 'does', 'i', 'im', 'my', 'a', 'an', 'the',
  'to', 'for', 'in', 'on', 'at', 'of', 'and', 'or', 'with', 'near', 'nearby', 'me',
  'around', 'best', 'good', 'top', 'find', 'looking', 'need', 'want', 'some', 'any',
  'place', 'places', 'spot', 'spots', 'open', 'now', 'today', 'cheap', 'affordable',
  'local', 'black', 'owned', 'blackowned', 'business', 'businesses', 'company',
  'companies', 'service', 'services', 'shop', 'shops', 'store', 'stores', 'owner',
  'owners', 'help', 'recommend', 'is', 'are', 'there', 'get', 'go', 'you', 'your', 'it',
  'this', 'that', 'from', 'by', 'please', 'should', 'would', 'could', 'will', 'just',
  'really', 'very', 'like', 'about', 'into', 'up', 'out', 'all', 'one', 'someone',
])

// Category-name words that say nothing about the category on their own:
// "services" would otherwise tie every "X Services" category to every search.
const GENERIC_NAME_TOKENS: ReadonlySet<string> = new Set([
  'service', 'and', 'other', 'shop', 'store', 'product', 'solution', 'general', 'the',
  'of', 'amp', 'more',
])

/** Lowercase, letters and digits only, single spaces, capped in length. */
export function normalizeQuery(q: string): string {
  return q
    .slice(0, MAX_QUERY_LENGTH)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Folds the plurals people type onto one form: braids → braid, classes →
 * class, therapies → therapy. Deliberately small. Postgres does real stemming
 * for the search itself; this only has to make "plumbers" meet "plumber".
 */
export function stem(word: string): string {
  if (word.length <= 3) return word
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`
  if (/(ss|x|z|ch|sh)es$/.test(word)) return word.slice(0, -2)
  if (word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us')) return word.slice(0, -1)
  return word
}

function tokens(text: string): string[] {
  const n = normalizeQuery(text)
  return n ? n.split(' ') : []
}

/**
 * The words that carry the search, in the order typed: filler, single letters
 * and ZIP codes dropped, duplicates removed, at most six.
 */
export function meaningfulWords(text: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const w of tokens(text)) {
    if (w.length < 2 || FILLER_WORDS.has(w) || /^\d{5}$/.test(w)) continue
    const s = stem(w)
    if (seen.has(s)) continue
    seen.add(s)
    out.push(w)
    if (out.length >= MAX_WORDS) break
  }
  return out
}

/** True when the exact search found too little to stand on its own. */
export function shouldAssist(args: {
  q: string | undefined
  total: number
  page: number
  radiusUnavailable?: boolean
  filtersUnavailable?: boolean
}): boolean {
  // When a filter could not run, the grid already says so. Suggesting other
  // searches on top would answer a question the visitor did not ask.
  if (args.radiusUnavailable || args.filtersUnavailable) return false
  return !!args.q?.trim() && args.page === 1 && args.total < ASSIST_BELOW
}

// ─── Places ───────────────────────────────────────────────────────────────────

export interface AssistCity {
  id: string
  name: string
  slug: string
  isActive: boolean
  lat: number | null
  lng: number | null
  stateCode: string | null
}

export interface PlaceHit {
  /** As written for a sentence: "Ohio", "Detroit". */
  label: string
  /** Live cities inside the place. Empty means we do not cover it yet. */
  activeCities: AssistCity[]
  /** A point to measure "nearest city we cover" from, when we know one. */
  anchor: LatLng | null
}

// What people type for the cities we have rows for. Two letters are allowed
// here, unlike state codes (usStates.ts), because these are the forms people
// really search with and none of them is an everyday word.
export const CITY_NICKNAMES: Readonly<Record<string, string>> = {
  atl: 'atlanta-ga',
  nola: 'new-orleans-la',
  chitown: 'chicago-il',
  htx: 'houston-tx',
  hou: 'houston-tx',
  nyc: 'new-york-ny',
  philly: 'philadelphia-pa',
  dfw: 'dallas-tx',
  bmore: 'baltimore-md',
  clt: 'charlotte-nc',
  dmv: 'washington-dc',
  dc: 'washington-dc',
  'washington dc': 'washington-dc',
}

function cityPoint(c: AssistCity): LatLng | null {
  return c.lat != null && c.lng != null ? { lat: c.lat, lng: c.lng } : null
}

/** Finds `phrase` as whole words in `text` (both normalized). */
function hasPhrase(text: string, phrase: string): boolean {
  return ` ${text} `.includes(` ${phrase} `)
}

function removePhrase(text: string, phrase: string): string {
  return ` ${text} `.replace(` ${phrase} `, ' ').trim().replace(/\s+/g, ' ')
}

/**
 * The cities and states named in a search, plus the search with them taken
 * out. Longest names first, so "new orleans" is read before "orleans" could
 * be, and "washington state" before the city of Washington.
 */
export function findPlaces(
  query: string,
  cities: readonly AssistCity[]
): { places: PlaceHit[]; rest: string } {
  let text = normalizeQuery(query)
  const places: PlaceHit[] = []

  const stateHit = (code: string, name: string): PlaceHit => {
    const inState = cities.filter((c) => c.stateCode === code)
    const withPoint = inState.find((c) => cityPoint(c))
    return {
      label: name,
      activeCities: inState.filter((c) => c.isActive),
      anchor: withPoint ? cityPoint(withPoint) : null,
    }
  }

  if (hasPhrase(text, 'washington state')) {
    text = removePhrase(text, 'washington state')
    places.push(stateHit('WA', 'Washington State'))
  }

  const bySlug = new Map(cities.map((c) => [c.slug, c]))
  const cityNames: Array<[string, AssistCity]> = [
    ...cities.map((c) => [normalizeQuery(c.name), c] as [string, AssistCity]),
    ...Object.entries(CITY_NICKNAMES)
      .map(([nick, slug]) => [nick, bySlug.get(slug)] as [string, AssistCity | undefined])
      .filter((e): e is [string, AssistCity] => !!e[1]),
  ].sort((a, b) => b[0].length - a[0].length)

  for (const [name, city] of cityNames) {
    if (!name || !hasPhrase(text, name)) continue
    text = removePhrase(text, name)
    if (places.some((p) => p.label === city.name)) continue
    places.push({
      label: city.name,
      activeCities: city.isActive ? [city] : [],
      anchor: cityPoint(city),
    })
  }

  const states = [...US_STATES].sort((a, b) => b.name.length - a.name.length)
  for (const s of states) {
    const name = normalizeQuery(s.name)
    if (!hasPhrase(text, name)) continue
    text = removePhrase(text, name)
    places.push(stateHit(s.code, s.name))
  }

  return { places, rest: text }
}

/** The closest live city to a point, with the distance in whole miles. */
export function nearestCity(
  point: LatLng,
  cities: readonly AssistCity[]
): { city: AssistCity; miles: number } | null {
  let best: { city: AssistCity; miles: number } | null = null
  for (const c of cities) {
    const p = c.isActive ? cityPoint(c) : null
    if (!p) continue
    const miles = Math.round(distanceMiles(point, p))
    if (!best || miles < best.miles) best = { city: c, miles }
  }
  return best
}

// ─── Categories ───────────────────────────────────────────────────────────────

export interface AssistCategory {
  id: string
  name: string
  slug: string
  parentId: string | null
}

export interface CategoryMatch {
  category: AssistCategory
  /** 3 exact word or related word, 2 typo or word start. */
  score: number
}

/** Edit distance, stopping early once it passes `max`. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(
        prev[j]! + 1,
        cur[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
      cur.push(v)
      if (v < rowMin) rowMin = v
    }
    if (rowMin > max) return max + 1
    prev = cur
  }
  return prev[b.length]!
}

function closeEnough(word: string, token: string): boolean {
  if (word.length >= 4 && token.length >= 4) {
    if (token.startsWith(word) || word.startsWith(token)) return true
  }
  const allowed = Math.min(word.length, token.length) >= 8 ? 2 : Math.min(word.length, token.length) >= 5 ? 1 : 0
  return allowed > 0 && editDistance(word, token, allowed) <= allowed
}

function nameTokens(c: AssistCategory): string[] {
  const all = [...tokens(c.name), ...tokens(c.slug.replace(/-/g, ' '))].map(stem)
  return [...new Set(all)].filter((t) => t.length > 1 && !GENERIC_NAME_TOKENS.has(t))
}

/**
 * The categories a search most likely means, best first. Each search word is
 * checked against the category's own name and its related words in
 * categoryKeywords.ts. A related-words phrase ("water heater") counts only
 * when the whole phrase is in the search.
 */
export function matchCategories(
  query: string,
  categories: readonly AssistCategory[],
  keywords: Readonly<Record<string, readonly string[]>> = CATEGORY_KEYWORDS,
  limit = 4
): CategoryMatch[] {
  const words = meaningfulWords(query).map(stem)
  if (words.length === 0) return []
  const stemmedQuery = tokens(query).map(stem).join(' ')

  const scored: Array<CategoryMatch & { hits: number; isChild: boolean }> = []
  for (const category of categories) {
    const own = nameTokens(category)
    const related = (keywords[category.slug] ?? []).map((k) => tokens(k).map(stem).join(' '))
    const relatedWords = new Set(related.filter((k) => !k.includes(' ')))
    const relatedPhrases = related.filter((k) => k.includes(' '))

    let score = 0
    let hits = 0
    for (const w of words) {
      let s = 0
      if (own.includes(w) || relatedWords.has(w)) s = 3
      else if (own.some((t) => closeEnough(w, t))) s = 2
      else if (w.length >= 5 && [...relatedWords].some((t) => t.length >= 5 && closeEnough(w, t))) s = 2
      if (s > 0) hits++
      score = Math.max(score, s)
    }
    if (relatedPhrases.some((p) => hasPhrase(stemmedQuery, p))) {
      score = 3
      hits++
    }
    if (score >= 2) scored.push({ category, score, hits, isChild: !!category.parentId })
  }

  // Strongest first, then the one that matched more of the words, then the
  // narrower category: "dentist" should offer Dentists before Healthcare.
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      b.hits - a.hits ||
      Number(b.isChild) - Number(a.isChild) ||
      a.category.name.localeCompare(b.category.name)
  )
  return scored.slice(0, limit).map(({ category, score }) => ({ category, score }))
}
