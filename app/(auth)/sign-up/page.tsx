'use client'

import { Suspense, useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Loader2, Mail } from 'lucide-react'

import { signUpAction } from '@/lib/actions/auth/signUp'
import { TurnstileWidget } from '@/components/security/TurnstileWidget'
import { cn } from '@/lib/utils'

const ROLE_OPTIONS = [
  {
    value: 'supporter',
    dbRole: 'supporter',
    label: "I'm here to discover",
    description: 'Find and support Black-owned businesses',
  },
  {
    value: 'owner',
    dbRole: 'owner',
    label: 'I have a business',
    description: 'Claim or create your BLACQList Page',
  },
  {
    value: 'vendor',
    dbRole: 'owner',
    label: "I'm a vendor or seller",
    description: 'List your products and services',
  },
  {
    value: 'event_organizer',
    dbRole: 'owner',
    label: 'I organize events',
    description: 'Promote your events to the community',
  },
  {
    value: 'job_poster',
    dbRole: 'owner',
    label: "I'm hiring / posting jobs",
    description: 'Connect with Black talent',
  },
  {
    value: 'sponsor',
    dbRole: 'owner',
    label: "I'm interested in sponsoring",
    description: 'Partner with The BLACQList',
  },
] as const

type RoleValue = (typeof ROLE_OPTIONS)[number]['value']

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={pending ? 'Creating your account…' : 'Create account'}
      className="w-full h-11 rounded-full bg-brand-black text-white font-body font-bold text-sm hover:bg-charcoal transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {pending ? 'Creating your account…' : 'Create account'}
    </button>
  )
}

