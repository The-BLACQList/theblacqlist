'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { POLL_INTERVAL_MS, POLL_MAX_TICKS } from '@/lib/jobs/confirmation'

/**
 * Shown when the poster is back from Stripe before the webhook has moved the
 * role to review. Re-checks the page every 5 seconds for up to 30 seconds; when
 * the server renders a different state this component is simply gone.
 */
export function PaymentPending() {
  const router = useRouter()
  const [ticks, setTicks] = useState(0)
  const gaveUp = ticks >= POLL_MAX_TICKS

  useEffect(() => {
    if (gaveUp) return
    const id = window.setTimeout(() => {
      setTicks((t) => t + 1)
      router.refresh()
    }, POLL_INTERVAL_MS)
    return () => window.clearTimeout(id)
  }, [ticks, gaveUp, router])

  return (
    <div aria-live="polite" className="font-subhead text-sm text-charcoal leading-relaxed">
      {gaveUp ? (
        <p>Payment is taking longer than usual. Your dashboard will update when it clears.</p>
      ) : (
        <p>This usually takes a few seconds. This page updates by itself.</p>
      )}
      <p className="mt-3">
        <button type="button" onClick={() => router.refresh()} className="inline-flex min-h-11 items-center font-semibold underline">
          Refresh now
        </button>
      </p>
    </div>
  )
}
