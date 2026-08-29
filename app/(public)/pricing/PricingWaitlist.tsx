'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Check, Loader2 } from 'lucide-react'

import { subscribeLaunchAction, type SubscribeState } from '@/lib/actions/subscribers/subscribeLaunch'

// One shared waitlist below the plan grid rather than a form inside each
// disabled card: four cards in a lg:grid-cols-4 row cannot each carry an email
// input without collapsing at narrow widths, and three copies of the same form
// on one page means three sets of duplicate element IDs.
//
// The `source` values must match the allowlist in
// lib/actions/subscribers/subscribeLaunch.ts — anything else is silently
// recorded as a plain coming-soon signup, which would under-count demand for
// whichever tier the founder is deciding whether to build next.

export interface WaitlistOption {
  value: string
  label: string
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-brand-black px-7 font-body text-sm font-bold text-white transition-colors hover:bg-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-black focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {pending ? 'Adding you…' : 'Join the waitlist'}
    </button>
  )
}

export function PricingWaitlist({ options }: { options: WaitlistOption[] }) {
  const [state, action] = useActionState<SubscribeState, FormData>(subscribeLaunchAction, null)
  const [source, setSource] = useState(options[0]?.value ?? '')

  // Nothing left to wait for — every tier and add-on shipped. The section
  // removes itself rather than becoming a form with no subject.
  const first = options[0]
  if (!first) return null

  const isSuccess = state !== null && 'success' in state && state.success
  const error = state !== null && 'error' in state ? state.error : null

  return (
    <div id="pricing-waitlist" className="mt-8 max-w-2xl scroll-mt-24">
      {isSuccess ? (
        <div
          role="status"
          className="flex items-center gap-3 rounded-xl border border-amber-gold/50 bg-amber-gold/10 px-6 py-4"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-gold/25">
            <Check className="size-4 text-amber" aria-hidden="true" />
          </span>
          <p className="font-subhead text-sm text-brand-black">
            You&apos;re on the list. We&apos;ll email you the day it opens.
          </p>
        </div>
      ) : (
        <form action={action} noValidate>
          {options.length > 1 ? (
            <fieldset className="mb-5">
              <legend className="font-subhead text-sm font-semibold text-brand-black mb-3">
                What are you waiting on?
              </legend>
              <div className="flex flex-wrap gap-x-6 gap-y-3">
                {options.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex cursor-pointer items-center gap-2 font-subhead text-sm text-charcoal"
                  >
                    <input
                      type="radio"
                      name="source"
                      value={opt.value}
                      checked={source === opt.value}
                      onChange={() => setSource(opt.value)}
                      className="size-4 accent-amber-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <input type="hidden" name="source" value={first.value} />
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <label htmlFor="waitlist-email" className="sr-only">
              Email address
            </label>
            <input
              id="waitlist-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              aria-invalid={!!error}
              aria-describedby={error ? 'waitlist-error' : undefined}
              className="h-12 w-full rounded-full border border-charcoal/25 bg-white px-5 font-subhead text-sm text-brand-black placeholder:text-charcoal-faint focus:border-amber-gold focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
            />
            <SubmitButton />
          </div>

          {error && (
            <p id="waitlist-error" role="alert" className="mt-3 font-subhead text-sm text-amber">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  )
}
