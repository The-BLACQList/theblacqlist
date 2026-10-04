'use client'

import Link from 'next/link'
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from 'react'
import { Check, Copy, Loader2, Share2 } from 'lucide-react'

import { subscribeLaunchAction, type SubscribeState } from '@/lib/actions/subscribers/subscribeLaunch'
import { errorTypeFor } from '@/lib/actions/subscribers/subscribeErrors'
import { ANALYTICS_EVENTS } from '@/lib/analytics/constants'
import { track } from '@/lib/analytics/client'
import {
  COMING_SOON_COPY,
  CONFIRMATION_COPY,
  CONSENT_LINE_CURRENT,
  INSTAGRAM_URL,
  ROLE_FIELD_COPY,
} from '@/lib/marketing/coming-soon-copy'
import {
  PRE_LAUNCH_SHARE_URL,
  appendAttribution,
  readBrowserAttribution,
  type SignupRole,
} from '@/lib/marketing/launch-attribution'
import { HoneypotField } from '@/components/security/HoneypotField'
import { TurnstileWidget } from '@/components/security/TurnstileWidget'

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-amber-gold px-7 font-body text-sm font-bold text-brand-black transition-colors hover:bg-light-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2 focus-visible:ring-offset-deep-bg disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {pending ? 'Adding you…' : COMING_SOON_COPY.cta}
    </button>
  )
}

/**
 * Pre-launch R4. Native share sheet where the browser has one, copy-to-clipboard
 * where it does not, and the URL printed for manual copy if both fail. The link
 * carries utm_source=share and utm_campaign=pre-launch.
 */
function ShareButton() {
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  // Only rendered after a submit, in the browser, so reading navigator during
  // render cannot differ from a server render.
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  async function handleClick() {
    track({
      event_name: ANALYTICS_EVENTS.LAUNCH_LIST_SHARE_CLICK,
      properties: { method: canNativeShare ? 'native_share' : 'copy_link' },
    })
    if (canNativeShare) {
      try {
        await navigator.share({ title: COMING_SOON_COPY.name, url: PRE_LAUNCH_SHARE_URL })
      } catch {
        // Dismissing the share sheet rejects; nothing to do.
      }
      return
    }
    try {
      await navigator.clipboard.writeText(PRE_LAUNCH_SHARE_URL)
      setCopied(true)
    } catch {
      setCopyFailed(true)
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        data-testid="launch-list-share"
        className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-amber-gold/60 px-5 font-body text-sm font-semibold text-light-gold transition-colors hover:bg-amber-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2 focus-visible:ring-offset-deep-bg"
      >
        {canNativeShare ? (
          <Share2 className="size-4" aria-hidden="true" />
        ) : copied ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <Copy className="size-4" aria-hidden="true" />
        )}
        {canNativeShare ? 'Share the link' : copied ? 'Link copied' : 'Copy the link'}
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? 'Link copied' : ''}
      </span>
      {copyFailed && (
        <code className="max-w-full select-all break-all rounded-md bg-white/5 px-3 py-2 text-xs text-pale-lavender">
          {PRE_LAUNCH_SHARE_URL}
        </code>
      )}
    </div>
  )
}

const ROLE_OPTIONS = [
  ['owner', ROLE_FIELD_COPY.owner],
  ['supporter', ROLE_FIELD_COPY.supporter],
] as const

