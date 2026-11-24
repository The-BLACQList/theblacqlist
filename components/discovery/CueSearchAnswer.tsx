'use client'

import { useEffect, useRef, useState, type FormEvent, type MouseEvent, type RefObject } from 'react'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, MessageCircle, RotateCcw } from 'lucide-react'

import type { CueReply } from '@/lib/ai/assistant-limits'
import { CUE_MESSAGE_MAX } from '@/lib/ai/cue/ask'
import { fallbackHref } from '@/lib/ai/guide-limits'
import { streamCue } from '@/lib/assistant/ask'
import type { NearPoint } from '@/lib/assistant/near'
import { addTurn, openAssistantFrom, setHomeBarInView, turnId, type AssistantTurn } from '@/lib/assistant/store'
import {
  canFollowUp,
  hasCueTurn,
  keepThread,
  readThread,
  threadKey,
  turnsForChat,
} from '@/lib/search/answerThread'
import {
  ASSISTANT_LINK,
  AskBubble,
  AssistantReply,
  CUE_LOOKING,
  CueStreaming,
  replyStatus,
  type ReplyHandlers,
} from '@/components/assistant/AssistantAnswer'
import { plainCueText } from '@/components/assistant/CueText'
import { GoldBrandMark } from '@/components/ui/gold-brand-mark'
import { cn } from '@/lib/utils'

/** Neither Cue nor the quick answer came back: the network, or every limit at once. */
export const ANSWER_FAILED_LINE = "We couldn't load an answer just now. Your search results are below."
/** Stopped before any words arrived. */
export const ANSWER_STOPPED_LINE = 'Stopped.'
/** Said in place of the follow-up box once the thread is full. */
export const THREAD_FULL_LINE = 'To keep going, continue this conversation in the chat.'
/** The follow-up box's label and placeholder. */
export const FOLLOW_UP_LABEL = 'Ask a Follow-Up'
/** Characters of an earlier answer shown while it is folded. */
const PREVIEW_CHARS = 140

/** The ask Cue is working on, with its status line and the words so far. */
export interface PendingTurn {
  id: string
  ask: string
  status: string
  text: string
}

/**
 * Cue's answer above the /search results, and the conversation that follows
 * from it (tickets 255 and 258). The keyword grid renders on the server as
 * before; this asks Cue the same words from the browser and streams a short
 * answer with its picks. The search page decides when to mount it
 * (lib/search/assist.ts `wantsCue`), so a one-word search never spends.
 *
 * The first ask never asks the browser for a position: `near` is the URL's
 * own location filter or nothing. Follow-ups are typed by hand, so "near me"
 * there may ask, as it does in the chat.
 *
 * Follow-ups stay here, under the answer, with the grid still below. Cue gets
 * the thread's turns with each one, never the corner chat's, so earlier chat
 * never colours a search. Suggestion chips ask in the thread too. Earlier
 * answers fold to a line. After six turns the box gives way to Continue in
 * Chat, which copies the thread into the chat and opens the panel; that
 * button is there from the first Cue answer on.
 *
 * It always answers (ticket 255). When Cue can't (flag off, kill switch,
 * limits, spend ceiling, an empty run), the route sends the quick answer from
 * our listings instead, labelled as such, for the first ask and follow-ups
 * alike. Only when the first ask fails outright (the network, or every limit)
 * does the strip say so, with Try Again and a jump to the results below. It
 * never disappears.
 */
