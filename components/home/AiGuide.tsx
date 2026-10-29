'use client'

import { useRef, useState, useTransition, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, LoaderCircle, Sparkles } from 'lucide-react'

import { askGuide, type GuideResponse } from '@/lib/actions/ai/guide'
import { fallbackHref, GUIDE_MAX_INPUT, GUIDE_MAX_RESULTS } from '@/lib/ai/guide-limits'
import { EntityCard } from '@/components/entities/EntityCard'
import { Skeleton } from '@/components/ui/skeleton'

type Results = Extract<GuideResponse, { kind: 'results' }>

const FALLBACK_STATUS = "Couldn't match that. Showing search results for what you typed."

/** One short line for screen readers; the cards themselves are not announced. */
function statusFor(answer: Results): string {
  const n = Math.min(answer.results.length, GUIDE_MAX_RESULTS)
  if (n === 0) return answer.summary
  return `${answer.summary} ${n === 1 ? '1 match' : `${n} matches`} below.`
}

const LINK =
  'inline-flex items-center gap-1.5 min-h-11 font-subhead text-sm font-semibold text-gold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold rounded-sm'

/**
 * The home page visitor guide (ticket 146). The visitor says what they need;
 * the server turns it into filters we already have and sends back real cards.
 * Any failure sends them to plain search with their own words.
 *
 * The words stay in this component's state and the one server call. Nothing
 * here stores or logs them.
 */
export function AiGuide() {
  const router = useRouter()
  const [text, setText] = useState('')
  const [answer, setAnswer] = useState<Results | null>(null)
  const [status, setStatus] = useState('')
  const [pending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const words = text.trim()
    if (pending) return
    if (!words) {
      setStatus("Type what you're looking for, then press Ask.")
      inputRef.current?.focus()
      return
    }
    setAnswer(null)
    setStatus('Finding matches…')
    startTransition(async () => {
      let res: GuideResponse
      try {
        res = await askGuide(words)
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

  return (
    <div>
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        role="search"
        aria-label="Ask the guide"
      >
        <div className="flex-1 min-w-0">
          <label htmlFor="ai-guide-input" className="block font-subhead text-sm font-semibold text-off-white mb-2">
            Tell me what you need
          </label>
          <div className="relative">
            <Sparkles
              className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-charcoal-soft pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="ai-guide-input"
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={GUIDE_MAX_INPUT}
              autoComplete="off"
              enterKeyHint="search"
              placeholder="Soul food in Atlanta, open now"
              aria-describedby="ai-guide-hint"
              className="w-full h-14 pl-10 pr-4 rounded-full border border-charcoal/30 bg-white font-subhead text-base text-brand-black placeholder:text-charcoal-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold focus:border-brand-black"
            />
          </div>
        </div>
        <button
          type="submit"
          aria-disabled={pending || undefined}
          className="inline-flex items-center justify-center gap-2 h-14 min-w-11 px-6 rounded-full bg-gold text-brand-black font-subhead text-sm font-bold hover:bg-light-gold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold aria-disabled:opacity-70 aria-disabled:cursor-wait"
        >
          {pending && <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          Ask
        </button>
      </form>
      <p id="ai-guide-hint" className="font-body text-sm text-off-white/80 mt-2">
        Say it in your own words. We use AI to match it to our listings and don&apos;t save what you type.
      </p>

      {/* Always mounted, so screen readers hear each short status once. */}
      <p role="status" className="sr-only">
        {status}
      </p>

      {(pending || answer) && (
        <div className="mt-4">
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

function GuideAnswer({ answer }: { answer: Results }) {
  const { summary, results, seeAllHref, page } = answer
  return (
    <div className="rounded-2xl bg-brand-black/60 backdrop-blur-sm p-3 sm:p-4">
      <h2 className="sr-only">Matches for your request</h2>
      <p className="font-body text-sm md:text-base text-off-white">{summary}</p>

      {results.length > 0 && (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3 list-none p-0 m-0">
          {results.slice(0, GUIDE_MAX_RESULTS).map((entity) => (
            <li key={entity.id} className="min-w-0">
              <EntityCard entity={entity} />
            </li>
          ))}
        </ul>
      )}
      {results.length === 0 && !page && (
        <p className="font-body text-sm text-off-white/85 mt-2">
          Try fewer words, or see everything close to it.
        </p>
      )}

      <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2">
        <Link href={seeAllHref} className={LINK}>
          See all matches
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
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
