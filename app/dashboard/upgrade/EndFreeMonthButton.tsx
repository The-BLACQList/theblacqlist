'use client'

// End the plan when the free month ends, or keep it (ticket 136). Ending asks
// once before it calls the route, since it stops the page's plan; keeping
// needs no confirm. The page reloads after, so the card reads Stripe again.

import { useState } from 'react'
import { Loader2 } from 'lucide-react'

const GENERIC_ERROR = 'Couldn’t change your plan just now. Try again in a moment.'

interface Props {
  cancelling: boolean
  /** The plan the page goes back to, e.g. "Starter". */
  returnTierName: string | null
}

export function EndFreeMonthButton({ cancelling, returnTierName }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const plan = returnTierName ?? 'your plan'

  async function send(cancel: boolean) {
    setPending(true)
    setError(null)
    try {
      const res = await fetch('/api/tour/upgrade/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancel }),
      })
      if (res.ok) {
        window.location.reload()
        return
      }
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      setError(typeof body?.error === 'string' ? body.error : GENERIC_ERROR)
    } catch {
      setError(GENERIC_ERROR)
    }
    setPending(false)
  }

  const secondary =
    'inline-flex h-11 items-center justify-center gap-2 rounded-full border border-charcoal/20 bg-white px-5 font-body text-sm font-bold text-brand-black transition-colors hover:border-charcoal/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60'

  return (
    <div className="mt-4">
      {cancelling ? (
        <button
          type="button"
          onClick={() => void send(false)}
          disabled={pending}
          className={secondary}
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {`Keep ${plan} after the free month`}
        </button>
      ) : confirming ? (
        <div className="space-y-3">
          <p className="max-w-xl font-body text-sm text-brand-black">
            {`Your page goes back to the Free plan when the free month ends, and you won’t be charged for ${plan}. You can change your mind until then.`}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void send(true)}
              disabled={pending}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-red-700 px-5 font-body text-sm font-bold text-white transition-colors hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              End my plan then
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className={secondary}
            >
              Never mind
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className={secondary}>
          End my plan when the free month ends
        </button>
      )}
      {error && (
        <p role="alert" className="mt-2 font-body text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
