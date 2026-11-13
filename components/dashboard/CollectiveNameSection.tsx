'use client'

import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'

import { useSaveLabel } from './SaveLabel'
import { updateListingContentAction } from '@/lib/actions/dashboard/updateListingContent'
import { CollectiveSubmit, useSectionSave } from '@/components/listings/finish/ProfileSave'

// Naming in The Collective (tickets 166, 183). After a receipt is counted, the
// shopper can share a line of text that may include what they spent. That text
// names this business only if this is on; off, it says "a local business" and
// links to The Collective map. The owner decides; it's off until they turn it on.
// Support posts (ticket 183) always name the business and never show an amount.
// `[Decision — founder, 2026-11-13]`
// [Needs professional review] owner-facing description of what shoppers share.

interface Props {
  listingId: string
  optedIn: boolean
}

export function CollectiveNameSection({ listingId, optedIn }: Props) {
  const {
    state,
    pending: isPending,
    collective,
    formProps,
  } = useSectionSave({
    id: 'collective-name',
    label: 'Shopper posts',
    action: updateListingContentAction,
  })
  const saveLabel = useSaveLabel()

  return (
    <div className="rounded-xl border border-charcoal/10 bg-white">
      <div className="px-5 py-4 border-b border-charcoal/8">
        <h2 className="font-headline text-base text-brand-black">Shopper posts</h2>
      </div>
      <form {...formProps} className="px-5 py-4 space-y-4">
        <input type="hidden" name="listing_id" value={listingId} />
        <input type="hidden" name="collective_name_opt_in_field" value="1" />
        <div className="flex items-start gap-3">
          <input
            id="collective-name-switch"
            name="collective_name_opt_in"
            type="checkbox"
            role="switch"
            value="true"
            defaultChecked={optedIn}
            aria-describedby="collective-name-hint"
            className="mt-0.5 size-5 shrink-0 accent-amber-gold"
          />
          <div>
            <label
              htmlFor="collective-name-switch"
              className="font-subhead text-sm font-semibold text-brand-black"
            >
              Name my business when shoppers share what they spent
            </label>
            <p id="collective-name-hint" className="mt-0.5 font-body text-xs text-charcoal-soft">
              After a receipt is counted, a shopper can share that they shopped with you, and can
              choose to include what they spent. On, that share shows your name and links to your
              page. Off, it says &ldquo;a local business&rdquo; instead. Support posts always name
              your business and never show a receipt or an amount.
            </p>
          </div>
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
        {!collective && state && 'success' in state && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
            <CheckCircle className="size-4 text-green-600 shrink-0" aria-hidden="true" />
            <p className="font-body text-sm text-green-700">Saved.</p>
          </div>
        )}

        {collective ? (
          <CollectiveSubmit />
        ) : (
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-amber-gold text-brand-black font-subhead font-bold text-sm hover:bg-light-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {isPending ? 'Saving…' : saveLabel}
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
