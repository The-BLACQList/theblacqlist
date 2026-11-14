// The owner Cue (ticket 203): input, ownership, the go_to allow-list, drafts
// that never apply themselves, help that follows plans.ts, the limits, and a
// whole message on the scripted model. The route's guards are read as text.

import { readFileSync } from 'node:fs'

import { ownerCuePageId } from '@/lib/ai/cue/owner/routes'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { OWNER_CUE_AGENT, ASSISTANT_AGENT, findAgent } from '@/lib/ai/agents'
import { ownerCueAskSchema, OWNER_CUE_MESSAGE_MAX } from '@/lib/ai/cue/owner/ask'
import type { OwnedPage, PageFacts } from '@/lib/ai/cue/owner/data'
import { OWNER_CUE_EVENT_TYPES } from '@/lib/ai/cue/owner/events'
import { ownerHelp, OWNER_HELP_TOPICS } from '@/lib/ai/cue/owner/help'
import {
  OWNER_CUE_BUDGET_SHARE,
  OWNER_CUE_PER_DAY,
  OWNER_CUE_PER_HOUR,
  ownerCueCallBudget,
  withinOwnerCueBudget,
} from '@/lib/ai/cue/owner/limits'
import { createMockOwnerCueCall } from '@/lib/ai/cue/owner/mock'
import { buildOwnerCueMessages, ownerCueSystem } from '@/lib/ai/cue/owner/prompt'
import { runOwnerCue } from '@/lib/ai/cue/owner/run'
import {
  availableSections,
  OWNER_SECTION_IDS,
  sectionLink,
  type OwnerSection,
} from '@/lib/ai/cue/owner/sections'
import {
  newOwnerTurnState,
  OWNER_CUE_TOOLS,
  OWNER_MAX_DRAFTS,
  OWNER_MAX_LINKS,
  resolvePage,
  runOwnerCueTool,
  type OwnerCueContext,
  type OwnerCueDeps,
} from '@/lib/ai/cue/owner/tools'
import { CUE_AGENT_TYPES } from '@/lib/ai/spend'
import { AGENT_PROMPT_MAP } from '@/lib/ai/prompts'
import type { SuggestionRequestResult } from '@/lib/ai/requestSuggestion'
import { PLANS, type PlanSlug } from '@/lib/stripe/plans'

const MINE = '11111111-1111-4111-8111-111111111111'
const MINE_TOO = '22222222-2222-4222-8222-222222222222'
const THEIRS = '33333333-3333-4333-8333-333333333333'
const SUGGESTION = '44444444-4444-4444-8444-444444444444'

const PAGE: OwnedPage = {
  id: MINE,
  name: 'Chef Rae',
  entityType: 'business',
  tier: 'starter',
  status: 'published',
}
const PAGE_TOO: OwnedPage = {
  id: MINE_TOO,
  name: 'Rae Events',
  entityType: 'event',
  tier: 'free',
  status: 'published',
}

function facts(page: OwnedPage): PageFacts {
  return {
    id: page.id,
    name: page.name,
    kind: page.entityType,
    plan: page.tier,
    status: page.status,
    city: 'Atlanta',
    category: 'Catering',
    tagline: null,
    about: null,
    aboutLength: 0,
    counts: { photos: 0, services: 0, daysWithHours: 0, extraButtons: 0 },
    mainButton: null,
    hasSearchTitle: false,
    hasSearchDescription: false,
    strengthPercent: 40,
    missing: [
      { item: 'Hours', section: 'hours' },
      { item: 'Photos', section: 'photos' },
      { item: 'Deals', section: 'deals' },
    ],
  }
}

const DRAFTED: SuggestionRequestResult = {
  success: true,
  suggestion: {
    id: SUGGESTION,
    text: 'Chef Rae cooks for weddings.',
    sample: false,
    agentType: 'listing_description',
  },
  allowance: { state: 'ready', left: 2 } as never,
}

