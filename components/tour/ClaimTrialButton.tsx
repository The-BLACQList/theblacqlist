'use client'

// One click from a completed tour to Stripe Checkout (tester-tour-spec.md
// §4.3). All the hard guarantees live server-side in /api/tour/claim — the
// compare-and-set, the idempotency key, release-on-failure. This button just
// POSTs and follows the URL; on a resumable claim the route hands back the
// same open session, so `claimed` only changes the label, never the call.

import { useState } from 'react'
import { Loader2 } from 'lucide-react'

const GENERIC_ERROR = 'Couldn’t start your trial just now. Try again in a moment.'

export function ClaimTrialButton({ claimed }: { claimed: boolean }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function claim() {
    setPending(true)
    setError(null)
    try {
      const res = await fetch('/api/tour/claim', { method: 'POST' })
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
    <div className="mt-3">
      <button
        type="button"
        onClick={() => void claim()}
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-amber-gold px-5 py-2.5 font-subhead text-sm font-bold text-brand-black transition-colors hover:bg-light-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2 focus-visible:ring-offset-deep-bg disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {pending
          ? 'Opening checkout…'
          : claimed
            ? 'Resume trial checkout'
            : 'Claim your 30-day trial'}
      </button>
      {error && (
        <p role="alert" className="mt-2 font-subhead text-sm text-light-gold">
          {error}
        </p>
      )}
    </div>
  )
}
