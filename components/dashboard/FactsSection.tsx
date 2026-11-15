'use client'

import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'

import { useSaveLabel } from './SaveLabel'
import { updateListingContentAction } from '@/lib/actions/dashboard/updateListingContent'
import { CollectiveSubmit, useSectionSave } from '@/components/listings/finish/ProfileSave'
import {
  FOUNDED_YEAR_MIN,
  PRICE_RANGES,
  PRICE_RANGE_TITLE,
  isPriceRange,
} from '@/lib/listings/facts'

// The facts line under the business name (ticket 189): "Est. 2014 · $$ ·
// Takes Reservations". Each fact shows only when the owner fills it, so every
// field here can be left blank. Business pages only.

interface Props {
  listingId: string
  foundedYear: number | null
  priceRange: string | null
  acceptsReservations: boolean | null
}

export function FactsSection({ listingId, foundedYear, priceRange, acceptsReservations }: Props) {
  const {
    state,
    pending: isPending,
    collective,
    formProps,
  } = useSectionSave({
    id: 'facts',
    label: 'Quick Facts',
    action: updateListingContentAction,
  })
  const saveLabel = useSaveLabel()
  const thisYear = new Date().getFullYear()
  const price = isPriceRange(priceRange) ? priceRange : ''
  const reservations = acceptsReservations === null ? '' : String(acceptsReservations)

  return (
    <div className="rounded-xl border border-charcoal/10 bg-white">
      <div className="px-5 py-4 border-b border-charcoal/8">
        <h2 className="font-headline text-base text-brand-black">Quick Facts</h2>
        <p className="mt-0.5 font-body text-xs text-charcoal-soft">
          A short line under your name: when you started, your prices, and whether you take
          reservations. Leave any of them blank to hide it.
        </p>
      </div>
      <form {...formProps} className="px-5 py-4 space-y-5">
        <input type="hidden" name="listing_id" value={listingId} />

        <div>
          <label
            htmlFor="facts-founded"
            className="font-subhead text-sm font-semibold text-brand-black"
          >
            Year Founded
          </label>
          <input
            id="facts-founded"
            name="founded_year"
            type="number"
            inputMode="numeric"
            min={FOUNDED_YEAR_MIN}
            max={thisYear}
            step={1}
            placeholder={String(thisYear - 5)}
            defaultValue={foundedYear ?? ''}
            className="mt-1.5 block h-10 w-32 rounded-lg border border-charcoal/20 px-3 font-body text-sm text-brand-black focus:border-amber-gold focus:outline-none focus:ring-2 focus:ring-amber-gold/30"
          />
        </div>

        <fieldset>
          <legend className="font-subhead text-sm font-semibold text-brand-black">
            Price Range
          </legend>
          <div className="mt-1.5 inline-flex flex-wrap rounded-lg border border-charcoal/20 p-0.5">
            {(['', ...PRICE_RANGES] as const).map((value) => (
              <label key={value || 'none'} className="cursor-pointer">
                <input
                  type="radio"
                  name="price_range"
                  value={value}
                  defaultChecked={price === value}
                  className="peer sr-only"
                />
                <span
                  title={value ? PRICE_RANGE_TITLE[value] : 'Hide the Price Range'}
                  className="inline-flex h-8 min-w-11 items-center justify-center rounded-md px-3 font-subhead text-sm font-semibold text-charcoal-soft peer-checked:bg-brand-black peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-amber-gold"
                >
                  {value || 'Not Set'}
                  {value && <span className="sr-only">: {PRICE_RANGE_TITLE[value]}</span>}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="font-subhead text-sm font-semibold text-brand-black">
            Reservations
          </legend>
          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:gap-5">
            {(
              [
                ['', 'Not Set'],
                ['true', 'Takes Reservations'],
                ['false', 'Walk-Ins Only'],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value || 'none'}
                className="inline-flex items-center gap-2 font-body text-sm text-brand-black"
              >
                <input
                  type="radio"
                  name="accepts_reservations"
                  value={value}
                  defaultChecked={reservations === value}
                  className="size-4 accent-amber-gold"
                />
                {label}
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
