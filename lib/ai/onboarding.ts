/**
 * The /add-business drafts (ticket 128): what the prompt may see, what an answer
 * must look like, the mock, and the rules-only fallback.
 *
 * ── One call, five drafts, nothing saved ─────────────────────────────────────
 * After "Save my draft", one generation suggests a category, tagline, about,
 * search title and search description. None of it is written anywhere by the
 * generation: the owner taps "Use this" on a card and that card's value goes
 * through the ordinary save path. There is no `ai_suggestions` row, because
 * there is nothing pending to approve; the card is the review step.
 *
 * ── The prompt sees only this file's allowlist ───────────────────────────────
 * `OnboardingContext` is the whole input, and `buildOnboardingPromptVars` is the
 * only function that turns it into prompt text. It is short so it can be
 * audited in one reading (V2 privacy audit, docs/blacqlist/ai/). Owner and
 * imported text share one 500 character budget, owner words first, and both go
 * through `sanitizeForPrompt` with the owner's name removed. Categories reach
 * the model as short codes (C1, G1), never ids, so an answer can only point at a
 * row we offered.
 *
 * ── Text cannot close its own block ──────────────────────────────────────────
 * The template wraps owner words and site text in bracketed markers and tells
 * the model the site text is information only. Brackets, braces and backticks
 * are removed from every value before it is placed, so pasted text cannot end
 * a block early, fake a marker, or leave a `{{placeholder}}` in the prompt.
 *
 * Pure module: no database, no network, no logging.
 */

import { z } from 'zod'
import { searchGuide, type GuideCategory } from '@/lib/categories/sorting-guide'
import { withoutCreatorCategories } from '@/lib/listings/creatorCategories'
import { firstSentence } from '@/lib/listings/draftSeed'
import { fitQuery } from '@/lib/listings/quickStart'
import { rulesSeo, SEO_DESCRIPTION_MAX, SEO_DESCRIPTION_MIN, SEO_TITLE_MAX } from '@/lib/listings/seo'
import { ONBOARDING_AGENT } from './agents'
import {
  NO_NAME_REDACTION,
  sanitizeForPrompt,
  validateOutput,
  type OutputRejection,
  type PromptRedaction,
} from './sanitize'

/** Owner words and imported text together, in characters. */
export const ONBOARDING_TEXT_MAX = 500
/** Rules matches offered to the model as C codes. */
export const ONBOARDING_MAX_CANDIDATES = 6
/** Top-level groups offered as G codes, for a new category's home. */
export const ONBOARDING_MAX_GROUPS = 30
/** Below this many characters left, site text is left out rather than cut to a fragment. */
const MIN_SITE_ROOM = 40
export const DRAFT_TAGLINE_MAX = 120
export const DRAFT_ABOUT_MIN = 100
export const DRAFT_ABOUT_MAX = 300
export const DRAFT_CATEGORY_NAME_MIN = 2
export const DRAFT_CATEGORY_NAME_MAX = 60

/** The one plain line shown when the cards come from rules, not a generation. */
export const FALLBACK_LINE =
  "We couldn't write drafts this time, so here are simple ones from what you told us."
/** The page cap (5) is used up. */
export const PAGE_LIMIT_LINE =
  "That's all the fresh drafts for this page, so here are simple ones from what you told us."
/** The owner's daily cap (20) is used up. */
export const DAY_LIMIT_LINE =
  "That's all the fresh drafts for today, so here are simple ones from what you told us."

export type DraftStyle = 'fresh' | 'shorter' | 'warmer'
export type DraftFocus =
  | 'all'
  | 'category'
  | 'tagline'
  | 'about'
  | 'searchTitle'
  | 'searchDescription'

export const DRAFT_STYLES: readonly DraftStyle[] = ['fresh', 'shorter', 'warmer']
export const DRAFT_FOCUSES: readonly DraftFocus[] = [
  'all',
  'category',
  'tagline',
  'about',
  'searchTitle',
  'searchDescription',
]

export interface DraftRequest {
  style: DraftStyle
  focus: DraftFocus
}

export interface CategoryOption {
  id: string
  name: string
}

