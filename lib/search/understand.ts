// Query understanding for the /search grid (ticket 254).
//
// The search RPC needs every word to match. That is the right rule for "Shea
// Soap Co." and the wrong one for a question: "How do I switch to Black Owned
// bathroom products" asked for switch AND black AND own AND bathroom AND
// product, and found nothing on production (founder, 2026-11-21).
//
// queryListings runs the search exactly as typed first, so every search that
// finds something today finds the same thing tomorrow. Only when that comes
// back empty does it run the understood form built here:
//
//   * identity phrases go ("black owned", "black-owned businesses"). Every
//     listing is Black-owned or Ally, so they narrow nothing. A lone "black"
//     stays: "Black Tie Catering", "black seed oil".
//   * filler and question words go (FILLER_WORDS, plus verbs like switch, buy,
//     replace that ask "where can I get it" rather than name a thing)
//   * generic objects go (products, items, brands) when something else is left
//   * each word that is left gains its word family (ticket 172) and its intent
//     family below: "bathroom" also searches bath, soap, lotion, toiletries
//
// Every word that is left still has to match. The grid stays strict
// [Decision — founder, 2026-10-14, kept 2026-11-21]: this only takes out the
// words that could never have matched in the first place.
//
// Pure, no database access: tests/search-understand.test.ts pins every rule.

import { FILLER_WORDS, normalizeQuery, stem } from '@/lib/search/assist'
import { WORD_FAMILIES } from '@/lib/search/wordFamilies'

// Phrases that say who owns a business, which every listing already answers.
// Longest first: the first phrase that matches wins.
const IDENTITY_PHRASES: readonly (readonly string[])[] = [
  ['african', 'american', 'owned'],
  ['owned', 'by', 'black', 'people'],
  ['owned', 'by', 'black'],
  ['black', 'owned'],
  ['blackowned'],
  ['black', 'businesses'],
  ['black', 'business'],
  ['black', 'owners'],
  ['black', 'owner'],
  ['black', 'brands'],
  ['black', 'brand'],
  ['black', 'led'],
  ['black', 'people'],
]

// The grid's filler. FILLER_WORDS without "black", which is only dropped as
// part of an identity phrase above (FILLER_WORDS keeps it for the help panel,
// which never searches with it).
const GRID_FILLER: ReadonlySet<string> = new Set([...FILLER_WORDS].filter((w) => w !== 'black'))

// Verbs that ask where to get something rather than name it. "repair" is
// deliberately absent ("phone repair"), and so is "new" ("New Orleans").
const VERB_FILLER: ReadonlySet<string> = new Set([
  'switch', 'switching', 'swap', 'swapping', 'replace', 'replacing', 'buy', 'buying',
  'purchase', 'purchasing', 'order', 'ordering', 'shopping', 'try', 'trying', 'use',
  'using', 'start', 'starting', 'support', 'supporting', 'alternative', 'alternatives',
  'option', 'options', 'recommendation', 'recommendations', 'suggestion', 'suggestions',
  'where', 'which', 'whats', 'wheres', 'know', 'tell', 'show', 'list', 'other',
  'more', 'different', 'instead', 'than', 'our', 'we', 'us', 'them', 'they',
  'their', 'these', 'those', 'am', 'was', 'be', 'been', 'have', 'has', 'had', 'did',
])
// "support" reads as a verb in "support Black businesses" and as a noun in "IT
// support". It is dropped only when it opens the sentence or follows "to".
const VERB_ONLY_AFTER_TO: ReadonlySet<string> = new Set(['support', 'supporting'])

/** Words that name no particular thing. Dropped only when something else is left. */
const GENERIC_OBJECTS: ReadonlySet<string> = new Set([
  'product', 'products', 'item', 'items', 'stuff', 'thing', 'things', 'brand', 'brands',
  'goods', 'supplies', 'supply', 'kind', 'kinds', 'type', 'types',
])

/**
 * What people ask for, to the words listings use for it. Rules, as for
 * WORD_FAMILIES: one way, whole words, at most four, and nothing that drags in
 * another trade. "body" is never added on its own (auto body shops), and
 * neither is "hair" (it is a word, not a business, in most descriptions).
 */
