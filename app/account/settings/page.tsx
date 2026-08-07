'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Loader2, CheckCircle } from 'lucide-react'

import { updateProfileAction } from '@/lib/actions/account/updateProfile'
import { cn } from '@/lib/utils'
import { DeleteAccountSection } from './DeleteAccountSection'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={pending ? 'Saving changes…' : 'Save changes'}
      className="h-11 px-6 rounded-full bg-brand-black text-white font-body font-bold text-sm hover:bg-charcoal transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {pending ? 'Saving…' : 'Save changes'}
    </button>
  )
}

export default function AccountSettingsPage() {
  const [state, action] = useActionState(updateProfileAction, null)

  const isSuccess = state && 'success' in state && state.success

  const getFieldError = (field: string) =>
    state && 'fieldErrors' in state && state.fieldErrors && field in state.fieldErrors
      ? state.fieldErrors[field as keyof typeof state.fieldErrors]
      : null

  const generalError =
    state && 'error' in state && !('fieldErrors' in state && state.fieldErrors) ? state.error : null

  return (
    <main>
      <div className="max-w-[640px] mx-auto">

        <h1 className="font-headline text-3xl text-brand-black mb-6">Account settings</h1>

        {isSuccess && (
          <div
            role="status"
            className="flex items-center gap-2 mb-6 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm font-subhead text-green-700"
          >
            <CheckCircle className="size-4 shrink-0" aria-hidden="true" />
            Your profile has been updated.
          </div>
        )}

        {generalError && (
          <div
            role="alert"
            className="mb-6 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-subhead text-red-700"
          >
            {generalError}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-charcoal/10 p-6">
          <form action={action} noValidate className="flex flex-col gap-5">
            {/* Display name */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="display_name"
                className="font-subhead text-sm font-semibold text-brand-black"
              >
                Display name
              </label>
              <input
                id="display_name"
                name="display_name"
                type="text"
                autoComplete="name"
                maxLength={100}
                aria-describedby={getFieldError('display_name') ? 'display_name-error' : undefined}
                aria-invalid={!!getFieldError('display_name')}
                className={cn(
                  'h-11 rounded-lg border bg-white font-subhead text-sm text-brand-black px-3 placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-brand-black/20 focus:border-brand-black',
                  getFieldError('display_name') ? 'border-red-400' : 'border-charcoal/30'
                )}
                placeholder="Your name"
              />
              {getFieldError('display_name') && (
                <p
                  id="display_name-error"
                  role="alert"
                  className="text-xs font-subhead text-red-600 mt-0.5"
                >
                  {getFieldError('display_name')}
                </p>
              )}
            </div>

            {/* Bio */}
            <div className="flex flex-col gap-1">
              <label htmlFor="bio" className="font-subhead text-sm font-semibold text-brand-black">
                Bio
              </label>
              <textarea
                id="bio"
                name="bio"
                rows={3}
                maxLength={500}
                aria-describedby={cn('bio-hint', getFieldError('bio') ? 'bio-error' : undefined)}
                aria-invalid={!!getFieldError('bio')}
                className={cn(
                  'rounded-lg border bg-white font-subhead text-sm text-brand-black px-3 py-2.5 placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-brand-black/20 focus:border-brand-black resize-none',
                  getFieldError('bio') ? 'border-red-400' : 'border-charcoal/30'
                )}
                placeholder="A little about you…"
              />
              <p id="bio-hint" className="text-xs font-subhead text-charcoal-soft">
                Max 500 characters.
              </p>
              {getFieldError('bio') && (
                <p id="bio-error" role="alert" className="text-xs font-subhead text-red-600 mt-0.5">
                  {getFieldError('bio')}
                </p>
              )}
            </div>

            {/* Website URL */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="website_url"
                className="font-subhead text-sm font-semibold text-brand-black"
              >
                Website URL
              </label>
              <input
                id="website_url"
                name="website_url"
                type="url"
                autoComplete="url"
                aria-describedby={getFieldError('website_url') ? 'website_url-error' : undefined}
                aria-invalid={!!getFieldError('website_url')}
                className={cn(
                  'h-11 rounded-lg border bg-white font-subhead text-sm text-brand-black px-3 placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-brand-black/20 focus:border-brand-black',
                  getFieldError('website_url') ? 'border-red-400' : 'border-charcoal/30'
                )}
                placeholder="https://yourwebsite.com"
              />
              {getFieldError('website_url') && (
                <p
                  id="website_url-error"
                  role="alert"
                  className="text-xs font-subhead text-red-600 mt-0.5"
                >
                  {getFieldError('website_url')}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end pt-2">
              <SubmitButton />
            </div>
          </form>
        </div>

        {/* Danger zone */}
        <DeleteAccountSection />
      </div>
    </main>
  )
}
