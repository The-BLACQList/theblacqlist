'use client'

// One click from the free-month card to Stripe Checkout (tester-tour-spec.md
// §4.3). All the hard guarantees live server-side in /api/tour/claim — the
// tier guard, the compare-and-set, the idempotency key, release-on-failure.
// This button just POSTs the tier and follows the URL. On a tier whose
// checkout is already open the route hands back the same session, so
// `resume` only changes the label, never the call.

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { TesterTrialTier } from '@/lib/tour/trial'

const GENERIC_ERROR = 'Couldn’t start your free month just now. Try again in a moment.'

interface Props {
  plan: TesterTrialTier
  /** e.g. "Use it on Starter" or "Resume checkout". */
  label: string
  /** The page to put the month on, only for an owner tester whose
   *  enrollment has no listing yet. The route checks it is theirs. */
  listingId?: string
}

export function ClaimTrialButton({ plan, label, listingId }: Props) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function claim() {
    setPending(true)
    setError(null)
    try {
      const res = await fetch('/api/tour/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(listingId ? { plan, listingId } : { plan }),
      })
      const body = (await res.json().catch(() => null)) as
        | { data?: { url?: string }; error?: string }
        | null
      if (res.ok && body?.data?.url) {
        // Keep the button pending through navigation — resetting it while the
        // browser leaves would flash an actionable button nobody should click.
        window.location.assign(body.data.url)
        return
      }
      setError(typeof body?.error === 'string' ? body.error : GENERIC_ERROR)
      setPending(false)
    } catch {
      setError(GENERIC_ERROR)
      setPending(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void claim()}
        disabled={pending}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-amber-gold px-5 font-body text-sm font-bold text-brand-black transition-colors hover:bg-light-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {pending ? 'Opening checkout…' : label}
      </button>
      {error && (
        <p role="alert" className="mt-2 font-body text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
