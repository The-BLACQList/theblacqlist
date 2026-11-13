'use client'

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type MouseEvent,
} from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ArrowUp, Square, X } from 'lucide-react'

import { CueText } from '@/components/assistant/CueText'
import { GoldBrandMark } from '@/components/ui/gold-brand-mark'
import { approveSuggestionAction } from '@/lib/actions/ai/approveSuggestion'
import { applySuggestionAction } from '@/lib/actions/ai/applySuggestion'
import { rejectSuggestionAction } from '@/lib/actions/ai/rejectSuggestion'
import { CUE_HISTORY_TURNS, CUE_TURN_MAX_CHARS } from '@/lib/ai/cue/ask'
import { OWNER_CUE_MESSAGE_MAX } from '@/lib/ai/cue/owner/ask'
import { streamOwnerCue, type OwnerCueReply } from '@/lib/ai/cue/owner/client'
import { OWNER_DRAFT_KINDS, OWNER_FALLBACK_TEXT, type OwnerDraft } from '@/lib/ai/cue/owner/events'
import { isOwnerCueHiddenPath, ownerCuePageId } from '@/lib/ai/cue/owner/routes'
import { cn } from '@/lib/utils'

/**
 * The owner Cue (ticket 203): the same gold Ask Cue button in the bottom-right
 * corner that visitors get, on every dashboard page but Upgrade. On a computer
 * it opens a panel that stays open while the owner works on the page; on a
 * phone, a full-screen sheet that closes when they follow a link. It answers
 * how-to questions, reads the owner's own pages and drafts text. A draft is a
 * pending suggestion; it reaches the page only when the owner chooses "Use
 * this" and confirms. The chat lives in this tab (sessionStorage).
 *
 * On the edit page the button and panel sit above the Save bar
 * (.lift-over-save-bar in globals.css), so Save is never covered.
 */

const STORAGE_KEY = 'blacq-owner-cue-v1'
const MAX_KEPT_TURNS = 20
const LOOKING = 'Cue is looking…'
const DESKTOP = '(min-width: 48rem)'

function subscribeDesktop(onChange: () => void): () => void {
  const mq = window.matchMedia(DESKTOP)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

/** md and up: a panel beside the page. Below: a full-screen sheet. */
function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP).matches,
    () => false
  )
}

export const OWNER_CUE_EXAMPLES = [
  'How do I get more views?',
  'Write my About',
  'How do I turn on messages?',
  'What do the plans include?',
] as const

type DraftState = 'open' | 'used' | 'set_aside'

interface OwnerTurn {
  id: string
  ask: string
  reply: OwnerCueReply
  drafts: Record<string, DraftState>
}

function loadTurns(): OwnerTurn[] {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (t): t is OwnerTurn =>
          !!t &&
          typeof t === 'object' &&
          typeof (t as OwnerTurn).id === 'string' &&
          typeof (t as OwnerTurn).ask === 'string' &&
          !!(t as OwnerTurn).reply &&
          typeof (t as OwnerTurn).reply === 'object'
      )
      .slice(-MAX_KEPT_TURNS)
  } catch {
    return []
  }
}

function saveTurns(turns: OwnerTurn[]): void {
  try {
    if (turns.length === 0) window.sessionStorage.removeItem(STORAGE_KEY)
    else window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(turns.slice(-MAX_KEPT_TURNS)))
  } catch {
    // Private windows and blocked storage: the chat just doesn't survive a reload.
  }
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/** The earlier turns the route reads, newest last, within its limits. */
export function ownerHistory(turns: readonly { ask: string; reply: OwnerCueReply }[]) {
  const out: { role: 'user' | 'assistant'; text: string }[] = []
  for (const turn of turns) {
    if (turn.reply.kind !== 'reply' || !turn.reply.text.trim()) continue
    out.push({ role: 'user', text: turn.ask.slice(0, CUE_TURN_MAX_CHARS) })
    out.push({ role: 'assistant', text: turn.reply.text.slice(0, CUE_TURN_MAX_CHARS) })
  }
  return out.slice(-CUE_HISTORY_TURNS * 2)
}