function context(
  over: Partial<OwnerCueContext> = {},
  deps: Partial<OwnerCueDeps> = {}
): OwnerCueContext & {
  deps: { pageFacts: ReturnType<typeof vi.fn>; requestDraft: ReturnType<typeof vi.fn> }
} {
  return {
    pages: [PAGE],
    currentId: null,
    sections: new Set(availableSections(() => false)),
    openTiers: new Set<PlanSlug>(['starter']),
    writingHelp: true,
    deps: {
      pageFacts: vi.fn(async (page: OwnedPage) => facts(page)),
      requestDraft: vi.fn(async () => DRAFTED),
      ...deps,
    },
    state: newOwnerTurnState(),
    ...over,
  } as never
}

describe('ownerCueAskSchema', () => {
  it('takes a message, up to twelve turns and an optional page id', () => {
    const parsed = ownerCueAskSchema.parse({ message: '  hi  ', listingId: MINE })
    expect(parsed).toEqual({ message: 'hi', history: [], listingId: MINE })
    expect(ownerCueAskSchema.parse({ message: 'hi' }).listingId).toBeNull()
  })

  it('refuses empty or long messages, unknown fields and a page id that is not a uuid', () => {
    expect(ownerCueAskSchema.safeParse({ message: '   ' }).success).toBe(false)
    expect(
      ownerCueAskSchema.safeParse({ message: 'x'.repeat(OWNER_CUE_MESSAGE_MAX + 1) }).success
    ).toBe(false)
    expect(ownerCueAskSchema.safeParse({ message: 'hi', page: 'x' }).success).toBe(false)
    expect(ownerCueAskSchema.safeParse({ message: 'hi', listingId: 'abc' }).success).toBe(false)
    const turns = Array.from({ length: 13 }, () => ({ role: 'user', text: 'a' }))
    expect(ownerCueAskSchema.safeParse({ message: 'hi', history: turns }).success).toBe(false)
  })
})

describe('resolvePage: only the caller’s own pages', () => {
  it('refuses a page id that is not in the caller’s list', () => {
    const r = resolvePage(THEIRS, context())
    expect('error' in r && r.error.isError).toBe(true)
  })

  it('uses the open page, or the only page, and asks when there are several', () => {
    expect(resolvePage(undefined, context())).toEqual({ page: PAGE })
    expect(
      resolvePage(undefined, context({ pages: [PAGE, PAGE_TOO], currentId: MINE_TOO }))
    ).toEqual({
      page: PAGE_TOO,
    })
    const many = resolvePage(undefined, context({ pages: [PAGE, PAGE_TOO] }))
    expect('error' in many && many.error.content).toMatch(/Ask which page/)
  })

  it.each([
    ['get_my_page', { listing_id: THEIRS }],
    ['draft_text', { kind: 'about', listing_id: THEIRS }],
    ['go_to', { section: 'hours', listing_id: THEIRS }],
  ])('%s refuses someone else’s page before reading anything', async (tool, input) => {
    const ctx = context()
    const run = await runOwnerCueTool(tool, input, ctx)
    expect(run.isError).toBe(true)
    expect(ctx.deps.pageFacts).not.toHaveBeenCalled()
    expect(ctx.deps.requestDraft).not.toHaveBeenCalled()
    expect(ctx.state.links).toEqual([])
  })
})

describe('get_my_page', () => {
  it('drops sections this deployment does not have', async () => {
    const run = await runOwnerCueTool('get_my_page', {}, context())
    const body = JSON.parse(run.content) as PageFacts
    expect(body.missing).toEqual([
      { item: 'Hours', section: 'hours' },
      { item: 'Photos', section: 'photos' },
      { item: 'Deals', section: null },
    ])
  })
})

