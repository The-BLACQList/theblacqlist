'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Link2, Loader2, MapPin, Unlink } from 'lucide-react'
import { linkLocationAction, unlinkLocationAction } from '@/lib/actions/dashboard/locations'

// Multi-location accounts (ticket 110), the owner's side: the pages linked to
// this one, a way to link another, and the numbers for each location and all
// of them together. Links are display only since ticket 238 (Also At).

export interface OwnerLocation {
  id: string
  name: string
  cityName: string
  published: boolean
  views: number
  saves: number
  reviews: number
}

export interface LinkCandidate {
  id: string
  name: string
  cityName: string
}

interface Props {
  primary: OwnerLocation
  linked: OwnerLocation[]
  candidates: LinkCandidate[]
  /** The owner's plan links locations (Premium). */
  covers: boolean
  /** Locations still open to link on this plan. */
  slotsLeft: number
  /** Total the plan links, this page included. */
  total: number
}

const BUTTON =
  'inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-full font-subhead text-sm font-bold disabled:opacity-50'
const CARD = 'rounded-2xl border border-charcoal/10 bg-white p-5'

export function LocationsManager({ primary, linked, candidates, covers, slotsLeft, total }: Props) {
  const router = useRouter()
  const [pick, setPick] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function run(key: string, action: () => Promise<{ success: true } | { error: string }>) {
    setError(null)
    setBusy(key)
    startTransition(async () => {
      const result = await action()
      setBusy(null)
      if ('error' in result) {
        setError(result.error)
        return
      }
      setPick('')
      router.refresh()
    })
  }

  const everyone = [primary, ...linked]
  const sum = (key: 'views' | 'saves' | 'reviews') => everyone.reduce((n, l) => n + l[key], 0)

  return (
    <div className="space-y-6">
      <section className={CARD} aria-labelledby="linked-heading">
        <h2 id="linked-heading" className="font-subhead text-base font-bold text-brand-black">
          Linked Locations
        </h2>
        <p className="font-body text-sm text-charcoal-soft mt-1">
          {covers
            ? `Link up to ${total} locations: this page and ${total - 1} more. Linked pages show each other under Also At.`
            : 'These pages are still linked. Linking more comes with Premium.'}
        </p>

        {linked.length === 0 ? (
          <p className="font-body text-sm text-charcoal mt-4">No linked locations yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-charcoal/10">
            {linked.map((loc) => (
              <li key={loc.id} className="flex items-center gap-3 py-3">
                <MapPin className="size-4 shrink-0 text-amber" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/dashboard/pages/${loc.id}/locations`}
                    className="font-subhead text-sm font-semibold text-brand-black hover:underline underline-offset-2"
                  >
                    {loc.name}
                  </Link>
                  <p className="font-body text-xs text-charcoal-soft">
                    {[loc.cityName, loc.published ? null : 'Not published']
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => run(loc.id, () => unlinkLocationAction({ locationId: loc.id }))}
                  className={`${BUTTON} border border-charcoal/20 bg-white text-charcoal`}
                  aria-label={`Unlink ${loc.name}`}
                >
                  {busy === loc.id ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Unlink className="size-4" aria-hidden="true" />
                  )}
                  Unlink
                </button>
              </li>
            ))}
          </ul>
        )}

        {covers && slotsLeft > 0 && (
          <div className="mt-5 border-t border-charcoal/10 pt-5">
            {candidates.length === 0 ? (
              <p className="font-body text-sm text-charcoal-soft">
                To link another location, first add it as its own business page under My Pages.
              </p>
            ) : (
              <form
                className="flex flex-col sm:flex-row gap-3 sm:items-end"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!pick) return
                  run('link', () => linkLocationAction({ primaryId: primary.id, locationId: pick }))
                }}
              >
                <div className="flex-1">
                  <label
                    htmlFor="link-location"
                    className="block font-subhead text-xs font-semibold text-charcoal-soft mb-1"
                  >
                    Link One of Your Pages ({slotsLeft} Left)
                  </label>
                  <select
                    id="link-location"
                    value={pick}
                    onChange={(e) => setPick(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-charcoal/20 bg-white font-body text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
                  >
                    <option value="">Choose a page</option>
                    {candidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.cityName ? `${c.name} (${c.cityName})` : c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={isPending || !pick}
                  className={`${BUTTON} h-10 bg-brand-black text-white`}
                >
                  {busy === 'link' ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Link2 className="size-4" aria-hidden="true" />
                  )}
                  Link Location
                </button>
              </form>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 font-body text-sm text-red-700">
            {error}
          </p>
        )}
      </section>

      <section className={CARD} aria-labelledby="numbers-heading">
        <h2 id="numbers-heading" className="font-subhead text-base font-bold text-brand-black">
          All Locations
        </h2>
        <p className="font-body text-sm text-charcoal-soft mt-1">
          Totals since each page went live. Open a location for its full analytics.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full font-body text-sm text-charcoal">
            <thead>
              <tr className="text-left text-xs text-charcoal-soft">
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Location
                </th>
                <th scope="col" className="py-2 px-2 font-semibold text-right">
                  Views
                </th>
                <th scope="col" className="py-2 px-2 font-semibold text-right">
                  Saves
                </th>
                <th scope="col" className="py-2 pl-2 font-semibold text-right">
                  Reviews
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal/10">
              {everyone.map((loc) => (
                <tr key={loc.id}>
                  <th scope="row" className="py-2 pr-4 text-left font-normal">
                    <Link
                      href={`/dashboard/pages/${loc.id}/analytics`}
                      className="hover:underline underline-offset-2"
                    >
                      {loc.name}
                    </Link>
                    {loc.cityName && <span className="text-charcoal-soft"> · {loc.cityName}</span>}
                  </th>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {loc.views.toLocaleString()}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {loc.saves.toLocaleString()}
                  </td>
                  <td className="py-2 pl-2 text-right tabular-nums">
                    {loc.reviews.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
            {everyone.length > 1 && (
              <tfoot>
                <tr className="border-t border-charcoal/20 font-semibold text-brand-black">
                  <th scope="row" className="py-2 pr-4 text-left">
                    All Locations
                  </th>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {sum('views').toLocaleString()}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {sum('saves').toLocaleString()}
                  </td>
                  <td className="py-2 pl-2 text-right tabular-nums">
                    {sum('reviews').toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  )
}
