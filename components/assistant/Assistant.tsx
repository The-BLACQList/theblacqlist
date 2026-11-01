'use client'

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type MouseEvent } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ArrowUp, Square, X } from 'lucide-react'

import { GUIDE_MAX_INPUT } from '@/lib/ai/guide-limits'
import { streamCue } from '@/lib/assistant/ask'
import { isAssistantHiddenPath } from '@/lib/assistant/routes'
import {
  addTurn,
  clearChat,
  setAssistantOpen,
  takeReturnFocus,
  turnId,
  useAssistant,
  useHomeBarInView,
  type AssistantTurn,
} from '@/lib/assistant/store'
import { GoldBrandMark } from '@/components/ui/gold-brand-mark'
import { findSection, jumpToSection } from '@/lib/assistant/scroll'
import { cn } from '@/lib/utils'
import { AssistantReply, CueStreaming, CUE_LOOKING, replyStatus, type ReplyHandlers } from './AssistantAnswer'
import { useExample, useExamples } from './useExample'

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

/**
 * Cue, the site assistant (tickets 147, 148 and 169): a gold Ask Cue button in
 * the corner of every public page. Replies stream in as Cue writes them. On a
 * computer it opens a panel that stays open while the visitor browses; on a
 * phone it opens a full-screen sheet that closes when they follow a link or
 * Cue jumps to part of the page. The chat lives in this tab
 * (lib/assistant/store.ts).
 */
export function Assistant() {
  const pathname = usePathname()
  const { turns, open } = useAssistant()
  const isDesktop = useIsDesktop()
  const hidden = isAssistantHiddenPath(pathname)
  const barInView = useHomeBarInView()
  // Said after the phone sheet closes, so it lives outside the sheet.
  const [afterClose, setAfterClose] = useState('')

  useEffect(() => {
    if (hidden) setAssistantOpen(false)
  }, [hidden])

  if (hidden) return null
  const onMap = pathname === '/map' || pathname.startsWith('/map/')

  return (
    <>
      <DialogPrimitive.Root
        open={open}
        onOpenChange={setAssistantOpen}
        modal={!isDesktop}
      >
        <DialogPrimitive.Trigger
          data-assistant="on"
          className={cn(
            'lift-over-quick-bar fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 min-h-12 pl-1.5 pr-4 rounded-full bg-gold text-brand-black font-subhead text-sm font-bold shadow-lg shadow-brand-black/30 hover:bg-light-gold transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-black focus-visible:ring-4 focus-visible:ring-white data-[state=open]:invisible',
            // The map's zoom and locate buttons sit bottom-right on a computer;
            // on a phone the button rides above the card sheet (globals.css).
            onMap && 'lift-over-map-sheet md:bottom-48',
            // The home bar is its own Ask Cue; one in view is enough.
            barInView && !open && 'invisible'
          )}
        >
          <span className="grid place-items-center size-9 rounded-full bg-brand-black">
            <GoldBrandMark className="size-5" />
          </span>
          Ask Cue
        </DialogPrimitive.Trigger>

        <DialogPrimitive.Portal>
          <AssistantPanel
            turns={turns}
            isDesktop={isDesktop}
            // A changed line is spoken even when the words match the last jump's,
            // however the panel was opened (the button, or Keep chatting).
            announce={(say) => setAfterClose((now) => (now === say ? `${say}\u00a0` : say))}
          />
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
      <p role="status" className="sr-only">
        {afterClose}
      </p>
    </>
  )
}

