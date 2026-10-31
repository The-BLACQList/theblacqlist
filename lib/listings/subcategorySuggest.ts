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
