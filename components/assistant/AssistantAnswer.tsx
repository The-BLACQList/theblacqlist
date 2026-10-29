'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight, Check, Copy, Minus, Star } from 'lucide-react'

import type {
  AssistantCard,
  AssistantNeedResult,
  AssistantNeedStatus,
  AssistantResponse,
} from '@/lib/ai/assistant-limits'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type Answer = Extract<AssistantResponse, { kind: 'answer' }>
type Fallback = Extract<AssistantResponse, { kind: 'fallback' }>

/** Where the answer sits: the corner panel, or the home hero. */
export type AnswerLayout = 'panel' | 'page'

export const ASSISTANT_LINK =
  'inline-flex items-center gap-1.5 min-h-11 font-subhead text-sm font-semibold text-gold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white rounded-sm'

const LIMITED_LINE = "You've asked a lot this minute. Try again shortly."
const ERROR_LINE = "Couldn't answer that one. A plain search may help."

/** The short line a status region reads out after each reply. */
export function replyStatus(reply: AssistantResponse): string {
  if (reply.kind === 'fallback') return reply.reason === 'limited' ? LIMITED_LINE : ERROR_LINE
  return reply.notice ? `${reply.notice} ${reply.summary}` : reply.summary
}

/** One reply: an answer with its need groups, or a plain-search fallback. */
export function AssistantReply({
  ask,
  reply,
  layout,
  headingLevel = 3,
}: {
  ask: string
  reply: AssistantResponse
  layout: AnswerLayout
  headingLevel?: 2 | 3
}) {
  if (reply.kind === 'fallback') return <FallbackReply ask={ask} reply={reply} />
  return <AnswerReply answer={reply} layout={layout} headingLevel={headingLevel} />
}

function FallbackReply({ ask, reply }: { ask: string; reply: Fallback }) {
  return (
    <div>
      <p className="font-body text-sm text-off-white">
        {reply.reason === 'limited' ? LIMITED_LINE : ERROR_LINE}
      </p>
      <Link href={reply.href} className={ASSISTANT_LINK}>
        Search for &lsquo;{ask}&rsquo;
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </div>
  )
}

