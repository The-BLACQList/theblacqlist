'use client'

import { useEffect, useRef } from 'react'
import Script from 'next/script'

// Cloudflare Turnstile widget.
//
// Renders nothing when NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset — same
// degrade-not-break posture as lib/security/turnstile.ts, so local dev and CI
// keep working without a Cloudflare credential.
//
// The widget injects a hidden input named `cf-turnstile-response` into the
// surrounding <form>, so any form submitted via a normal `action={formAction}`
// carries the token with no extra wiring. All five call sites submit that way,
// so none of them touch `onToken` today — it exists for a future form that
// builds FormData by hand and has to append the token itself.
//
// A token is single-use. Once a submit has carried it to the server (Supabase
// Auth or siteverify) it is spent, whether or not the action succeeded. A form
// that fails validation server-side and stays mounted still holds that spent
// token in its hidden input, so the person's retry is rejected as "Verification
// failed" until they reload. `resetKey` is the fix: pass the action state, and
// every time it changes (each settled submit) the widget is reset and issues a
// fresh token for the next attempt.

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      remove: (id: string) => void
      reset: (id?: string) => void
    }
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

interface Props {
  /** Called with the solved token, and with null when it expires or errors. */
  onToken?: (token: string | null) => void
  /** 'auto' follows the page; the auth pages are light. */
  theme?: 'auto' | 'light' | 'dark'
  className?: string
  /**
   * Changes whenever a submit settles (pass the `useActionState` state). Each
   * change resets the widget so the next submit carries an unspent token.
   */
  resetKey?: unknown
}

export function TurnstileWidget({ onToken, theme = 'light', className, resetKey }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  // Held in a ref so re-renders of the parent never re-run the render effect
  // (re-rendering the widget would discard an already-solved token).
  const onTokenRef = useRef(onToken)
  // Kept fresh in an effect rather than during render — a ref write during
  // render is a React violation (react-hooks/refs).
  useEffect(() => {
    onTokenRef.current = onToken
  })

  // Reset on every change of resetKey after mount. The previous value lives in
  // a ref (not effect deps alone) so StrictMode's double-invoke on mount does
  // not reset a widget that has not been submitted yet.
  const prevResetKeyRef = useRef(resetKey)
  useEffect(() => {
    if (Object.is(prevResetKeyRef.current, resetKey)) return
    prevResetKeyRef.current = resetKey
    const id = widgetIdRef.current
    if (id === null || !window.turnstile) return
    try {
      window.turnstile.reset(id)
    } catch {
      // Widget not rendered yet or already removed; the next render issues a
      // fresh token anyway.
    }
  }, [resetKey])

  useEffect(() => {
    if (!SITE_KEY) return

    let cancelled = false

    function tryRender() {
      if (cancelled || widgetIdRef.current !== null) return
      const el = containerRef.current
      if (!el || !window.turnstile || !SITE_KEY) return
      widgetIdRef.current = window.turnstile.render(el, {
        sitekey: SITE_KEY,
        theme,
        callback: (token: string) => onTokenRef.current?.(token),
        'expired-callback': () => onTokenRef.current?.(null),
        'error-callback': () => onTokenRef.current?.(null),
      })
    }

    // The script may already be cached from a previous navigation, in which
    // case onReady never fires again — poll briefly instead of relying on it.
    tryRender()
    const interval = window.setInterval(tryRender, 200)
    const stop = window.setTimeout(() => window.clearInterval(interval), 10_000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.clearTimeout(stop)
      const id = widgetIdRef.current
      widgetIdRef.current = null
      if (id !== null) {
        try {
          window.turnstile?.remove(id)
        } catch {
          // Widget already torn down with the DOM node; nothing to clean up.
        }
      }
    }
  }, [theme])

  if (!SITE_KEY) return null

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="lazyOnload"
      />
      <div ref={containerRef} className={className} />
    </>
  )
}
