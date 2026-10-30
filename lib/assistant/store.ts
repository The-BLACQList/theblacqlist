import { useSyncExternalStore } from 'react'
import { z } from 'zod'

import {
  ASSISTANT_HISTORY,
  ASSISTANT_MAX_NEEDS,
  type AssistantSearchPlan,
  type AssistantResponse,
} from '@/lib/ai/assistant-limits'

/**
 * The site assistant's chat, kept in this browser tab only (ticket 147).
 *
 * sessionStorage clears when the tab closes, and nothing here is sent to our
 * servers except the last few asks that go with the next question. Storage can
 * be missing or throw (private windows, blocked site data), so every read and
 * write is wrapped and the chat still works in memory.
 *
 * `open` is memory only: a reload should not pop the panel over the page.
 */

export const ASSISTANT_STORAGE_KEY = 'blq-assistant-v1'
export const ASSISTANT_MAX_TURNS = 20

export interface AssistantTurn {
  id: string
  ask: string
  reply: AssistantResponse
}

export interface AssistantState {
  turns: AssistantTurn[]
  open: boolean
}

// ─── What a stored turn may hold ─────────────────────────────────────────────
// The tab's own data, but it is rendered as links and images, so a turn is
// only kept when every link stays on this site and every image is https.

const internalHref = z.string().refine((h) => h.startsWith('/') && !h.startsWith('//'))
const imageSrc = z.string().refine((s) => s.startsWith('https://'))

const cardSchema = z.object({
  id: z.string(),
  name: z.string(),
  href: internalHref,
  categoryName: z.string(),
  cityLabel: z.string().nullable(),
  rating: z.number().nullable(),
  reviewCount: z.number(),
  imageSrc: imageSrc.nullable(),
})

// tel: links hold only digits and an optional leading +.
const externalHref = z
  .string()
  .refine((h) => h.startsWith('https://') || /^tel:\+?\d{3,15}$/.test(h))

const actionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('scroll'), ids: z.array(z.string().regex(/^[a-z][a-z0-9-]*$/)), label: z.string() }),
  z.object({ kind: z.literal('link'), href: internalHref, label: z.string() }),
  z.object({ kind: z.literal('external'), href: externalHref, label: z.string() }),
  z.object({ kind: z.literal('ask'), text: z.string(), label: z.string() }),
])

const replySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('answer'),
    heading: z.string(),
    opener: z.string().nullable(),
    notice: z.string().nullable(),
    summary: z.string(),
    needs: z.array(
      z.object({
        name: z.string(),
        status: z.enum(['found', 'close', 'nearest', 'none']),
        line: z.string(),
        total: z.number(),
        top: z.array(cardSchema),
        seeAllHref: internalHref.nullable(),
        plan: z.object({
          category: z.string().nullable(),
          keywords: z.array(z.string()),
          openNow: z.boolean(),
        }),
      })
    ),
    nameMatches: z.array(cardSchema),
    page: z.object({ label: z.string(), href: internalHref }).nullable(),
    searchHref: internalHref,
    actions: z.array(actionSchema),
    near: z.boolean(),
  }),
  z.object({ kind: z.literal('fallback'), href: internalHref, reason: z.enum(['limited', 'error']) }),
])

const turnSchema = z.object({ id: z.string(), ask: z.string(), reply: replySchema })

/** Keeps the turns that pass the shape check, newest last, at most 20. */
export function cleanTurns(raw: unknown): AssistantTurn[] {
  if (!Array.isArray(raw)) return []
  const turns: AssistantTurn[] = []
  for (const item of raw) {
    const parsed = turnSchema.safeParse(item)
    if (parsed.success) turns.push(parsed.data as AssistantTurn)
  }
  return turns.slice(-ASSISTANT_MAX_TURNS)
}

// ─── The store ───────────────────────────────────────────────────────────────

const EMPTY: AssistantState = { turns: [], open: false }

let state: AssistantState | null = null
const listeners = new Set<() => void>()

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

