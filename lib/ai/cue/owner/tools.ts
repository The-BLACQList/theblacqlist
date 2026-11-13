/**
 * The owner Cue's tools (ticket 203).
 *
 * ── Ownership ────────────────────────────────────────────────────────────────
 * The route loads the caller's pages once (owner_user_id = caller). Every tool
 * that takes a page resolves it against that list first, so a page id the
 * model makes up, or one belonging to someone else, is refused before any
 * read. The reads behind each tool filter by owner again.
 *
 * ── Nothing changes by itself ────────────────────────────────────────────────
 * draft_text makes a pending suggestion and shows it as a card. Only the
 * owner's "Use this" approves and applies it. go_to builds links from the
 * fixed list in sections.ts, never from a URL the model wrote.
 *
 * Every input is checked with zod, because a streamed tool input can arrive
 * cut short. Nothing here logs.
 */

import type Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

import type { CueToolRun } from '@/lib/ai/cue/loop'
import type { SuggestionRequestResult } from '@/lib/ai/requestSuggestion'
import type { PlanSlug } from '@/lib/stripe/plans'

import type { OwnedPage, PageFacts } from './data'
import { OWNER_DRAFT_KIND_IDS, OWNER_DRAFT_KINDS, type OwnerDraft, type OwnerLink } from './events'
import { OWNER_HELP_TOPICS, ownerHelp } from './help'
import { OWNER_SECTION_IDS, sectionLink, type OwnerSection } from './sections'

/** Drafts one message can ask for. Each one uses a writing-help draft. */
export const OWNER_MAX_DRAFTS = 1
/** Link buttons under one reply. */
export const OWNER_MAX_LINKS = 3

export interface OwnerCueDeps {
  pageFacts(page: OwnedPage): Promise<PageFacts | null>
  requestDraft(listingId: string, agentType: string): Promise<SuggestionRequestResult>
}

export interface OwnerTurnState {
  drafts: OwnerDraft[]
  links: OwnerLink[]
  /** Drafts asked for, counted before the request so parallel calls can't both pass. */
  draftsAsked: number
}

export interface OwnerCueContext {
  /** The caller's own pages. The only pages any tool will touch. */
  pages: readonly OwnedPage[]
  /** The page the owner has open, already checked against `pages`. */
  currentId: string | null
  /** Sections this deployment has (flags). */
  sections: ReadonlySet<OwnerSection>
  openTiers: ReadonlySet<PlanSlug>
  /** aiBeta: writing help is on. */
  writingHelp: boolean
  deps: OwnerCueDeps
  state: OwnerTurnState
}

export function newOwnerTurnState(): OwnerTurnState {
  return { drafts: [], links: [], draftsAsked: 0 }
}

// ─── Inputs ──────────────────────────────────────────────────────────────────

const listingId = z.string().uuid().optional()

export const getMyPageInput = z.object({ listing_id: listingId })
export const getHelpInput = z.object({ topic: z.enum(OWNER_HELP_TOPICS) })
export const draftTextInput = z.object({
  kind: z.enum(OWNER_DRAFT_KIND_IDS as [string, ...string[]]),
  listing_id: listingId,
})
export const goToInput = z.object({
  section: z.enum(OWNER_SECTION_IDS as [string, ...string[]]),
  listing_id: listingId,
})

const LISTING_ID_PROP = {
  type: 'string',
  description:
    "One of the owner's page ids from the context. Leave out to use the page they have open.",
} as const

export const OWNER_CUE_TOOLS: readonly Anthropic.Tool[] = [
  {
    name: 'get_my_page',
    description:
      "Reads one of the owner's own pages: name, kind, plan, status, city, category, tagline, the start of the About, counts, and what the page strength meter says is missing, with the section to fix each.",
    input_schema: { type: 'object', properties: { listing_id: LISTING_ID_PROP } },
  },
  {
    name: 'get_help',
    description:
      'Returns our written help on one topic. Answer how-to and plan questions from this, never from memory.',
    input_schema: {
      type: 'object',
      properties: { topic: { type: 'string', enum: [...OWNER_HELP_TOPICS] } },
      required: ['topic'],
    },
  },
  {
    name: 'draft_text',
    description:
      "Asks writing help for a draft of the page's About, search title or search description. The owner sees it as a card and chooses whether to use it; nothing changes on the page by itself. Uses one of the page's monthly drafts, so only call it when the owner asks for a draft.",
    input_schema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: OWNER_DRAFT_KIND_IDS },
        listing_id: LISTING_ID_PROP,
      },
      required: ['kind'],
    },
  },
  {
    name: 'go_to',
    description:
      'Adds a button under your reply that takes the owner to a card on the edit page or a dashboard page. Use it whenever you tell them where to do something.',
    input_schema: {
      type: 'object',
      properties: {
        section: { type: 'string', enum: OWNER_SECTION_IDS },
        listing_id: LISTING_ID_PROP,
      },
      required: ['section'],
    },
    cache_control: { type: 'ephemeral' },
  },
]

// ─── Running ─────────────────────────────────────────────────────────────────

function ok(value: unknown): CueToolRun {
  return { content: typeof value === 'string' ? value : JSON.stringify(value) }
}

function refuse(text: string): CueToolRun {
  return { content: text, isError: true }
}

type Resolved = { page: OwnedPage } | { error: CueToolRun }

