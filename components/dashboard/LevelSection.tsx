'use client'

import { useState } from 'react'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'

import { useSaveLabel } from './SaveLabel'
import { LEVEL_META, type BusinessLevel } from '@/lib/listings/levels'
import { updateListingLevelsAction } from '@/lib/actions/dashboard/updateListingLevels'
import { CollectiveSubmit, useSectionSave } from '@/components/listings/finish/ProfileSave'

// "Your role": the main level plus extras (docs/blacqlist/product/business-levels-2026-10.md).
// Hidden when the category allows one level, so most owners never see it.
// Not part of the plan's attribute limit.

interface Props {
  listingId: string
  primary: BusinessLevel
  extras: BusinessLevel[]
  /** The levels the listing's category allows, in canonical order. */
  allowed: BusinessLevel[]
}

export function LevelSection({ listingId, primary, extras, allowed }: Props) {
  const {
    state,
    pending: isPending,
    collective,
    formProps,
  } = useSectionSave({
    id: 'role',
    label: 'Your role',
    action: updateListingLevelsAction,
  })
  const saveLabel = useSaveLabel()
  const [main, setMain] = useState<BusinessLevel>(primary)
  const [also, setAlso] = useState(() => new Set(extras.filter((e) => e !== primary)))

  if (allowed.length < 2) return null

  function pickMain(level: BusinessLevel) {
    setMain(level)
    // The main role is never also an extra.
    setAlso((prev) => {
      const next = new Set(prev)
      next.delete(level)
      return next
    })
  }

  function toggleExtra(level: BusinessLevel, checked: boolean) {
    setAlso((prev) => {
      const next = new Set(prev)
      if (checked) next.add(level)
      else next.delete(level)
      return next
    })
  }

  const extraChoices = allowed.filter((l) => l !== main)

  return (
    <div className="rounded-xl border border-charcoal/10 bg-white">
      <div className="px-5 py-4 border-b border-charcoal/8">
        <h2 className="font-headline text-base text-brand-black">Your role</h2>
        <p className="font-body text-xs text-charcoal-soft mt-0.5">
          Shoppers can filter by grower, maker, supplier or local business.
        </p>
      </div>
      <form {...formProps} className="px-5 py-4 space-y-5">
        <input type="hidden" name="listing_id" value={listingId} />

        <fieldset>
          <legend className="font-subhead text-xs font-semibold text-charcoal uppercase tracking-wide mb-2">
            Main role
          </legend>
          <div className="flex flex-col gap-2">
            {allowed.map((level) => (
              <label
                key={level}
                className="flex items-start gap-2 text-sm font-subhead text-charcoal cursor-pointer select-none"
              >
                <input
                  type="radio"
                  name="primary_level"
                  value={level}
                  checked={main === level}
                  onChange={() => pickMain(level)}
                  className="mt-0.5 border-charcoal/30 text-brand-black focus:ring-amber-gold/40"
                />
                <span>
                  {LEVEL_META[level].label}
                  <span className="block font-body text-xs text-charcoal-soft">
                    {LEVEL_META[level].description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="font-subhead text-xs font-semibold text-charcoal uppercase tracking-wide mb-2">
            Also
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
            {extraChoices.map((level) => (
              <label
                key={level}
                className="flex items-center gap-2 text-sm font-subhead text-charcoal cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  name="extra_level"
                  value={level}
                  checked={also.has(level)}
                  onChange={(e) => toggleExtra(level, e.target.checked)}
                  className="rounded border-charcoal/30 text-brand-black focus:ring-amber-gold/40"
                />
                {LEVEL_META[level].label}
              </label>
            ))}
          </div>
        </fieldset>

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