function replyLine(reply: OwnerCueReply): string {
  if (reply.kind === 'fallback') return OWNER_FALLBACK_TEXT[reply.reason]
  return reply.drafts.length > 0 ? 'Cue answered, with a draft below.' : 'Cue answered.'
}

export function OwnerCue() {
  const pathname = usePathname()
  const isDesktop = useIsDesktop()
  const [open, setOpen] = useState(false)
  const [turns, setTurns] = useState<OwnerTurn[]>([])
  const loaded = useRef(false)

  // The chat in this tab is read when the panel first opens, and written on
  // every change; saveTurns is idempotent, so a repeated updater is harmless.
  function onOpenChange(next: boolean) {
    if (next && !loaded.current) {
      loaded.current = true
      setTurns(loadTurns())
    }
    setOpen(next)
  }

  function updateTurns(update: (now: OwnerTurn[]) => OwnerTurn[]) {
    setTurns((now) => {
      const next = update(now)
      saveTurns(next)
      return next
    })
  }

  // Upgrade and checkout are for deciding what to pay; Cue stays out of them.
  if (isOwnerCueHiddenPath(pathname)) return null

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal={!isDesktop}>
      <DialogPrimitive.Trigger
        data-owner-cue="on"
        aria-label="Ask Cue"
        className="lift-over-save-bar fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 min-h-12 pl-1.5 pr-4 rounded-full bg-gold text-brand-black font-subhead text-sm font-bold shadow-lg shadow-brand-black/30 hover:bg-light-gold transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-black focus-visible:ring-4 focus-visible:ring-white data-[state=open]:invisible"
      >
        <span className="grid place-items-center size-9 rounded-full bg-brand-black">
          <GoldBrandMark className="size-5" />
        </span>
        <span className="owner-cue-label">Ask Cue</span>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <OwnerCuePanel
          turns={turns}
          setTurns={updateTurns}
          pageId={ownerCuePageId(pathname)}
          isDesktop={isDesktop}
          close={() => setOpen(false)}
        />
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function OwnerCuePanel({
  turns,
  setTurns,
  pageId,
  isDesktop,
  close,
}: {
  turns: OwnerTurn[]
  setTurns: (update: (now: OwnerTurn[]) => OwnerTurn[]) => void
  pageId: string | null
  isDesktop: boolean
  close: () => void
}) {
  const [text, setText] = useState('')
  const [pending, setPending] = useState<{
    id: string
    ask: string
    status: string
    text: string
  } | null>(null)
  const [status, setStatus] = useState('')
  const stopRef = useRef<AbortController | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastRef = useRef<HTMLLIElement>(null)

  const count = turns.length
  useEffect(() => {
    lastRef.current?.scrollIntoView({ block: 'start' })
  }, [count])

  const written = pending?.text.length ?? 0
  useEffect(() => {
    const el = scrollRef.current
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 96)
      el.scrollTo({ top: el.scrollHeight })
  }, [written, pending?.ask])

  function say(line: string) {
    setStatus((now) => (now === line ? `${line} ` : line))
  }

  async function send(raw: string) {
    const words = raw.trim().slice(0, OWNER_CUE_MESSAGE_MAX)
    if (!words) return
    if (pending) {
      say('Cue is still answering. Stop it first, or wait.')
      return
    }
    const id = newId()
    setText('')
    setPending({ id, ask: words, status: LOOKING, text: '' })
    say(LOOKING)
    const stop = new AbortController()
    stopRef.current = stop
    const reply = await streamOwnerCue(
      { message: words, history: ownerHistory(turns), listingId: pageId },
      {
        signal: stop.signal,
        onProgress: (p) =>
          setPending((now) =>
            now
              ? {
                  ...now,
                  ...(p.status ? { status: p.status } : {}),
                  ...(p.text ? { text: p.text } : {}),
                }
              : now
          ),
      }
    )
    const cleared = stopRef.current !== stop
    stopRef.current = null
    setPending(null)
    if (cleared) return
    if (!reply) {
      setText(words)
      say('Stopped.')
      inputRef.current?.focus()
      return
    }
    const drafts: Record<string, DraftState> = {}
    if (reply.kind === 'reply') for (const d of reply.drafts) drafts[d.suggestionId] = 'open'
    setTurns((now) => [...now, { id, ask: words, reply, drafts }].slice(-MAX_KEPT_TURNS))
    say(replyLine(reply))
    inputRef.current?.focus()
  }

  function setDraft(turnId: string, suggestionId: string, state: DraftState) {
    setTurns((now) =>
      now.map((t) =>
        t.id === turnId ? { ...t, drafts: { ...t.drafts, [suggestionId]: state } } : t
      )
    )
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!text.trim()) {
      say('Type a question first, then send.')
      inputRef.current?.focus()
      return
    }
    void send(text)
  }

  function onStop() {
    stopRef.current?.abort()
    inputRef.current?.focus()
  }

  function onClear() {
    const running = stopRef.current
    stopRef.current = null
    running?.abort()
    setTurns(() => [])
    say('Chat cleared.')
    inputRef.current?.focus()
  }

  // The phone sheet covers the page, so following a link closes it. The
  // computer panel stays open beside the page, except on the way to Upgrade,
  // where Cue doesn't show.
  function onClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return
    const link = (event.target as Element).closest('a[href]')
    if (!link) return
    if (!isDesktop || isOwnerCueHiddenPath(link.getAttribute('href') ?? '')) close()
  }

  return (
    <DialogPrimitive.Content
      ref={contentRef}
      aria-describedby="owner-cue-description"
      onOpenAutoFocus={(event) => {
        event.preventDefault()
        // On a phone the keyboard would cover the examples, so focus the sheet.
        if (isDesktop) inputRef.current?.focus()
        else contentRef.current?.focus()
      }}
      // The computer panel stays open while the owner uses the page.
      onInteractOutside={(event) => {
        if (isDesktop) event.preventDefault()
      }}
      // The computer panel is not modal: Esc on the page belongs to the page.
      // While Cue writes, Esc in the panel stops it rather than closing.
      onEscapeKeyDown={(event) => {
        if (isDesktop && !contentRef.current?.contains(document.activeElement)) {
          event.preventDefault()
        } else if (pending) {
          event.preventDefault()
          onStop()
        }
      }}
      onClickCapture={onClickCapture}
      className="owner-cue-panel fixed inset-0 z-50 flex flex-col bg-brand-black text-off-white pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] h-dvh md:inset-auto md:bottom-4 md:right-4 md:w-96 md:h-[min(70dvh,40rem)] md:p-0 md:rounded-2xl md:border md:border-gold/30 md:shadow-2xl md:shadow-brand-black/50 focus:outline-none"
    >
      <header className="flex items-center gap-2 h-14 shrink-0 pl-4 pr-1 border-b border-white/10">
        <GoldBrandMark className="size-6" />
        <DialogPrimitive.Title className="font-headline text-lg font-medium tracking-wide">
          Cue
        </DialogPrimitive.Title>
        <DialogPrimitive.Description id="owner-cue-description" className="sr-only">
          Cue answers questions about your dashboard, reads your own pages and can draft text for
          you to use. It never changes your page by itself. This chat stays in this browser tab.
        </DialogPrimitive.Description>
        <div className="ml-auto flex items-center">
          {turns.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="min-h-11 px-3 mr-1 rounded-md font-subhead text-sm font-semibold text-ink-soft hover:text-off-white hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              Clear chat
            </button>
          )}
          <DialogPrimitive.Close className="grid place-items-center size-11 rounded-md text-off-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
            <X className="size-5" aria-hidden="true" />
            <span className="sr-only">Close Cue</span>
          </DialogPrimitive.Close>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {turns.length === 0 && !pending ? (
          <div>
            <p className="font-body text-base text-off-white">
              Hi, I&rsquo;m Cue. Ask me how anything on your dashboard works, what your page is
              missing, or to draft your About. I never change your page without you saying so.
            </p>
            <p className="mt-4 font-subhead text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
              Try
            </p>
            <ul className="mt-2 list-none p-0 m-0 space-y-2">
              {OWNER_CUE_EXAMPLES.map((example) => (
                <li key={example}>
                  <button
                    type="button"
                    onClick={() => void send(example)}
                    className="w-full min-h-11 px-4 py-2 rounded-xl border border-white/25 text-left font-body text-sm text-off-white hover:border-gold/60 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                  >
                    {example}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ol aria-label="Conversation" className="list-none p-0 m-0 space-y-6">
            {turns.map((turn, i) => (
              <li
                key={turn.id}
                ref={i === turns.length - 1 ? lastRef : undefined}
                className="space-y-3 scroll-mt-4"
              >
                <AskBubble ask={turn.ask} />
                <Reply
                  reply={turn.reply}
                  drafts={turn.drafts}
                  onDraft={(suggestionId, state) => setDraft(turn.id, suggestionId, state)}
                  say={say}
                />
              </li>
            ))}
            {pending && (
              <li key={pending.id} className="space-y-3 scroll-mt-4">
                <AskBubble ask={pending.ask} />
                {pending.text ? (
                  <div className="font-body text-[15px] text-off-white">
                    <CueText text={pending.text} />
                  </div>
                ) : (
                  <p className="font-body text-sm text-ink-soft motion-safe:animate-pulse">
                    {pending.status}
                  </p>
                )}
              </li>
            )}
          </ol>
        )}
      </div>

      <p role="status" className="sr-only">
        {status}
      </p>

      <form
        onSubmit={onSubmit}
        className="flex items-center gap-2 shrink-0 px-3 pt-3 pb-3 border-t border-white/10"
      >
        <label htmlFor="owner-cue-input" className="sr-only">
          Ask Cue
        </label>
        <input
          id="owner-cue-input"
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={OWNER_CUE_MESSAGE_MAX}
          autoComplete="off"
          enterKeyHint="send"
          placeholder="Ask about your page or dashboard"
          className="flex-1 min-w-0 h-11 px-4 rounded-full border border-white/40 bg-white/[0.06] font-subhead text-base text-off-white placeholder:text-sm placeholder:text-ink-soft text-ellipsis focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        />
        <button
          type={pending ? 'button' : 'submit'}
          onClick={pending ? onStop : undefined}
          className={cn(
            'grid place-items-center size-11 shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
            pending
              ? 'border border-gold/70 text-off-white hover:bg-gold/15'
              : 'bg-gold text-brand-black hover:bg-light-gold'
          )}
        >
          {pending ? (
            <Square className="size-3.5 fill-current" aria-hidden="true" />
          ) : (
            <ArrowUp className="size-5" aria-hidden="true" />
          )}
          <span className="sr-only">{pending ? 'Stop Cue’s answer' : 'Send'}</span>
        </button>
      </form>
      <p className="shrink-0 px-4 pb-3 font-body text-[11px] leading-tight text-ink-soft">
        Cue uses AI and can get things wrong. Check a draft before you use it.{' '}
        <Link
          href="/privacy#ai-writing-help"
          className="relative underline underline-offset-2 hover:text-off-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold rounded-sm after:absolute after:left-1/2 after:top-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']"
        >
          Privacy
        </Link>
      </p>
    </DialogPrimitive.Content>
  )
}

function AskBubble({ ask }: { ask: string }) {
  return (
    <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-gold/15 px-3 py-2 font-body text-[15px] text-off-white break-words">
      <span className="sr-only">You asked: </span>
      {ask}
    </p>
  )
}

function Reply({
  reply,
  drafts,
  onDraft,
  say,
}: {
  reply: OwnerCueReply
  drafts: Record<string, DraftState>
  onDraft: (suggestionId: string, state: DraftState) => void
  say: (line: string) => void
}) {
  if (reply.kind === 'fallback') {
    return (
      <p className="font-body text-[15px] text-off-white">{OWNER_FALLBACK_TEXT[reply.reason]}</p>
    )
  }
  return (
    <div className="space-y-3">
      {reply.text && (
        <div className="font-body text-[15px] text-off-white">
          <CueText text={reply.text} />
          {reply.stopped && <p className="mt-1 text-xs text-ink-soft">Stopped.</p>}
        </div>
      )}
      {reply.drafts.map((draft) => (
        <DraftCard
          key={draft.suggestionId}
          draft={draft}
          state={drafts[draft.suggestionId] ?? 'open'}
          onState={(state) => onDraft(draft.suggestionId, state)}
          say={say}
        />
      ))}
      {reply.links.length > 0 && (
        <ul className="list-none p-0 m-0 flex flex-wrap gap-2">
          {reply.links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="inline-flex min-h-11 items-center rounded-full border border-gold/60 px-4 font-subhead text-sm font-semibold text-gold hover:bg-gold/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                {link.label} <span aria-hidden="true">&nbsp;→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function DraftCard({
  draft,
  state,
  onState,
  say,
}: {
  draft: OwnerDraft
  state: DraftState
  onState: (state: DraftState) => void
  say: (line: string) => void
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const kind = OWNER_DRAFT_KINDS[draft.kind]

  function form(): FormData {
    const data = new FormData()
    data.set('suggestion_id', draft.suggestionId)
    return data
  }

  async function use() {
    setBusy(true)
    setError(null)
    try {
      // Approve, then apply: the same two steps as the edit page's writing help.
      const approved = await approveSuggestionAction(null, form())
      if (!approved || 'error' in approved)
        throw new Error(approved?.error ?? 'Could not save that draft.')
      const applied = await applySuggestionAction(null, form())
      if (!applied || 'error' in applied)
        throw new Error(applied?.error ?? 'Could not save that draft.')
      onState('used')
      setConfirming(false)
      say(`Saved to ${draft.pageName}.`)
      router.refresh()
    } catch (e) {
      const line = e instanceof Error ? e.message : 'Could not save that draft.'
      setError(line)
      say(line)
    } finally {
      setBusy(false)
    }
  }

  async function setAside() {
    setBusy(true)
    setError(null)
    try {
      const rejected = await rejectSuggestionAction(null, form())
      if (rejected && 'error' in rejected) throw new Error(rejected.error)
      onState('set_aside')
      say('Draft set aside.')
    } catch (e) {
      const line = e instanceof Error ? e.message : 'Could not set that draft aside.'
      setError(line)
      say(line)
    } finally {
      setBusy(false)
    }
  }

  const button =
    'inline-flex min-h-11 items-center rounded-full px-4 font-subhead text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-60'

  return (
    <section
      aria-label={`Draft ${kind.label} for ${draft.pageName}`}
      className="rounded-xl border border-white/20 bg-white/[0.04] p-3"
    >
      <p className="font-subhead text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
        Draft {kind.label} · {draft.pageName}
        {draft.sample && (
          <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 normal-case tracking-normal">
            Sample text
          </span>
        )}
      </p>
      <p className="mt-2 whitespace-pre-line font-body text-[15px] text-off-white">{draft.text}</p>
      {draft.sample && (
        <p className="mt-2 font-body text-xs text-ink-soft">
          Sample text is for trying the buttons. Real drafts are written from your page.
        </p>
      )}

      {state === 'used' && (
        <p className="mt-3 font-body text-sm text-gold">
          Saved to your page.{' '}
          <Link
            href={`/dashboard/pages/${draft.listingId}/edit`}
            className="underline underline-offset-2 hover:text-light-gold"
          >
            Open the edit page
          </Link>
        </p>
      )}
      {state === 'set_aside' && (
        <p className="mt-3 font-body text-sm text-ink-soft">Set aside. Nothing changed.</p>
      )}

      {state === 'open' && !confirming && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirming(true)}
            className={cn(button, 'bg-gold text-brand-black hover:bg-light-gold')}
          >
            Use this
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void setAside()}
            className={cn(button, 'border border-white/30 text-off-white hover:bg-white/10')}
          >
            Not now
          </button>
        </div>
      )}
      {state === 'open' && confirming && (
        <div className="mt-3 space-y-2">
          <p className="font-body text-sm text-off-white">
            This replaces {kind.replaces} on {draft.pageName}.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void use()}
              className={cn(button, 'bg-gold text-brand-black hover:bg-light-gold')}
            >
              {busy ? 'Saving…' : 'Replace it'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(false)}
              className={cn(button, 'border border-white/30 text-off-white hover:bg-white/10')}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 font-body text-sm text-red-300">
          {error}
        </p>
      )}
    </section>
  )
}
