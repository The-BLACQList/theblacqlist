/**
 * Street addresses and the owner's own name, taken out of owner text before it
 * reaches a prompt.
 *
 * The Privacy Policy says: "We don't send your phone number, email, street
 * address or your own name to the AI." Phone and email are handled by
 * `redactContactPatterns` in sanitize.ts. This module is the other half, and
 * `sanitizeForPrompt` runs it on every field. It is plain functions with no
 * server imports so any later prompt path (ticket 128, AI drafts in
 * /add-business) can reuse it as is.
 *
 * ── Addresses: tuned against false positives, unlike the contact patterns ────
 * A phone pattern can be loose because ten digits in a row are almost never
 * ordinary copy. "Number, words, Way" is ordinary copy all the time ("20 years
 * on the Way"). So an address needs a house number, one to five street-name
 * words that each start with a capital or are an ordinal (5th, 125th), and a
 * street suffix. Common quantity words (years, hours, stars, locations) and
 * small connecting words (of, in, the) can never be a street-name word, which
 * is what keeps "Over 20 Years On The Square" intact. A lowercase form is also
 * caught ("123 main st"), but only with one or two words and an unambiguous
 * suffix. P.O. boxes are always caught.
 *
 * ── Names: whole words, and never the business's own name ───────────────────
 * Owners often name the business after themselves. "Keisha's Kitchen" must
 * still read as "Keisha's Kitchen" in the about text, so any name word that is
 * also a word of the business name is left alone. The full name is removed
 * unless the business name contains the whole of it.
 *
 * Nothing here logs. The strings passing through are prompt text.
 */

/** What a removed detail becomes. The same marker sanitize.ts uses for email and phone. */
export const REDACTED = '[removed]'

/**
 * Thrown when redaction itself fails. The message is a fixed code and carries no
 * text, so a caller can catch it and close the audit row without risk of
 * storing what it was cleaning. Callers must treat it as "do not send".
 */
export class PromptRedactionError extends Error {
  constructor() {
    super('prompt_redaction_failed')
    this.name = 'PromptRedactionError'
  }
}

// ── Street addresses ──────────────────────────────────────────────────────────

/** "street" → "street|Street|STREET". The patterns are case-sensitive on purpose. */
function caseVariants(words: readonly string[]): string {
  const out = new Set<string>()
  for (const w of words) {
    const lower = w.toLowerCase()
    out.add(lower)
    out.add(lower.charAt(0).toUpperCase() + lower.slice(1))
    out.add(lower.toUpperCase())
  }
  // Longest first so "Street" wins over "St" in the alternation.
  return [...out].sort((a, b) => b.length - a.length).join('|')
}

/** Suffixes that almost never follow a number in ordinary copy. */
const STRONG_SUFFIXES = [
  'street', 'st', 'avenue', 'ave', 'av', 'boulevard', 'blvd', 'road', 'rd', 'drive', 'dr',
  'lane', 'ln', 'parkway', 'pkwy', 'highway', 'hwy', 'terrace', 'ter', 'circle', 'cir',
  'court', 'ct', 'place', 'pl', 'square', 'sq', 'trail', 'trl', 'alley', 'aly', 'plaza', 'plz',
  'expressway', 'expy', 'freeway', 'fwy', 'turnpike', 'tpke', 'crescent', 'cres',
] as const

/**
 * Suffixes that are also everyday words. Only accepted after capitalized street
 * names. "Run" and "Path" are left out: "Our 3 Kids Run The Place" is copy.
 */
const SOFT_SUFFIXES = ['way', 'pike', 'row', 'loop', 'point', 'pt', 'crossing', 'xing'] as const

/** Suffixes accepted after a lowercase street name ("123 main st"). */
const LOWERCASE_SUFFIXES = [
  'street', 'st', 'avenue', 'ave', 'boulevard', 'blvd', 'road', 'rd', 'lane', 'ln',
  'parkway', 'pkwy', 'highway', 'hwy',
] as const

