'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Check, Loader2 } from 'lucide-react'

import { subscribeLaunchAction, type SubscribeState } from '@/lib/actions/subscribers/subscribeLaunch'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-amber-gold px-7 font-body text-sm font-bold text-brand-black transition-colors hover:bg-light-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2 focus-visible:ring-offset-deep-bg disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {pending ? 'Adding you…' : 'Notify me'}
    </button>
  )
}

export function ComingSoonForm() {
  const [state, action] = useActionState<SubscribeState, FormData>(subscribeLaunchAction, null)

  const isSuccess = state !== null && 'success' in state && state.success
  const error = state !== null && 'error' in state ? state.error : null

  if (isSuccess) {
    return (
      <div
        role="status"
        className="flex items-center justify-center gap-3 rounded-full border border-amber-gold/40 bg-amber-gold/10 px-6 py-4"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-gold/20">
          <Check className="size-4 text-light-gold" aria-hidden="true" />
        </span>
        <p className="font-subhead text-sm text-cream">
          You&apos;re on the list. We&apos;ll let you know the moment we launch.
        </p>
      </div>
    )
  }

  return (
    <form action={action} noValidate>
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
          aria-invalid={!!error}
          aria-describedby={error ? 'subscribe-error' : undefined}
          className="h-12 w-full rounded-full border border-white/20 bg-white/5 px-5 font-subhead text-sm text-white placeholder:text-pale-lavender/50 focus:border-amber-gold focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
        />
        <SubmitButton />
      </div>
      {error && (
        <p id="subscribe-error" role="alert" className="mt-3 font-subhead text-sm text-light-gold">
          {error}
        </p>
      )}
    </form>
  )
}
