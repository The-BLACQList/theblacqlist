'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Loader2, TriangleAlert } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { deleteAccountAction } from '@/lib/actions/account/deleteAccount'

function ConfirmDeleteButton({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={!enabled || pending}
      className="h-11 px-5 rounded-full bg-red-600 text-white font-body font-bold text-sm hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {pending ? 'Deleting…' : 'Permanently delete account'}
    </button>
  )
}

export function DeleteAccountSection() {
  const [state, action] = useActionState(deleteAccountAction, null)
  const [confirmText, setConfirmText] = useState('')
  const canDelete = confirmText.trim() === 'DELETE'

  return (
    <section className="mt-8 bg-white rounded-2xl border border-red-200 p-6">
      <div className="flex items-start gap-3">
        <TriangleAlert className="size-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <h2 className="font-headline text-lg text-brand-black">Delete account</h2>
          <p className="font-body text-sm text-charcoal-soft mt-1">
            Permanently delete your account and personal data. This cannot be undone.
          </p>
        </div>
      </div>

      <div className="mt-5">
        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              className="h-10 px-5 rounded-full border border-red-300 text-red-700 font-subhead font-bold text-sm hover:bg-red-50 transition-colors"
            >
              Delete my account…
            </button>
          </DialogTrigger>

          <DialogContent>
            <div className="p-6">
              <DialogHeader>
                <DialogTitle>Delete your account?</DialogTitle>
                <DialogDescription>This is permanent and cannot be undone.</DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-4 font-body text-sm text-charcoal leading-relaxed">
                <div>
                  <p className="font-subhead font-semibold text-brand-black mb-1">
                    What we delete:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-charcoal-soft">
                    <li>Your account and sign-in</li>
                    <li>Your saved businesses and reviews</li>
                    <li>Your receipts and personal spend records</li>
                  </ul>
                </div>
                <div>
                  <p className="font-subhead font-semibold text-brand-black mb-1">
                    What stays:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-charcoal-soft">
                    <li>Businesses you listed remain in the directory as unclaimed</li>
                    <li>Anonymous community spend totals already counted</li>
                  </ul>
                </div>
              </div>

              <form action={action} className="mt-5 space-y-3">
                <label
                  htmlFor="confirm-delete"
                  className="block font-subhead text-sm font-semibold text-brand-black"
                >
                  Type <span className="font-mono text-red-700">DELETE</span> to confirm
                </label>
                <input
                  id="confirm-delete"
                  name="confirm"
                  type="text"
                  autoComplete="off"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  aria-invalid={Boolean(state?.error)}
                  aria-describedby={state?.error ? 'delete-error' : undefined}
                  className="w-full h-11 rounded-lg border border-charcoal/30 bg-white font-body text-sm text-brand-black px-3 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
                  placeholder="DELETE"
                />

                {state?.error && (
                  <p id="delete-error" role="alert" className="text-xs font-subhead text-red-600">
                    {state.error}
                  </p>
                )}

                <div className="flex justify-end pt-1">
                  <ConfirmDeleteButton enabled={canDelete} />
                </div>
              </form>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  )
}