const DIRECTIONALS = [
  'n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw',
  'north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest',
] as const

const UNIT_WORDS = ['suite', 'ste', 'unit', 'apt', 'apartment', 'room', 'rm', 'floor', 'fl', 'bldg', 'building'] as const

/**
 * Words that can never be part of a street name. Without this, any number
 * followed by title-case marketing copy and a word like Square or Place would
 * read as an address.
 */
const NOT_STREET_WORDS = [
  'year', 'years', 'yr', 'yrs', 'hour', 'hours', 'hr', 'hrs', 'day', 'days', 'week', 'weeks',
  'month', 'months', 'minute', 'minutes', 'min', 'mins', 'star', 'stars', 'location',
  'locations', 'time', 'times', 'people', 'person', 'customer', 'customers', 'client', 'clients',
  'step', 'steps', 'reason', 'reasons', 'tip', 'tips', 'way', 'ways', 'best', 'top', 'great',
  'for', 'of', 'in', 'on', 'at', 'to', 'by', 'and', 'or', 'the', 'a', 'an', 'our', 'your',
  'my', 'we', 'us', 'is', 'are', 'with', 'from', 'off', 'percent', 'dollars', 'free',
  'kid', 'kids', 'child', 'children', 'family', 'families', 'generation', 'generations',
  'friend', 'friends', 'brother', 'brothers', 'sister', 'sisters', 'item', 'items',
] as const

const HOUSE_NUMBER = String.raw`\d{1,6}(?:-\d{1,6})?[A-Za-z]?`
const ORDINAL = String.raw`\d{1,4}(?:st|nd|rd|th|ST|ND|RD|TH)`
const NOT_STREET = `(?!(?:${caseVariants(NOT_STREET_WORDS)})(?![A-Za-z]))`
/** One street-name word: capitalized (or all caps) or an ordinal. */
const NAME_WORD = `${NOT_STREET}(?:${ORDINAL}|[A-Z][A-Za-z'’.-]*)`
const DIRECTIONAL = `(?:${caseVariants(DIRECTIONALS)})\\.?`
const UNIT = String.raw`(?:,?\s*(?:${caseVariants(UNIT_WORDS)})\.?\s*#?\s*[A-Za-z0-9-]+|,?\s*#\s*[A-Za-z0-9-]+)`
/** ", Detroit, MI 48201" / ", MI 48201" / ", Detroit MI". State must be two capitals. */
const CITY_STATE_ZIP = String.raw`(?:,\s*(?:[A-Z][A-Za-z.'’-]*(?:\s+[A-Z][A-Za-z.'’-]*){0,3},?\s+)?[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?(?![A-Za-z]))`
/** Word end. A hyphen plus a letter is still the same word ("Drive-In"). */
const END = `(?![A-Za-z0-9]|-[A-Za-z])`

function addressTail(suffixes: string): string {
  return `(?:${suffixes})\\.?${END}(?:\\s+${DIRECTIONAL}${END})?${UNIT}?${CITY_STATE_ZIP}?`
}

const CAPITALIZED_ADDRESS = new RegExp(
  `(?<![A-Za-z0-9])${HOUSE_NUMBER}\\s+(?:${NAME_WORD}\\s+){1,5}?` +
    addressTail(caseVariants([...STRONG_SUFFIXES, ...SOFT_SUFFIXES])),
  'g'
)

const LOWERCASE_ADDRESS = new RegExp(
  `(?<![A-Za-z0-9])${HOUSE_NUMBER}\\s+(?:${NOT_STREET}(?:${ORDINAL}|[a-z][a-z'’-]*)\\s+){1,2}?` +
    addressTail(caseVariants(LOWERCASE_SUFFIXES)),
  'g'
)

