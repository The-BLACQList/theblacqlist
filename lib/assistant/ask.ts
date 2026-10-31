import { z } from 'zod'

import { ASSISTANT_PAGE_MAX, type AssistantAction, type AssistantCard, type CueReply } from '@/lib/ai/assistant-limits'
import type { CueAskInput } from '@/lib/ai/cue/ask'
import { createCueParser, type CueEvent } from '@/lib/ai/cue/stream'
import { fallbackHref } from '@/lib/ai/guide-limits'
import { getNearPoint, wantsNearMe, type NearPoint } from './near'
import {
  actionSchema,
  cardSchema,
  cardsFor,
  fallbackSchema,
  getAssistantState,
  historyFor,
  lastWasNear,
  type AssistantTurn,
} from './store'

/** The page the visitor is on, as a path with its query. Only this is sent. */
function currentPage(): string {
  return (window.location.pathname + window.location.search).slice(0, ASSISTANT_PAGE_MAX)
}

/** What the panel shows while Cue works. */
export type CueProgress =
  | { type: 'status'; text: string }
  | { type: 'text'; text: string }

interface StreamCueOptions {
  /** The turns to follow on from. Defaults to this tab's chat. */
  turns?: readonly AssistantTurn[]
  /** A position the caller already has, such as the Near me chip. */
  near?: NearPoint | null
  /** Stop: ends the request and keeps what Cue had written so far. */
  signal?: AbortSignal
  /** Called with the status line and the reply so far, as they change. */
  onProgress?: (progress: CueProgress) => void
}

const cardsSchema = z.array(cardSchema)
const actionsSchema = z.array(actionSchema)

/**
 * Sends the visitor's message to /api/cue and reads Cue's reply as it streams
 * (ticket 169). Along with the words go the conversation so far, the cards
 * Cue last showed, the page they're on, and their location when they asked
 * for Near me now or the last ask used it.
 *
 * Always resolves. Any failure becomes a fallback to plain search. After Stop,
 * the words written so far are kept as a stopped reply, or null when Cue had
 * not written anything yet.
 */
export async function streamCue(words: string, options: StreamCueOptions = {}): Promise<CueReply | null> {
  const turns = options.turns ?? getAssistantState().turns
  const near = options.near ?? (wantsNearMe(words) || lastWasNear(turns) ? await getNearPoint() : null)
  const failed: CueReply = { kind: 'fallback', href: fallbackHref(words), reason: 'error' }

  const got: {
    text: string
    finalText: string | null
    cards: AssistantCard[]
    actions: AssistantAction[]
    fallback: CueReply | null
  } = { text: '', finalText: null, cards: [], actions: [], fallback: null }

  const handle = (event: CueEvent): void => {
    switch (event.type) {
      case 'status':
        options.onProgress?.({ type: 'status', text: event.text })
        break
      case 'text':
        got.text += event.text
        options.onProgress?.({ type: 'text', text: got.text })
        break
      case 'cards': {
        const parsed = cardsSchema.safeParse(event.cards)
        if (parsed.success) got.cards = parsed.data
        break
      }
      case 'actions': {
        const parsed = actionsSchema.safeParse(event.actions)
        if (parsed.success) got.actions = parsed.data
        break
      }
      case 'done':
        got.finalText = typeof event.text === 'string' ? event.text : got.text
        break
      case 'fallback': {
        const parsed = fallbackSchema.safeParse({ kind: 'fallback', href: event.href, reason: event.reason })
        got.fallback = parsed.success ? parsed.data : failed
        break
      }
    }
  }

  const body: CueAskInput = {
    message: words,
    history: historyFor(turns),
    cards: cardsFor(turns),
    page: currentPage(),
    near,
  }

  try {
    const res = await fetch('/api/cue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: options.signal,
    })
    if (!res.ok || !res.body) return failed

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    const parser = createCueParser()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      for (const event of parser.push(decoder.decode(value, { stream: true }))) handle(event)
    }
    for (const event of parser.push(decoder.decode())) handle(event)
    for (const event of parser.end()) handle(event)
  } catch {
    if (options.signal?.aborted) {
      return got.text.trim()
        ? { kind: 'reply', text: got.text, cards: [], actions: [], near: near !== null, stopped: true }
        : null
    }
    return failed
  }

  if (got.fallback) return got.fallback
  if (got.finalText === null) return failed
  return { kind: 'reply', text: got.finalText, cards: got.cards, actions: got.actions, near: near !== null }
}
