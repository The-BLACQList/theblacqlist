'use client'

import { useActionState, useEffect, useState } from 'react'
import { redeemTesterLinkAction } from '@/lib/actions/tester/redeemTesterLink'

const MISSING = 'This link is missing its code. Ask for a new one.'

/**
 * Reads the token from the URL fragment, then wipes the fragment so the token
 * leaves the address bar, history and anything that later reads location. It
 * stays only in this component's state until Start posts it.
 */
export function StartTourButton() {
  const [state, dispatch, pending] = useActionState(redeemTesterLinkAction, null)
  const [token, setToken] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const fromHash = window.location.hash.replace(/^#/, '')
    if (fromHash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
    // Reading location has to wait for the browser, so this is a one-time
    // sync from outside React rather than derived state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(fromHash || null)
    setReady(true)
  }, [])

  if (ready && !token) {
    return (
      <p role="alert" className="font-subhead text-sm text-red-600">
        {MISSING}
      </p>
    )
  }

  const error = state?.error ?? null

  return (
    <form action={dispatch} className="space-y-3">
      <input type="hidden" name="token" value={token ?? ''} />
      {error && (
        <p role="alert" className="font-subhead text-sm text-red-600">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={!ready || pending}
        className="w-full h-11 rounded-full bg-brand-black text-white font-body font-bold text-sm hover:bg-charcoal transition-colors disabled:opacity-50"
      >
        {pending ? 'Starting…' : 'Start'}
      </button>
    </form>
  )
}
