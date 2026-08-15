'use client'

import { useActionState, useState } from 'react'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { updateListingContentAction } from '@/lib/actions/dashboard/updateListingContent'

interface Props {
  listingId: string
  description: string | null
}

export function AboutSection({ listingId, description }: Props) {
  const [state, formAction, isPending] = useActionState(updateListingContentAction, null)
  const [chars, setChars] = useState(description?.length ?? 0)

  return (
    <div className="rounded-xl border border-charcoal/10 bg-white">
      <div className="px-5 py-4 border-b border-charcoal/8">
        <h2 className="font-headline text-base text-brand-black">Story</h2>
        <p className="font-body text-xs text-charcoal-soft mt-0.5">
          Tell the community about your business. Who you are, what you do, and why it matters.
        </p>
      </div>
      <form action={formAction} className="px-5 py-4 space-y-4">
        <input type="hidden" name="listing_id" value={listingId} />

        <div>
          <label
            htmlFor="about-description"
            className="block font-subhead text-xs font-semibold text-charcoal-soft mb-1"
          >
            Business description
          </label>
          <textarea
            id="about-description"
            name="description"
            rows={6}
            defaultValue={description ?? ''}
            onChange={(e) => setChars(e.target.value.length)}
            placeholder="Describe your business, its history, and what makes it special…"
            className="w-full px-3 py-2 rounded-lg border border-charcoal/20 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40 resize-none"
          />
          <p className="font-body text-xs text-charcoal-faint text-right mt-0.5">{chars} characters</p>
        </div>

        {state && 'error' in state && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2"
          >
            <AlertCircle className="size-4 text-red-500 shrink-0" aria-hidden="true" />
            <p className="font-body text-sm text-red-700">{state.error}</p>
          </div>
        )}
        {state && 'success' in state && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
            <CheckCircle className="size-4 text-green-600 shrink-0" aria-hidden="true" />
            <p className="font-body text-sm text-green-700">Saved.</p>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-amber-gold text-brand-black font-subhead font-bold text-sm hover:bg-light-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}
