'use client'

import { useState, useTransition } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { saveLocationAction } from '@/lib/actions/dashboard/whereSold'
import {
  LOCATION_TYPE_META,
  VALID_LOCATION_TYPES,
  type LocationType,
} from '@/lib/constants/listing'
import { SERVICE_AREA_MAX } from '@/lib/listings/whereSold'

// How customers find you (owner-experience round 2, part D), at the top of the
// edit page's "Where to find us" tab: storefront, online, comes to you and so
// on, the area served, and shipping nationwide. These were only set when the
// page was made. Saves on its own.

interface Props {
  listingId: string
  initial: { locationType: LocationType; serviceArea: string | null; shipsNationwide: boolean }
}

const HINTS: Record<LocationType, string> = {
  physical: 'Customers come to your address.',
  virtual: 'You work or sell online only.',
  hybrid: 'You have an address and sell online too.',
  service_area: 'You go to your customers.',
  national: 'You ship across the country.',
  traveling: 'Food truck, markets, pop-ups.',
}

export function LocationSection({ listingId, initial }: Props) {
  const [saved, setSaved] = useState({
    locationType: initial.locationType,
    serviceArea: initial.serviceArea ?? '',
    shipsNationwide: initial.shipsNationwide,
  })
  const [values, setValues] = useState(saved)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [isPending, startTransition] = useTransition()
  const dirty =
    values.locationType !== saved.locationType ||
    values.serviceArea.trim() !== saved.serviceArea ||
    values.shipsNationwide !== saved.shipsNationwide

  function update(patch: Partial<typeof values>) {
    setDone(false)
    setValues((prev) => ({ ...prev, ...patch }))
  }

  function save() {
    setError(null)
    setDone(false)
    startTransition(async () => {
      const result = await saveLocationAction({ listingId, ...values })
      if ('error' in result) {
        setError(result.error)
        return
      }
      const next = {
        locationType: result.locationType,
        serviceArea: result.serviceArea ?? '',
        shipsNationwide: result.shipsNationwide,
      }
      setSaved(next)
      setValues(next)
      setDone(true)
    })
  }

  return (
    <section className="rounded-xl border border-charcoal/10 bg-white">
      <div className="px-5 py-4 border-b border-charcoal/8">
        <h2 className="font-headline text-base text-brand-black">How customers find you</h2>
        <p className="font-body text-xs text-charcoal-soft mt-0.5">
          Shown on your page, and used by the “Where” filter on Discover.
        </p>
      </div>
      <form
        className="px-5 py-4 space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <fieldset>
          <legend className="font-subhead text-xs font-semibold text-charcoal-soft mb-2">
            How do you operate?
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {VALID_LOCATION_TYPES.map((t) => {
              const checked = values.locationType === t
              return (
                <label
                  key={t}
                  className={`flex cursor-pointer gap-2.5 rounded-lg border px-3 py-2.5 ${
                    checked
                      ? 'border-brand-black bg-charcoal/5'
                      : 'border-charcoal/15 hover:bg-charcoal/5'
                  }`}
                >
                  <input
                    type="radio"
                    name={`location-type-${listingId}`}
                    value={t}
                    checked={checked}
                    onChange={() => update({ locationType: t })}
                    className="mt-0.5 accent-brand-black"
                  />
                  <span>
                    <span className="block font-subhead text-sm font-semibold text-brand-black">
                      {LOCATION_TYPE_META[t].label}
                    </span>
                    <span className="block font-body text-xs text-charcoal-soft">{HINTS[t]}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>

        <div>
          <label
            htmlFor={`service-area-${listingId}`}
            className="block font-subhead text-xs font-semibold text-charcoal-soft mb-1"
          >
            Area you serve <span className="font-normal text-charcoal-faint">(optional)</span>
          </label>
          <input
            id={`service-area-${listingId}`}
            type="text"
            maxLength={SERVICE_AREA_MAX}
            placeholder="Metro Atlanta, within 30 miles of Decatur"
            value={values.serviceArea}
            onChange={(e) => update({ serviceArea: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-charcoal/20 bg-white font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
          />
        </div>

        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={values.shipsNationwide}
            onChange={(e) => update({ shipsNationwide: e.target.checked })}
            className="mt-0.5 accent-brand-black"
          />
          <span>
            <span className="block font-subhead text-sm font-semibold text-brand-black">
              We ship nationwide
            </span>
            <span className="block font-body text-xs text-charcoal-soft">
              Your page says so, even if you also have a storefront.
            </span>
          </span>
        </label>

        {error && (
          <p role="alert" className="font-body text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isPending || !dirty}
            className="inline-flex items-center gap-1.5 h-10 px-5 rounded-full bg-brand-black text-white font-subhead text-sm font-bold hover:bg-charcoal disabled:opacity-60"
          >
            {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Save
          </button>
          {done && !dirty && (
            <span
              role="status"
              className="inline-flex items-center gap-1 font-body text-sm text-success"
            >
              <Check className="size-4" aria-hidden="true" />
              Saved
            </span>
          )}
        </div>
      </form>
    </section>
  )
}
