'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  redeemTesterLinkAction,
  testerLinkStartAction,
} from '@/lib/actions/tester/redeemTesterLink'
import type { TesterLinkStart } from '@/lib/tester/redeem'

const MISSING = 'This link is missing its code. Ask for a new one.'
const EMAIL_TAKEN_PREFIX = 'That email already has an account.'

const ROLES = [
  {
    value: 'owner',
    label: 'I own a business',
    hint: 'Claim or make your page and try the owner tools.',
  },
  {
    value: 'supporter',
    label: 'I support Black-owned businesses',
    hint: 'Find places, save favorites and leave reviews.',
  },
] as const

/**
 * The card on /t: heading, intro and the Start form.
 *
 * Reads the token from the URL fragment, then wipes the fragment so the token
 * leaves the address bar, history and anything that later reads location. It
 * stays only in this component's state until Start posts it.
 *
 * A link made without an email or a listing asks for one here. A shared link
 * also asks whether the tester owns a business, and says so when the test is
 * full. Checking what to ask is read only, so loading the page never spends a use.
 */
export function StartTourButton() {
  const [state, dispatch, pending] = useActionState(redeemTesterLinkAction, null)
  const [token, setToken] = useState<string | null>(null)
  const [start, setStart] = useState<TesterLinkStart | null>(null)
  // Controlled, so the answers stay put when Start comes back with an error.
  const [typed, setTyped] = useState('')
  const [role, setRole] = useState('')
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
      setStart({ mode: 'ready', askRole: false })
      return
    }
    let cancelled = false
    testerLinkStartAction(fromHash)
      .then((next) => {
        if (!cancelled) setStart(next)
      })
      .catch(() => {
        // Start asks for anything still needed itself.
        if (!cancelled) setStart({ mode: 'ready', askRole: false })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const ready = start !== null
  const full = start?.mode === 'full' || state?.full === true

  if (full) {
    return (
      <>
        <h1 className="font-headline text-[26px] text-brand-black mb-1">This test is full</h1>
        <p role="status" className="font-subhead text-sm text-charcoal mb-6">
          Thanks for wanting to help! All of our tester spots are taken. Join the waitlist and
          we&rsquo;ll let you know when The BLACQList opens.
        </p>
        <Link
          href="/coming-soon"
          className="flex w-full h-11 items-center justify-center rounded-full bg-brand-black text-white font-body font-bold text-sm hover:bg-charcoal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2"
        >
          Join the waitlist
        </Link>
      </>
    )
  }

  const heading = (
    <>
      <h1 className="font-headline text-[26px] text-brand-black mb-1">You&rsquo;re in</h1>
      <p className="font-subhead text-sm text-charcoal mb-6">
        {start?.mode === 'returning'
          ? 'You’re already one of our testers. Tap Start to pick up where you left off.'
          : 'Thanks for testing The BLACQList. Tap Start and we’ll sign you in and open a short tour. No password needed.'}
      </p>
    </>
  )

  if (ready && !token) {
    return (
      <>
        {heading}
        <p role="alert" className="font-subhead text-sm text-red-600">
          {MISSING}
        </p>
      </>
    )
  }

  const error = state?.error ?? null
  const askRole = start?.askRole === true || state?.needRole === true
  const askEmail = start?.mode === 'email' || state?.needEmail === true
  const emailTaken = error?.startsWith(EMAIL_TAKEN_PREFIX) ?? false
  const roleError = error !== null && state?.needRole === true

  return (
    <>
      {heading}
      <form action={dispatch} className="space-y-4">
        <input type="hidden" name="token" value={token ?? ''} />

        {askRole && (
          <fieldset aria-describedby={roleError ? 'tester-start-error' : undefined}>
            <legend className="font-subhead text-sm font-semibold text-brand-black">
              Which fits you best?
            </legend>
            <div className="mt-2 space-y-2">
              {ROLES.map(({ value, label, hint }) => (
                <label
                  key={value}
                  className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-charcoal/15 bg-white px-4 py-3 hover:border-amber-gold/50 has-[:checked]:border-amber-gold has-[:checked]:bg-amber-gold/5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-amber-gold/40"
                >
                  <input
                    type="radio"
                    name="role"
                    value={value}
                    required
                    checked={role === value}
                    onChange={() => setRole(value)}
                    className="mt-1 accent-amber-gold"
                  />
                  <span>
                    <span className="block font-body text-sm font-semibold text-brand-black">
                      {label}
                    </span>
                    <span className="block font-body text-xs text-charcoal-soft">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {askEmail && (
          <div>
            <label
              htmlFor="tester-email"
              className="block font-subhead text-sm font-semibold text-brand-black"
            >
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
              aria-describedby={
                error && !roleError ? 'tester-email-hint tester-start-error' : 'tester-email-hint'
              }
              aria-invalid={error && state?.needEmail && !roleError ? true : undefined}
              className="mt-1.5 w-full h-11 rounded-lg border border-charcoal/20 px-3 font-body text-base text-brand-black placeholder:text-charcoal-faint focus:border-amber-gold focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
              placeholder="you@example.com"
            />
          </div>
        )}

        {start?.mode === 'session' && !askEmail && (
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
    </>
  )
}
