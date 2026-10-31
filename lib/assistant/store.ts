import { useSyncExternalStore } from 'react'
import { z } from 'zod'

import type { CueReply } from '@/lib/ai/assistant-limits'
import { CUE_HISTORY_TURNS, CUE_PRIOR_CARDS_MAX, CUE_TURN_MAX_CHARS } from '@/lib/ai/cue/ask'

/**
 * Cue's chat, kept in this browser tab only (tickets 147 and 169).
 *
 * sessionStorage clears when the tab closes. Nothing here reaches our servers
 * except what goes with the next message: the last few turns of text and the
 * names of the businesses Cue last showed. Storage can be missing or throw
 * (private windows, blocked site data), so every read and write is wrapped
 * and the chat still works in memory.
 *
 * `open` is memory only: a reload should not pop the panel over the page.
 * The v1 chat (fixed-wording answers) is a different shape and is ignored.
 */

export const ASSISTANT_STORAGE_KEY = 'blq-assistant-v2'
export const ASSISTANT_MAX_TURNS = 20

export interface AssistantTurn {
  id: string
  ask: string
  reply: CueReply
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

export const cardSchema = z.object({
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

export const actionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('scroll'), ids: z.array(z.string().regex(/^[a-z][a-z0-9-]*$/)), label: z.string() }),
  z.object({ kind: z.literal('link'), href: internalHref, label: z.string() }),
  z.object({ kind: z.literal('external'), href: externalHref, label: z.string() }),
  z.object({ kind: z.literal('ask'), text: z.string(), label: z.string() }),
])

export const fallbackSchema = z.object({
  kind: z.literal('fallback'),
  href: internalHref,
  reason: z.enum(['limited', 'error']),
})

const replySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('reply'),
    text: z.string(),
    cards: z.array(cardSchema),
    actions: z.array(actionSchema),
    near: z.boolean(),
    stopped: z.boolean().optional(),
  }),
  fallbackSchema,
])

const turnSchema = z.object({ id: z.string(), ask: z.string(), reply: replySchema })

/** Keeps the turns that pass the shape check, newest last, at most 20. */
export function cleanTurns(raw: unknown): AssistantTurn[] {
  if (!Array.isArray(raw)) return []
  const turns: AssistantTurn[] = []
  for (const item of raw) {
    const parsed = turnSchema.safeParse(item)
    if (parsed.success) turns.push(parsed.data)
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
/** A new turn id. The panel takes one up front, so the streaming reply and the kept one share it. */
export function turnId(): string {
  nextId += 1
  return `${Date.now().toString(36)}-${nextId}`
}

export function addTurn(ask: string, reply: CueReply, id: string = turnId()): void {
  const prev = current()
  const turns = [...prev.turns, { id, ask, reply }].slice(-ASSISTANT_MAX_TURNS)
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

/**
 * The conversation so far, as the route takes it: the visitor's words and
 * Cue's replies, oldest first. Fallback turns are skipped so the pairs stay
 * whole; the server keeps the last six turns within its own limit.
 */
export function historyFor(turns: readonly AssistantTurn[]): { role: 'user' | 'assistant'; text: string }[] {
  const out: { role: 'user' | 'assistant'; text: string }[] = []
  for (const turn of turns) {
    if (turn.reply.kind !== 'reply' || !turn.reply.text.trim()) continue
    out.push({ role: 'user', text: turn.ask.slice(0, CUE_TURN_MAX_CHARS) })
    out.push({ role: 'assistant', text: turn.reply.text.slice(0, CUE_TURN_MAX_CHARS) })
  }
  return out.slice(-CUE_HISTORY_TURNS * 2)
}

/** The last reply, or null when the chat is empty or ended on a fallback. */
function lastReply(turns: readonly AssistantTurn[]) {
  const reply = turns.at(-1)?.reply
  return reply && reply.kind === 'reply' ? reply : null
}

/**
 * The businesses Cue showed last, by id and name, so "is the first one open
 * Sunday?" knows which one the visitor means.
 */
export function cardsFor(turns: readonly AssistantTurn[]): { id: string; name: string }[] {
  return (lastReply(turns)?.cards ?? []).slice(0, CUE_PRIOR_CARDS_MAX).map((c) => ({ id: c.id, name: c.name }))
}

/** True when the last ask sent the visitor's location. Never a position. */
export function lastWasNear(turns: readonly AssistantTurn[]): boolean {
  return lastReply(turns)?.near === true
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
