// =============================================================================
// The search eval set, unit run (ticket 256)
// =============================================================================
// Every question in tests/fixtures/search-evals.ts goes through both answers
// the /search strip can give, against a small catalogue and a fake of
// queryListings that ANDs words the way the grid does:
//
//   * the quick answer (lib/search/basicAnswer.ts), no model
//   * Cue with the mock model, which searches the understood words and shows
//     what the search tool returns (including close matches)
//
// The rules: never empty, never a remark on ownership, and the business the
// question is about is among the cards. Live runs use
// scripts/eval/search-evals.ts.
// =============================================================================

import { describe, expect, it } from 'vitest'

import { runCue } from '@/lib/ai/cue/agent'
import { createMockCueCall } from '@/lib/ai/cue/mock'
import { buildCueMessages, cueSystem } from '@/lib/ai/cue/prompt'
import type { AssistantAction, AssistantCard } from '@/lib/ai/assistant-limits'
import { NO_PAGE } from '@/lib/assistant/page'
import type { ListingsParams } from '@/lib/listings/query'
import { normalizeQuery, stem } from '@/lib/search/assist'
import { buildBasicAnswer } from '@/lib/search/basicAnswer'
import { understandQuery } from '@/lib/search/understand'
import type { DiscoveryEntity } from '@/types'

import { CITIES, ctx as makeCtx, deps, entity } from './fixtures/cue'
import { EVAL_CATEGORIES, EVAL_LISTINGS, SEARCH_EVALS, type SearchEval } from './fixtures/search-evals'

// ─── A fake of queryListings ──────────────────────────────────────────────────

/** Postgres's English stop words: dropped from a query, never matched. */
const STOP = new Set(
  ('i me my myself we our ours you your he him his she her it its they them their what which who whom this that ' +
    'these those am is are was were be been being have has had having do does did doing a an the and but if or ' +
    'because as until while of at by for with about against between into through during before after above below ' +
    'to from up down in out on off over under again further then once here there when where why how all any both ' +
    'each few more most other some such no nor not only own same so than too very s t can will just don should now')
    .split(' ')
)

const toks = (text: string) => normalizeQuery(text).split(' ').filter(Boolean)

const ENTITIES: DiscoveryEntity[] = EVAL_LISTINGS.map((l, i) => {
  const category = EVAL_CATEGORIES.find((c) => c.slug === l.category)!
  return entity(i + 1, {
    name: l.name,
    slug: normalizeQuery(l.name).replace(/ /g, '-'),
    description: l.description,
    category: { name: category.name, slug: category.slug },
  } as Partial<DiscoveryEntity>)
})

const TEXT = new Map(ENTITIES.map((e) => [e.id, toks(`${e.name} ${e.description} ${e.category.name}`).map(stem)]))

/** One alternative: a quoted phrase in order, or bare words all present. */
function altMatches(words: string[], alt: string): boolean {
  const phrase = alt.startsWith('"')
  const want = toks(alt).filter((w) => !STOP.has(w)).map(stem)
  if (want.length === 0) return false
  if (!phrase) return want.every((w) => words.includes(w))
  return words.some((_, i) => want.every((w, k) => words[i + k] === w))
}

/** How many alternatives of a websearch query a listing matches. */
function hits(e: DiscoveryEntity, q: string): number {
  const words = TEXT.get(e.id)!
  return q.split(' OR ').filter((alt) => altMatches(words, alt)).length
}

/** queryListings as the eval needs it: category filter, AND search, the rescue. */
async function fakeQueryListings(p: ListingsParams): Promise<DiscoveryEntity[]> {
  const parent = EVAL_CATEGORIES.find((c) => c.slug === p.category)
  const pool = p.category
    ? ENTITIES.filter((e) => {
        const own = EVAL_CATEGORIES.find((c) => c.slug === e.category.slug)!
        return own.slug === p.category || own.parentId === parent?.id
      })
    : ENTITIES
  if (!p.q) return pool
  const search = (q: string) =>
    pool
      .map((e) => ({ e, n: hits(e, q) }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n)
      .map((x) => x.e)
  let found = search(p.q)
  if (found.length === 0) {
    const u = understandQuery(p.q)
    if (u.mode === 'search') found = search(u.tsQuery!)
    else if (u.mode === 'browse') found = pool
  }
  return found.slice(0, 24)
}

// ─── The rules ────────────────────────────────────────────────────────────────

const OWNERSHIP = /black[- ]owned|black business|owned by|ownership|identity/i

function checkRules(
  ev: SearchEval,
  answer: { text: string; cards: AssistantCard[]; actions: AssistantAction[] },
  opts: { checkFind: boolean; questionOk: boolean }
) {
  const where = `“${ev.query}”: ${answer.text}`
  expect(answer.text.trim(), where).not.toBe('')
  expect(answer.text, where).not.toMatch(OWNERSHIP)
  // Never a dead end: cards or a link, or (chat only) a question back.
  const answered = answer.cards.length > 0 || answer.actions.length > 0
  expect(answered || (opts.questionOk && answer.text.trim().endsWith('?')), where).toBe(true)
  const names = answer.cards.map((c) => c.name)
  if (opts.checkFind && ev.find) {
    expect(
      names.some((n) => ev.find!.includes(n)),
      `${where} — cards: ${names.join(', ') || 'none'}`
    ).toBe(true)
  }
  for (const n of ev.never ?? []) expect(names, where).not.toContain(n)
}

describe('search eval set: the quick answer', () => {
  it.each(SEARCH_EVALS.map((ev) => [ev.query, ev] as const))('%s', async (_q, ev) => {
    const answer = await buildBasicAnswer(ev.query, null, {
      search: fakeQueryListings,
      categories: EVAL_CATEGORIES,
    })
    checkRules(ev, answer, { checkFind: true, questionOk: false })
  })
})

describe('search eval set: Cue with the mock model', () => {
  it.each(SEARCH_EVALS.map((ev) => [ev.query, ev] as const))('%s', async (_q, ev) => {
    const ctx = makeCtx({
      categories: EVAL_CATEGORIES,
      deps: deps({ search: fakeQueryListings }),
    })
    const out = await runCue({
      call: createMockCueCall({ cities: CITIES }),
      model: 'mock',
      system: cueSystem(EVAL_CATEGORIES, CITIES),
      messages: buildCueMessages({ history: [], message: ev.query, page: NO_PAGE, nearShared: false, priorCards: [] }),
      ctx,
      names: ENTITIES.map((e) => ({ id: e.id, name: e.name })),
      emit: () => {},
      signal: new AbortController().signal,
    })
    checkRules(ev, out, { checkFind: !ev.skipMockCue, questionOk: true })
  })

  it('covers at least thirty questions, the founder’s first', () => {
    expect(SEARCH_EVALS.length).toBeGreaterThanOrEqual(30)
    expect(SEARCH_EVALS[0]!.query).toBe('How do I switch to Black Owned bathroom products')
  })
})
