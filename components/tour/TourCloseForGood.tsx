'use client'

// "Close the tour for good", shown only once the walk is finished
// (founder, 2026-10-12: testers who finish should be able to close the panel
// and just enjoy the site).
//
// The choice is saved on the tester's account by closeTourRailAction, so the
// panel stays gone on every device. Nothing hides until the server says it
// saved: a panel that vanished and came back on the next page would be worse
// than a button that asks them to try again.

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'

import { closeTourRailAction } from '@/lib/actions/tour/closeTourRail'

export function TourCloseForGood({
  kind,
  onClosed,
}: {
  kind: 'supporter' | 'owner'
  onClosed: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function close() {
    setError(null)
    startTransition(async () => {
      const result = await closeTourRailAction().catch(() => null)
      if (result?.ok) {
        // The panel unmounts with focus inside it, which would drop a keyboard
        // or screen reader user at the top of <body>. Hand focus to the page.
        const main = document.getElementById('main-content')
        if (main !== null) {
          if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1')
          main.focus({ preventScroll: true })
        }
        onClosed()
        return
      }
      setError(result?.error ?? 'Couldn’t close the tour just now. Try again in a moment.')
    })
  }

  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <button
        type="button"
        onClick={close}
        disabled={pending}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-cream/30 px-5 py-2 font-subhead text-sm font-bold text-cream transition-colors hover:border-cream/60 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {pending ? 'Closing…' : 'Close the tour for good'}
      </button>
      <p className="mt-2 font-subhead text-xs text-cream/60">
        {kind === 'owner'
          ? 'It stays closed on every device. Your free month stays on your Upgrade page.'
          : 'It stays closed on every device.'}
      </p>
      {error !== null && (
        <p role="alert" className="mt-2 font-subhead text-sm text-cream">
          {error}
        </p>
      )}
    </div>
  )
}