const PO_BOX = /(?<![A-Za-z0-9])(?:P\.?\s*O\.?|Post\s+Office)\s*Box\s*#?\s*\d+/gi

/**
 * Replaces US street addresses and P.O. boxes with {@link REDACTED}.
 *
 * Numbers followed by ordinary words are left alone: "open 24 hours",
 * "3 locations", "since 1998", "5 stars", "2 for 1", "Top 10", "$15".
 */
export function redactStreetAddresses(input: string): string {
  return input
    .replace(PO_BOX, REDACTED)
    .replace(CAPITALIZED_ADDRESS, REDACTED)
    .replace(LOWERCASE_ADDRESS, REDACTED)
}

// ── The owner's own name ──────────────────────────────────────────────────────

/** Shortest name word removed on its own. Two-letter words are too often real words. */
const MIN_NAME_TOKEN = 3

/**
 * Titles people put in a display name. Removing "Chef" from every description
 * because the owner calls themselves "Chef Mike" would damage the copy and
 * protect nothing.
 */
const NOT_NAME_WORDS = new Set([
  'mr', 'mrs', 'ms', 'miss', 'mx', 'dr', 'rev', 'chef', 'coach', 'the', 'and', 'owner',
  'jr', 'sr', 'ii', 'iii', 'iv',
])

const LETTER = String.raw`\p{L}\p{M}\p{N}`

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function wholeWord(term: string): RegExp {
  // A space in the name matches any run of whitespace in the text.
  const body = term.split(/\s+/).map(escapeRegExp).join('\\s+')
  return new RegExp(`(?<![${LETTER}])${body}(?![${LETTER}])`, 'giu')
}

function containsWholeWord(haystack: string, term: string): boolean {
  return wholeWord(term).test(haystack)
}

/**
 * Turns the owner's name(s) on file into the terms to remove from their text.
 *
 * - The full name, unless the business name contains all of it.
 * - Each name word of three letters or more, unless the business name contains
 *   it as a whole word, or it is a title like "Chef".
 *
 * Returns longest first, so "Keisha Brown" goes before "Brown". An empty array
 * means there is nothing to remove (no name on file).
 */
export function ownerNameTerms(
  names: readonly (string | null | undefined)[],
  businessName: string | null | undefined
): string[] {
  const business = (businessName ?? '').trim()
  const terms = new Map<string, string>()

  for (const raw of names) {
    const name = (raw ?? '').replace(/\s+/g, ' ').trim()
    if (!name) continue
    // A display name that is an email address is handled by the email pattern.
    if (name.includes('@')) continue

    const words = name
      .split(/[\s,./_-]+/u)
      .map((w) => w.replace(/^['’]+|['’]+$/gu, ''))
      .filter(Boolean)

    const fullIsOneWord = words.length <= 1
    const fullLongEnough = fullIsOneWord ? name.length >= MIN_NAME_TOKEN : true
    if (
      fullLongEnough &&
      !NOT_NAME_WORDS.has(name.toLowerCase()) &&
      !(business && containsWholeWord(business, name))
    ) {
      if (!terms.has(name.toLowerCase())) terms.set(name.toLowerCase(), name)
    }

    for (const word of words) {
      if ([...word].length < MIN_NAME_TOKEN) continue
      if (NOT_NAME_WORDS.has(word.toLowerCase())) continue
      if (!/\p{L}/u.test(word)) continue
      if (business && containsWholeWord(business, word)) continue
      if (!terms.has(word.toLowerCase())) terms.set(word.toLowerCase(), word)
    }
  }

  return [...terms.values()].sort((a, b) => b.length - a.length)
}

/**
 * Removes each term from `input` as a whole word, ignoring case. Run it on
 * owner text only, never on the business name field itself.
 */
export function redactOwnerName(input: string, terms: readonly string[]): string {
  let out = input
  for (const term of terms) {
    if (!term) continue
    out = out.replace(wholeWord(term), REDACTED)
  }
  return out
}
