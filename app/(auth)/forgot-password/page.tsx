"use client"

import { Suspense, useActionState } from "react"
import { useFormStatus } from "react-dom"
import Link from "next/link"
import { Loader2, Mail } from "lucide-react"

import { forgotPasswordAction } from "@/lib/actions/auth/forgotPassword"
import { cn } from "@/lib/utils"

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={pending ? "Sending reset link…" : "Send reset link"}
      className="w-full h-11 rounded-full bg-brand-black text-white font-body font-bold text-sm hover:bg-charcoal transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {pending ? "Sending…" : "Send reset link"}
    </button>
  )
}

function ForgotPasswordContent() {
  const [state, action] = useActionState(forgotPasswordAction, null)

  const emailError =
    state && "error" in state && state.field === "email" ? state.error : null
  const generalError =
    state && "error" in state && (!state.field || state.field === "general")
      ? state.error
      : null

  if (state && "success" in state) {
    return (
      <div className="text-center py-4">
        <div className="w-14 h-14 rounded-full bg-amber-gold/10 flex items-center justify-center mx-auto mb-4">
          <Mail className="size-7 text-amber-gold" aria-hidden="true" />
        </div>
        <h1 className="font-headline text-[22px] text-brand-black mb-2">
          Check your inbox
        </h1>
        <p className="font-subhead text-sm text-charcoal leading-relaxed">
          If{" "}
          <span className="font-semibold text-brand-black">{state.email}</span>{" "}
          is registered, we sent a reset link. It expires in 1 hour.
        </p>
        <p className="font-subhead text-sm text-charcoal/60 mt-2">
          Didn&apos;t receive it? Check your spam folder.
        </p>
        <p className="font-subhead text-xs text-charcoal/40 mt-6">
          <Link
            href="/sign-in"
            className="text-brand-black underline underline-offset-2 hover:text-charcoal"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    )
  }

  return (
    <>
      <h1 className="font-headline text-[26px] text-brand-black mb-1">
        Forgot your password?
      </h1>
      <p className="font-subhead text-sm text-charcoal mb-6">
        Enter your email and we&apos;ll send you a reset link.
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
        <div className="flex flex-col gap-1">
          <label
            htmlFor="email"
            className="font-subhead text-sm font-semibold text-brand-black"
          >
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-describedby={emailError ? "email-error" : undefined}
            aria-invalid={!!emailError}
            className={cn(
              "h-11 rounded-lg border bg-white font-subhead text-sm text-brand-black px-3 placeholder:text-charcoal/40 focus:outline-none focus:ring-2 focus:ring-brand-black/20 focus:border-brand-black",
              emailError ? "border-red-400" : "border-charcoal/30"
            )}
            placeholder="you@example.com"
          />
          {emailError && (
            <p
              id="email-error"
              role="alert"
              className="text-xs font-subhead text-red-600 mt-0.5"
            >
              {emailError}
            </p>
          )}
        </div>

        <div className="mt-2">
          <SubmitButton />
        </div>
      </form>

      <p className="text-center text-sm font-subhead text-charcoal mt-6">
        <Link
          href="/sign-in"
          className="font-semibold text-brand-black hover:underline underline-offset-2"
        >
          Back to sign in
        </Link>
      </p>
    </>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordContent />
    </Suspense>
  )
}
