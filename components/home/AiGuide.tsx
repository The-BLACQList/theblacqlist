'use client'

import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, LoaderCircle } from 'lucide-react'

import { askGuide, type GuideResponse } from '@/lib/actions/ai/guide'
import { fallbackHref, GUIDE_MAX_INPUT, GUIDE_MAX_RESULTS, withChip } from '@/lib/ai/guide-limits'
import { EntityCard } from '@/components/entities/EntityCard'
import { HeroQuickFilters, type NearPoint, type QuickFilter } from '@/components/home/HeroQuickFilters'
import { GoldBrandMark } from '@/components/ui/gold-brand-mark'
import { Skeleton } from '@/components/ui/skeleton'

type Results = Extract<GuideResponse, { kind: 'results' }>

const FALLBACK_STATUS = "Couldn't match that. Showing search results for what you typed."
const NO_LOCATION_STATUS = "Couldn't get your location. Type a city instead, or try Near me again."

/** One short line for screen readers; the cards themselves are not announced. */
function statusFor(answer: Results): string {
  const n = answer.nameMatches.length + Math.min(answer.results.length, GUIDE_MAX_RESULTS)
  const count = n === 1 ? '1 match' : `${n} matches`
  if (answer.summary === null) return `${count} by name below.`
  if (n === 0) return answer.summary
  return `${answer.summary} ${count} below.`
}

const LINK =
  'inline-flex items-center gap-1.5 min-h-11 font-subhead text-sm font-semibold text-gold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white rounded-sm'

/**
 * The home page visitor guide (ticket 146), and the hero's only search bar.
 * The visitor says what they need, or a business name; the server turns it
 * into filters we already have and sends back real cards, name matches first.
 * Any failure sends them to plain search with their own words.
 *
 * The chips under the bar feed it. Near me is a switch whose position goes to
 * our search only, rounded, and never to the AI.
 *
 * The words stay in this component's state and the one server call. Nothing
 * here stores or logs them.
 */