function load(): AssistantState {
  try {
    const raw = storage()?.getItem(ASSISTANT_STORAGE_KEY)
    return { turns: raw ? cleanTurns(JSON.parse(raw)) : [], open: false }
  } catch {
    return { turns: [], open: false }
  }
}

function current(): AssistantState {
  if (state === null) state = load()
  return state
}

function set(next: AssistantState, persist: boolean): void {
  state = next
  if (persist) {
    try {
      const store = storage()
      if (next.turns.length === 0) store?.removeItem(ASSISTANT_STORAGE_KEY)
      else store?.setItem(ASSISTANT_STORAGE_KEY, JSON.stringify(next.turns))
    } catch {
      // Full or blocked storage: the chat lives in memory for this page.
    }
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getAssistantState(): AssistantState {
  return current()
}

export function useAssistant(): AssistantState {
  return useSyncExternalStore(subscribe, current, () => EMPTY)
}

let nextId = 0
function turnId(): string {
  nextId += 1
  return `${Date.now().toString(36)}-${nextId}`
}

export function addTurn(ask: string, reply: AssistantResponse): void {
  const prev = current()
  const turns = [...prev.turns, { id: turnId(), ask, reply }].slice(-ASSISTANT_MAX_TURNS)
  set({ ...prev, turns }, true)
}

export function clearChat(): void {
  set({ ...current(), turns: [] }, true)
}

export function setAssistantOpen(open: boolean): void {
  const prev = current()
  if (prev.open === open) return
  set({ ...prev, open }, false)
}

// Where focus goes when the panel closes, when it was opened from somewhere
// other than the Ask button (the home answer's Keep chatting).
let returnFocus: HTMLElement | null = null

/** Opens the panel and sends focus back to `from` when it closes. */
export function openAssistantFrom(from: HTMLElement | null): void {
  returnFocus = from
  setAssistantOpen(true)
}

/** The element to focus on close, once; null means the Ask button. */
export function takeReturnFocus(): HTMLElement | null {
  const el = returnFocus
  returnFocus = null
  return el
}

/** The visitor's last few asks, sent with the next one so follow-ups make sense. */
export function historyFor(turns: readonly AssistantTurn[]): string[] {
  return turns.map((t) => t.ask).slice(-ASSISTANT_HISTORY)
}

/** The last answer, or null when the chat is empty or ended on a fallback. */
function lastAnswer(turns: readonly AssistantTurn[]) {
  const reply = turns.at(-1)?.reply
  return reply && reply.kind === 'answer' ? reply : null
}

/**
 * The last answer's search plans, sent as `previous` so a follow-up like
 * "in atlanta" re-runs those needs only. Needs that had no plan are skipped.
 */
export function previousFor(turns: readonly AssistantTurn[]): { name: string; plan: AssistantSearchPlan }[] {
  const last = lastAnswer(turns)
  if (!last) return []
  return last.needs
    .filter((n) => n.plan.category !== null || n.plan.keywords.length > 0)
    .slice(0, ASSISTANT_MAX_NEEDS)
    .map((n) => ({ name: n.name, plan: n.plan }))
}

/** True when the last answer used the visitor's location. Never a position. */
export function lastWasNear(turns: readonly AssistantTurn[]): boolean {
  return lastAnswer(turns)?.near === true
}

/** Tests only: forget the in-memory copy so the next read loads from storage. */
export function resetAssistantStoreForTests(): void {
  state = null
  listeners.clear()
}

// ─── The home bar ────────────────────────────────────────────────────────────
// While the home page's Ask Cue bar is on screen, the corner button steps
// aside so there is one Ask Cue in view. Memory only.

let homeBarInView = false
const barListeners = new Set<() => void>()

export function setHomeBarInView(inView: boolean): void {
  if (homeBarInView === inView) return
  homeBarInView = inView
  for (const listener of barListeners) listener()
}

function subscribeBar(listener: () => void): () => void {
  barListeners.add(listener)
  return () => barListeners.delete(listener)
}

export function useHomeBarInView(): boolean {
  return useSyncExternalStore(
    subscribeBar,
    () => homeBarInView,
    () => false
  )
}