export function CueSearchAnswer({ query, near }: { query: string; near: NearPoint | null }) {
  const router = useRouter()
  const words = query.trim().slice(0, CUE_MESSAGE_MAX)
  // By value: a fresh server render hands over a new object for the same point.
  const lat = near?.lat
  const lng = near?.lng
  const key = threadKey(words, near)
  const [turns, setTurns] = useState<AssistantTurn[]>([])
  const [pending, setPending] = useState<PendingTurn | null>({ id: 'search', ask: words, status: CUE_LOOKING, text: '' })
  const [failed, setFailed] = useState<string | null>(null)
  const [status, setStatus] = useState(CUE_LOOKING)
  const [draft, setDraft] = useState('')
  // Earlier answers the visitor unfolded. A new follow-up folds them again.
  const [unfolded, setUnfolded] = useState<ReadonlySet<string>>(new Set())
  // How many turns Continue in Chat has handed over, so a second tap adds none twice.
  const [copied, setCopied] = useState(0)
  // Try Again bumps this, which runs the first ask once more.
  const [attempt, setAttempt] = useState(0)
  const stopRef = useRef<AbortController | null>(null)
  const userStopped = useRef(false)
  const gone = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const turnRefs = useRef(new Map<string, HTMLLIElement>())
  // The follow-up whose answer just landed: focus goes there once it renders.
  const focusTurn = useRef<string | null>(null)
  // The follow-up box, while it is drawn.
  const [form, setForm] = useState<HTMLFormElement | null>(null)

  // One Ask Cue in view: the corner button steps aside while the follow-up
  // box shows, so on a phone it never sits over the send button.
  useEffect(() => {
    if (!form || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setHomeBarInView(entry?.isIntersecting ?? false))
    observer.observe(form)
    return () => {
      observer.disconnect()
      setHomeBarInView(false)
    }
  }, [form])

  // The search page keys this component on the words and place, so each new
  // search mounts it fresh in the streaming state; the effect never resets it.
  useEffect(() => {
    gone.current = false
    const stop = new AbortController()
    stopRef.current = stop
    userStopped.current = false

    const ask = async (): Promise<{ kept: AssistantTurn[] } | { reply: CueReply | null }> => {
      const kept = readThread(key)
      if (kept) return { kept }
      return {
        reply: await streamCue(words, {
          surface: 'search',
          turns: [],
          near: lat !== undefined && lng !== undefined ? { lat, lng } : null,
          locate: false,
          signal: stop.signal,
          onProgress: (progress) => {
            if (stop.signal.aborted) return
            setPending((now) =>
              now ? { ...now, [progress.type === 'status' ? 'status' : 'text']: progress.text } : now
            )
          },
        }),
      }
    }

    void ask().then((result) => {
      // Unmounted or the query changed: this answer belongs to nobody.
      if (stop.signal.aborted && !userStopped.current) return
      stopRef.current = null
      setPending(null)
      if ('kept' in result) {
        setTurns(result.kept)
        setStatus(replyStatus(result.kept[result.kept.length - 1]!.reply))
        return
      }
      const reply = result.reply
      if (!reply || reply.kind === 'fallback') {
        const line = reply ? ANSWER_FAILED_LINE : ANSWER_STOPPED_LINE
        setFailed(line)
        setStatus(line)
        return
      }
      const first: AssistantTurn[] = [{ id: turnId(), ask: words, reply }]
      keepThread(key, first)
      setTurns(first)
      setStatus(replyStatus(reply))
    })

    // Leaving the page or changing the search ends Cue's request, so it stops spending.
    return () => {
      gone.current = true
      stop.abort()
    }
  }, [key, words, lat, lng, attempt])

  // A follow-up's answer: bring it into view and put focus on it, so a
  // keyboard or screen reader lands on the new reply, not on a box above it.
  useEffect(() => {
    const id = focusTurn.current
    if (!id) return
    focusTurn.current = null
    const el = turnRefs.current.get(id)
    if (!el) return
    el.scrollIntoView({ block: 'nearest' })
    el.focus({ preventScroll: true })
  }, [turns])

  /** Says `line`, even when it is what was said last. */
  function say(line: string) {
    setStatus((now) => (now === line ? `${line} ` : line))
  }

  async function send(raw: string) {
    const next = raw.trim().slice(0, CUE_MESSAGE_MAX)
    if (!next) {
      say('Type a question first, then ask.')
      inputRef.current?.focus()
      return
    }
    if (pending) {
      say('Cue is still answering. Stop it first, or wait.')
      return
    }
    if (!canFollowUp(turns)) return
    const id = turnId()
    const before = turns
    setDraft('')
    setUnfolded(new Set())
    setPending({ id, ask: next, status: CUE_LOOKING, text: '' })
    setStatus(CUE_LOOKING)
    const stop = new AbortController()
    stopRef.current = stop
    userStopped.current = false
    const reply = await streamCue(next, {
      surface: 'search',
      turns: before,
      near: lat !== undefined && lng !== undefined ? { lat, lng } : null,
      signal: stop.signal,
      onProgress: (progress) =>
        setPending((now) =>
          now?.id === id ? { ...now, [progress.type === 'status' ? 'status' : 'text']: progress.text } : now
        ),
    })
    if (gone.current) return
    stopRef.current = null
    setPending(null)
    // Stopped before Cue wrote anything: give them their words back.
    if (!reply) {
      setDraft(next)
      setStatus(ANSWER_STOPPED_LINE)
      inputRef.current?.focus()
      return
    }
    const after = [...before, { id, ask: next, reply }]
    keepThread(key, after)
    focusTurn.current = id
    setTurns(after)
    setStatus(replyStatus(reply))
  }

  function onStop() {
    userStopped.current = true
    stopRef.current?.abort()
  }

  function onRetry() {
    setFailed(null)
    setPending({ id: 'search', ask: words, status: CUE_LOOKING, text: '' })
    setStatus(CUE_LOOKING)
    setAttempt((n) => n + 1)
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void send(draft)
  }

  function onContinue(event: MouseEvent<HTMLButtonElement>) {
    for (const turn of turnsForChat(turns, copied)) addTurn(turn.ask, turn.reply)
    setCopied(turns.length)
    openAssistantFrom(event.currentTarget)
  }

  const handlers: ReplyHandlers = {
    // A chip asks in the thread; once it's full, it runs a search as before.
    onAsk: (text) => {
      if (canFollowUp(turns)) void send(text)
      else router.push(fallbackHref(text) as Route)
    },
  }

  return (
    <>
      {/* Always mounted, so screen readers hear each short status once. */}
      <p role="status" className="sr-only">
        {status}
      </p>

      <AnswerThreadView
        turns={turns}
        pending={pending}
        failed={failed}
        unfolded={unfolded}
        draft={draft}
        handlers={handlers}
        inputRef={inputRef}
        formRef={setForm}
        turnRefs={turnRefs}
        onDraft={setDraft}
        onSubmit={onSubmit}
        onStop={onStop}
        onRetry={onRetry}
        onContinue={onContinue}
        onFold={(id, open) =>
          setUnfolded((now) => {
            const next = new Set(now)
            if (open) next.add(id)
            else next.delete(id)
            return next
          })
        }
      />
    </>
  )
}