export function ComingSoonForm() {
  const [state, dispatch, pending] = useActionState<SubscribeState, FormData>(subscribeLaunchAction, null)
  // Controlled, and submitted through onSubmit rather than <form action>. React
  // 19 calls form.reset() after a form action, which blanks a controlled radio
  // (the e2e spec caught it). onSubmit leaves the form alone, so what was typed
  // and chosen survives a "Please check that email address." error.
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<SignupRole | ''>('')

  const isSuccess = state !== null && 'success' in state && state.success
  const error = state !== null && 'error' in state ? state.error : null

  // coming_soon_view (R6), once per mount. The ref keeps React's dev-mode
  // double effect from counting a view twice.
  const viewTracked = useRef(false)
  useEffect(() => {
    if (viewTracked.current) return
    viewTracked.current = true
    track({
      event_name: ANALYTICS_EVENTS.COMING_SOON_VIEW,
      properties: { ...readBrowserAttribution() },
    })
  }, [])

  // launch_list_submit_error (R6). Keyed on the state object, which is new on
  // every action result, so a repeated identical error is still counted.
  useEffect(() => {
    if (state && 'error' in state) {
      track({
        event_name: ANALYTICS_EVENTS.LAUNCH_LIST_SUBMIT_ERROR,
        properties: { error_type: errorTypeFor(state.error) },
      })
    }
  }, [state])

  // UTM values and the referrer origin ride along on submit (R2), read from the
  // address bar at that moment rather than rendered into hidden inputs. The
  // server re-validates every one of them.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const formData = appendAttribution(new FormData(event.currentTarget), readBrowserAttribution())
    startTransition(() => dispatch(formData))
  }

  if (isSuccess) {
    return (
      <div
        role="status"
        data-testid="launch-list-confirmation"
        className="flex flex-col items-center gap-4 rounded-2xl border border-amber-gold/40 bg-amber-gold/10 px-6 py-6 text-center"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-gold/20">
          <Check className="size-4 text-light-gold" aria-hidden="true" />
        </span>
        <p className="font-headline text-2xl text-white">{CONFIRMATION_COPY.title}</p>
        <p className="font-subhead text-sm text-cream">
          {role === 'owner' ? CONFIRMATION_COPY.ownerBody : CONFIRMATION_COPY.body}
        </p>
        <p className="font-subhead text-sm text-pale-lavender/80">{CONFIRMATION_COPY.share}</p>
        <ShareButton />
        <Link
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            track({
              event_name: ANALYTICS_EVENTS.INSTAGRAM_FOLLOW_CLICK,
              properties: { placement: 'confirmation' },
            })
          }
          className="rounded-sm font-subhead text-sm text-light-gold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold"
        >
          {CONFIRMATION_COPY.follow}
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <HoneypotField />
      <div className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="email" className="sr-only">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? 'subscribe-error' : undefined}
          className="h-12 w-full rounded-full border border-white/20 bg-white/5 px-5 font-subhead text-sm text-white placeholder:text-pale-lavender/50 focus:border-amber-gold focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
        />
        <SubmitButton pending={pending} />
      </div>

      {/* Optional role (R3). Nothing preselected; email alone still submits. */}
      <fieldset className="mt-5">
        <legend className="mx-auto font-subhead text-sm text-pale-lavender/90">{ROLE_FIELD_COPY.legend}</legend>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {ROLE_OPTIONS.map(([value, label]) => (
            <label
              key={value}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/20 px-4 py-2 font-subhead text-sm text-pale-lavender transition-colors has-[:checked]:border-amber-gold has-[:checked]:bg-amber-gold/10 has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-amber-gold"
            >
              <input
                type="radio"
                name="signup_role"
                value={value}
                checked={role === value}
                onChange={() => setRole(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
        <p className="mt-2 font-subhead text-xs text-pale-lavender/60">{ROLE_FIELD_COPY.purpose}</p>
      </fieldset>

      <TurnstileWidget theme="dark" resetKey={state} className="mt-3 flex justify-center" />
      {error && (
        <p id="subscribe-error" role="alert" className="mt-3 font-subhead text-sm text-light-gold">
          {error}
        </p>
      )}

      {/* Consent wording pending Business Operations (R7) */}
      <p className="mt-4 font-subhead text-xs leading-relaxed text-pale-lavender/70">
        {CONSENT_LINE_CURRENT}{' '}
        <Link
          href="/privacy"
          className="rounded-sm underline underline-offset-2 hover:text-light-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold"
        >
          Privacy Policy
        </Link>
      </p>
    </form>
  )
}
