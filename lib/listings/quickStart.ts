/**
 * The /add-business quick start (ticket 126).
 *
 * One question at a time, then "Save my draft" writes the listing and opens the
 * finish page. This file holds the rules the screens follow, so they can be
 * tested without a browser:
 *
 *   - the step order
 *   - the "Not quite" layers on "Here's how we'd list you": one pick, two more,
 *     the 13 groups, then "Suggest a new category". A query that matches
 *     nothing starts at the groups, so the owner can never get stuck.
 *   - what is still missing when the owner taps "Save my draft" early
 *   - which step a server field error belongs to
 *
 * Rules only, no AI. Pure and client-safe.
 */

import { descriptionCharLimit } from '@/lib/stripe/features'
import {
  GUIDE_ANSWERS,
  type GuideAnswer,
  type GuideCategory,
  type GuidePick,
  type GuideWhereId,
  buildGuidePick,
  findAnswer,
  findWhere,
  searchGuide,
} from '@/lib/categories/sorting-guide'

export const QUICK_STEPS = [
  'ownership',
  'name',
  'about',
  'fit',
  'where',
  'cta',
  'tagline',
  'attest',
] as const

export type QuickStep = (typeof QUICK_STEPS)[number]

export type FitChoice =
  /** `answerId` is the group the owner tapped, when they came through the groups. */
  | { kind: 'category'; categoryId: string; answerId?: string }
  | { kind: 'request'; parentId: string; proposedName: string; words: string }

export interface QuickStartAnswers {
  ownership: 'black_owned' | 'ally' | ''
  name: string
  about: string
  fit: FitChoice | null
  where: GuideWhereId | ''
  cityId: string
  /** Only when "My city isn't listed". */
  cityText: string
  stateText: string
  ctaType: string
  ctaUrl: string
  /** Empty means "use the first sentence of about". */
  tagline: string
  attested: boolean
}

export const EMPTY_ANSWERS: QuickStartAnswers = {
  ownership: '',
  name: '',
  about: '',
  fit: null,
  where: '',
  cityId: '',
  cityText: '',
  stateText: '',
  ctaType: '',
  ctaUrl: '',
  tagline: '',
  attested: false,
}

export const ABOUT_MIN = 15
export const NAME_MIN = 2
export const NAME_MAX = 120
export const TAGLINE_MIN = 5
export const TAGLINE_MAX = 120
export const REQUEST_NAME_MIN = 2
export const REQUEST_NAME_MAX = 60
export const REQUEST_WORDS_MAX = 500

/** Every new listing starts on Free, so the about box uses Free's limit. */
export function aboutMax(): number {
  return descriptionCharLimit('free') ?? 2000
}

// ── The main button ────────────────────────────────────────────────────────

export type QuickCtaInput = 'url' | 'tel' | 'email'

export interface QuickCta {
  value: 'book' | 'order' | 'call' | 'visit' | 'message'
  label: string
  /** What the button says on the live page. */
  buttonLabel: string
  input: QuickCtaInput
  inputLabel: string
  placeholder: string
}

export const QUICK_CTAS: readonly QuickCta[] = [
  {
    value: 'book',
    label: 'Book an appointment',
    buttonLabel: 'Book now',
    input: 'url',
    inputLabel: 'Booking link',
    placeholder: 'https://cal.com/yourbusiness',
  },
  {
    value: 'order',
    label: 'Order online',
    buttonLabel: 'Order online',
    input: 'url',
    inputLabel: 'Order link',
    placeholder: 'https://yourbusiness.com/order',
  },
  {
    value: 'call',
    label: 'Call',
    buttonLabel: 'Call us',
    input: 'tel',
    inputLabel: 'Phone number',
    placeholder: '(404) 555-0100',
  },
  {
    value: 'visit',
    label: 'Visit or get directions',
    buttonLabel: 'Get directions',
    input: 'url',
    inputLabel: 'Directions link',
    placeholder: 'https://maps.google.com/?q=...',
  },
  {
    value: 'message',
    label: 'Send a message',
    buttonLabel: 'Send a message',
    input: 'email',
    inputLabel: 'Email for messages',
    placeholder: 'hello@yourbusiness.com',
  },
]

