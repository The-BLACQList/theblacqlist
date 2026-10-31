'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight, CornerDownRight, MessageCircle, Phone, RotateCcw, Square, Star } from 'lucide-react'

import type { AssistantAction, AssistantCard, CueReply } from '@/lib/ai/assistant-limits'
import { fallbackHref } from '@/lib/ai/guide-limits'
import { GoldBrandMark } from '@/components/ui/gold-brand-mark'
import { Skeleton } from '@/components/ui/skeleton'
import { jumpToSection } from '@/lib/assistant/scroll'
import { cn } from '@/lib/utils'
import { CueText, plainCueText, settledCueText } from './CueText'

type Reply = Extract<CueReply, { kind: 'reply' }>
type Fallback = Extract<CueReply, { kind: 'fallback' }>

/** Where the answer sits: the corner panel, or the home hero. */
export type AnswerLayout = 'panel' | 'page'

export const ASSISTANT_LINK =
  'inline-flex items-center gap-1.5 min-h-11 font-subhead text-sm font-semibold text-gold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white rounded-sm'

const LIMITED_LINE = "You've asked me a lot this minute. Give me a moment and try again."
const ERROR_LINE = "I couldn't answer that one. A plain search may help."

/** What a status region says while Cue works, before any words arrive. */
export const CUE_LOOKING = 'Cue is looking…'

/**
 * The line a status region reads once a reply is finished. Never read on each
 * streamed delta, so a screen reader hears the reply once, whole.
 */
export function replyStatus(reply: CueReply): string {
  if (reply.kind === 'fallback') return reply.reason === 'limited' ? LIMITED_LINE : ERROR_LINE
  const parts = [plainCueText(reply.text)]
  const n = reply.cards.length
  if (n > 0) parts.push(`Showing ${n} ${n === 1 ? 'business' : 'businesses'}.`)
  if (reply.stopped) parts.push('Stopped.')
  return parts.filter(Boolean).join(' ')
}

/** What the action buttons do. Without `onAsk`, ask actions are hidden. */
export interface ReplyHandlers {
  /** Sends `text` as the visitor's next ask. */
  onAsk?: (text: string) => void
  /** Jumps to a section. Defaults to a plain jump. */
  onJump?: (ids: string[], label: string) => void
}

/** One finished reply: Cue's words, its buttons and cards, or a plain-search fallback. */
export function AssistantReply({
  ask,
  reply,
  layout,
  handlers = {},
}: {
  ask: string
  reply: CueReply
  layout: AnswerLayout
  handlers?: ReplyHandlers
}) {
  if (reply.kind === 'fallback') return <FallbackReply ask={ask} reply={reply} onAsk={handlers.onAsk} />
  return <TextReply ask={ask} reply={reply} layout={layout} handlers={handlers} />
}

/** Cue couldn't answer: say so plainly, offer the same ask again, and plain search. */
function FallbackReply({ ask, reply, onAsk }: { ask: string; reply: Fallback; onAsk?: (text: string) => void }) {
  return (
    <div className="border-l-2 border-gold/60 pl-3">
      <p className="font-body text-[15px] leading-relaxed text-off-white">
        {reply.reason === 'limited' ? LIMITED_LINE : ERROR_LINE}
      </p>
      <div className="flex flex-wrap items-center gap-x-4">
        {onAsk && (
          <button type="button" onClick={() => onAsk(ask)} className={ASSISTANT_LINK}>
            <RotateCcw className="size-4" aria-hidden="true" />
            Try again
          </button>
        )}
        <Link href={reply.href} className={ASSISTANT_LINK}>
          Search for &lsquo;{ask}&rsquo;
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}

/**
 * In the corner panel Cue's words sit beside its mark, so a reply reads as
 * Cue's at a glance next to the visitor's gold bubbles. The home bar's answer
 * box is Cue's already.
 */
function CueVoice({ layout, children }: { layout: AnswerLayout; children: React.ReactNode }) {
  if (layout !== 'panel') return <div className="space-y-3">{children}</div>
  return (
    <div className="flex gap-2.5">
      <GoldBrandMark className="size-5 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1 space-y-3">{children}</div>
    </div>
  )
}

function TextReply({
  ask,
  reply,
  layout,
  handlers,
}: {
  ask: string
  reply: Reply
  layout: AnswerLayout
  handlers: ReplyHandlers
}) {
  return (
    <CueVoice layout={layout}>
      <div>
        <span className="sr-only">Cue says: </span>
        <CueText text={reply.text} />
        {reply.stopped && <p className="mt-1 font-body text-xs text-ink-soft">Stopped</p>}
      </div>

      {reply.actions.length > 0 && <ActionRow actions={reply.actions} handlers={handlers} />}

      {reply.cards.length > 0 ? (
        <div className="blacq-cue-in">
          <CardList cards={reply.cards} layout={layout} />
        </div>
      ) : (
        !reply.stopped && (
          <Link href={fallbackHref(ask)} className={ASSISTANT_LINK}>
            Search for &lsquo;{ask}&rsquo;
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        )
      )}
    </CueVoice>
  )
}

/** Three dots that pulse in turn while Cue works; still under reduced motion. */
function CueDots() {
  return (
    <span className="inline-flex shrink-0 gap-1" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span key={i} className="blacq-cue-dot size-1.5 rounded-full bg-gold" />
      ))}
    </span>
  )
}

