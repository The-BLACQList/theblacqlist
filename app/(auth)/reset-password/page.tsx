"use client"

import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"
import Link from "next/link"
import { Eye, EyeOff, Loader2 } from "lucide-react"

import { resetPasswordAction } from "@/lib/actions/auth/resetPassword"
import { cn } from "@/lib/utils"

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={pending ? "Saving new password…" : "Set new password"}
      className="w-full h-11 rounded-full bg-brand-black text-white font-body font-bold text-sm hover:bg-charcoal transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {pending ? "Saving…" : "Set new password"}
    </button>
  )
}

export default function ResetPasswordPage() {
  const [state, action] = useActionState(resetPasswordAction, null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const generalError =
    state && "error" in state && (!state.field || state.field === "general")
      ? state.error
      : null
  const passwordError =
    state && "error" in state && state.field === "password" ? state.error : null
  const confirmError =
    state && "error" in state && state.field === "confirmPassword"
      ? state.error
      : null

  return (
    <>
      <h1 className="font-headline text-[26px] text-brand-black mb-1">
        Set a new password
      </h1>
      <p className="font-subhead text-sm text-charcoal mb-6">
        Choose a strong password for your account.
      </p>

      {generalError && (
        <div
          role="alert"
          className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm font-subhead text-red-700"
        >
          {generalError}{" "}
          {generalError.includes("expired") && (
            <Link
              href="/forgot-password"
              className="underline underline-offset-2 font-semibold"
            >
              Request a new link
            </Link>
          )}
        </div>
      )}

      <form action={action} noValidate className="flex flex-col gap-4">
        {/* New password */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="password"
            className="font-subhead text-sm font-semibold text-brand-black"
          >
            New password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
              aria-describedby={cn(
                "password-hint",
                passwordError ? "password-error" : undefined
              )}
              aria-invalid={!!passwordError}
              className={cn(
                "w-full h-11 rounded-lg border bg-white font-subhead text-sm text-brand-black px-3 pr-11 placeholder:text-charcoal/40 focus:outline-none focus:ring-2 focus:ring-brand-black/20 focus:border-brand-black",
                passwordError ? "border-red-400" : "border-charcoal/30"
              )}
              placeholder="Min. 8 characters"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/50 hover:text-charcoal transition-colors"
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
          <p id="password-hint" className="text-xs font-subhead text-charcoal/50">
            Must be at least 8 characters.
          </p>
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

        {/* Confirm password */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="confirmPassword"
            className="font-subhead text-sm font-semibold text-brand-black"
          >
            Confirm new password
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              required
              aria-describedby={confirmError ? "confirm-error" : undefined}
              aria-invalid={!!confirmError}
              className={cn(
                "w-full h-11 rounded-lg border bg-white font-subhead text-sm text-brand-black px-3 pr-11 placeholder:text-charcoal/40 focus:outline-none focus:ring-2 focus:ring-brand-black/20 focus:border-brand-black",
                confirmError ? "border-red-400" : "border-charcoal/30"
              )}
              placeholder="Re-enter your password"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={showConfirm ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/50 hover:text-charcoal transition-colors"
            >
              {showConfirm ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {confirmError && (
            <p
              id="confirm-error"
              role="alert"
              className="text-xs font-subhead text-red-600 mt-0.5"
            >
              {confirmError}
            </p>
          )}
        </div>

        <div className="mt-2">
          <SubmitButton />
        </div>
      </form>
    </>
  )
}