export function findCta(value: string): QuickCta | undefined {
  return QUICK_CTAS.find((c) => c.value === value)
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** The same checks createListingAction runs on cta_url. */
export function ctaValueProblem(ctaType: string, value: string): string | null {
  const v = value.trim()
  const cta = findCta(ctaType)
  if (!cta) return 'Pick what the main button does.'
  if (!v) return `Add your ${cta.inputLabel.toLowerCase()}.`
  if (cta.input === 'email') return EMAIL_RE.test(v) ? null : 'Enter a valid email address.'
  if (cta.input === 'tel')
    return /\d{7,}/.test(v.replace(/\D/g, '')) ? null : 'Enter a phone number.'
  return /^https?:\/\//.test(v) ? null : 'Links start with https://'
}

// ── "Here's how we'd list you" ─────────────────────────────────────────────

export type FitLayer = 'best' | 'more' | 'groups' | 'suggest'

export interface FitOptions {
  best: GuideCategory | null
  /** Up to two more matches behind the first "Not quite". */
  more: GuideCategory[]
  /** The guide's 13 plain-language groups that have a category in the live tree. Always present. */
  groups: GuideAnswer[]
  /** Top-level categories, A to Z: the "closest group" choices for a new category. */
  parents: GuideCategory[]
}

export function fitQuery(a: Pick<QuickStartAnswers, 'name' | 'about'>): string {
  return `${a.name} ${a.about}`.trim()
}

export function fitOptions(query: string, categories: readonly GuideCategory[]): FitOptions {
  const matches = searchGuide(query, categories, 3)
  const slugs = new Set(categories.map((c) => c.slug))
  const groups = GUIDE_ANSWERS.filter((a) => a.candidates.some((cand) => slugs.has(cand.slug)))
  const parents = categories
    .filter((c) => c.parent_id === null)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
  return { best: matches[0] ?? null, more: matches.slice(1, 3), groups, parents }
}

export function firstFitLayer(options: FitOptions): FitLayer {
  return options.best ? 'best' : 'groups'
}

/** Where "Not quite" goes from each layer. */
export function nextFitLayer(layer: FitLayer, options: FitOptions): FitLayer {
  if (layer === 'best') return options.more.length > 0 ? 'more' : 'groups'
  if (layer === 'more') return 'groups'
  return 'suggest'
}

/** The top-level group a category sits under (itself when it is one). */
export function groupOf(
  categoryId: string,
  categories: readonly GuideCategory[]
): GuideCategory | undefined {
  const cat = categories.find((c) => c.id === categoryId)
  if (!cat) return undefined
  if (!cat.parent_id) return cat
  return categories.find((c) => c.id === cat.parent_id) ?? cat
}

/** The category the listing is saved under. A request saves under its group. */
export function fitCategoryId(fit: FitChoice | null): string {
  if (!fit) return ''
  return fit.kind === 'category' ? fit.categoryId : fit.parentId
}

/**
 * The group a new category request starts under: the best match's group, else
 * the first category of the group the owner tapped, else none.
 */
export function defaultRequestParent(
  options: FitOptions,
  categories: readonly GuideCategory[],
  answerId?: string
): string {
  if (options.best) return groupOf(options.best.id, categories)?.id ?? ''
  const answer = findAnswer(answerId)
  const bySlug = new Map(categories.map((c) => [c.slug, c]))
  for (const cand of answer?.candidates ?? []) {
    const cat = bySlug.get(cand.slug)
    if (cat) return groupOf(cat.id, categories)?.id ?? ''
  }
  return ''
}

/** Listing type, category and "why" line for the current answers. */
export function pickFor(
  a: QuickStartAnswers,
  categories: readonly GuideCategory[]
): GuidePick | null {
  const id = fitCategoryId(a.fit)
  const cat = categories.find((c) => c.id === id)
  if (!cat) return null
  const answer = a.fit?.kind === 'category' ? findAnswer(a.fit.answerId) : undefined
  return buildGuidePick(cat, categories, {
    answer,
    where: a.where || null,
    query: fitQuery(a),
  })
}

// ── What is still missing ──────────────────────────────────────────────────

export interface Missing {
  step: QuickStep
  /** The id of the input to focus. */
  fieldId: string
  reason: string
}

export const FIELD_IDS = {
  ownership: 'qs-ownership-black_owned',
  name: 'qs-name',
  about: 'qs-about',
  fit: 'qs-fit',
  requestName: 'qs-request-name',
  where: 'qs-where-visit',
  city: 'qs-city',
  cityText: 'qs-city-text',
  ctaType: 'qs-cta-book',
  ctaUrl: 'qs-cta-value',
  tagline: 'qs-tagline',
  attest: 'qs-attest',
} as const

/** The first problem on one step, or null when the step is done. */
export function stepProblem(step: QuickStep, a: QuickStartAnswers): Missing | null {
  switch (step) {
    case 'ownership':
      return a.ownership
        ? null
        : { step, fieldId: FIELD_IDS.ownership, reason: 'Pick Black-Owned or Ally.' }
    case 'name': {
      const n = a.name.trim().length
      if (n < NAME_MIN) return { step, fieldId: FIELD_IDS.name, reason: 'Add your business name.' }
      if (n > NAME_MAX)
        return { step, fieldId: FIELD_IDS.name, reason: `Keep the name to ${NAME_MAX} characters.` }
      return null
    }
    case 'about': {
      const n = a.about.trim().length
      if (n < ABOUT_MIN)
        return {
          step,
          fieldId: FIELD_IDS.about,
          reason: `Tell people what you do in at least ${ABOUT_MIN} characters.`,
        }
      if (n > aboutMax())
        return {
          step,
          fieldId: FIELD_IDS.about,
          reason: `Keep this to ${aboutMax()} characters. You can add more after a plan upgrade.`,
        }
      return null
    }
    case 'fit': {
      if (!a.fit) return { step, fieldId: FIELD_IDS.fit, reason: 'Pick where your page is listed.' }
      if (a.fit.kind === 'request') {
        if (!a.fit.parentId)
          return { step, fieldId: FIELD_IDS.fit, reason: 'Pick the closest group.' }
        const n = a.fit.proposedName.trim().length
        if (n < REQUEST_NAME_MIN || n > REQUEST_NAME_MAX)
          return {
            step,
            fieldId: FIELD_IDS.requestName,
            reason: `Name the new category in ${REQUEST_NAME_MIN} to ${REQUEST_NAME_MAX} characters.`,
          }
        if (a.fit.words.trim().length > REQUEST_WORDS_MAX)
          return {
            step,
            fieldId: FIELD_IDS.requestName,
            reason: `Keep your note to ${REQUEST_WORDS_MAX} characters.`,
          }
      }
      return null
    }
    case 'where':
      if (!a.where)
        return { step, fieldId: FIELD_IDS.where, reason: 'Pick where customers get what you do.' }
      if (a.where !== 'online' && !a.cityId && !a.cityText.trim())
        return {
          step,
          fieldId: a.cityText || a.stateText ? FIELD_IDS.cityText : FIELD_IDS.city,
          reason: 'Pick your city.',
        }
      return null
    case 'cta': {
      if (!findCta(a.ctaType))
        return { step, fieldId: FIELD_IDS.ctaType, reason: 'Pick what the main button does.' }
      const problem = ctaValueProblem(a.ctaType, a.ctaUrl)
      return problem ? { step, fieldId: FIELD_IDS.ctaUrl, reason: problem } : null
    }
    case 'tagline': {
      const n = a.tagline.trim().length
      if (n === 0) return null
      if (n < TAGLINE_MIN)
        return {
          step,
          fieldId: FIELD_IDS.tagline,
          reason: `Make it at least ${TAGLINE_MIN} characters, or leave it empty.`,
        }
      if (n > TAGLINE_MAX)
        return { step, fieldId: FIELD_IDS.tagline, reason: `Keep it to ${TAGLINE_MAX} characters.` }
      return null
    }
    case 'attest':
      return a.attested
        ? null
        : {
            step,
            fieldId: FIELD_IDS.attest,
            reason: 'Confirm you own or run this business.',
          }
  }
}

/** The first missing item across every step, in step order. */
export function firstMissing(a: QuickStartAnswers): Missing | null {
  for (const step of QUICK_STEPS) {
    const problem = stepProblem(step, a)
    if (problem) return problem
  }
  return null
}

/** Which step a createListingAction field error belongs to. */
export function stepForServerField(field: string): QuickStep | null {
  if (field === 'ownership_label') return 'ownership'
  if (field === 'name') return 'name'
  if (field === 'description' || field === 'founder_story') return 'about'
  if (field === 'tagline') return 'tagline'
  if (field === 'category_id' || field === 'entity_type' || field.startsWith('category_request'))
    return 'fit'
  if (field === 'location_type' || field === 'city_id') return 'where'
  if (field === 'cta_type' || field === 'cta_url' || field === 'phone') return 'cta'
  return null
}

// ── The live page ──────────────────────────────────────────────────────────

/** "Atlanta, GA", "Online", or null while unknown. */
export function locationLabel(
  a: Pick<QuickStartAnswers, 'where' | 'cityId' | 'cityText' | 'stateText'>,
  cities: readonly { id: string; name: string; stateCode: string | null }[]
): string | null {
  if (a.where === 'online') return 'Online'
  const city = cities.find((c) => c.id === a.cityId)
  if (city) return city.stateCode ? `${city.name}, ${city.stateCode}` : city.name
  const typed = a.cityText.trim()
  if (typed) return a.stateText.trim() ? `${typed}, ${a.stateText.trim()}` : typed
  return null
}

export function whereLocationType(where: QuickStartAnswers['where']): string {
  return findWhere(where || null)?.locationType ?? ''
}
