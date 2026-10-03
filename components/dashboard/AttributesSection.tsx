'use client'

import { useActionState, useState } from 'react'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'

import type { FacetGroupData } from '@/lib/listings/facets'
import { updateListingAttributesAction } from '@/lib/actions/dashboard/updateListingAttributes'
import { PlanLimitNote } from '@/components/dashboard/PlanLimitNote'

interface Props {
  listingId: string
  /** Attribute groups applicable to this listing's entity type. */
  groups: FacetGroupData[]
  /** Currently-selected attribute value ids. */
  selectedValueIds: string[]
  /** Plan limit on selected details, or null for no limit (ticket 119). */
  limit: number | null
  showUpgrade: boolean
}

export function AttributesSection({
  listingId,
  groups,
  selectedValueIds,
  limit,
  showUpgrade,
}: Props) {
  const [state, formAction, isPending] = useActionState(updateListingAttributesAction, null)
  const [selected, setSelected] = useState(() => new Set(selectedValueIds))

  if (groups.length === 0) return null

  // Same rule as checkAttributeCount: a listing that already had more than the
  // limit keeps them, and can swap one for another, but cannot add more.
  const ceiling = limit === null ? null : Math.max(limit, selectedValueIds.length)
  const full = ceiling !== null && selected.size >= ceiling

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  return (
    <div className="rounded-xl border border-charcoal/10 bg-white">
      <div className="px-5 py-4 border-b border-charcoal/8">
        <h2 className="font-headline text-base text-brand-black">Attributes &amp; amenities</h2>
        <p className="font-body text-xs text-charcoal-soft mt-0.5">
          Help shoppers find you. These power the filters on Discover.
          {limit !== null && ` ${selected.size} of ${limit} chosen.`}
        </p>
      </div>
      <form action={formAction} className="px-5 py-4 space-y-5">
        <input type="hidden" name="listing_id" value={listingId} />

        {full && (
          <PlanLimitNote showUpgrade={showUpgrade}>
            {`Your plan includes up to ${limit} details customers filter by. Uncheck one to pick another${showUpgrade ? ', or upgrade for more' : ''}.`}
          </PlanLimitNote>
        )}

        {groups.map((group) => (
          <fieldset key={group.id}>
            <legend className="font-subhead text-xs font-semibold text-charcoal uppercase tracking-wide mb-2">
              {group.name}
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              {group.values.map((value) => (
                <label
                  key={value.id}
                  className="flex items-center gap-2 text-sm font-subhead text-charcoal cursor-pointer select-none has-[:disabled]:cursor-not-allowed has-[:disabled]:text-charcoal-faint"
                >
                  <input
                    type="checkbox"
                    name="attr"
                    value={value.id}
                    checked={selected.has(value.id)}
                    disabled={full && !selected.has(value.id)}
                    onChange={(e) => toggle(value.id, e.target.checked)}
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