/**
 * Cue at work, laid out like the finished reply so nothing jumps when it
 * lands. Before any words: the status line with the dots, over a skeleton.
 * Once words arrive: a small status line, then the words. The words are hidden
 * from screen readers here; the finished reply is read once through the status
 * region instead.
 *
 * `onStop` shows a Stop button in the row. The corner panel leaves it out,
 * since its send button turns into Stop.
 */
export function CueStreaming({
  status,
  text,
  layout,
  onStop,
}: {
  status: string
  text: string
  layout: AnswerLayout
  onStop?: () => void
}) {
  const words = settledCueText(text)
  return (
    <CueVoice layout={layout}>
      <div className="flex items-center justify-between gap-2">
        <p
          className={cn(
            'flex items-center gap-2 font-body text-ink-soft',
            words ? 'text-xs' : 'text-sm'
          )}
        >
          {!words && <CueDots />}
          {status}
        </p>
        {onStop && (
          <button
            type="button"
            onClick={onStop}
            className="inline-flex items-center gap-1.5 min-h-11 px-3 -mr-3 rounded-full font-subhead text-sm font-semibold text-off-white hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Square className="size-3.5 fill-current" aria-hidden="true" />
            Stop<span className="sr-only"> Cue&rsquo;s answer</span>
          </button>
        )}
      </div>
      {words ? (
        <div aria-hidden="true">
          <CueText text={words} />
        </div>
      ) : (
        <AssistantSkeleton layout={layout} />
      )}
    </CueVoice>
  )
}

const ACTION_BASE =
  'inline-flex items-center gap-1.5 min-h-11 rounded-full px-4 font-subhead text-sm font-semibold transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
const ACTION_BUTTON = `${ACTION_BASE} border border-gold/60 text-off-white hover:bg-gold/15 hover:border-gold`
// The jump answers them on this page, so it leads.
const JUMP_BUTTON = `${ACTION_BASE} bg-gold text-brand-black hover:bg-light-gold`

/**
 * Cue's buttons for this page. Each waits for a tap; only the scroll that came
 * with the answer ran on its own, and its button jumps back there.
 */
