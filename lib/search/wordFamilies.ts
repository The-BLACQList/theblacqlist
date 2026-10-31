// Words that mean the same business but that Postgres stems apart (ticket 172).
//
// English stemming folds "dentists" to "dentist" and "lawyers" to "lawyer", but
// it never makes "lawyer" meet "law" or "dentist" meet "dental". So a search for
// "lawyer" missed every "... Law Group", even though "law" found them. This list
// adds the missing words to the search itself, before it reaches the database.
//
// Rules for adding a family:
//   * One way only. "lawyer" adds "law", but "baker" adds "bakery" and never the
//     other way round, because Baker is a surname ("Baker Law Firm").
//   * Only words that name the same kind of business. No wider group: a search
//     for "orthodontist" must not turn into general dentistry.
//   * Lowercase single-word keys. Plurals fold onto the key ("lawyers").
//   * Only add a word when Postgres stems it apart. "accountant" and
//     "accounting" both stem to "account" already, so they need nothing here.
//   * Each added word is matched as a whole word. The prefix match is off for an
//     expanded search, so "law" never finds "lawn".

import { stem } from '@/lib/search/assist'

export const WORD_FAMILIES: Readonly<Record<string, readonly string[]>> = {
  lawyer: ['law', 'legal', 'attorney'],
  attorney: ['law', 'legal', 'lawyer'],
  law: ['legal', 'lawyer', 'attorney'],
  legal: ['law', 'lawyer', 'attorney'],
  dentist: ['dental', 'dentistry'],
  dental: ['dentist', 'dentistry'],
  dentistry: ['dentist', 'dental'],
  orthodontist: ['orthodontics'],
  orthodontics: ['orthodontist'],
  plumber: ['plumbing'],
  plumbing: ['plumber'],
  realtor: ['realty', 'real estate'],
  chiropractor: ['chiropractic'],
  chiropractic: ['chiropractor'],
  veterinarian: ['veterinary'],
  veterinary: ['veterinarian'],
  pharmacist: ['pharmacy'],
  pediatrician: ['pediatric', 'pediatrics'],
  optometrist: ['optometry'],
  therapist: ['therapy'],
  florist: ['floral'],
  baker: ['bakery'],
}

// More than this many ORed searches and the query is long enough that the
// visitor is better served by exactly what they typed.
const MAX_ALTERNATIVES = 12

/** The family for one typed word, folding plurals. Null when it has none. */
function familyOf(word: string): readonly string[] | null {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')
  if (!w) return null
  return WORD_FAMILIES[w] ?? WORD_FAMILIES[stem(w)] ?? null
}

/**
 * Widens a search to its word families as a websearch OR query: "divorce
 * lawyer" becomes "divorce lawyer OR divorce law OR divorce legal OR divorce
 * attorney". Every other word still has to match. The uppercase OR also turns
 * off the prefix match in search_prefix_tsquery, so an added word only ever
 * matches whole.
 *
 * Returns the search unchanged when no word has a family, or when the visitor
 * already used quotes, a minus or OR.
 */
export function expandSearchQuery(q: string): string {
  const trimmed = q.trim()
  if (!trimmed || /"|(^|\s)-\S|\sor\s/i.test(trimmed)) return trimmed

  const words = trimmed.split(/\s+/)
  if (!words.some((w) => familyOf(w))) return trimmed

  let combos: string[][] = [[]]
  for (const word of words) {
    const options = [word, ...(familyOf(word) ?? [])]
    combos = combos.flatMap((c) => options.map((o) => [...c, o]))
    if (combos.length > MAX_ALTERNATIVES) return trimmed
  }
  return combos.map((c) => c.join(' ')).join(' OR ')
}
