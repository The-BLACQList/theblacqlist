'use client'

import { Suspense, useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

import { signInAction } from '@/lib/actions/auth/signIn'
import { cn } from '@/lib/utils'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={pending ? 'Signing in…' : 'Sign in'}
      className="w-full h-11 rounded-full bg-brand-black text-white font-body font-bold text-sm hover:bg-charcoal transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {pending ? 'Signing in…' : 'Sign in'}
    </button>
  )
}

function SignInContent() {
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? ''
  const error = searchParams.get('error')

  const [state, action] = useActionState(signInAction, null)
  const [showPassword, setShowPassword] = useState(false)

  const generalError =
    state && 'error' in state && (!state.field || state.field === 'general') ? state.error : null
  const emailError = state && 'error' in state && state.field === 'email' ? state.error : null
  const passwordError = state && 'error' in state && state.field === 'password' ? state.error : null

  const callbackError =
    error === 'auth_callback_failed'
      ? 'That verification link has expired or is invalid. Please sign in again.'
      : null

  return (
    <>
      <h1 className="font-headline text-[26px] text-brand-black mb-1">Welcome back</h1>
      <p className="font-subhead text-sm text-charcoal mb-6">Sign in to your BLACQList account.</p>

      {(generalError ?? callbackError) && (
        <div
          role="alert"
          className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm font-subhead text-red-700"
        >
          {generalError ?? callbackError}
        </div>
      )}

      <form action={action} noValidate className="flex flex-col gap-4">
        {/* Preserve next param */}
        {next && <input type="hidden" name="next" value={next} />}

        {/* Email */}
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="font-subhead text-sm font-semibold text-brand-black">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-describedby={emailError ? 'email-error' : undefined}
            aria-invalid={!!emailError}
            className={cn(
              'h-11 rounded-lg border bg-white font-subhead text-sm text-brand-black px-3 placeholder:text-charcoal/40 focus:outline-none focus:ring-2 focus:ring-brand-black/20 focus:border-brand-black',
              emailError ? 'border-red-400' : 'border-charcoal/30'
            )}
            placeholder="you@example.com"
          />
          {emailError && (
            <p id="email-error" role="alert" className="text-xs font-subhead text-red-600 mt-0.5">
              {emailError}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="font-subhead text-sm font-semibold text-brand-black"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-subhead text-charcoal hover:text-brand-black underline underline-offset-2"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              aria-describedby={passwordError ? 'password-error' : undefined}
              aria-invalid={!!passwordError}
              className={cn(
                'w-full h-11 rounded-lg border bg-white font-subhead text-sm text-brand-black px-3 pr-11 placeholder:text-charcoal/40 focus:outline-none focus:ring-2 focus:ring-brand-black/20 focus:border-brand-black',
                passwordError ? 'border-red-400' : 'border-charcoal/30'
              )}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/50 hover:text-charcoal transition-colors"
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {passwordError && (
            <p
              id="password-error"
              role="alert"
              className="text-xs font-subhead text-red-600 mt-0.5"
            >
              {passwordError}
            </p>
          )}
        </div>

        <div className="mt-2">
          <SubmitButton />
        </div>
      </form>

      <p className="text-center text-sm font-subhead text-charcoal mt-6">
        Don&apos;t have an account?{' '}
        <Link
          href={next ? `/sign-up?next=${encodeURIComponent(next)}` : '/sign-up'}
          className="font-semibold text-brand-black hover:underline underline-offset-2"
        >
          Sign up — it&apos;s free
        </Link>
      </p>
    </>
  )
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInContent />
    </Suspense>
  )
}