function ActionRow({ actions, handlers }: { actions: AssistantAction[]; handlers: ReplyHandlers }) {
  const jump = handlers.onJump ?? ((ids: string[]) => void jumpToSection(ids))
  return (
    <ul className="flex flex-wrap gap-2 list-none p-0 m-0">
      {actions.map((action) => {
        const key = `${action.kind}-${action.label}`
        if (action.kind === 'scroll') {
          return (
            <li key={key}>
              <button type="button" onClick={() => jump(action.ids, action.label)} className={JUMP_BUTTON}>
                <CornerDownRight className="size-4" aria-hidden="true" />
                Take me to {action.label}
              </button>
            </li>
          )
        }
        if (action.kind === 'ask') {
          if (!handlers.onAsk) return null
          const onAsk = handlers.onAsk
          return (
            <li key={key}>
              <button type="button" onClick={() => onAsk(action.text)} className={ACTION_BUTTON}>
                <MessageCircle className="size-4 text-gold" aria-hidden="true" />
                {action.label}
              </button>
            </li>
          )
        }
        if (action.kind === 'link') {
          return (
            <li key={key}>
              <Link href={action.href} className={ACTION_BUTTON}>
                {action.label}
                <ArrowRight className="size-4 text-gold" aria-hidden="true" />
              </Link>
            </li>
          )
        }
        const tel = action.href.startsWith('tel:')
        return (
          <li key={key}>
            <a
              href={action.href}
              {...(tel ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
              className={ACTION_BUTTON}
            >
              {tel && <Phone className="size-4 text-gold" aria-hidden="true" />}
              {action.label}
              {!tel && (
                <>
                  <ArrowUpRight className="size-4 text-gold" aria-hidden="true" />
                  <span className="sr-only"> (opens in a new tab)</span>
                </>
              )}
            </a>
          </li>
        )
      })}
    </ul>
  )
}

function CardList({ cards, layout }: { cards: AssistantCard[]; layout: AnswerLayout }) {
  return (
    <ul
      className={cn(
        'grid gap-2 list-none p-0 m-0',
        layout === 'page' && 'sm:grid-cols-2 lg:grid-cols-3'
      )}
    >
      {cards.map((card) => (
        <li key={card.id} className="min-w-0">
          <CompactCard card={card} />
        </li>
      ))}
    </ul>
  )
}

/** Up to two letters for a card with no photo, as the map cards do. */
function initials(name: string): string {
  return name
    .split(' ')
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
}

function CompactCard({ card }: { card: AssistantCard }) {
  const where = [card.categoryName, card.cityLabel].filter(Boolean).join(' · ')
  return (
    <Link
      href={card.href}
      className="flex items-center gap-3 min-h-16 rounded-xl bg-white/[0.06] p-2 pr-3 hover:bg-white/[0.12] transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
    >
      <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-gold/15">
        {card.imageSrc ? (
          <Image src={card.imageSrc} alt="" fill sizes="48px" className="object-cover" />
        ) : (
          <span aria-hidden="true" className="flex h-full items-center justify-center font-headline text-base text-gold">
            {initials(card.name)}
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-subhead text-sm font-semibold text-off-white">{card.name}</span>
        <span className="block truncate font-body text-xs text-ink-soft">{where}</span>
      </span>
      {card.rating !== null && card.reviewCount > 0 && (
        <span className="shrink-0 inline-flex items-center gap-1 font-subhead text-xs font-semibold text-off-white">
          <Star className="size-3.5 fill-gold text-gold" aria-hidden="true" />
          <span aria-hidden="true">
            {card.rating.toFixed(1)} <span className="font-normal text-ink-soft">({card.reviewCount})</span>
          </span>
          <span className="sr-only">
            Rated {card.rating.toFixed(1)} out of 5 from {card.reviewCount}{' '}
            {card.reviewCount === 1 ? 'review' : 'reviews'}
          </span>
        </span>
      )}
    </Link>
  )
}

// ─── Loading ─────────────────────────────────────────────────────────────────

export function AssistantSkeleton({ layout }: { layout: AnswerLayout }) {
  // The panel holds a few lines of words; most answers there carry no cards,
  // so it shows lines only and nothing jumps when the words land.
  if (layout === 'panel') {
    return (
      <div className="space-y-2" aria-hidden="true">
        <Skeleton className="h-3.5 w-11/12 bg-white/15" />
        <Skeleton className="h-3.5 w-3/5 bg-white/15" />
      </div>
    )
  }
  return (
    <div className="space-y-3" aria-hidden="true">
      <Skeleton className="h-4 w-1/2 bg-white/15" />
      <div className={cn('grid gap-2', layout === 'page' && 'sm:grid-cols-2 lg:grid-cols-3')}>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl bg-white/[0.06] p-2">
            <Skeleton className="size-12 rounded-lg bg-white/15" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/3 bg-white/15" />
              <Skeleton className="h-3 w-1/3 bg-white/15" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
