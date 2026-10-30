'use client'

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type MouseEvent } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ArrowUp, LoaderCircle, X } from 'lucide-react'

import { GUIDE_MAX_INPUT } from '@/lib/ai/guide-limits'
import { askCue } from '@/lib/assistant/ask'
import { isAssistantHiddenPath } from '@/lib/assistant/routes'
import {
  addTurn,
  clearChat,
  setAssistantOpen,
  takeReturnFocus,
  useAssistant,
  useHomeBarInView,
  type AssistantTurn,
} from '@/lib/assistant/store'
import { GoldBrandMark } from '@/components/ui/gold-brand-mark'
import { findSection, jumpToSection } from '@/lib/assistant/scroll'
import { cn } from '@/lib/utils'
import { AssistantReply, AssistantSkeleton, replyStatus, type ReplyHandlers } from './AssistantAnswer'
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
 * Cue, the site assistant (tickets 147 and 148): a gold Ask Cue button in the
 * corner of every public page. On a computer it opens a panel that stays open
 * while the visitor browses; on a phone it opens a full-screen sheet that
 * closes when they follow a link or Cue jumps to part of the page. The chat
 * lives in this tab (lib/assistant/store.ts).
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
        onOpenChange={(next) => {
          // A fresh open starts quiet, so the next jump is spoken even with the same words.
          if (next) setAfterClose('')
          setAssistantOpen(next)
        }}
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
          <AssistantPanel turns={turns} isDesktop={isDesktop} announce={setAfterClose} />
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
  const [pending, setPending] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const contentRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastRef = useRef<HTMLLIElement>(null)
  const jumpOnClose = useRef<{ ids: string[]; label: string } | null>(null)
  const placeholder = useExample()

  // A new answer: bring its start into view, not the bottom of a long list.
  const count = turns.length
  useEffect(() => {
    lastRef.current?.scrollIntoView({ block: 'start' })
  }, [count])

  useEffect(() => {
    if (pending) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [pending])

  async function send(raw: string) {
    const words = raw.trim().slice(0, GUIDE_MAX_INPUT)
    if (!words || pending) return
    setText('')
    setPending(words)
    setStatus('Cue is looking…')
    const reply = await askCue(words)
    addTurn(words, reply)
    setPending(null)
    // A section of this page that answers them: go there on its own.
    const scroll = reply.kind === 'answer' ? reply.actions.find((a) => a.kind === 'scroll') : undefined
    if (scroll && jump(scroll.ids, scroll.label)) {
      setStatus(`${replyStatus(reply)} Cue took you to ${scroll.label}.`)
    } else {
      setStatus(replyStatus(reply))
    }
  }

  /**
   * Jumps to a section of this page. On a phone the sheet covers the page, so
   * it closes first and the jump runs as it hands focus back (onCloseAutoFocus).
   */
  function jump(ids: string[], label: string): boolean {
    if (!findSection(ids)) return false
    if (isDesktop) return jumpToSection(ids)
    jumpOnClose.current = { ids, label }
    setAssistantOpen(false)
    return true
  }

  const handlers: ReplyHandlers = {
    onAsk: (words) => void send(words),
    onJump: (ids, label) => void jump(ids, label),
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!text.trim()) {
      setStatus("Type what you're looking for, then send.")
      inputRef.current?.focus()
      return
    }
    void send(text)
  }

  function onClear() {
    clearChat()
    setStatus('Chat cleared.')
    inputRef.current?.focus()
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
      onEscapeKeyDown={(event) => {
        if (isDesktop && !contentRef.current?.contains(document.activeElement)) event.preventDefault()
      }}
      onCloseAutoFocus={(event) => {
        const back = takeReturnFocus()
        const pendingJump = jumpOnClose.current
        if (pendingJump) {
          jumpOnClose.current = null
          event.preventDefault()
          if (jumpToSection(pendingJump.ids)) announce(`Cue took you to ${pendingJump.label}.`)
          return
        }
        if (back?.isConnected) {
          event.preventDefault()
          back.focus()
        }
      }}
      onClickCapture={onClickCapture}
      className="fixed inset-0 z-50 flex flex-col bg-brand-black text-off-white pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] md:inset-auto md:bottom-4 md:right-4 md:w-96 md:h-[min(70vh,40rem)] md:p-0 md:rounded-2xl md:border md:border-gold/30 md:shadow-2xl md:shadow-brand-black/50 focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4 motion-reduce:animate-none"
    >
      <header className="flex items-center gap-2 h-14 shrink-0 pl-4 pr-1 border-b border-white/10">
        <GoldBrandMark className="size-6" />
        <DialogPrimitive.Title className="font-subhead text-base font-bold">Cue</DialogPrimitive.Title>
        <DialogPrimitive.Description id="assistant-description" className="sr-only">
          Cue answers from our listings and can take you to parts of this page. This chat stays in this
          browser tab and clears when you close it.
        </DialogPrimitive.Description>
        <div className="ml-auto flex items-center">
          {turns.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="min-h-11 px-3 rounded-md font-subhead text-sm font-semibold text-ink-soft hover:text-off-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
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
              if (isDesktop) inputRef.current?.focus()
              else contentRef.current?.focus()
              void send(example)
            }}
          />
        ) : (
          <ol aria-label="Conversation" className="list-none p-0 m-0 space-y-6">
            {turns.map((turn, i) => (
              <li key={turn.id} ref={i === turns.length - 1 ? lastRef : undefined} className="space-y-3 scroll-mt-4">
                <AskBubble ask={turn.ask} />
                <div>
                  <span className="sr-only">Cue:</span>
                  <AssistantReply ask={turn.ask} reply={turn.reply} layout="panel" handlers={handlers} />
                </div>
              </li>
            ))}
            {pending && (
              <li className="space-y-3">
                <AskBubble ask={pending} />
                <AssistantSkeleton layout="panel" />
              </li>
            )}
          </ol>
        )}
      </div>

      <p role="status" className="sr-only">
        {status}
      </p>

      <form onSubmit={onSubmit} className="flex items-center gap-2 shrink-0 px-3 pt-3 pb-1 border-t border-white/10">
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
          className="flex-1 min-w-0 h-11 px-4 rounded-full border border-white/60 bg-white/[0.06] font-subhead text-base text-off-white placeholder:text-sm placeholder:text-ink-soft text-ellipsis focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        />
        <button
          type="submit"
          aria-disabled={pending !== null || undefined}
          className="grid place-items-center size-11 shrink-0 rounded-full bg-gold text-brand-black hover:bg-light-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white aria-disabled:opacity-70 aria-disabled:cursor-wait"
        >
          {pending ? (
            <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <ArrowUp className="size-5" aria-hidden="true" />
          )}
          <span className="sr-only">Send</span>
        </button>
      </form>
      <p className="shrink-0 px-4 pt-1 pb-2 font-body text-xs text-ink-soft">
        Cue uses AI to match your words to our listings.{' '}
        <Link
          href="/privacy"
          className="inline-block py-2 underline underline-offset-2 hover:text-off-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold rounded-sm"
        >
          Privacy
        </Link>
      </p>
    </DialogPrimitive.Content>
  )
}

function AskBubble({ ask }: { ask: string }) {
  return (
    <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-gold/15 px-3 py-2 font-body text-sm text-off-white break-words">
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
              className="w-full min-h-11 px-4 py-2 rounded-xl border border-white/50 text-left font-body text-sm text-off-white hover:border-gold/60 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              {example}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
