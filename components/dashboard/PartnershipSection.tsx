'use client'

import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'

import { useSaveLabel } from './SaveLabel'
import { updateListingContentAction } from '@/lib/actions/dashboard/updateListingContent'
import { CollectiveSubmit, useSectionSave } from '@/components/listings/finish/ProfileSave'

// The partner switch (ticket 132). One column, worded by type: creators say
// they take brand deals, everyone else says they work with creators. Contact
// stays on the page's own buttons; The BLACQList makes no introductions.

interface Props {
  listingId: string
  entityType: string
  openToPartnerships: boolean
}

const COPY = {
  creator: {
    label: 'Open to brand deals',
    hint: 'Turn this on so businesses looking for creators know you take brand deals. They reach you through the contact details on your page.',
  },
  other: {
    label: 'Open to creator partnerships & sponsorships',
    hint: 'Turn this on so creators looking for partners and sponsors know you are open to it. They reach you through the contact details on your page.',
  },
} as const

export function PartnershipSection({ listingId, entityType, openToPartnerships }: Props) {
  const {
    state,
    pending: isPending,
    collective,
    formProps,
  } = useSectionSave({
    id: 'partnerships',
    label: 'Partnerships',
    action: updateListingContentAction,
  })
  const saveLabel = useSaveLabel()
  const copy = entityType === 'creator' ? COPY.creator : COPY.other

  return (
    <div className="rounded-xl border border-charcoal/10 bg-white">
      <div className="px-5 py-4 border-b border-charcoal/8">
        <h2 className="font-headline text-base text-brand-black">Partnerships</h2>
      </div>
      <form {...formProps} className="px-5 py-4 space-y-4">
        <input type="hidden" name="listing_id" value={listingId} />
        <input type="hidden" name="open_to_partnerships_field" value="1" />
        <div className="flex items-start gap-3">
          <input
            id="partner-switch"
            name="open_to_partnerships"
            type="checkbox"
            role="switch"
            value="true"
            defaultChecked={openToPartnerships}
            aria-describedby="partner-switch-hint"
            className="mt-0.5 size-5 shrink-0 accent-amber-gold"
          />
          <div>
            <label
              htmlFor="partner-switch"
              className="font-subhead text-sm font-semibold text-brand-black"
            >
              {copy.label}
            </label>
            <p id="partner-switch-hint" className="mt-0.5 font-body text-xs text-charcoal-soft">
              {copy.hint}
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
