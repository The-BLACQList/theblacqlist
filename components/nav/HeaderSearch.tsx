'use client'

import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import Link from 'next/link'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ArrowRight, LoaderCircle, MessageCircle, Search, X } from 'lucide-react'

import type { CueReply } from '@/lib/ai/assistant-limits'
import { fallbackHref, GUIDE_MAX_INPUT } from '@/lib/ai/guide-limits'
import { streamCue } from '@/lib/assistant/ask'
import {
  addTurn,
  openAssistantFrom,
  setAssistantOpen,
  type AssistantTurn,
} from '@/lib/assistant/store'
import {
  ASSISTANT_LINK,
  AssistantReply,
  CUE_LOOKING,
  CueStreaming,
  replyStatus,
} from '@/components/assistant/AssistantAnswer'
import { useExample } from '@/components/assistant/useExample'
import { GoldBrandMark } from '@/components/ui/gold-brand-mark'
import { cn } from '@/lib/utils'

const TRIGGER =
  'flex items-center justify-center rounded-md text-cream hover:text-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2 focus-visible:ring-offset-deep-bg'

const STILL_ANSWERING = 'Cue is still answering. Press Esc to stop it, or wait.'

type Answer = { ask: string; reply: CueReply }

/**
 * The header's search icon (desktop and phone). With Cue on, it opens a
 * drop-down under the header: one box to search or ask Cue. Enter asks Cue
 * and streams the answer and its picks here; "See all results" is the plain
 * /search page for the same words; "Keep chatting with Cue" copies the answer
 * into the corner panel's chat and opens it.
 *
 * This is its own way in. The corner Ask Cue button and the home hero bar are
 * unchanged. Like the hero bar, the drop-down keeps its own last few asks in
 * memory so "in atlanta" follows on from the answer above it.
 *
 * With Cue off it stays a plain link to /search.
 */
export function HeaderSearch({ cue, size }: { cue: boolean; size: 'desktop' | 'mobile' }) {
  const box = size === 'desktop' ? 'h-10 w-10' : 'h-11 w-11'
  if (!cue) {
    return (
      <Link href="/search" aria-label="Search" className={cn(TRIGGER, box)}>
        <Search className="h-5 w-5" aria-hidden="true" />
      </Link>
    )
  }
  return <SearchCueDropdown box={box} />
}

