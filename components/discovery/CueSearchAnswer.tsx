'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import { ArrowDown, MessageCircle, RotateCcw } from 'lucide-react'
import { z } from 'zod'

import type { CueReply } from '@/lib/ai/assistant-limits'
import { CUE_MESSAGE_MAX } from '@/lib/ai/cue/ask'
import { fallbackHref } from '@/lib/ai/guide-limits'
import { streamCue } from '@/lib/assistant/ask'
import type { NearPoint } from '@/lib/assistant/near'
import { actionSchema, addTurn, cardSchema, openAssistantFrom } from '@/lib/assistant/store'
import {
  ASSISTANT_LINK,
  AssistantReply,
  CUE_LOOKING,
  CueStreaming,
  replyStatus,
} from '@/components/assistant/AssistantAnswer'
import { GoldBrandMark } from '@/components/ui/gold-brand-mark'

type Reply = Extract<CueReply, { kind: 'reply' }>

type Phase =
  | { kind: 'streaming'; status: string; text: string }
  | { kind: 'reply'; reply: Reply }
  | { kind: 'failed'; line: string }

/** Neither Cue nor the quick answer came back: the network, or every limit at once. */
export const ANSWER_FAILED_LINE = "We couldn't load an answer just now. Your search results are below."
/** Stopped before any words arrived. */
export const ANSWER_STOPPED_LINE = 'Stopped.'

// ─── This tab's recent answers ───────────────────────────────────────────────
// Back and Forward remount the page. Keeping the last few finished answers in
// sessionStorage means going back to a search shows its answer again without
// a second model call or a second tick on the visitor's daily Cue allowance.
// Cleared when the tab closes; never sent anywhere.

// v2: replies carry `mode` (ticket 255). Only Cue's answers are kept; the
// quick answer is cheap to fetch again and may have stood in for a limit
// that has since passed.
const CACHE_KEY = 'blq-search-cue-v2'
const CACHE_MAX = 10

const cachedSchema = z.array(
  z.object({
    key: z.string(),
    reply: z.object({
      kind: z.literal('reply'),
      text: z.string(),
      cards: z.array(cardSchema),
      actions: z.array(actionSchema),
      near: z.boolean(),
      mode: z.enum(['ai', 'basic']).optional(),
    }),
  })
)
type Cached = z.infer<typeof cachedSchema>

function cacheKey(query: string, near: NearPoint | null): string {
  return near ? `${near.lat},${near.lng}|${query}` : `|${query}`
}

function readCache(): Cached {
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY)
    if (!raw) return []
    const parsed = cachedSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}

function cachedReply(key: string): Reply | null {
  return readCache().find((entry) => entry.key === key)?.reply ?? null
}

function keepReply(key: string, reply: Reply): void {
  try {
    const rest = readCache().filter((entry) => entry.key !== key)
    const next = [...rest, { key, reply: { ...reply, stopped: undefined } }].slice(-CACHE_MAX)
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(next))
  } catch {
    // Storage full or blocked: the answer still shows, it just isn't kept.
  }
}

/**
 * Cue's answer above the /search results. The keyword grid renders on the
 * server as before; this asks Cue the same words from the browser and streams
 * a short answer with its picks. The search page decides when to mount it
 * (lib/search/assist.ts `wantsCue`), so a one-word search never spends.
 *
 * It starts fresh, without this tab's chat, so earlier chat never colours a
 * search, and it never asks the browser for a position: `near` is the URL's
 * own location filter or nothing. "Keep chatting with Cue" copies the turn
 * into the chat and opens the corner panel. A follow-up chip runs a new search.
 *
 * It always answers (ticket 255). When Cue can't (flag off, kill switch,
 * limits, spend ceiling, an empty run), the route sends the quick answer from
 * our listings instead, labelled as such. Only when that fails too (the
 * network, or its own limit) does the strip say so, with Try Again and a jump
 * to the results below. It never disappears.
 */