describe('go_to: links from the fixed list only', () => {
  it('builds edit and dashboard links, never a free URL', async () => {
    const ctx = context()
    await runOwnerCueTool('go_to', { section: 'hours' }, ctx)
    await runOwnerCueTool('go_to', { section: 'upgrade' }, ctx)
    expect(ctx.state.links).toEqual([
      { label: 'Hours', href: `/dashboard/pages/${MINE}/edit#hours` },
      { label: 'Upgrade', href: '/dashboard/upgrade' },
    ])
    const bad = await runOwnerCueTool('go_to', { section: 'https://evil.example' }, ctx)
    expect(bad.isError).toBe(true)
  })

  it('refuses a section whose flag is off, and caps the buttons', async () => {
    const ctx = context()
    expect((await runOwnerCueTool('go_to', { section: 'deals' }, ctx)).isError).toBe(true)
    for (const section of ['hours', 'photos', 'about'])
      await runOwnerCueTool('go_to', { section }, ctx)
    const extra = await runOwnerCueTool('go_to', { section: 'faq' }, ctx)
    expect(extra.isError).toBe(true)
    expect(ctx.state.links).toHaveLength(OWNER_MAX_LINKS)
  })

  it('every section id links to a dashboard path', () => {
    for (const section of OWNER_SECTION_IDS) {
      const link = sectionLink(section, MINE)
      expect(link?.href).toMatch(/^\/dashboard(\/|$)/)
    }
    expect(sectionLink('nowhere', MINE)).toBeNull()
  })

  it('flags decide which sections exist', () => {
    const off = new Set<OwnerSection>(availableSections(() => false))
    const on = new Set<OwnerSection>(availableSections(() => true))
    for (const s of [
      'deals',
      'order_on',
      'where_sold',
      'happening_now',
      'messages',
      'posts',
    ] as const) {
      expect(off.has(s)).toBe(false)
      expect(on.has(s)).toBe(true)
    }
  })
})

describe('draft_text: a pending suggestion, never applied', () => {
  it('asks writing help for the right agent and shows a card', async () => {
    const ctx = context()
    const run = await runOwnerCueTool('draft_text', { kind: 'search_title' }, ctx)
    expect(ctx.deps.requestDraft).toHaveBeenCalledWith(MINE, 'seo_coach_title')
    expect(JSON.parse(run.content)).toMatchObject({
      shown_as_card: true,
      drafts_left_this_month: 2,
    })
    expect(ctx.state.drafts).toEqual([
      {
        suggestionId: SUGGESTION,
        kind: 'search_title',
        listingId: MINE,
        pageName: 'Chef Rae',
        text: 'Chef Rae cooks for weddings.',
        sample: false,
      },
    ])
  })

  it('never imports the approve or apply actions', () => {
    for (const file of [
      'lib/ai/cue/owner/tools.ts',
      'lib/ai/cue/owner/run.ts',
      'app/api/cue/owner/route.ts',
    ]) {
      const src = readFileSync(join(process.cwd(), file), 'utf8')
      expect(src).not.toMatch(/approveSuggestion|applySuggestion/)
    }
  })

  it('one draft per message, even when asked twice at once', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => (release = r))
    const ctx = context({}, { requestDraft: vi.fn(async () => (await gate, DRAFTED)) })
    const both = Promise.all([
      runOwnerCueTool('draft_text', { kind: 'about' }, ctx),
      runOwnerCueTool('draft_text', { kind: 'search_title' }, ctx),
    ])
    release()
    const [, second] = await both
    expect(second.isError).toBe(true)
    expect(ctx.deps.requestDraft).toHaveBeenCalledTimes(OWNER_MAX_DRAFTS)
  })

  it('a Free page gets the Upgrade button, not a draft', async () => {
    const ctx = context(
      {},
      {
        requestDraft: vi.fn(
          async () => ({ error: 'Starter', code: 'locked' }) as SuggestionRequestResult
        ),
      }
    )
    const run = await runOwnerCueTool('draft_text', { kind: 'about' }, ctx)
    expect(run.content).toMatch(/Starter/)
    expect(ctx.state.drafts).toEqual([])
    expect(ctx.state.links).toEqual([{ label: 'Upgrade', href: '/dashboard/upgrade' }])
  })

  it('no draft when writing help is off, or for an event', async () => {
    const off = context({ writingHelp: false })
    await runOwnerCueTool('draft_text', { kind: 'about' }, off)
    expect(off.deps.requestDraft).not.toHaveBeenCalled()
    const event = context({ pages: [PAGE_TOO] })
    await runOwnerCueTool('draft_text', { kind: 'about' }, event)
    expect(event.deps.requestDraft).not.toHaveBeenCalled()
  })
})

