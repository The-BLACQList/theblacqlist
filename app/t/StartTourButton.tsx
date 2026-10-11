'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  redeemTesterLinkAction,
  testerLinkStartAction,
} from '@/lib/actions/tester/redeemTesterLink'

const MISSING = 'This link is missing its code. Ask for a new one.'
const EMAIL_TAKEN_PREFIX = 'That email already has an account.'

type Start = 'email' | 'session' | 'ready'

/**
 * Reads the token from the URL fragment, then wipes the fragment so the token
 * leaves the address bar, history and anything that later reads location. It
 * stays only in this component's state until Start posts it.
 *
 * A link made without an email or a listing asks for one here. Checking whether
 * to ask is read only, so loading the page never spends a use.
 */
export function StartTourButton() {
  const [state, dispatch, pending] = useActionState(redeemTesterLinkAction, null)
  const [token, setToken] = useState<string | null>(null)
  const [start, setStart] = useState<Start | null>(null)
  // Controlled, so the email stays in the box when Start comes back with an error.
  const [typed, setTyped] = useState('')
  // React runs this effect twice in dev. The first run wipes the fragment, so
  // the second would find no code without this.
  const tokenRef = useRef<string | null>(null)

  useEffect(() => {
    const fromHash = window.location.hash.replace(/^#/, '') || tokenRef.current || ''
    tokenRef.current = fromHash || null
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
    // Reading location has to wait for the browser, so this is a one-time
    // sync from outside React rather than derived state.
    setToken(fromHash || null)
    if (!fromHash) {
      setStart('ready')
      return
    }
    let cancelled = false
    testerLinkStartAction(fromHash)
      .then((next) => {
        if (!cancelled) setStart(next)
      })
      .catch(() => {
        // Start asks for the email itself if it is still needed.
        if (!cancelled) setStart('ready')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const ready = start !== null

  if (ready && !token) {
    return (
      <p role="alert" className="font-subhead text-sm text-red-600">
        {MISSING}
      </p>
    )
  }

  const error = state?.error ?? null
  const askEmail = start === 'email' || state?.needEmail === true
  const emailTaken = error?.startsWith(EMAIL_TAKEN_PREFIX) ?? false

  return (
    <form action={dispatch} className="space-y-3">
      <input type="hidden" name="token" value={token ?? ''} />

      {askEmail && (
        <div>
          <label htmlFor="tester-email" className="block font-subhead text-sm font-semibold text-brand-black">
            Your email
          </label>
          <p id="tester-email-hint" className="mt-0.5 font-body text-xs text-charcoal-soft">
            We&rsquo;ll make your account with it. No password needed.
          </p>
          <input
            id="tester-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            aria-describedby={error ? 'tester-email-hint tester-start-error' : 'tester-email-hint'}
            aria-invalid={error && state?.needEmail ? true : undefined}
            className="mt-1.5 w-full h-11 rounded-lg border border-charcoal/20 px-3 font-body text-base text-brand-black placeholder:text-charcoal-faint focus:border-amber-gold focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
            placeholder="you@example.com"
          />
        </div>
      )}

      {start === 'session' && !askEmail && (
        <p className="font-body text-sm text-charcoal-soft">
          You&rsquo;re already signed in, so your tour goes on this account.
        </p>
      )}

      {error && (
        <p id="tester-start-error" role="alert" className="font-subhead text-sm text-red-600">
          {error}
          {emailTaken && (
            <>
              {' '}
              <Link href="/login" className="underline underline-offset-2 hover:text-red-800">
                Sign in
              </Link>
            </>
          )}
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