export function CueSearchAnswer({ query, near }: { query: string; near: NearPoint | null }) {
  const router = useRouter()
  const words = query.trim().slice(0, CUE_MESSAGE_MAX)
  // By value: a fresh server render hands over a new object for the same point.
  const lat = near?.lat
  const lng = near?.lng
  const key = cacheKey(words, near)
  const [phase, setPhase] = useState<Phase>({ kind: 'streaming', status: CUE_LOOKING, text: '' })
  const [status, setStatus] = useState(CUE_LOOKING)
  const [kept, setKept] = useState(false)
  // Try Again bumps this, which runs the effect once more.
  const [attempt, setAttempt] = useState(0)
  const stopRef = useRef<AbortController | null>(null)
  const userStopped = useRef(false)

  // The search page keys this component on the words and place, so each new
  // search mounts it fresh in the streaming state; the effect never resets it.
  useEffect(() => {
    const stop = new AbortController()
    stopRef.current = stop
    userStopped.current = false

    const ask = async (): Promise<CueReply | null> =>
      cachedReply(key) ??
      streamCue(words, {
        surface: 'search',
        turns: [],
        near: lat !== undefined && lng !== undefined ? { lat, lng } : null,
        locate: false,
        signal: stop.signal,
        onProgress: (progress) => {
          if (stop.signal.aborted) return
          setPhase((now) =>
            now.kind === 'streaming'
              ? { ...now, [progress.type === 'status' ? 'status' : 'text']: progress.text }
              : now
          )
        },
      })

    void ask().then((reply) => {
      // Unmounted or the query changed: this answer belongs to nobody.
      if (stop.signal.aborted && !userStopped.current) return
      stopRef.current = null
      if (!reply || reply.kind === 'fallback') {
        const line = reply ? ANSWER_FAILED_LINE : ANSWER_STOPPED_LINE
        setPhase({ kind: 'failed', line })
        setStatus(line)
        return
      }
      if (!reply.stopped && reply.mode !== 'basic') keepReply(key, reply)
      setPhase({ kind: 'reply', reply })
      setStatus(replyStatus(reply))
    })

    // Leaving the page or changing the search ends Cue's request, so it stops spending.
    return () => stop.abort()
  }, [key, words, lat, lng, attempt])

  function onStop() {
    userStopped.current = true
    stopRef.current?.abort()
  }

  function onRetry() {
    setPhase({ kind: 'streaming', status: CUE_LOOKING, text: '' })
    setStatus(CUE_LOOKING)
    setAttempt((n) => n + 1)
  }

  const basic = phase.kind === 'reply' && phase.reply.mode === 'basic'

  return (
    <>
      {/* Always mounted, so screen readers hear each short status once. */}
      <p role="status" className="sr-only">
        {status}
      </p>

      <section
        aria-label={basic ? 'Quick answer' : "Cue's answer"}
        data-testid="search-answer"
        data-mode={phase.kind === 'reply' ? (phase.reply.mode ?? 'ai') : phase.kind}
        className="mb-8 rounded-2xl border border-gold/30 bg-brand-black p-3 sm:p-4 text-off-white"
      >
        <p className="flex items-center gap-2 mb-3 font-subhead text-xs font-semibold uppercase tracking-[0.08em] text-gold">
          <GoldBrandMark className="size-4" />
          {basic ? 'Quick Answer' : 'Cue'}
          <span className="font-normal normal-case tracking-normal text-off-white/70">
            &middot; {basic ? 'From Our Listings' : 'AI Answer from Our Listings'}
          </span>
        </p>

        {phase.kind === 'streaming' ? (
          <div className="min-h-24">
            <CueStreaming status={phase.status} text={phase.text} layout="page" onStop={onStop} />
          </div>
        ) : phase.kind === 'failed' ? (
          <div className="border-l-2 border-gold/60 pl-3">
            <p className="font-body text-[15px] leading-relaxed text-off-white">{phase.line}</p>
            <div className="flex flex-wrap items-center gap-x-4">
              <button type="button" onClick={onRetry} className={ASSISTANT_LINK}>
                <RotateCcw className="size-4" aria-hidden="true" />
                Try Again
              </button>
              <a href="#search-results" className={ASSISTANT_LINK}>
                See Results Below
                <ArrowDown className="size-4" aria-hidden="true" />
              </a>
            </div>
          </div>
        ) : (
          <>
            <AssistantReply
              ask={words}
              reply={phase.reply}
              layout="page"
              handlers={{ onAsk: (next) => router.push(fallbackHref(next) as Route) }}
            />
            {/* The quick answer stood in for Cue, so the chat has nothing to add yet. */}
            {!basic && (
              <button
                type="button"
                onClick={(event) => {
                  // Once per answer, so a second tap only reopens the panel.
                  if (!kept) addTurn(words, phase.reply)
                  setKept(true)
                  openAssistantFrom(event.currentTarget)
                }}
                className={ASSISTANT_LINK}
              >
                <MessageCircle className="size-4" aria-hidden="true" />
                Keep Chatting with Cue
              </button>
            )}
          </>
        )}
      </section>
    </>
  )
}