describe('get_help', () => {
  it('the plan text follows plans.ts, and closed tiers are not for sale', () => {
    const text = ownerHelp('plans', new Set<PlanSlug>(['starter']))!
    for (const plan of PLANS) expect(text).toContain(plan.name)
    const starter = PLANS.find((p) => p.slug === 'starter')!
    expect(text).toContain(`$${starter.price_monthly} a month`)
    for (const f of starter.features) expect(text).toContain(f)
    for (const p of PLANS.filter((p) => p.slug !== 'free' && p.slug !== 'starter')) {
      expect(text).toContain(`${p.name}: not on sale yet.`)
    }
  })

  it('has text for every topic', () => {
    for (const topic of OWNER_HELP_TOPICS) expect(ownerHelp(topic, new Set())).toBeTruthy()
    expect(ownerHelp('nope', new Set())).toBeNull()
  })
})

describe('limits', () => {
  it('20 an hour, 100 a day, a fifth of the monthly budget', () => {
    expect([OWNER_CUE_PER_HOUR, OWNER_CUE_PER_DAY, OWNER_CUE_BUDGET_SHARE]).toEqual([20, 100, 0.2])
    expect(ownerCueCallBudget(1000)).toBe(200)
    expect(ownerCueCallBudget(0)).toBe(0)
    expect(ownerCueCallBudget(Number.NaN)).toBe(0)
    expect(withinOwnerCueBudget(196, 4, 1000)).toBe(true)
    expect(withinOwnerCueBudget(197, 4, 1000)).toBe(false)
  })
})

describe('agent wiring', () => {
  it('owner_cue is routed like the visitor Cue and counts as Cue spend', () => {
    expect(AGENT_PROMPT_MAP.owner_cue).toBe(OWNER_CUE_AGENT.templateKey)
    expect(OWNER_CUE_AGENT).toMatchObject({
      modelTier: 'fast',
      applyTarget: null,
      suggestionType: 'none',
    })
    // Not a writing-help agent: nothing can apply what it says.
    expect(findAgent('owner_cue')).toBeUndefined()
    expect(CUE_AGENT_TYPES).toEqual(
      expect.arrayContaining([ASSISTANT_AGENT.agentType, 'owner_cue'])
    )
  })

  it('the last tool carries the cache mark', () => {
    expect(OWNER_CUE_TOOLS.at(-1)?.cache_control).toEqual({ type: 'ephemeral' })
    expect(OWNER_CUE_TOOLS.map((t) => t.name)).toEqual([
      'get_my_page',
      'get_help',
      'draft_text',
      'go_to',
    ])
  })

  it('the wire has the owner events', () => {
    expect([...OWNER_CUE_EVENT_TYPES].sort()).toEqual([
      'done',
      'draft',
      'fallback',
      'links',
      'status',
      'text',
    ])
  })
})

describe('a whole message on the scripted model', () => {
  async function ask(message: string, ctx = context()) {
    const events: unknown[] = []
    const result = await runOwnerCue({
      call: createMockOwnerCueCall(),
      model: 'mock-v1',
      system: ownerCueSystem(),
      messages: buildOwnerCueMessages({
        history: [],
        message,
        pages: ctx.pages,
        currentId: ctx.currentId,
        writingHelp: ctx.writingHelp,
      }),
      ctx,
      emit: (e) => events.push(e),
      signal: new AbortController().signal,
    })
    return { result, events, ctx }
  }

  it('"how do I get more views" reads the page and links to what is missing', async () => {
    const { result, events } = await ask('How do I get more views?')
    expect(result.stop).toBe('end')
    expect(result.links.map((l) => l.href)).toEqual([
      `/dashboard/pages/${MINE}/edit#hours`,
      `/dashboard/pages/${MINE}/edit#photos`,
    ])
    expect(result.text).toBeTruthy()
    expect(events.some((e) => (e as { type: string }).type === 'status')).toBe(true)
  })

  it('"write my About" returns a draft card and applies nothing', async () => {
    const { result, ctx } = await ask('Write my About')
    expect(result.drafts).toHaveLength(1)
    expect(result.drafts[0]!.kind).toBe('about')
    expect(ctx.deps.requestDraft).toHaveBeenCalledWith(MINE, 'listing_description')
  })

  it('"what do the plans include" links to Upgrade', async () => {
    const { result } = await ask('What do the plans include?')
    expect(result.links).toEqual([{ label: 'Upgrade', href: '/dashboard/upgrade' }])
  })
})