function SearchCueDropdown({ box }: { box: string }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [pending, setPending] = useState<{ status: string; text: string } | null>(null)
  const [status, setStatus] = useState('')
  const [kept, setKept] = useState(false)
  const example = useExample()

  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const stopRef = useRef<AbortController | null>(null)
  // The drop-down's own asks with Cue, for follow-ups. Memory only.
  const turns = useRef<AssistantTurn[]>([])
  // Set by Keep chatting: once this closes, open the corner panel.
  const handOff = useRef(false)

  // Leaving the page ends Cue's request, so it stops spending.
  useEffect(() => () => stopRef.current?.abort(), [])

  function onOpenChange(next: boolean) {
    if (next) {
      // One Cue on screen at a time.
      setAssistantOpen(false)
    } else {
      // Closing stops Cue; the last answer stays for when it reopens.
      stopRef.current?.abort()
    }
    setOpen(next)
  }

  async function ask(words: string) {
    setText(words)
    setStatus(CUE_LOOKING)
    setPending({ status: CUE_LOOKING, text: '' })
    const stop = new AbortController()
    stopRef.current = stop
    const reply = await streamCue(words, {
      turns: turns.current,
      signal: stop.signal,
      onProgress: (progress) =>
        setPending((now) =>
          now ? { ...now, [progress.type === 'status' ? 'status' : 'text']: progress.text } : now
        ),
    })
    if (stopRef.current === stop) stopRef.current = null
    setPending(null)
    // Stopped before Cue wrote anything: their words are still in the box.
    if (!reply) {
      setStatus('Stopped.')
      inputRef.current?.focus()
      return
    }
    if (reply.kind === 'reply') {
      turns.current = [
        ...turns.current,
        { id: String(turns.current.length), ask: words, reply },
      ].slice(-4)
    }
    setKept(false)
    setAnswer({ ask: words, reply })
    setStatus(replyStatus(reply))
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const words = text.trim()
    if (pending) {
      setStatus((now) => (now === STILL_ANSWERING ? `${STILL_ANSWERING} ` : STILL_ANSWERING))
      return
    }
    if (!words) {
      setStatus("Type a business name or what you're looking for, then press Ask.")
      inputRef.current?.focus()
      return
    }
    void ask(words)
  }

  function onStop() {
    stopRef.current?.abort()
    inputRef.current?.focus()
  }

  // Following any link (a card, See all results) leaves this page: close.
  function onClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return
    if ((event.target as Element).closest('a[href]')) onOpenChange(false)
  }

  const words = text.trim()
  const reply = answer?.reply.kind === 'reply' ? answer.reply : null

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Trigger
        ref={triggerRef}
        aria-label="Search or ask Cue"
        className={cn(TRIGGER, box)}
      >
        <Search className="h-5 w-5" aria-hidden="true" />
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-x-0 bottom-0 top-14 md:top-16 z-40 bg-brand-black/60" />
        <DialogPrimitive.Content
          aria-describedby="header-search-description"
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            inputRef.current?.focus()
          }}
          // While Cue writes, Esc stops it rather than closing.
          onEscapeKeyDown={(event) => {
            if (pending) {
              event.preventDefault()
              onStop()
            }
          }}
          onCloseAutoFocus={(event) => {
            if (!handOff.current) return
            handOff.current = false
            event.preventDefault()
            openAssistantFrom(triggerRef.current)
          }}
          onClickCapture={onClickCapture}
          className="fixed inset-x-0 bottom-0 top-14 z-50 flex flex-col bg-brand-black text-off-white md:bottom-auto md:top-16 md:max-h-[calc(100dvh-5rem)] md:border-b md:border-gold/30 md:shadow-2xl md:shadow-brand-black/50 focus:outline-none"
        >
          <div className="mx-auto flex w-full max-w-3xl min-h-0 flex-1 flex-col px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center gap-2 mb-3">
              <GoldBrandMark className="size-5" />
              <DialogPrimitive.Title className="font-subhead text-sm font-semibold text-off-white">
                Search or ask Cue
              </DialogPrimitive.Title>
              <DialogPrimitive.Description id="header-search-description" className="sr-only">
                Cue answers with AI from our listings. See all results opens the plain search page.
              </DialogPrimitive.Description>
              <DialogPrimitive.Close className="ml-auto grid place-items-center size-11 -mr-2 rounded-md text-off-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
                <X className="size-5" aria-hidden="true" />
                <span className="sr-only">Close search</span>
              </DialogPrimitive.Close>
            </div>

            <form
              onSubmit={onSubmit}
              role="search"
              aria-label="Search or ask Cue"
              className="flex items-center gap-2"
            >
              <label htmlFor="header-search-input" className="sr-only">
                A business name, or what you&rsquo;re looking for (answered with AI)
              </label>
              <input
                id="header-search-input"
                ref={inputRef}
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={GUIDE_MAX_INPUT}
                autoComplete="off"
                enterKeyHint="search"
                placeholder={example}
                className="min-w-0 flex-1 h-12 px-4 rounded-full border border-charcoal/30 bg-white font-subhead text-base text-brand-black placeholder:text-charcoal-soft text-ellipsis focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold focus:border-brand-black"
              />
              <button
                type="submit"
                aria-disabled={pending ? true : undefined}
                className="shrink-0 inline-flex items-center justify-center gap-2 h-12 px-5 rounded-full bg-gold text-brand-black font-subhead text-sm font-bold hover:bg-light-gold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white aria-disabled:opacity-70 aria-disabled:cursor-wait"
              >
                {pending && (
                  <LoaderCircle
                    className="size-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                )}
                Ask Cue
              </button>
            </form>

            {/* Always mounted, so screen readers hear each short status once. */}
            <p role="status" className="sr-only">
              {status}
            </p>

            {(pending || answer) && (
              <div className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {pending ? (
                  <CueStreaming
                    status={pending.status}
                    text={pending.text}
                    layout="page"
                    onStop={onStop}
                  />
                ) : (
                  answer && (
                    <AssistantReply
                      ask={answer.ask}
                      reply={answer.reply}
                      layout="page"
                      handlers={{ onAsk: (next) => void ask(next) }}
                    />
                  )
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mt-2">
              {words && (
                <Link href={fallbackHref(words)} className={ASSISTANT_LINK}>
                  See all results for &lsquo;{words}&rsquo;
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              )}
              {reply && !pending && answer && (
                <button
                  type="button"
                  onClick={() => {
                    // Once per answer, so a second tap only reopens the panel.
                    if (!kept) addTurn(answer.ask, reply)
                    setKept(true)
                    handOff.current = true
                    onOpenChange(false)
                  }}
                  className={ASSISTANT_LINK}
                >
                  <MessageCircle className="size-4" aria-hidden="true" />
                  Keep chatting with Cue
                </button>
              )}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
