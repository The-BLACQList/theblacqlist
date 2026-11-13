'use client'

import { useState, useTransition } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { saveOrderLinksAction } from '@/lib/actions/dashboard/whereSold'
import {
  ORDER_PLATFORMS,
  ORDER_PLATFORM_IDS,
  ORDER_URL_MAX,
  type OrderLink,
  type OrderPlatform,
} from '@/lib/listings/whereSold'

// "Order on" (owner-experience round 2, part D), on the edit page's Services
// tab. One link per delivery platform; the page shows a button for each one
// filled in. Saves on its own, and the links come back from the server as saved.

interface Props {
  listingId: string
  initial: OrderLink[]
}

const INPUT =
  'w-full px-3 py-2 rounded-lg border border-charcoal/20 bg-white font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40'

function toValues(links: OrderLink[]): Record<OrderPlatform, string> {
  const out = { doordash: '', grubhub: '', instacart: '', ubereats: '' }
  for (const l of links) out[l.platform] = l.url
  return out
}

export function OrderPlatformsSection({ listingId, initial }: Props) {
  const [saved, setSaved] = useState(() => toValues(initial))
  const [values, setValues] = useState(saved)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [isPending, startTransition] = useTransition()
  const dirty = ORDER_PLATFORM_IDS.some((p) => values[p].trim() !== saved[p])

  function save() {
    setError(null)
    setDone(false)
    startTransition(async () => {
      const result = await saveOrderLinksAction({ listingId, links: values })
      if ('error' in result) {
        setError(result.error)
        return
      }
      const next = toValues(result.links)
      setSaved(next)
      setValues(next)
      setDone(true)
    })
  }

  return (
    <section className="rounded-xl border border-charcoal/10 bg-white">
      <div className="px-5 py-4 border-b border-charcoal/8">
        <h2 className="font-headline text-base text-brand-black">Order on</h2>
        <p className="font-body text-xs text-charcoal-soft mt-0.5">
          On a delivery app? Paste the link to your store and your page shows an “Order on” button
          for it.
        </p>
      </div>
      <form
        className="px-5 py-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        {ORDER_PLATFORM_IDS.map((p) => {
          const meta = ORDER_PLATFORMS[p]
          const id = `order-on-${p}`
          return (
            <div key={p}>
              <label
                htmlFor={id}
                className="block font-subhead text-xs font-semibold text-charcoal-soft mb-1"
              >
                {meta.label}
              </label>
              <input
                id={id}
                type="url"
                inputMode="url"
                autoComplete="off"
                maxLength={ORDER_URL_MAX}
                placeholder={meta.example}
                value={values[p]}
                onChange={(e) => {
                  const v = e.target.value
                  setDone(false)
                  setValues((prev) => ({ ...prev, [p]: v }))
                }}
                className={INPUT}
              />
            </div>
          )
        })}
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
            Save links
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