describe('the route (read as text)', () => {
  const route = readFileSync(join(process.cwd(), 'app/api/cue/owner/route.ts'), 'utf8')

  it('checks the flag, then the kill switch, then the owner, then the rate limits', () => {
    const flat = route.replace(/\s+/g, ' ')
    const order = [
      "isFeatureEnabled('ownerCue')",
      'aiKillSwitchOn()',
      'getOwnerSession()',
      "bucket: 'owner_cue', identifier: `hour:${userId}`",
      "bucket: 'owner_cue', identifier: `day:${userId}`",
      'withinOwnerCueBudget(',
    ].map((needle) => flat.indexOf(needle))
    for (const i of order) expect(i).toBeGreaterThan(-1)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('writes the audit row without a page or any text', () => {
    expect(route).toMatch(/listing_id: null/)
    expect(route).toMatch(/created_by: userId/)
    expect(route).not.toMatch(/console\./)
    expect(route).not.toMatch(/prompt_text|message_text|input_text/)
  })

  it('the visitor Cue is unchanged: still hidden on the dashboard', () => {
    const routes = readFileSync(join(process.cwd(), 'lib/assistant/routes.ts'), 'utf8')
    expect(routes).toMatch(/dashboard/)
  })
})

describe('the corner button', () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
  const sidebar = read('components/dashboard/DashboardSidebar.tsx')
  const layout = read('app/dashboard/layout.tsx')
  const cue = read('components/dashboard/OwnerCue.tsx')
  const css = read('app/globals.css')
  const save = read('components/listings/finish/ProfileSave.tsx')

  it('is mounted by the dashboard layout behind the flag, not in the sidebar', () => {
    expect(layout).toMatch(/isFeatureEnabled\('ownerCue'\) && hasListings && <OwnerCue \/>/)
    expect(sidebar).not.toMatch(/OwnerCue/)
  })

  it('shows on every dashboard page, Upgrade included', () => {
    expect(cue).not.toMatch(/return null/)
    expect(cue).not.toMatch(/HiddenPath/)
  })

  it('reads the open page from the address', () => {
    const id = '11111111-2222-4333-8444-555555555555'
    expect(ownerCuePageId(`/dashboard/pages/${id}/edit`)).toBe(id)
    expect(ownerCuePageId(`/dashboard/pages/${id}`)).toBe(id)
    expect(ownerCuePageId('/dashboard/pages/new')).toBeNull()
    expect(ownerCuePageId('/dashboard/messages')).toBeNull()
  })

  it('works like the visitor Cue: corner pill, side panel on a computer, sheet on a phone', () => {
    expect(cue).toMatch(/fixed bottom-4 right-4 z-40/)
    expect(cue).toMatch(/modal=\{!isDesktop\}/)
    expect(cue).toMatch(/md:bottom-4 md:right-4 md:w-96/)
    expect(cue).toMatch(/onInteractOutside/)
    expect(cue).not.toMatch(/DialogPrimitive\.Overlay/)
    expect(cue).toMatch(/aria-label="Ask Cue"/)
  })

  it('rides above the edit page Save bar and the Tester Tour', () => {
    const rail = read('components/tour/TourRail.tsx')
    expect(save).toMatch(/data-save-bar=""/)
    expect(cue).toMatch(/owner-cue-pill fixed bottom-4/)
    expect(css).toMatch(
      /\.owner-cue-pill \{\s*bottom: calc\(var\(--owner-cue-base, 1rem\) \+ var\(--tour-rail-stack, 0px\)\)/
    )
    expect(css).toMatch(/body:has\(\[data-save-bar\]\) \{\s*--owner-cue-base: 6\.5rem/)
    expect(css).toMatch(/body:has\(\[data-save-bar\]\) \.owner-cue-panel/)
    // The tour keeps the corner; it writes its height for Cue to sit above.
    expect(rail).toMatch(/setProperty\('--tour-rail-stack'/)
    expect(rail.match(/ref=\{cornerRef\}/g)).toHaveLength(2)
  })
})