/** The page a tool works on: one of the caller's, or a refusal. */
export function resolvePage(requested: string | undefined, ctx: OwnerCueContext): Resolved {
  if (requested) {
    const page = ctx.pages.find((p) => p.id === requested)
    return page
      ? { page }
      : { error: refuse("That page isn't one of the owner's pages. Use an id from the context.") }
  }
  const fallback = ctx.currentId
    ? ctx.pages.find((p) => p.id === ctx.currentId)
    : ctx.pages.length === 1
      ? ctx.pages[0]
      : undefined
  if (fallback) return { page: fallback }
  return {
    error: refuse('The owner has more than one page and none is open. Ask which page they mean.'),
  }
}

function addLink(ctx: OwnerCueContext, link: OwnerLink | null): boolean {
  if (!link) return false
  if (ctx.state.links.some((l) => l.href === link.href)) return true
  if (ctx.state.links.length >= OWNER_MAX_LINKS) return false
  ctx.state.links.push(link)
  return true
}

async function draftText(
  input: z.infer<typeof draftTextInput>,
  ctx: OwnerCueContext
): Promise<CueToolRun> {
  const resolved = resolvePage(input.listing_id, ctx)
  if ('error' in resolved) return resolved.error
  const { page } = resolved
  if (!ctx.writingHelp)
    return ok("Writing help isn't switched on yet, so no draft. Tell the owner.")
  if (page.entityType === 'event' || page.entityType === 'job') {
    return ok('Writing help is for business and creator pages, not events or jobs.')
  }
  if (ctx.state.draftsAsked >= OWNER_MAX_DRAFTS) {
    return refuse('One draft per message. Offer the next one in your reply.')
  }
  ctx.state.draftsAsked++

  const kind = input.kind as keyof typeof OWNER_DRAFT_KINDS
  const result = await ctx.deps.requestDraft(page.id, OWNER_DRAFT_KINDS[kind].agentType)
  if (!('success' in result)) {
    if (result.code === 'locked') {
      addLink(ctx, sectionLink('upgrade', null))
      return ok(
        'Not drafted: writing help comes with Starter. An Upgrade button is shown. Say so plainly.'
      )
    }
    return ok(`Not drafted. Tell the owner: ${result.error}`)
  }

  ctx.state.drafts.push({
    suggestionId: result.suggestion.id,
    kind,
    listingId: page.id,
    pageName: page.name,
    text: result.suggestion.text,
    sample: result.suggestion.sample,
  })
  const left = result.allowance.state === 'ready' ? result.allowance.left : null
  return ok({
    drafted: OWNER_DRAFT_KINDS[kind].label,
    shown_as_card: true,
    drafts_left_this_month: left,
    note: "The owner sees the draft as a card with Use this and Not now. Don't repeat the draft text.",
  })
}

export async function runOwnerCueTool(
  name: string,
  rawInput: unknown,
  ctx: OwnerCueContext
): Promise<CueToolRun> {
  switch (name) {
    case 'get_my_page': {
      const input = getMyPageInput.safeParse(rawInput)
      if (!input.success) return refuse('Bad input.')
      const resolved = resolvePage(input.data.listing_id, ctx)
      if ('error' in resolved) return resolved.error
      const facts = await ctx.deps.pageFacts(resolved.page)
      if (!facts) return refuse("That page couldn't be read.")
      return ok({
        ...facts,
        missing: facts.missing.map((m) => ({
          item: m.item,
          section: m.section && ctx.sections.has(m.section) ? m.section : null,
        })),
      })
    }
    case 'get_help': {
      const input = getHelpInput.safeParse(rawInput)
      if (!input.success) return refuse(`Unknown topic. Topics: ${OWNER_HELP_TOPICS.join(', ')}.`)
      return ok(ownerHelp(input.data.topic, ctx.openTiers) ?? 'No help on that.')
    }
    case 'draft_text': {
      const input = draftTextInput.safeParse(rawInput)
      if (!input.success) return refuse(`Bad input. Kinds: ${OWNER_DRAFT_KIND_IDS.join(', ')}.`)
      return draftText(input.data, ctx)
    }
    case 'go_to': {
      const input = goToInput.safeParse(rawInput)
      if (!input.success) return refuse('Unknown section. Use one from the list.')
      const section = input.data.section as OwnerSection
      if (!ctx.sections.has(section))
        return refuse("That part of the dashboard isn't available here.")
      const needsPage = sectionLink(section, null) === null
      let page: OwnedPage | null = null
      if (needsPage || input.data.listing_id) {
        const resolved = resolvePage(input.data.listing_id, ctx)
        if ('error' in resolved) return resolved.error
        page = resolved.page
      }
      const many = ctx.pages.length > 1
      const added = addLink(ctx, sectionLink(section, page?.id ?? null, many ? page?.name : null))
      return added
        ? ok('Button added under your reply.')
        : refuse(`At most ${OWNER_MAX_LINKS} buttons.`)
    }
    default:
      return refuse('Unknown tool.')
  }
}

/** The line shown while a tool runs. */
export function ownerStatusFor(name: string): string {
  switch (name) {
    case 'get_my_page':
      return 'Reading your page…'
    case 'get_help':
      return 'Checking the help…'
    case 'draft_text':
      return 'Writing a draft…'
    default:
      return 'Working…'
  }
}
