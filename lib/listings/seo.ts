/**
 * Search text for a listing page (ticket 126).
 *
 * Two jobs:
 *   - `listingMetaText` is what the public page puts in <title> and the meta
 *     description. The owner's own meta_title / meta_description win when set;
 *     otherwise it is the text the page has always built.
 *   - `rulesSeo` drafts that search text from the page fields with no AI, for
 *     the finish page's "How you'll show up on Google" card. Its description is
 *     always at least SEO_DESCRIPTION_MIN characters, so "Use this" is never
 *     blocked by length.
 */

export const SEO_TITLE_MAX = 60
export const SEO_DESCRIPTION_MIN = 40
export const SEO_DESCRIPTION_MAX = 160

export interface ListingSeoFields {
  name: string
  tagline: string | null
  description?: string | null
  categoryName: string | null
  /** "Atlanta, GA", or null for an online-only page. */
  locationLabel: string | null
  metaTitle?: string | null
  metaDescription?: string | null
}

function squash(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim()
}

function stripEndPunctuation(text: string): string {
  return text.replace(/[.!?]+\s*$/, '')
}

/** Cut at a word boundary so the result fits `max`, with no trailing comma. */
function fit(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[,;:\s]+$/, '')}…`
}

/** The listing page's <title> (before the site suffix) and meta description. */
export function listingMetaText(f: ListingSeoFields): { title: string; description: string } {
  const location = f.locationLabel ?? 'Online'
  const builtTitle = `${f.name} in ${location}`
  // Taglines land with and without end punctuation; trim it before adding a period.
  const tagline = stripEndPunctuation(squash(f.tagline))
  const builtDescription = `${tagline ? `${tagline}. ` : ''}${f.categoryName ?? 'Business'} in ${location}. Discover and support Black-owned businesses on The BLACQList.`
  return {
    title: squash(f.metaTitle) || builtTitle,
    description: squash(f.metaDescription) || builtDescription,
  }
}

/** Rules-only search title and description for the Google card. */
export function rulesSeo(f: ListingSeoFields): { title: string; description: string } {
  const name = squash(f.name)
  const category = squash(f.categoryName)
  const place = f.locationLabel ? ` in ${f.locationLabel}` : ''

  const titleOptions = [
    category && place ? `${name} | ${category}${place}` : '',
    place ? `${name}${place}` : '',
    category ? `${name} | ${category}` : '',
    name,
  ]
  const title = fit(titleOptions.find((t) => t && t.length <= SEO_TITLE_MAX) ?? name, SEO_TITLE_MAX)

  const lead = stripEndPunctuation(squash(f.tagline) || squash(f.description))
  const where = f.locationLabel ? ` in ${f.locationLabel}` : ' online'
  const kind = category ? category.toLowerCase() : 'business'
  const parts = [
    lead ? `${lead}.` : '',
    `${name} is a ${kind}${where}.`,
    'Find hours, contact info and reviews on The BLACQList.',
  ].filter(Boolean)

  let description = ''
  for (const part of parts) {
    const next = description ? `${description} ${part}` : part
    if (next.length > SEO_DESCRIPTION_MAX) break
    description = next
  }
  // A long lead can fill the budget alone; cut it to fit instead of dropping it.
  if (!description) description = fit(parts[0] ?? '', SEO_DESCRIPTION_MAX)
  if (description.length < SEO_DESCRIPTION_MIN) {
    description = fit(`${description} Support Black-owned and ally businesses on The BLACQList.`.trim(), SEO_DESCRIPTION_MAX)
  }
  return { title, description }
}
