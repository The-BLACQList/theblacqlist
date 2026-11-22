// The answer strip on /search as a short conversation (ticket 258).
//
// The strip used to answer once; a follow-up chip ran a whole new search. Now
// the visitor can ask on from the answer, ChatGPT-style, with the grid still
// below: the first turn is the search itself, each follow-up goes to Cue with
// the turns so far, and after SEARCH_THREAD_MAX_TURNS the strip hands the
// thread to the full chat (Continue in Chat).
//
// The rules live here so tests can run them without a browser:
//
//   * how many turns a strip holds, and when it can take another
//   * which turns the chat still needs when the visitor continues there
//   * this tab's recent threads, so Back shows a search's thread again
//     without a second model call or a second tick on the Cue allowance
//
// Nothing here is sent anywhere. The cache is sessionStorage: it clears when
// the tab closes, and every read and write is wrapped, since storage can be
// missing or throw (private windows, blocked site data).

import { cleanTurns, type AssistantTurn } from '@/lib/assistant/store'
import type { NearPoint } from '@/lib/assistant/near'

/** The search plus five follow-ups; past this the thread moves to the chat. */
export const SEARCH_THREAD_MAX_TURNS = 6

/** v3: whole threads (ticket 258). v2 held one reply per search and is ignored. */
export const THREAD_CACHE_KEY = 'blq-search-cue-v3'
/** Searches remembered per tab. */
const THREAD_CACHE_MAX = 10

/** True while the strip can take another question. */
export function canFollowUp(turns: readonly AssistantTurn[]): boolean {
  return turns.length < SEARCH_THREAD_MAX_TURNS
}

/** Did Cue write any of it? A thread of quick answers alone has nothing for the chat yet. */
export function hasCueTurn(turns: readonly AssistantTurn[]): boolean {
  return turns.some((t) => t.reply.kind === 'reply' && t.reply.mode !== 'basic')
}

/**
 * The turns the chat doesn't have yet. `copied` is how many this strip has
 * already handed over, so Continue in Chat twice never doubles a turn.
 */
export function turnsForChat(turns: readonly AssistantTurn[], copied: number): AssistantTurn[] {
  return turns.slice(Math.min(copied, turns.length))
}

/**
 * Worth keeping for Back: anything with a follow-up, or a first answer Cue
 * wrote and finished. A lone quick answer is cheap to fetch again and may have
 * stood in for a limit that has since passed; a stopped one is half an answer.
 */
export function shouldKeepThread(turns: readonly AssistantTurn[]): boolean {
  if (turns.length > 1) return true
  const first = turns[0]?.reply
  return first?.kind === 'reply' && first.mode !== 'basic' && !first.stopped
}

/** One search: its words and the place it was for. */
export function threadKey(query: string, near: NearPoint | null): string {
  return near ? `${near.lat},${near.lng}|${query}` : `|${query}`
}

interface CachedThread {
  key: string
  turns: AssistantTurn[]
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

function readAll(): CachedThread[] {
  try {
    const raw = storage()?.getItem(THREAD_CACHE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const out: CachedThread[] = []
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue
      const { key, turns } = item as { key?: unknown; turns?: unknown }
      if (typeof key !== 'string') continue
      // The same check the chat uses: only on-site links and https images.
      const clean = cleanTurns(turns).slice(0, SEARCH_THREAD_MAX_TURNS)
      if (clean.length > 0) out.push({ key, turns: clean })
    }
    return out
  } catch {
    return []
  }
}

/** This tab's thread for a search, or null. */
export function readThread(key: string): AssistantTurn[] | null {
  return readAll().find((t) => t.key === key)?.turns ?? null
}

/** Keeps the thread for Back, newest search last; drops it when not worth keeping. */
export function keepThread(key: string, turns: readonly AssistantTurn[]): void {
  try {
    const store = storage()
    if (!store) return
    const rest = readAll().filter((t) => t.key !== key)
    const next = shouldKeepThread(turns)
      ? [...rest, { key, turns: [...turns] }].slice(-THREAD_CACHE_MAX)
      : rest
    store.setItem(THREAD_CACHE_KEY, JSON.stringify(next))
  } catch {
    // Storage full or blocked: the thread still shows, it just isn't kept.
  }
}