export const INTENT_FAMILIES: Readonly<Record<string, readonly string[]>> = {
  bathroom: ['bath', 'soap', 'lotion', 'toiletries'],
  toiletry: ['soap', 'lotion', 'bath', 'deodorant'],
  toiletries: ['soap', 'lotion', 'bath', 'deodorant'],
  bodycare: ['soap', 'lotion', 'bath', 'shea'],
  grocery: ['market', 'produce', 'groceries'],
  groceries: ['market', 'produce', 'grocery'],
  clothes: ['clothing', 'apparel', 'boutique', 'fashion'],
  clothing: ['apparel', 'boutique', 'fashion'],
  apparel: ['clothing', 'boutique', 'fashion'],
  makeup: ['cosmetics', 'beauty'],
  cosmetic: ['makeup', 'beauty'],
  haircut: ['barber', 'barbershop', 'salon'],
  hairdresser: ['salon', 'stylist'],
  coffee: ['cafe', 'espresso'],
  cafe: ['coffee'],
  jewelry: ['jeweler', 'jewellery'],
  tax: ['accountant', 'accounting', 'bookkeeping', 'cpa'],
  // Never a lone "auto": it matched "auto insurance" for "a good mechanic"
  // (live eval, 2026-11-21). "auto repair" needs both words.
  car: ['automotive', 'mechanic', 'auto repair'],
  mechanic: ['auto repair', 'car repair', 'automotive'],
  daycare: ['childcare', 'preschool'],
  childcare: ['daycare', 'preschool'],
  doctor: ['physician', 'clinic', 'medical'],
  counseling: ['therapist', 'therapy', 'counselor'],
  photo: ['photographer', 'photography'],
  book: ['bookstore', 'bookshop'],
  wine: ['winery', 'vineyard'],
  beer: ['brewery', 'brewing'],
}

// ─── "IT" the trade, not "it" the word ───────────────────────────────────────
//
// Postgres drops "it" as an English stop word, so "IT support" searched only
// "support" and found any business that offers support (live eval,
// 2026-11-21). In the trade sense it becomes "technology": every listing under
// IT Support & Managed Services carries that word through its group's name
// (search_vector weight B).

/** Words that make a preceding "it" the trade: "IT support", "it consultant". */
const TECH_NOUNS: ReadonlySet<string> = new Set([
  'support', 'services', 'service', 'security', 'consulting', 'consultant', 'consultants',
  'consultancy', 'solution', 'solutions', 'company', 'companies', 'firm', 'firms', 'guy', 'guys',
  'person', 'provider', 'providers', 'department', 'staffing', 'training', 'professional',
  'professionals', 'managed', 'network', 'networking', 'specialist', 'specialists',
  'technician', 'technicians', 'tech', 'helpdesk', 'desk', 'infrastructure', 'contractor',
  'contractors', 'job', 'jobs',
])

/** Before a lowercase "it", these make it the pronoun: "can it support", "make it work". */
const IT_PRONOUN_BEFORE: ReadonlySet<string> = new Set([
  'is', 'was', 'does', 'do', 'did', 'will', 'would', 'can', 'could', 'should', 'has', 'have',
  'had', 'make', 'makes', 'made', 'keep', 'let', 'take', 'give', 'put', 'call', 'bring', 'send',
])

/**
 * Rewrites "it" to "technology" where it names the trade: before a word like
 * support or consultant ("IT support", "need an it guy"), or a capital "IT"
 * that ends the search ("help with IT"). A capital "IT" elsewhere stays ("IT
 * Works"), and so does all-capitals text, where "IT" could be anything.
 */
export function withTechIt(raw: string): string {
  if (!/\bit\b/i.test(raw)) return raw
  const shouting = raw === raw.toUpperCase()
  return raw.replace(/\bit\b/gi, (match: string, offset: number) => {
    const before = /([a-z']+)[^a-z']*$/i.exec(raw.slice(0, offset))?.[1]?.toLowerCase()
    const afterText = raw.slice(offset + match.length)
    const after = /^[^a-z']*([a-z']+)/i.exec(afterText)?.[1]?.toLowerCase()
    const capital = match === 'IT' && !shouting
    if (after && TECH_NOUNS.has(after)) {
      return capital || !before || !IT_PRONOUN_BEFORE.has(before) ? 'technology' : match
    }
    if (capital && !after) return 'technology'
    return match
  })
}

/** Same cap as expandSearchQuery: past this the query is too long to widen. */
const MAX_ALTERNATIVES = 12
/** The most words a rescue search keeps, as meaningfulWords does. */
const MAX_WORDS = 6

export interface UnderstoodQuery {
  /**
   * 'search': run `tsQuery` instead. 'browse': nothing meaningful was left
   * but an identity phrase ("black owned businesses"), so show everything.
   * 'none': nothing to add; keep the result of the search as typed.
   */
  mode: 'search' | 'browse' | 'none'
  /** The websearch query to run in 'search' mode, already widened. */
  tsQuery: string | null
  /** The words that carry the search, in the order typed. */
  words: string[]
  /** True when an identity phrase was taken out. */
  identityRemoved: boolean
}

const NONE: UnderstoodQuery = { mode: 'none', tsQuery: null, words: [], identityRemoved: false }

function lookup(map: Readonly<Record<string, readonly string[]>>, word: string) {
  return map[word] ?? map[stem(word)] ?? null
}

/** The intent family for one word ("bathroom" → bath, soap…), or none. */
export function intentWords(word: string): readonly string[] {
  return lookup(INTENT_FAMILIES, word) ?? []
}

/** Takes the identity phrases out of a token list. */
function withoutIdentity(tokens: string[]): { rest: string[]; removed: boolean } {
  const rest: string[] = []
  let removed = false
  let i = 0
  outer: while (i < tokens.length) {
    for (const phrase of IDENTITY_PHRASES) {
      if (phrase.every((p, k) => tokens[i + k] === p)) {
        i += phrase.length
        removed = true
        continue outer
      }
    }
    rest.push(tokens[i]!)
    i += 1
  }
  return { rest, removed }
}