function AnswerReply({
  answer,
  layout,
  headingLevel,
}: {
  answer: Answer
  layout: AnswerLayout
  headingLevel: 2 | 3
}) {
  const { heading, notice, needs, nameMatches, page, searchHref } = answer
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  const Sub = headingLevel === 2 ? 'h3' : 'h4'
  const plan = needs.length > 1
  const nothing = needs.every((n) => n.top.length === 0) && nameMatches.length === 0

  return (
    <div className="space-y-4">
      <div>
        <Heading className="font-subhead text-base font-bold text-off-white">{heading}</Heading>
        {notice && <p className="mt-1 font-body text-sm text-off-white">{notice}</p>}
      </div>

      {nameMatches.length > 0 && (
        <section>
          <Sub className="font-subhead text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
            Matching names
          </Sub>
          <CardList cards={nameMatches} layout={layout} />
        </section>
      )}

      {needs.map((need) => (
        <NeedGroup key={need.name} need={need} layout={layout} headingAs={Sub} showName={plan} />
      ))}

      {plan && <YourList needs={needs} headingAs={Sub} />}

      <div className="flex flex-wrap gap-x-5">
        {page && (
          <Link href={page.href} className={ASSISTANT_LINK}>
            {page.label}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        )}
        {(nothing || plan) && (
          <Link href={searchHref} className={ASSISTANT_LINK}>
            Search instead
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  )
}

function NeedGroup({
  need,
  layout,
  headingAs: Sub,
  showName,
}: {
  need: AssistantNeedResult
  layout: AnswerLayout
  headingAs: 'h3' | 'h4'
  showName: boolean
}) {
  return (
    <section>
      {showName && <Sub className="font-subhead text-sm font-bold text-off-white">{need.name}</Sub>}
      <p
        className={cn(
          'flex items-center gap-1.5 font-body text-sm',
          need.status === 'found' ? 'text-ink-soft' : 'text-off-white'
        )}
      >
        <StatusIcon status={need.status} />
        {need.line}
      </p>
      {need.top.length > 0 && <CardList cards={need.top} layout={layout} />}
      {need.seeAllHref && need.top.length > 0 && (
        <Link href={need.seeAllHref} className={ASSISTANT_LINK}>
          See all {need.total}
          <span className="sr-only">for {need.name}</span>
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      )}
    </section>
  )
}

function StatusIcon({ status }: { status: AssistantNeedStatus }) {
  if (status === 'found') return null
  if (status === 'none') return <Minus className="size-4 shrink-0 text-ink-soft" aria-hidden="true" />
  return <ArrowUpRight className="size-4 shrink-0 text-gold" aria-hidden="true" />
}

function CardList({ cards, layout }: { cards: AssistantCard[]; layout: AnswerLayout }) {
  return (
    <ul
      className={cn(
        'mt-2 grid gap-2 list-none p-0 m-0',
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
      <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-white/10">
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
          {card.rating.toFixed(1)}
          <span className="font-normal text-ink-soft">({card.reviewCount})</span>
          <span className="sr-only">
            stars from {card.reviewCount} {card.reviewCount === 1 ? 'review' : 'reviews'}
          </span>
        </span>
      )}
    </Link>
  )
}

// ─── Your list ───────────────────────────────────────────────────────────────

const LIST_MARK: Record<AssistantNeedStatus, string> = {
  found: 'Found',
  close: 'Close option',
  nearest: 'Nearest city',
  none: 'Not listed',
}

/** Plain text for Copy list: each need and its top pick. */
export function listText(needs: readonly AssistantNeedResult[]): string {
  const lines = needs.map((need) => {
    const top = need.top[0]
    if (need.status === 'none' || !top) return `- ${need.name}: not listed`
    const where = top.cityLabel ? ` (${top.cityLabel})` : ''
    const note = need.status === 'found' ? '' : ` [${LIST_MARK[need.status].toLowerCase()}]`
    return `- ${need.name}: ${top.name}${where}${note}`
  })
  return ['Your list', ...lines].join('\n')
}

function YourList({ needs, headingAs: Sub }: { needs: AssistantNeedResult[]; headingAs: 'h3' | 'h4' }) {
  const [copied, setCopied] = useState<'yes' | 'no' | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(listText(needs))
      setCopied('yes')
    } catch {
      setCopied('no')
    }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(null), 2500)
  }

  return (
    <section className="rounded-xl border border-gold/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <Sub className="font-subhead text-sm font-bold text-off-white">Your list</Sub>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 min-h-11 px-2 -mr-2 rounded-md font-subhead text-sm font-semibold text-gold hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <Copy className="size-4" aria-hidden="true" />
          {copied === 'yes' ? 'Copied' : copied === 'no' ? "Couldn't copy" : 'Copy list'}
        </button>
      </div>
      <ul className="mt-1 list-none p-0 m-0 space-y-1.5">
        {needs.map((need) => (
          <li key={need.name} className="flex items-start gap-2 font-body text-sm text-off-white">
            <ListMark status={need.status} />
            <span className="min-w-0">
              {need.name}
              <span className="text-ink-soft">
                {need.status === 'none' ? ': not listed' : need.top[0] ? `: ${need.top[0].name}` : ''}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p role="status" className="sr-only">
        {copied === 'yes' ? 'List copied.' : copied === 'no' ? "Couldn't copy the list." : ''}
      </p>
    </section>
  )
}

function ListMark({ status }: { status: AssistantNeedStatus }) {
  const label = <span className="sr-only">{LIST_MARK[status]}: </span>
  if (status === 'found')
    return (
      <span className="mt-0.5 shrink-0">
        <Check className="size-4 text-success-on-dark" aria-hidden="true" />
        {label}
      </span>
    )
  if (status === 'none')
    return (
      <span className="mt-0.5 shrink-0">
        <Minus className="size-4 text-ink-soft" aria-hidden="true" />
        {label}
      </span>
    )
  return (
    <span className="mt-0.5 shrink-0">
      <ArrowUpRight className="size-4 text-gold" aria-hidden="true" />
      {label}
    </span>
  )
}

// ─── Loading ─────────────────────────────────────────────────────────────────

export function AssistantSkeleton({ layout }: { layout: AnswerLayout }) {
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