/**
 * Everything the drafts prompt is allowed to see. Same rule as
 * `GenerateContext` in provider.ts: there is no email, phone, address, zip,
 * social, user id or owner name member, and no index signature.
 */
export interface OnboardingContext {
  businessName: string
  /** '' for an online-only page. */
  cityName: string
  /** What the owner typed about the business. */
  ownerWords: string | null
  /** About text brought in from the owner's website, the part they kept. */
  importedAbout: string | null
  /** Rules matches, best first. */
  candidates: readonly CategoryOption[]
  /** Top-level categories, for a new category's group. */
  groups: readonly CategoryOption[]
}

export type CategoryDraft =
  | { kind: 'existing'; categoryId: string; name: string }
  | { kind: 'new'; name: string; groupId: string; groupName: string }

export interface OnboardingDrafts {
  /** Null when nothing fits and no new name was proposed. */
  category: CategoryDraft | null
  tagline: string
  about: string
  searchTitle: string
  searchDescription: string
}

/** The sanitized values, for the mock. Never the raw context. */
export interface OnboardingSafeText {
  businessName: string
  cityName: string
  ownerWords: string
  importedText: string
}

/** Brackets, braces and backticks out, so a value cannot fake a block marker. */
function neutralize(text: string | null | undefined): string {
  return (text ?? '').replace(/[[\]{}`]/g, ' ').replace(/[ \t]{2,}/g, ' ').trim()
}

const STYLE_NOTES: Record<DraftStyle, string> = {
  fresh: 'Write in a clear, friendly voice.',
  shorter: 'Keep every draft as short and plain as it can be while still clear.',
  warmer: 'Make every draft warm and welcoming, like a neighbor talking.',
}

const FOCUS_NOTES: Record<DraftFocus, string> = {
  all: 'Give all five the same care.',
  category: 'The owner asked for a new category idea. Put the most care into "category".',
  tagline: 'The owner asked for a new tagline. Put the most care into "tagline".',
  about: 'The owner asked for a new about. Put the most care into "about".',
  searchTitle: 'The owner asked for a new search title. Put the most care into "searchTitle".',
  searchDescription:
    'The owner asked for a new search description. Put the most care into "searchDescription".',
}

/**
 * The prompt's input from a saved draft. Candidates come from the same rules
 * matcher the quick start uses, so the model only ever chooses among categories
 * the rules already think fit, or proposes a new name under one of the groups.
 * Creators & Influencers is never offered (it has its own sign-up).
 *
 * `aboutFromSite`: the about came from the owner's website or link page and
 * they kept it. It then goes in the site block, which the model is told holds
 * information only, instead of being treated as the owner's own words.
 */
export function onboardingContextFrom(input: {
  businessName: string
  cityName: string | null
  description: string
  aboutFromSite: boolean
  categories: readonly GuideCategory[]
}): OnboardingContext {
  const cats = withoutCreatorCategories(input.categories)
  const description = input.description.trim()
  const candidates = searchGuide(
    fitQuery({ name: input.businessName, about: description }),
    cats,
    ONBOARDING_MAX_CANDIDATES
  ).map((c) => ({ id: c.id, name: c.name }))
  const groups = cats
    .filter((c) => c.parent_id === null)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ id: c.id, name: c.name }))
  return {
    businessName: input.businessName,
    cityName: input.cityName ?? '',
    ownerWords: input.aboutFromSite ? null : description || null,
    importedAbout: input.aboutFromSite ? description || null : null,
    candidates,
    groups,
  }
}

/**
 * The only function that turns an `OnboardingContext` into prompt variables.
 * Throws `PromptRedactionError` if redaction fails; the caller must not send.
 */
export function buildOnboardingPromptVars(
  ctx: OnboardingContext,
  redaction: PromptRedaction,
  request: DraftRequest
): { vars: Record<string, string>; safe: OnboardingSafeText } {
  const ownerWords = sanitizeForPrompt(neutralize(ctx.ownerWords), ONBOARDING_TEXT_MAX, redaction)
  // Site text gets what is left, unless that is too little to mean anything.
  const room = ONBOARDING_TEXT_MAX - ownerWords.length
  const importedText =
    room >= MIN_SITE_ROOM ? sanitizeForPrompt(neutralize(ctx.importedAbout), room, redaction) : ''
  // The owner's name is never removed from the business name, which may be
  // named after them. Contact details and addresses still are.
  const businessName = sanitizeForPrompt(neutralize(ctx.businessName), 120, NO_NAME_REDACTION)
  const cityName = sanitizeForPrompt(neutralize(ctx.cityName), 100, NO_NAME_REDACTION)
  const codeList = (prefix: 'C' | 'G', options: readonly CategoryOption[]) =>
    options
      .map((o, i) => `${prefix}${i + 1}: ${sanitizeForPrompt(neutralize(o.name), 60, NO_NAME_REDACTION)}`)
      .join('\n')

  const candidates = ctx.candidates.slice(0, ONBOARDING_MAX_CANDIDATES)
  const groups = ctx.groups.slice(0, ONBOARDING_MAX_GROUPS)
  return {
    vars: {
      business_name: businessName,
      city_name: cityName || 'Online only',
      owner_words: ownerWords || '(nothing yet)',
      imported_text: importedText || '(none)',
      candidate_list: candidates.length
        ? codeList('C', candidates)
        : '(none fit, so suggest a new category)',
      group_list: groups.length ? codeList('G', groups) : '(none)',
      style_note: STYLE_NOTES[request.style],
      focus_note: FOCUS_NOTES[request.focus],
    },
    safe: { businessName, cityName, ownerWords, importedText },
  }
}

// ── Reading an answer ──────────────────────────────────────────────────────

const ANSWER_SCHEMA = z.object({
  category: z.union([
    z.object({ pick: z.string().regex(/^C\d{1,2}$/) }),
    z.object({
      newName: z.string().trim().min(DRAFT_CATEGORY_NAME_MIN).max(DRAFT_CATEGORY_NAME_MAX),
      group: z.string().regex(/^G\d{1,2}$/),
    }),
  ]),
  tagline: z.string().trim().min(1).max(DRAFT_TAGLINE_MAX),
  about: z.string().trim().min(DRAFT_ABOUT_MIN).max(DRAFT_ABOUT_MAX),
  searchTitle: z.string().trim().min(1).max(SEO_TITLE_MAX),
  searchDescription: z.string().trim().min(SEO_DESCRIPTION_MIN).max(SEO_DESCRIPTION_MAX),
})

export type OnboardingParse =
  | { ok: true; drafts: OnboardingDrafts }
  | { ok: false; reason: OutputRejection }

function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
}

/**
 * Turns a raw answer into drafts, or refuses it. Refuses, never cleans: an
 * answer with an email or phone in any field is rejected whole, a field outside
 * its length is rejected whole, and a code we did not offer is rejected whole.
 */
export function parseOnboardingDrafts(raw: string, ctx: OnboardingContext): OnboardingParse {
  const whole = validateOutput(raw, ONBOARDING_AGENT.maxOutputChars)
  if (!whole.ok) return { ok: false, reason: whole.reason }

  let json: unknown
  try {
    json = JSON.parse(stripFences(whole.text))
  } catch {
    return { ok: false, reason: 'invalid_shape' }
  }
  const parsed = ANSWER_SCHEMA.safeParse(json)
  if (!parsed.success) {
    const tooLong = parsed.error.issues.some((issue) => issue.code === 'too_big')
    return { ok: false, reason: tooLong ? 'too_long' : 'invalid_shape' }
  }
  const answer = parsed.data

  const texts = [answer.tagline, answer.about, answer.searchTitle, answer.searchDescription]
  if ('newName' in answer.category) texts.push(answer.category.newName)
  for (const text of texts) {
    const check = validateOutput(text, ONBOARDING_AGENT.maxOutputChars)
    if (!check.ok) return { ok: false, reason: check.reason }
  }

  const candidates = ctx.candidates.slice(0, ONBOARDING_MAX_CANDIDATES)
  const groups = ctx.groups.slice(0, ONBOARDING_MAX_GROUPS)
  let category: CategoryDraft
  if ('pick' in answer.category) {
    const picked = candidates[Number(answer.category.pick.slice(1)) - 1]
    if (!picked) return { ok: false, reason: 'not_a_candidate' }
    category = { kind: 'existing', categoryId: picked.id, name: picked.name }
  } else {
    const group = groups[Number(answer.category.group.slice(1)) - 1]
    if (!group) return { ok: false, reason: 'not_a_candidate' }
    category = { kind: 'new', name: answer.category.newName, groupId: group.id, groupName: group.name }
  }

  // The founder's copy rule. A swap, not a rewrite: the meaning is unchanged.
  const plain = (text: string) => text.replace(/\s*[—–]\s*/g, ', ')
  return {
    ok: true,
    drafts: {
      category,
      tagline: plain(answer.tagline),
      about: plain(answer.about),
      searchTitle: plain(answer.searchTitle),
      searchDescription: plain(answer.searchDescription),
    },
  }
}

// ── The mock ───────────────────────────────────────────────────────────────

function clip(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return (space > max / 2 ? cut.slice(0, space) : cut).replace(/[,;:\s]+$/, '')
}

/**
 * Deterministic drafts made only from the page's own sanitized values, the same
 * way the dashboard mock is (mock-responses.ts). With no rules match it returns
 * an empty answer, which is rejected and falls back, because the mock cannot
 * honestly invent a new category.
 */
export function mockOnboardingResponse(
  safe: OnboardingSafeText,
  ctx: OnboardingContext,
  request: DraftRequest
): string {
  const best = ctx.candidates[0]
  if (!best) return ''
  const name = safe.businessName || 'This business'
  const place = safe.cityName ? ` in ${safe.cityName}` : ' online'

  const tagline = {
    fresh: `${best.name}${place} you can count on.`,
    shorter: `${best.name}${place}.`,
    warmer: `${best.name}${place}, with a warm welcome every time.`,
  }[request.style]

  const lead = firstSentence(safe.ownerWords || safe.importedText, 140)
  const aboutParts = [
    lead,
    `${name} is listed under ${best.name}${place} on The BLACQList.`,
    request.style === 'warmer' ? 'Stop by and say hello, we would be glad to see you.' : '',
    'Reach out through this page to ask a question or plan a visit.',
    'We look forward to hearing from you.',
  ].filter(Boolean)
  let about = ''
  for (const part of aboutParts) {
    const next = about ? `${about} ${part}` : part
    if (next.length > DRAFT_ABOUT_MAX) break
    about = next
  }

  const answer = {
    category: { pick: 'C1' },
    tagline: clip(tagline, DRAFT_TAGLINE_MAX),
    about: clip(about, DRAFT_ABOUT_MAX),
    searchTitle: clip(`${name}, ${best.name}${place}`, SEO_TITLE_MAX),
    searchDescription: clip(
      `Find ${name} under ${best.name}${place}. See what they offer and get in touch on The BLACQList.`,
      SEO_DESCRIPTION_MAX
    ),
  }
  return JSON.stringify(answer)
}

// ── The fallback ───────────────────────────────────────────────────────────

/**
 * Simple drafts from rules, for when a generation is off, capped, failed or
 * refused. The best rules match, the first sentence of the about, the about
 * itself, and the same search text the Google card already offers.
 */
export function fallbackDrafts(input: {
  businessName: string
  /** "Atlanta, GA", or null for an online-only page. */
  locationLabel: string | null
  about: string
  bestMatch: CategoryOption | null
}): OnboardingDrafts {
  const about = input.about.trim()
  const tagline =
    firstSentence(about, DRAFT_TAGLINE_MAX) ||
    `${input.businessName}${input.locationLabel ? ` in ${input.locationLabel}` : ''}`
  const seo = rulesSeo({
    name: input.businessName,
    tagline,
    description: about,
    categoryName: input.bestMatch?.name ?? null,
    locationLabel: input.locationLabel,
  })
  return {
    category: input.bestMatch
      ? { kind: 'existing', categoryId: input.bestMatch.id, name: input.bestMatch.name }
      : null,
    tagline,
    about,
    searchTitle: seo.title,
    searchDescription: seo.description,
  }
}