/** Whether a reply is the quick answer, not Cue's. */
function isBasic(reply: CueReply): boolean {
  return reply.kind === 'reply' && reply.mode === 'basic'
}

/** The first line or so of a folded answer. */
function preview(reply: CueReply): string {
  if (reply.kind === 'fallback') return "Cue couldn't answer that one."
  const text = plainCueText(reply.text)
  return text.length <= PREVIEW_CHARS ? text : `${text.slice(0, PREVIEW_CHARS).replace(/\s+\S*$/, '')}…`
}

/**
 * The strip as drawn: the thread, the follow-up box and Continue in Chat. No
 * state of its own, so tests render it straight from turns.
 */
export function AnswerThreadView({
  turns,
  pending,
  failed,
  unfolded,
  draft,
  handlers,
  inputRef,
  formRef,
  turnRefs,
  onDraft,
  onSubmit,
  onStop,
  onRetry,
  onContinue,
  onFold,
}: {
  turns: readonly AssistantTurn[]
  pending: PendingTurn | null
  failed: string | null
  unfolded: ReadonlySet<string>
  draft: string
  handlers: ReplyHandlers
  inputRef?: RefObject<HTMLInputElement | null>
  formRef?: (el: HTMLFormElement | null) => void
  turnRefs?: RefObject<Map<string, HTMLLIElement>>
  onDraft: (text: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onStop: () => void
  onRetry: () => void
  onContinue: (event: MouseEvent<HTMLButtonElement>) => void
  onFold: (id: string, open: boolean) => void
}) {
  // The strip is labelled by its first answer, the one for the search itself.
  const first = turns[0]?.reply
  const basic = first !== undefined && isBasic(first)
  const mode = first ? (first.kind === 'reply' ? (first.mode ?? 'ai') : 'failed') : failed ? 'failed' : 'streaming'
  const full = !canFollowUp(turns)
  const showBox = turns.length > 0 && !full
  const chat = turns.length > 0 && hasCueTurn(turns)

  return (
    <section
      aria-label={basic ? 'Quick answer' : "Cue's answer"}
      data-testid="search-answer"
      data-mode={mode}
      data-turns={turns.length}
      className="mb-8 rounded-2xl border border-gold/30 bg-brand-black p-3 sm:p-4 text-off-white"
    >
      <p className="flex items-center gap-2 mb-3 font-subhead text-xs font-semibold uppercase tracking-[0.08em] text-gold">
        <GoldBrandMark className="size-4" />
        {basic ? 'Quick Answer' : 'Cue'}
        <span className="font-normal normal-case tracking-normal text-off-white/70">
          &middot; {basic ? 'From Our Listings' : 'AI Answer from Our Listings'}
        </span>
      </p>

      {failed ? (
        <div className="border-l-2 border-gold/60 pl-3">
          <p className="font-body text-[15px] leading-relaxed text-off-white">{failed}</p>
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
        <ol aria-label="Answer and follow-ups" className="list-none p-0 m-0 space-y-5">
          {turns.map((turn, i) => {
            const latest = i === turns.length - 1 && !pending
            const open = latest || unfolded.has(turn.id)
            const answerId = `search-answer-${turn.id}`
            return (
              <li
                key={turn.id}
                ref={(el) => {
                  if (el) turnRefs?.current.set(turn.id, el)
                  else turnRefs?.current.delete(turn.id)
                }}
                tabIndex={-1}
                data-testid="search-answer-turn"
                className={cn('space-y-3 scroll-mt-24 focus:outline-none', i > 0 && 'border-t border-white/10 pt-5')}
              >
                {/* The first ask is the search itself, already in the box above. */}
                {i > 0 && <AskBubble ask={turn.ask} />}
                {i > 0 && isBasic(turn.reply) && (
                  <p className="font-subhead text-xs font-semibold text-gold">
                    Quick Answer <span className="font-normal text-off-white/70">&middot; From Our Listings</span>
                  </p>
                )}
                {open ? (
                  <div id={answerId}>
                    <AssistantReply ask={turn.ask} reply={turn.reply} layout="page" handlers={handlers} />
                  </div>
                ) : (
                  <p className="font-body text-sm text-ink-soft">{preview(turn.reply)}</p>
                )}
                {!latest && (
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={open ? answerId : undefined}
                    onClick={() => onFold(turn.id, !open)}
                    className={ASSISTANT_LINK}
                  >
                    {open ? (
                      <ChevronUp className="size-4" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="size-4" aria-hidden="true" />
                    )}
                    {open ? 'Hide Answer' : 'Show Answer'}
                    <span className="sr-only"> to &lsquo;{turn.ask}&rsquo;</span>
                  </button>
                )}
              </li>
            )
          })}
          {pending && (
            <li
              key={pending.id}
              className={cn('space-y-3 scroll-mt-24', turns.length > 0 && 'border-t border-white/10 pt-5')}
            >
              {turns.length > 0 && <AskBubble ask={pending.ask} />}
              <CueStreaming status={pending.status} text={pending.text} layout="page" onStop={onStop} />
            </li>
          )}
        </ol>
      )}

      {showBox && (
        <form ref={formRef} onSubmit={onSubmit} className="mt-5 flex items-center gap-2">
          <label htmlFor="search-follow-up" className="sr-only">
            {FOLLOW_UP_LABEL}
          </label>
          <input
            id="search-follow-up"
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            maxLength={CUE_MESSAGE_MAX}
            autoComplete="off"
            enterKeyHint="send"
            placeholder={FOLLOW_UP_LABEL}
            className="flex-1 min-w-0 h-11 px-4 rounded-full border border-white/40 bg-white/[0.06] font-subhead text-base text-off-white placeholder:text-sm placeholder:text-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          />
          <button
            type="submit"
            className="grid place-items-center size-11 shrink-0 rounded-full bg-gold text-brand-black hover:bg-light-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <ArrowUp className="size-5" aria-hidden="true" />
            <span className="sr-only">Ask</span>
          </button>
        </form>
      )}

      {full && !pending && (
        <p className="mt-5 font-body text-sm text-off-white" data-testid="search-thread-full">
          {THREAD_FULL_LINE}
        </p>
      )}

      {/* The quick answer alone gives the chat nothing to go on yet. */}
      {chat && !pending && (
        <button type="button" onClick={onContinue} className={cn(ASSISTANT_LINK, 'mt-2')}>
          <MessageCircle className="size-4" aria-hidden="true" />
          Continue in Chat
        </button>
      )}
    </section>
  )
}
