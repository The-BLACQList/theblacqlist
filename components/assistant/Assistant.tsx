'use client'

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type MouseEvent } from 'react'
import { usePathname } from 'next/navigation'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ArrowUp, LoaderCircle, X } from 'lucide-react'

import { askAssistant } from '@/lib/actions/ai/assistant'
import type { AssistantResponse } from '@/lib/ai/assistant-limits'
import { fallbackHref, GUIDE_MAX_INPUT } from '@/lib/ai/guide-limits'
import { getNearPoint, wantsNearMe } from '@/lib/assistant/near'
import { isAssistantHiddenPath } from '@/lib/assistant/routes'
import {
  addTurn,
  clearChat,
  getAssistantState,
  historyFor,
  setAssistantOpen,
  takeReturnFocus,
  useAssistant,
  type AssistantTurn,
} from '@/lib/assistant/store'
import { GoldBrandMark } from '@/components/ui/gold-brand-mark'
import { cn } from '@/lib/utils'
import { AssistantReply, AssistantSkeleton, replyStatus } from './AssistantAnswer'

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

const EXAMPLES = [
  'Plan a birthday party in Detroit',
  'Soul food in Atlanta, open now',
  'Barber near me',
] as const

/**
 * The site assistant (ticket 147): a gold Ask button in the corner of every
 * public page. On a computer it opens a panel that stays open while the
 * visitor browses; on a phone it opens a full-screen sheet that closes when
 * they follow a link. The chat lives in this tab (lib/assistant/store.ts).
 */
export function Assistant() {
  const pathname = usePathname()
  const { turns, open } = useAssistant()
  const isDesktop = useIsDesktop()
  const hidden = isAssistantHiddenPath(pathname)

  useEffect(() => {
    if (hidden) setAssistantOpen(false)
  }, [hidden])

  if (hidden) return null
  const onMap = pathname === '/map' || pathname.startsWith('/map/')

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setAssistantOpen} modal={!isDesktop}>
      <DialogPrimitive.Trigger
        data-assistant="on"
        className={cn(
          'lift-over-quick-bar fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 min-h-12 pl-1.5 pr-4 rounded-full bg-gold text-brand-black font-subhead text-sm font-bold shadow-lg shadow-brand-black/30 hover:bg-light-gold transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-black focus-visible:ring-4 focus-visible:ring-white data-[state=open]:invisible',
          // The map's zoom and locate buttons sit bottom-right on a computer.
          onMap && 'md:bottom-48'
        )}
      >
        <span className="grid place-items-center size-9 rounded-full bg-brand-black">
          <GoldBrandMark className="size-5" />
        </span>
        Ask
        <span className="sr-only"> the AI assistant</span>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <AssistantPanel turns={turns} isDesktop={isDesktop} />
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function AssistantPanel({ turns, isDesktop }: { turns: AssistantTurn[]; isDesktop: boolean }) {
  const [text, setText] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const contentRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastRef = useRef<HTMLLIElement>(null)

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
    setStatus('Finding matches…')
    const near = wantsNearMe(words) ? await getNearPoint() : null
    let reply: AssistantResponse
    try {
      reply = await askAssistant({
        message: words,
        history: historyFor(getAssistantState().turns),
        near,
      })
    } catch {
      reply = { kind: 'fallback', href: fallbackHref(words), reason: 'error' }
    }
    addTurn(words, reply)
    setPending(null)
    setStatus(replyStatus(reply))
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
        <DialogPrimitive.Title className="font-subhead text-base font-bold">AI assistant</DialogPrimitive.Title>
        <DialogPrimitive.Description id="assistant-description" className="sr-only">
          Answers come from our listings. This chat stays in this browser tab and clears when you close it.
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
            <span className="sr-only">Close the assistant</span>
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
                  <span className="sr-only">Assistant:</span>
                  <AssistantReply ask={turn.ask} reply={turn.reply} layout="panel" />
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

      <form onSubmit={onSubmit} className="flex items-center gap-2 shrink-0 p-3 border-t border-white/10">
        <label htmlFor="assistant-input" className="sr-only">
          Ask the assistant
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
          placeholder="A business, a city, or a plan"
          className="flex-1 min-w-0 h-11 px-4 rounded-full border border-white/50 bg-white/[0.06] font-subhead text-base text-off-white placeholder:text-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
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
  return (
    <div>
      <p className="font-body text-sm text-off-white">
        Ask for a kind of business, a city, or a whole plan. I&rsquo;ll show what we list, and say plainly
        what we don&rsquo;t.
      </p>
      <p className="mt-4 font-subhead text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">Try</p>
      <ul className="mt-2 list-none p-0 m-0 space-y-2">
        {EXAMPLES.map((example) => (
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
