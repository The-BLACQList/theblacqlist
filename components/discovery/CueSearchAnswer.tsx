'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import { MessageCircle } from 'lucide-react'
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
  | { kind: 'gone' }

const UNAVAILABLE_STATUS = "Cue isn't available right now. Search results are below."

// ─── This tab's recent answers ───────────────────────────────────────────────
// Back and Forward remount the page. Keeping the last few finished answers in
// sessionStorage means going back to a search shows its answer again without
// a second model call or a second tick on the visitor's daily Cue allowance.
// Cleared when the tab closes; never sent anywhere.

const CACHE_KEY = 'blq-search-cue-v1'
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
 * Any failure (rate limit, kill switch, spend ceiling, network) removes the
 * strip quietly. The visitor is already on plain search, so there is nowhere
 * to fall back to, and SearchAssist below still offers next steps.
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
      if (!reply) {
        setPhase({ kind: 'gone' })
        setStatus('Stopped.')
        return
      }
      if (reply.kind === 'fallback') {
        setPhase({ kind: 'gone' })
        setStatus(UNAVAILABLE_STATUS)
        return
      }
      if (!reply.stopped) keepReply(key, reply)
      setPhase({ kind: 'reply', reply })
      setStatus(replyStatus(reply))
    })

    // Leaving the page or changing the search ends Cue's request, so it stops spending.
    return () => stop.abort()
  }, [key, words, lat, lng])

  function onStop() {
    userStopped.current = true
    stopRef.current?.abort()
  }

  return (
    <>
      {/* Always mounted, so screen readers hear each short status once. */}
      <p role="status" className="sr-only">
        {status}
      </p>

      {phase.kind !== 'gone' && (
        <section
          aria-label="Cue's answer"
          className="mb-8 rounded-2xl border border-gold/30 bg-brand-black p-3 sm:p-4 text-off-white"
        >
          <p className="flex items-center gap-2 mb-3 font-subhead text-xs font-semibold uppercase tracking-[0.08em] text-gold">
            <GoldBrandMark className="size-4" />
            Cue
            <span className="font-normal normal-case tracking-normal text-off-white/70">
              &middot; AI answer from our listings
            </span>
          </p>

          {phase.kind === 'streaming' ? (
            <div className="min-h-24">
              <CueStreaming status={phase.status} text={phase.text} layout="page" onStop={onStop} />
            </div>
          ) : (
            <>
              <AssistantReply
                ask={words}
                reply={phase.reply}
                layout="page"
                handlers={{ onAsk: (next) => router.push(fallbackHref(next) as Route) }}
              />
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
                Keep chatting with Cue
              </button>
            </>
          )}
        </section>
      )}
    </>
  )
}