function SignUpContent() {
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? ''

  const [state, action] = useActionState(signUpAction, null)
  const [showPassword, setShowPassword] = useState(false)
  const [selectedRole, setSelectedRole] = useState<RoleValue>('supporter')

  const isSuccess = state && 'success' in state && state.success

  const getFieldError = (field: string) =>
    state && 'error' in state && state.field === field ? state.error : null

  const generalError =
    state && 'error' in state && (!state.field || state.field === 'general') ? state.error : null

  const dbRole = ROLE_OPTIONS.find((r) => r.value === selectedRole)?.dbRole ?? 'supporter'

  if (isSuccess) {
    return (
      <div className="text-center py-4">
        <div className="w-14 h-14 rounded-full bg-amber-gold/10 flex items-center justify-center mx-auto mb-4">
          <Mail className="size-7 text-amber" aria-hidden="true" />
        </div>
        <h1 className="font-headline text-[22px] text-brand-black mb-2">Check your inbox</h1>
        <p className="font-subhead text-sm text-charcoal leading-relaxed">
          We sent a verification link to{' '}
          <span className="font-semibold text-brand-black">
            {'email' in state ? state.email : 'your email'}
          </span>
          .
        </p>
        <p className="font-subhead text-sm text-charcoal-soft mt-2">
          Didn&apos;t receive it? Check your spam folder.
        </p>
        <p className="font-subhead text-xs text-charcoal-faint mt-6">
          Already verified?{' '}
          <Link
            href={next ? `/sign-in?next=${encodeURIComponent(next)}` : '/sign-in'}
            className="text-brand-black underline underline-offset-2 hover:text-charcoal"
          >
            Sign in
          </Link>
        </p>
      </div>
    )
  }

  return (
    <>
      <h1 className="font-headline text-[26px] text-brand-black mb-1">Create your account</h1>
      <p className="font-subhead text-sm text-charcoal mb-6">
        Join The BLACQList — it&apos;s free.
      </p>

      {generalError && (
        <div
          role="alert"
          className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm font-subhead text-red-700"
        >
          {generalError}
        </div>
      )}

      <form action={action} noValidate className="flex flex-col gap-4">
        {next && <input type="hidden" name="next" value={next} />}
        <input type="hidden" name="role" value={dbRole} />
        <input type="hidden" name="onboardingIntent" value={selectedRole} />

        {/* Display name */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="displayName"
            className="font-subhead text-sm font-semibold text-brand-black"
          >
            Display name <span aria-hidden="true">*</span>
          </label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            autoComplete="name"
            required
            maxLength={100}
            aria-describedby={getFieldError('displayName') ? 'displayName-error' : undefined}
            aria-invalid={!!getFieldError('displayName')}
            className={cn(
              'h-11 rounded-lg border bg-white font-subhead text-sm text-brand-black px-3 placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-brand-black/20 focus:border-brand-black',
              getFieldError('displayName') ? 'border-red-400' : 'border-charcoal/30'
            )}
            placeholder="Your name"
          />
          {getFieldError('displayName') && (
            <p
              id="displayName-error"
              role="alert"
              className="text-xs font-subhead text-red-600 mt-0.5"
            >
              {getFieldError('displayName')}
            </p>
          )}
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="font-subhead text-sm font-semibold text-brand-black">
            Email address <span aria-hidden="true">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-describedby={getFieldError('email') ? 'email-error' : undefined}
            aria-invalid={!!getFieldError('email')}
            className={cn(
              'h-11 rounded-lg border bg-white font-subhead text-sm text-brand-black px-3 placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-brand-black/20 focus:border-brand-black',
              getFieldError('email') ? 'border-red-400' : 'border-charcoal/30'
            )}
            placeholder="you@example.com"
          />
          {getFieldError('email') && (
            <p id="email-error" role="alert" className="text-xs font-subhead text-red-600 mt-0.5">
              {getFieldError('email')}{' '}
              {getFieldError('email')?.includes('already registered') && (
                <Link
                  href={next ? `/sign-in?next=${encodeURIComponent(next)}` : '/sign-in'}
                  className="underline underline-offset-2"
                >
                  Sign in instead
                </Link>
              )}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="font-subhead text-sm font-semibold text-brand-black">
            Password <span aria-hidden="true">*</span>
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={8}
              aria-describedby={cn(
                'password-hint',
                getFieldError('password') ? 'password-error' : undefined
              )}
              aria-invalid={!!getFieldError('password')}
              className={cn(
                'w-full h-11 rounded-lg border bg-white font-subhead text-sm text-brand-black px-3 pr-11 placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-brand-black/20 focus:border-brand-black',
                getFieldError('password') ? 'border-red-400' : 'border-charcoal/30'
              )}
              placeholder="Min. 8 characters"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-soft hover:text-charcoal transition-colors"
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
          <p id="password-hint" className="text-xs font-subhead text-charcoal-soft">
            Must be at least 8 characters.
          </p>
          {getFieldError('password') && (
            <p
              id="password-error"
              role="alert"
              className="text-xs font-subhead text-red-600 mt-0.5"
            >
              {getFieldError('password')}
            </p>
          )}
        </div>

        {/* Role selector */}
        <fieldset className="mt-1">
          <legend className="font-subhead text-sm font-semibold text-brand-black mb-2">
            I am joining as: <span aria-hidden="true">*</span>
          </legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ROLE_OPTIONS.map((option) => {
              const isSelected = selectedRole === option.value
              return (
                <label
                  key={option.value}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors',
                    isSelected
                      ? 'border-brand-black bg-pale-lavender'
                      : 'border-charcoal/20 hover:border-charcoal/40'
                  )}
                >
                  <input
                    type="radio"
                    name="_roleSelection"
                    value={option.value}
                    checked={isSelected}
                    onChange={() => setSelectedRole(option.value)}
                    className="mt-0.5 accent-brand-black shrink-0"
                  />
                  <span className="flex flex-col min-w-0">
                    <span className="font-subhead text-sm font-semibold text-brand-black leading-snug">
                      {option.label}
                    </span>
                    <span className="font-subhead text-xs text-charcoal-soft leading-snug mt-0.5">
                      {option.description}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>

        {/* Terms */}
        <p className="text-xs font-subhead text-charcoal-soft mt-1 leading-relaxed">
          By creating an account you agree to our{' '}
          <Link
            href="/terms"
            className="text-charcoal underline underline-offset-2 hover:text-brand-black"
          >
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link
            href="/privacy"
            className="text-charcoal underline underline-offset-2 hover:text-brand-black"
          >
            Privacy Policy
          </Link>
          .
        </p>

        <TurnstileWidget className="mt-1" />

        <div className="mt-1">
          <SubmitButton />
        </div>
      </form>

      <p className="text-center text-sm font-subhead text-charcoal mt-6">
        Already have an account?{' '}
        <Link
          href={next ? `/sign-in?next=${encodeURIComponent(next)}` : '/sign-in'}
          className="font-semibold text-brand-black hover:underline underline-offset-2"
        >
          Sign in
        </Link>
      </p>
    </>
  )
}

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpContent />
    </Suspense>
  )
}
