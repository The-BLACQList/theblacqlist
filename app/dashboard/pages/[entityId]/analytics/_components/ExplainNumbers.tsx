'use client'

import { useRef, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { generateSuggestionAction } from '@/lib/actions/ai/generateSuggestion'
import { writeBlockedReason, type WritingAllowance } from '@/lib/ai/writingHelp'

interface Props {
  listingId: string
  allowance: WritingAllowance
}

type Result =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'shown'; text: string; sample: boolean }
  /** `limit` marks a daily or monthly limit: a grey note, not a red error. */
  | { kind: 'error'; message: string; limit: boolean }

const FAILED = "Couldn't write a summary right now. Try again."

// "Explain my numbers" (ticket 138): a plain-language read on the last 30 days.
// It is a reading of the owner's own data, so there is nothing to use or save.
// It spends from the same allowance as the writing help on Edit content.
export function ExplainNumbers({ listingId, allowance: initialAllowance }: Props) {
  const [allowance, setAllowance] = useState(initialAllowance)
  const [result, setResult] = useState<Result>({ kind: 'idle' })
  const busy = useRef(false)
  const blocked = writeBlockedReason(allowance)

  async function explain() {
    if (busy.current) return
    busy.current = true
    setResult({ kind: 'loading' })
    const form = new FormData()
    form.set('listing_id', listingId)
    form.set('agent_type', 'analytics_explainer')
    try {
      const res = await generateSuggestionAction(null, form)
      if (res && 'success' in res) {
        setAllowance(res.allowance)
        setResult({ kind: 'shown', text: res.suggestion.text, sample: res.suggestion.sample })
      } else if (res && 'error' in res) {
        if (res.allowance) setAllowance(res.allowance)
        setResult({
          kind: 'error',
          message: res.error,
          limit: res.code === 'daily' || res.code === 'monthly',
        })
      } else {
        setResult({ kind: 'error', message: FAILED, limit: false })
      }
    } catch {
      setResult({ kind: 'error', message: FAILED, limit: false })
    } finally {
      busy.current = false
    }
  }

  const left =
    allowance.state === 'ready' && allowance.limit !== null && allowance.left !== null
      ? `${allowance.left} of ${allowance.limit} left this month`
      : null

  return (
    <section
      aria-labelledby="explain-heading"
      className="rounded-xl border border-charcoal/10 bg-white"
    >
      <div className="border-b border-charcoal/8 px-5 py-4">
        <h2 id="explain-heading" className="font-headline text-base text-brand-black">
          What your numbers say
        </h2>
        <p className="mt-0.5 font-body text-xs text-charcoal-soft">
          A plain read on your last 30 days, and one thing to try next.
        </p>
      </div>

      <div className="flex flex-col gap-3 px-5 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={explain}
            disabled={result.kind === 'loading' || blocked !== null}
            aria-describedby={blocked ? 'explain-blocked' : undefined}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-charcoal/20 bg-white px-4 font-subhead text-sm font-semibold text-brand-black transition-colors hover:border-amber-gold disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {result.kind === 'loading' && (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            )}
            {result.kind === 'shown' ? 'Explain again' : 'Explain my numbers'}
          </button>
          {left && <p className="font-body text-xs text-charcoal-faint">{left}</p>}
        </div>

        <div role="status" className="flex flex-col gap-2">
          {blocked && (
            <p id="explain-blocked" className="font-body text-xs text-charcoal-soft">
              {blocked}
            </p>
          )}
          {result.kind === 'loading' && (
            <div aria-label="Writing your summary" className="flex flex-col gap-2">
              <span className="h-3 w-full animate-pulse rounded bg-charcoal/10 motion-reduce:animate-none" />
              <span className="h-3 w-5/6 animate-pulse rounded bg-charcoal/10 motion-reduce:animate-none" />
              <span className="h-3 w-2/3 animate-pulse rounded bg-charcoal/10 motion-reduce:animate-none" />
            </div>
          )}
          {result.kind === 'error' && result.limit && (
            <p className="font-body text-xs text-charcoal-soft">{result.message}</p>
          )}
          {result.kind === 'shown' && (
            <div className="rounded-lg border border-charcoal/10 bg-pale-lavender/30 px-4 py-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-subhead text-xs font-semibold text-charcoal-soft">
                  Just for you. Nothing to apply.
                </span>
                {result.sample && (
                  <span className="rounded-full bg-charcoal/5 px-2 py-0.5 font-subhead text-[11px] font-semibold text-charcoal-soft">
                    Sample text
                  </span>
                )}
              </div>
              <p className="whitespace-pre-line font-body text-sm leading-relaxed text-brand-black">
                {result.text}
              </p>
            </div>
          )}
        </div>

        {result.kind === 'error' && !result.limit && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2"
          >
            <AlertCircle className="size-4 shrink-0 text-red-500" aria-hidden="true" />
            <p className="font-body text-sm text-red-700">{result.message}</p>
          </div>
        )}
      </div>
    </section>
  )
}
