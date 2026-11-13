import { MapPin, Store } from 'lucide-react'
import type { Stockist } from '@/lib/listings/whereSold'

// "Find us at" (owner-experience round 2, part D): the stores that carry this
// business's products, in the owner's order, each with the cities and zips it
// covers or "Nationwide". A long list of places folds behind "Show all".

interface Props {
  stockists: readonly Stockist[] | undefined
}

/** Places shown before the rest fold away. */
const AREAS_SHOWN = 8

export function EntityFindUsAt({ stockists }: Props) {
  if (!stockists || stockists.length === 0) return null

  return (
    <section
      id="find-us"
      aria-labelledby="find-us-heading"
      className="scroll-mt-32 bg-white py-12 md:py-16"
    >
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8">
        <h2
          id="find-us-heading"
          className="font-headline text-[22px] md:text-[28px] text-brand-black mb-6"
        >
          Find us at
        </h2>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {stockists.map((s) => {
            const areas = [...s.cities, ...s.zips]
            const shown = areas.slice(0, AREAS_SHOWN)
            const rest = areas.slice(AREAS_SHOWN)
            return (
              <li
                key={s.id}
                className="flex items-start gap-3 rounded-xl border border-charcoal/10 bg-white p-5"
              >
                <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-charcoal/5 text-charcoal">
                  <Store className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-subhead text-base font-semibold text-brand-black break-words">
                    {s.name}
                  </h3>
                  <p className="mt-1 flex items-start gap-1.5 font-body text-sm text-charcoal">
                    <MapPin
                      className="mt-0.5 size-3.5 shrink-0 text-charcoal-soft"
                      aria-hidden="true"
                    />
                    <span className="break-words">
                      {s.nationwide ? 'Nationwide' : shown.join(' · ')}
                    </span>
                  </p>
                  {!s.nationwide && rest.length > 0 && (
                    <details className="mt-1 font-body text-sm text-charcoal">
                      <summary className="cursor-pointer text-charcoal-soft hover:text-brand-black">
                        Show all {areas.length} places
                      </summary>
                      <p className="mt-1 break-words">{rest.join(' · ')}</p>
                    </details>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
