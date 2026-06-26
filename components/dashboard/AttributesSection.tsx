'use client'

import { useActionState } from 'react'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'

import type { FacetGroupData } from '@/lib/listings/facets'
import { updateListingAttributesAction } from '@/lib/actions/dashboard/updateListingAttributes'

interface Props {
  listingId: string
  /** Attribute groups applicable to this listing's entity type. */
  groups: FacetGroupData[]
  /** Currently-selected attribute value ids. */
  selectedValueIds: string[]
}

export function AttributesSection({ listingId, groups, selectedValueIds }: Props) {
  const [state, formAction, isPending] = useActionState(updateListingAttributesAction, null)
  const selected = new Set(selectedValueIds)

  if (groups.length === 0) return null

  return (
    <div className="rounded-xl border border-charcoal/10 bg-white">
      <div className="px-5 py-4 border-b border-charcoal/8">
        <h2 className="font-headline text-base text-brand-black">Attributes &amp; amenities</h2>
        <p className="font-body text-xs text-charcoal-soft mt-0.5">
          Help shoppers find you. These power the filters on Discover.
        </p>
      </div>
      <form action={formAction} className="px-5 py-4 space-y-5">
        <input type="hidden" name="listing_id" value={listingId} />

        {groups.map((group) => (
          <fieldset key={group.id}>
            <legend className="font-subhead text-xs font-semibold text-charcoal uppercase tracking-wide mb-2">
              {group.name}
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              {group.values.map((value) => (
                <label
                  key={value.id}
                  className="flex items-center gap-2 text-sm font-subhead text-charcoal cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    name="attr"
                    value={value.id}
                    defaultChecked={selected.has(value.id)}
                    className="rounded border-charcoal/30 text-brand-black focus:ring-amber-gold/40"
                  />
                  {value.name}
                </label>
              ))}
            </div>
          </fieldset>
        ))}

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