export function AiGuide({ filters }: { filters: readonly QuickFilter[] }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [near, setNear] = useState<NearPoint | null>(null)
  const [answer, setAnswer] = useState<Results | null>(null)
  const [status, setStatus] = useState('')
  const [pending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const answerRef = useRef<HTMLDivElement>(null)
  // Set by Ask or Enter, not by a chip, so chip taps can be chained.
  const focusAnswer = useRef(false)

  useEffect(() => {
    if (answer && focusAnswer.current) {
      focusAnswer.current = false
      answerRef.current?.focus()
    }
  }, [answer])

  function ask(words: string, at: NearPoint | null) {
    if (pending) return
    setAnswer(null)
    setStatus('Finding matches…')
    startTransition(async () => {
      let res: GuideResponse
      try {
        res = await askGuide(at ? { text: words, near: at } : words)
      } catch {
        res = { kind: 'fallback', href: fallbackHref(words) }
      }
      if (res.kind === 'fallback') {
        setStatus(FALLBACK_STATUS)
        router.push(res.href)
        return
      }
      setAnswer(res)
      setStatus(statusFor(res))
    })
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const words = text.trim()
    if (pending) return
    if (!words) {
      if (near) {
        focusAnswer.current = true
        ask('near me', near)
        return
      }
      setStatus("Type what you're looking for, then press Ask.")
      inputRef.current?.focus()
      return
    }
    focusAnswer.current = true
    ask(words, near)
  }

  function onPick(label: string) {
    if (pending) return
    const next = withChip(text, label)
    setText(next)
    ask(next, near)
  }

  function onNear(point: NearPoint | null) {
    if (near) {
      // Near me was on; this tap turns it off.
      setNear(null)
      setStatus('Near me is off.')
      return
    }
    if (!point) {
      setStatus(NO_LOCATION_STATUS)
      if (text.trim()) ask(text.trim(), null)
      return
    }
    setNear(point)
    ask(text.trim() || 'near me', point)
  }

  return (
    <div>
      <form
        onSubmit={onSubmit}
        className="flex flex-row items-end gap-2 sm:gap-3"
        role="search"
        aria-label="Ask the guide"
      >
        <div className="flex-1 min-w-0">
          <label
            htmlFor="ai-guide-input"
            className="flex items-center gap-2 font-subhead text-sm font-semibold text-off-white mb-2"
          >
            Tell me what you need
            <span
              aria-hidden="true"
              className="rounded-full border border-gold/70 px-1.5 py-px font-subhead text-[11px] font-bold uppercase tracking-[0.08em] text-gold"
            >
              AI
            </span>
            <span className="sr-only">(answered with AI)</span>
          </label>
          <div className="relative">
            <GoldBrandMark className="absolute left-3.5 top-1/2 -translate-y-1/2 size-5 pointer-events-none" />
            <input
              id="ai-guide-input"
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={GUIDE_MAX_INPUT}
              autoComplete="off"
              enterKeyHint="search"
              placeholder="Braids in Atlanta, or a name"
              className="w-full h-14 pl-10 pr-4 rounded-full border border-charcoal/30 bg-white font-subhead text-base text-brand-black placeholder:text-charcoal-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold focus:border-brand-black"
            />
          </div>
        </div>
        {/* A round arrow on phones keeps the chips and answers above the fold. */}
        <button
          type="submit"
          aria-disabled={pending || undefined}
          className="shrink-0 inline-flex items-center justify-center gap-2 size-14 sm:w-auto sm:px-6 rounded-full bg-gold text-brand-black font-subhead text-sm font-bold hover:bg-light-gold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white aria-disabled:opacity-70 aria-disabled:cursor-wait"
        >
          {pending ? (
            <LoaderCircle className="size-5 sm:size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <ArrowRight className="size-5 sm:hidden" aria-hidden="true" />
          )}
          <span className="sr-only sm:not-sr-only">Ask</span>
        </button>
      </form>

      <HeroQuickFilters filters={filters} onPick={onPick} onNear={onNear} nearOn={near !== null} />

      {/* Always mounted, so screen readers hear each short status once. */}
      <p role="status" className="sr-only">
        {status}
      </p>

      {(pending || answer) && (
        <div ref={answerRef} tabIndex={-1} className="mt-5 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
          {pending ? <GuideSkeleton /> : answer && <GuideAnswer answer={answer} />}
        </div>
      )}
    </div>
  )
}

function GuideSkeleton() {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 list-none p-0 m-0" aria-hidden="true">
      {Array.from({ length: 3 }, (_, i) => (
        <li key={i} className="rounded-xl bg-white/95 p-3">
          <Skeleton className="h-28 w-full rounded-lg bg-charcoal/10" />
          <Skeleton className="h-4 w-2/3 mt-3 bg-charcoal/10" />
          <Skeleton className="h-3 w-1/3 mt-2 bg-charcoal/10" />
        </li>
      ))}
    </ul>
  )
}

function CardGrid({ entities }: { entities: Results['results'] }) {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3 list-none p-0 m-0">
      {entities.map((entity) => (
        <li key={entity.id} className="min-w-0">
          <EntityCard entity={entity} />
        </li>
      ))}
    </ul>
  )
}

function GuideAnswer({ answer }: { answer: Results }) {
  const { nameMatches, summary, results, seeAllHref, page } = answer
  const nothing = results.length === 0 && nameMatches.length === 0
  return (
    <div className="rounded-2xl bg-brand-black/60 backdrop-blur-sm p-3 sm:p-4">
      <h2 className="sr-only">Matches for your request</h2>

      {nameMatches.length > 0 && (
        <div className={summary !== null ? 'mb-4' : undefined}>
          <h3 className="font-subhead text-xs font-semibold uppercase tracking-[0.08em] text-off-white/85">
            Matching names
          </h3>
          <CardGrid entities={nameMatches} />
        </div>
      )}

      {summary !== null && <p className="font-body text-sm md:text-base text-off-white">{summary}</p>}
      {results.length > 0 && <CardGrid entities={results.slice(0, GUIDE_MAX_RESULTS)} />}
      {nothing && !page && (
        <p className="font-body text-sm text-off-white/85 mt-2">
          Try fewer words, or see everything close to it.
        </p>
      )}

      <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2">
        {/* A site question gets its page only; "see all" would be an empty search. */}
        {(!nothing || !page) && (
          <Link href={seeAllHref} className={LINK}>
            See all matches
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        )}
        {page && (
          <Link href={page.href} className={LINK}>
            {page.label}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  )
}