/** Every combination of the options, or null when there are too many. */
function combine(options: string[][]): string[][] | null {
  let combos: string[][] = [[]]
  for (const opts of options) {
    combos = combos.flatMap((c) => opts.map((o) => [...c, o]))
    if (combos.length > MAX_ALTERNATIVES) return null
  }
  return combos
}

export interface QueryWords {
  /** The words that carry the search, in the order typed, at most six. */
  words: string[]
  /** True when an identity phrase was taken out. */
  identityRemoved: boolean
}

/**
 * The words that carry a search: identity phrases, filler, "where can I get
 * it" verbs and (when something else is left) generic objects taken out.
 * Shared by the grid's rescue below and Cue's any-word query (ticket 256).
 */
export function queryWords(text: string): QueryWords {
  const tokens = normalizeQuery(withTechIt(text)).split(' ').filter(Boolean)
  const { rest, removed: identityRemoved } = withoutIdentity(tokens)

  const kept: string[] = []
  const seen = new Set<string>()
  rest.forEach((w, i) => {
    if (w.length < 2 && !/^\d$/.test(w)) return
    if (GRID_FILLER.has(w)) return
    if (VERB_FILLER.has(w)) {
      if (!VERB_ONLY_AFTER_TO.has(w)) return
      const prev = rest[i - 1]
      if (i === 0 || prev === 'to' || prev === 'and') return
    }
    const s = stem(w)
    if (seen.has(s)) return
    seen.add(s)
    kept.push(w)
  })

  const specific = kept.filter((w) => !GENERIC_OBJECTS.has(w))
  return { words: (specific.length > 0 ? specific : kept).slice(0, MAX_WORDS), identityRemoved }
}

// Words a question opens with. Taken off the front of an echo only, so a
// name keeps its own words ("The Shop ATL").
const QUESTION_LEAD: ReadonlySet<string> = new Set([
  'how', 'what', 'whats', 'where', 'wheres', 'who', 'which', 'can', 'could', 'do', 'does', 'did',
  'i', 'im', 'is', 'are', 'there', 'get', 'find', 'need', 'want', 'looking', 'please', 'for',
  'to', 'a', 'an', 'some', 'any', 'show', 'me', 'tell',
  // Follow-ups in the /search thread (ticket 258): "and lotion?", "do you have lotion".
  'and', 'also', 'you', 'have', 'got',
])

// Taken off only after a question word, so "About Face Salon" keeps its name
// while "what about lotion" echoes as "lotion".
const AFTER_LEAD: ReadonlySet<string> = new Set(['about', 'else'])

/**
 * The visitor's words to echo back when the search as typed found something:
 * what they typed, without identity phrases (#299) or the question it opened
 * with. "where can I find The Shop ATL" → "the shop atl". Falls back to the
 * words that carry the search when nothing else is left.
 */
export function echoWords(text: string): string {
  const { rest } = withoutIdentity(normalizeQuery(text).split(' ').filter(Boolean))
  let start = 0
  while (
    start < rest.length &&
    (QUESTION_LEAD.has(rest[start]!) || (start > 0 && AFTER_LEAD.has(rest[start]!)))
  )
    start++
  const echo = rest.slice(start)
  return echo.length > 0 ? echo.join(' ') : queryWords(text).words.join(' ')
}

/** True for a word that names no particular thing ("products", "stuff"). */
export function isGenericObject(word: string): boolean {
  return GENERIC_OBJECTS.has(word)
}

/**
 * The understood form of a search, for queryListings to run when the search as
 * typed found nothing. See the file header for the rules.
 */
export function understandQuery(raw: string | null | undefined): UnderstoodQuery {
  const trimmed = (raw ?? '').trim()
  // Quotes, a minus or OR: the visitor (or Cue) wrote search syntax. Leave it.
  if (!trimmed || /"|(^|\s)-\S|\sor\s/i.test(trimmed)) return NONE

  const { words, identityRemoved } = queryWords(trimmed)

  if (words.length === 0) {
    return identityRemoved ? { mode: 'browse', tsQuery: null, words: [], identityRemoved } : NONE
  }

  // Each word with its word family (ticket 172) and intent family. If the
  // combinations run past the cap, drop the intent families first, then the
  // word families, rather than give up on the rescue.
  const family = (w: string) => [...(lookup(WORD_FAMILIES, w) ?? [])]
  const intent = (w: string) => [...intentWords(w)]
  const unique = (list: string[]) => [...new Set(list)]
  const combos =
    combine(words.map((w) => unique([w, ...family(w), ...intent(w)]))) ??
    combine(words.map((w) => unique([w, ...family(w)]))) ??
    [words]

  const tsQuery = combos.map((c) => c.join(' ')).join(' OR ')

  // Nothing changed: running it again would only repeat the empty search.
  if (tsQuery === normalizeQuery(trimmed)) return { ...NONE, words }

  return { mode: 'search', tsQuery, words, identityRemoved }
}
