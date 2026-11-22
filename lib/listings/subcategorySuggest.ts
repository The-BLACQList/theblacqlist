/**
 * Subcategory suggestions for listings filed only under a top-level group
 * (ticket 170).
 *
 * Rule-based, no AI. A listing's own words (name, tagline, description) are
 * matched against each child of its current group: the child's name and the
 * related words in lib/search/categoryKeywords.ts. Only children of the group
 * the listing is already in are ever suggested, so a law firm under
 * Professional Services can become Law & Legal Services and nothing else.
 *
 * A suggestion is a review row, never a write. The founder marks each one
 * APPLY or SKIP in the CSV before scripts/ops/apply-subcategories.ts runs.
 */

import { GENERIC_NAME_TOKENS, stem, type AssistCategory } from '@/lib/search/assist'
import { CATEGORY_KEYWORDS } from '@/lib/search/categoryKeywords'

export interface SuggestInput {
  name: string
  tagline: string | null
  description: string | null
}

export interface SubcategorySuggestion {
  /** The child to move to, or null when nothing matched or two tied. */
  suggested: AssistCategory | null
  /** The words that matched the suggested child, or every tied child's words. */
  matched: string[]
  /** `several` when two or more different words agree, `one` for a single hit. */
  confidence: 'several' | 'one' | 'tie' | 'none'
  /** On a tie, the children that tied, best name first. */
  tied: AssistCategory[]
}

// normalizeQuery's rules without its 300-character cap: a description is
// often longer than a search box, and the words past the cap count too.
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function stemmed(text: string): string {
  const n = normalize(text)
  return n ? n.split(' ').map(stem).join(' ') : ''
}

function hasPhrase(text: string, phrase: string): boolean {
  return phrase !== '' && ` ${text} `.includes(` ${phrase} `)
}

/** The terms that point at one child: its own name words and its related words. */
function childTerms(child: AssistCategory, keywords: Readonly<Record<string, readonly string[]>>): string[] {
  const own = stemmed(`${child.name} ${child.slug.replace(/-/g, ' ')}`)
    .split(' ')
    .filter((t) => t.length > 1 && !GENERIC_NAME_TOKENS.has(t))
  const related = (keywords[child.slug] ?? []).map(stemmed).filter(Boolean)
  return [...new Set([...own, ...related])]
}

/**
 * The best child of `parentId` for this listing. Name and tagline count double,
 * since a business names what it does; a long description mentions plenty it
 * doesn't do.
 */
export function suggestSubcategory(
  listing: SuggestInput,
  parentId: string,
  categories: readonly AssistCategory[],
  keywords: Readonly<Record<string, readonly string[]>> = CATEGORY_KEYWORDS
): SubcategorySuggestion {
  const head = stemmed(`${listing.name} ${listing.tagline ?? ''}`)
  const body = stemmed(listing.description ?? '')

  const scored = categories
    .filter((c) => c.parentId === parentId)
    .map((child) => {
      const matched: string[] = []
      let score = 0
      for (const term of childTerms(child, keywords)) {
        if (hasPhrase(head, term)) {
          matched.push(term)
          score += 2
        } else if (hasPhrase(body, term)) {
          matched.push(term)
          score += 1
        }
      }
      return { child, matched, score }
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.child.name.localeCompare(b.child.name))

  const best = scored[0]
  if (!best) return { suggested: null, matched: [], confidence: 'none', tied: [] }

  const tied = scored.filter((s) => s.score === best.score)
  if (tied.length > 1) {
    return {
      suggested: null,
      matched: [...new Set(tied.flatMap((s) => s.matched))],
      confidence: 'tie',
      tied: tied.map((s) => s.child),
    }
  }

  return {
    suggested: best.child,
    matched: best.matched,
    confidence: best.matched.length >= 2 ? 'several' : 'one',
    tied: [],
  }
}

// ─── Into one new category (ticket 257) ──────────────────────────────────────
//
// suggestSubcategory only looks inside a listing's own group. A new category
// like Bath & Body takes listings from anywhere: soap makers sit under Health
// & Wellness Products, Handmade & Artisan Goods, or a group with no child at
// all. suggestInto asks one question of every listing: does it belong in this
// one category? It is stricter than suggestSubcategory, because a wrong move
// takes a business out of the place it was found.

export interface IntoRule {
  /** In the name, one of these is enough ("Lather & Light Soap Co."). */
  strong: readonly string[]
  /** Anywhere in the name, tagline or description: two different ones are enough. */
  words: readonly string[]
  /** In the name or tagline, another trade that shares the words. */
  excludeHead: readonly string[]
  /** Anywhere: a trade that never makes bath goods (auto body, remodels). */
  excludeAnywhere: readonly string[]
}

export const INTO_RULES: Readonly<Record<string, IntoRule>> = {
  'bath-body': {
    strong: ['soap', 'bath', 'body butter', 'bath bomb', 'lotion', 'toiletries', 'body wash', 'deodorant'],
    words: [
      ...(CATEGORY_KEYWORDS['bath-body'] ?? []),
      'bar soap', 'body care', 'bodycare', 'skin care', 'skincare', 'whipped butter', 'scrub',
    ],
    excludeHead: ['massage', 'spa services', 'day spa', 'hair', 'salon', 'barber', 'braids', 'nails', 'esthetician'],
    excludeAnywhere: [
      'auto', 'automotive', 'collision', 'body shop', 'body work', 'bodywork', 'remodel', 'remodeling',
      'renovation', 'plumbing', 'plumber', 'contractor', 'tile',
    ],
  },
}

export interface IntoSuggestion {
  /**
   * `name`: a strong word in the name. `several`: two or more different
   * words. `excluded`: one of those, but another trade's word ruled it out
   * (listed for review, never suggested). `none`: no match.
   */
  confidence: 'name' | 'several' | 'excluded' | 'none'
  /** The words that matched, as stemmed phrases. */
  matched: string[]
  /** The exclusion that ruled it out, when one did. */
  excludedBy: string | null
}

const terms = (list: readonly string[]) => [...new Set(list.map(stemmed).filter(Boolean))]

/** Whether a listing belongs in the rule's category. Rule-based, no AI. */
export function suggestInto(listing: SuggestInput, rule: IntoRule): IntoSuggestion {
  const name = stemmed(listing.name)
  const head = stemmed(`${listing.name} ${listing.tagline ?? ''}`)
  const all = `${head} ${stemmed(listing.description ?? '')}`

  const matched = terms([...rule.strong, ...rule.words]).filter((t) => hasPhrase(all, t))
  // "bath bomb" and "bath" are one hit, not two.
  const distinct = matched.filter((t) => !matched.some((o) => o !== t && hasPhrase(o, t)))
  const byName = terms(rule.strong).some((t) => hasPhrase(name, t))
  if (!byName && distinct.length < 2) return { confidence: 'none', matched: [], excludedBy: null }

  const excludedBy =
    terms(rule.excludeAnywhere).find((t) => hasPhrase(all, t)) ??
    terms(rule.excludeHead).find((t) => hasPhrase(head, t)) ??
    null
  if (excludedBy) return { confidence: 'excluded', matched: distinct, excludedBy }
  return { confidence: byName ? 'name' : 'several', matched: distinct, excludedBy: null }
}