function AssistantPanel({
  turns,
  isDesktop,
  announce,
}: {
  turns: AssistantTurn[]
  isDesktop: boolean
  /** Speaks once the panel is gone (the phone sheet's jump). */
  announce: (text: string) => void
}) {
  const [text, setText] = useState('')
  // The ask Cue is working on, with its status line and the words so far. Its
  // id carries over to the kept turn, so the list item doesn't remount.
  const [pending, setPending] = useState<{ id: string; ask: string; status: string; text: string } | null>(null)
  const [status, setStatus] = useState('')
  const stopRef = useRef<AbortController | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastRef = useRef<HTMLLIElement>(null)
  const listRef = useRef<HTMLOListElement>(null)
  // The phone sheet's jump, run once the sheet has closed, and what to say then.
  const jumpOnClose = useRef<{ ids: string[]; say: string; focus: boolean } | null>(null)
  // Alternates the empty-send line, so saying it twice is still heard.
  const nudged = useRef(false)
  const placeholder = useExample()

  // A new answer: bring its start into view, not the bottom of a long list.
  const count = turns.length
  useEffect(() => {
    lastRef.current?.scrollIntoView({ block: 'start' })
  }, [count])

  const asking = pending?.ask ?? null
  useEffect(() => {
    if (asking) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [asking])

  // Follow the words as they arrive, unless the visitor has scrolled up to read.
  const written = pending?.text.length ?? 0
  useEffect(() => {
    const el = scrollRef.current
    if (el && written > 0 && el.scrollHeight - el.scrollTop - el.clientHeight < 96) {
      el.scrollTo({ top: el.scrollHeight })
    }
  }, [written])

  /**
   * Puts focus back in the panel when the control that had it went away (the
   * Stop button, a Try again), so keyboard and screen reader users aren't
   * dropped at the top of the page. On a phone the keyboard would cover the
   * reply, so the sheet takes it.
   */
  function keepFocus() {
    const active = document.activeElement
    if (active && active !== document.body && contentRef.current?.contains(active)) return
    focusPanel()
  }

  /**
   * Focus for after the panel changed under the visitor. On a computer, the
   * box, ready for the next ask. On a phone, the conversation list rather than
   * the sheet, so the dialog's name and description aren't read again.
   */
  function focusPanel() {
    if (isDesktop) inputRef.current?.focus()
    else (listRef.current ?? contentRef.current)?.focus()
  }

  /** Says `line`, even when it is what was said last. */
  function sayAgain(line: string) {
    setStatus((now) => (now === line ? `${line}\u00a0` : line))
  }

  async function send(raw: string) {
    const words = raw.trim().slice(0, GUIDE_MAX_INPUT)
    if (!words) return
    if (pending) {
      sayAgain('Cue is still answering. Stop it first, or wait.')
      return
    }
    const id = turnId()
    setText('')
    setPending({ id, ask: words, status: CUE_LOOKING, text: '' })
    setStatus(CUE_LOOKING)
    const stop = new AbortController()
    stopRef.current = stop
    const reply = await streamCue(words, {
      signal: stop.signal,
      onProgress: (progress) =>
        setPending((now) =>
          now ? { ...now, [progress.type === 'status' ? 'status' : 'text']: progress.text } : now
        ),
    })
    // Clear chat let go of this ask; its reply goes nowhere.
    const cleared = stopRef.current !== stop
    stopRef.current = null
    setPending(null)
    if (cleared) return
    // Stopped before Cue wrote anything: give them their words back.
    if (!reply) {
      setText(words)
      setStatus('Stopped.')
      keepFocus()
      return
    }
    addTurn(words, reply, id)
    keepFocus()
    // A section of this page that answers them: go there on its own, without
    // taking focus from where they were typing.
    const said = replyStatus(reply)
    const scroll =
      reply.kind === 'reply' && !reply.stopped ? reply.actions.find((a) => a.kind === 'scroll') : undefined
    if (scroll && jump(scroll.ids, `${said} Cue took you to ${scroll.label}.`, false)) {
      // On a phone the sheet closes first; the line is said after it's gone.
      if (isDesktop) setStatus(`${said} Cue took you to ${scroll.label}.`)
    } else {
      setStatus(said)
    }
  }

  /**
   * Jumps to a section of this page. `focus` is for a jump they asked for (a
   * button); Cue's own jump leaves focus alone. On a phone the sheet covers
   * the page, so it closes first and the jump runs as it hands focus back
   * (onCloseAutoFocus), which also says `say`.
   */
  function jump(ids: string[], say: string, focus: boolean): boolean {
    if (!findSection(ids)) return false
    if (isDesktop) return jumpToSection(ids, { focus })
    jumpOnClose.current = { ids, say, focus }
    setAssistantOpen(false)
    return true
  }

  const handlers: ReplyHandlers = {
    // The new turn opens at the bottom; don't leave focus on an old button.
    onAsk: (words) => {
      focusPanel()
      void send(words)
    },
    onJump: (ids, label) => void jump(ids, `Cue took you to ${label}.`, true),
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!text.trim()) {
      nudged.current = !nudged.current
      setStatus(nudged.current ? "Type what you're looking for, then send." : 'Type a few words first, then send.')
      inputRef.current?.focus()
      return
    }
    void send(text)
  }

  function onStop() {
    stopRef.current?.abort()
    keepFocus()
  }

  function onClear() {
    const running = stopRef.current
    stopRef.current = null
    running?.abort()
    clearChat()
    setStatus('Chat cleared.')
    // The Clear chat button is gone now.
    focusPanel()
  }

  // The phone sheet covers the page, so following a link closes it.
  function onClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (isDesktop) return
    // A new tab or window leaves this page, and the sheet, where it was.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    if ((event.target as Element).closest('a[href]')) setAssistantOpen(false)
  }

  return (
    <DialogPrimitive.Content
      ref={contentRef}
      aria-describedby="assistant-description"
      onOpenAutoFocus={(event) => {
        event.preventDefault()
        // On a phone the keyboard would cover the examples, so focus the sheet.
        if (isDesktop) inputRef.current?.focus()
        else contentRef.current?.focus()
      }}
      // The computer panel stays open while the visitor uses the page.
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
      onCloseAutoFocus={(event) => {
        const back = takeReturnFocus()
        const pendingJump = jumpOnClose.current
        if (pendingJump) {
          jumpOnClose.current = null
          event.preventDefault()
          // The sheet's hold on the page lifts a beat after this, so wait
          // before speaking or the line is lost.
          if (jumpToSection(pendingJump.ids, { focus: pendingJump.focus })) {
            const say = pendingJump.say
            window.setTimeout(() => announce(say), 100)
          }
          // Cue's own jump leaves focus where it was before the sheet opened.
          if (!pendingJump.focus && back?.isConnected) back.focus({ preventScroll: true })
          return
        }
        if (back?.isConnected) {
          event.preventDefault()
          back.focus()
        }
      }}
      onClickCapture={onClickCapture}
      className="fixed inset-0 z-50 flex flex-col bg-brand-black text-off-white pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] md:inset-auto md:bottom-4 md:right-4 md:w-96 h-dvh md:h-[min(70dvh,40rem)] md:p-0 md:rounded-2xl md:border md:border-gold/30 md:shadow-2xl md:shadow-brand-black/50 focus:outline-none blacq-cue-panel"
    >
      <header className="flex items-center gap-2 h-14 shrink-0 pl-4 pr-1 border-b border-white/10">
        <GoldBrandMark className="size-6" />
        <DialogPrimitive.Title className="font-headline text-lg font-medium tracking-wide">Cue</DialogPrimitive.Title>
        <DialogPrimitive.Description id="assistant-description" className="sr-only">
          Cue answers from our listings and can take you to parts of this page. This chat stays in this
          browser tab and clears when you close it.
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
          <EmptyState
            onPick={(example) => {
              // The example list goes away, so keep focus in the panel.
              focusPanel()
              void send(example)
            }}
          />
        ) : (
          <ol ref={listRef} tabIndex={-1} aria-label="Conversation" className="list-none p-0 m-0 space-y-6 focus:outline-none">
            {turns.map((turn, i) => (
              <li key={turn.id} ref={i === turns.length - 1 ? lastRef : undefined} className="space-y-3 scroll-mt-4">
                <AskBubble ask={turn.ask} />
                <AssistantReply ask={turn.ask} reply={turn.reply} layout="panel" handlers={handlers} />
              </li>
            ))}
            {pending && (
              <li key={pending.id} className="space-y-3 scroll-mt-4">
                <AskBubble ask={pending.ask} />
                <CueStreaming status={pending.status} text={pending.text} layout="panel" />
              </li>
            )}
          </ol>
        )}
      </div>

      <p role="status" className="sr-only">
        {status}
      </p>

      <form onSubmit={onSubmit} className="flex items-center gap-2 shrink-0 px-3 pt-3 pb-3 border-t border-white/10">
        <label htmlFor="assistant-input" className="sr-only">
          Ask Cue
        </label>
        <input
          id="assistant-input"
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={GUIDE_MAX_INPUT}
          autoComplete="off"
          enterKeyHint="send"
          placeholder={placeholder}
          className="flex-1 min-w-0 h-11 px-4 rounded-full border border-white/40 bg-white/[0.06] font-subhead text-base text-off-white placeholder:text-sm placeholder:text-ink-soft text-ellipsis focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        />
        {/* While Cue writes, send turns into Stop, in the same spot. Enter in
            the box still sends, so it can't stop the answer by accident. */}
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
      {/* The link stays inline so it doesn't stretch the line; the ::after
          overlay keeps a 44px tap target. */}
      <p className="shrink-0 px-4 pb-3 font-body text-[11px] leading-tight text-ink-soft">
        Cue uses AI to answer from our listings and can get things wrong.{' '}
        <Link
          href="/privacy#cue"
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

function EmptyState({ onPick }: { onPick: (example: string) => void }) {
  const examples = useExamples()
  return (
    <div>
      <p className="font-body text-base text-off-white">
        Hi, I&rsquo;m Cue. Tell me what you&rsquo;re looking for, here or anywhere in the country. I&rsquo;ll
        show you what we list, tell you straight when we don&rsquo;t, and help with the page you&rsquo;re on.
      </p>
      <p className="mt-4 font-subhead text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">Try</p>
      <ul className="mt-2 list-none p-0 m-0 space-y-2">
        {examples.map((example) => (
          <li key={example}>
            <button
              type="button"
              onClick={() => onPick(example)}
              className="w-full min-h-11 px-4 py-2 rounded-xl border border-white/25 text-left font-body text-sm text-off-white hover:border-gold/60 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              {example}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
