'use client'

import { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createSponsoredPlacement } from '@/lib/actions/admin/createSponsoredPlacement'
import type { CreateSponsoredPlacementState } from '@/lib/actions/admin/createSponsoredPlacement'

interface Props {
  cities: { id: string; name: string }[]
  categories: { id: string; name: string }[]
}

const initial: CreateSponsoredPlacementState = {}

export function SponsoredPlacementForm({ cities, categories }: Props) {
  const router = useRouter()
  const [state, action, pending] = useActionState(createSponsoredPlacement, initial)

  const [listingSearch, setListingSearch] = useState('')
  const [listingResults, setListingResults] = useState<
    { id: string; name: string; slug: string }[]
  >([])
  const [selectedListing, setSelectedListing] = useState<{ id: string; name: string } | null>(null)
  const [searching, setSearching] = useState(false)

  if (state.success) {
    router.push('/admin/sponsored')
  }

  async function handleListingSearch(q: string) {
    setListingSearch(q)
    setSelectedListing(null)
    if (q.trim().length < 2) {
      setListingResults([])
      return
    }
    setSearching(true)
    try {
      const res = await fetch(`/api/admin/listings-search?q=${encodeURIComponent(q)}`)
      const json = await res.json()
      setListingResults(json.listings ?? [])
    } catch {
      setListingResults([])
    } finally {
      setSearching(false)
    }
  }

  return (
    <form action={action} className="space-y-5">
      {/* Listing search */}
      <div>
        <label className="block font-subhead text-xs font-semibold text-charcoal-soft uppercase tracking-wide mb-1.5">
          Listing <span aria-hidden="true">*</span>
        </label>
        {selectedListing ? (
          <div className="flex items-center justify-between rounded-lg border border-charcoal/20 bg-pale-lavender/30 px-4 py-2.5">
            <span className="font-body text-sm text-brand-black">{selectedListing.name}</span>
            <button
              type="button"
              onClick={() => {
                setSelectedListing(null)
                setListingSearch('')
              }}
              className="font-body text-xs text-charcoal-soft hover:text-charcoal underline"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              value={listingSearch}
              onChange={(e) => handleListingSearch(e.target.value)}
              placeholder="Search listings by name…"
              className="w-full rounded-lg border border-charcoal/20 px-4 py-2.5 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
            />
            {listingResults.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full rounded-lg border border-charcoal/10 bg-white shadow-lg overflow-hidden">
                {listingResults.map((l) => (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedListing(l)
                        setListingResults([])
                      }}
                      className="w-full text-left px-4 py-2.5 font-body text-sm text-brand-black hover:bg-pale-lavender/40 transition-colors"
                    >
                      {l.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {searching && <p className="mt-1 font-body text-xs text-charcoal-soft">Searching…</p>}
          </div>
        )}
        <input type="hidden" name="listing_id" value={selectedListing?.id ?? ''} />
      </div>

      {/* City */}
      <div>
        <label
          htmlFor="city_id"
          className="block font-subhead text-xs font-semibold text-charcoal-soft uppercase tracking-wide mb-1.5"
        >
          City{' '}
          <span className="font-normal text-charcoal-faint normal-case">
            (leave blank for all cities)
          </span>
        </label>
        <select
          id="city_id"
          name="city_id"
          className="w-full rounded-lg border border-charcoal/20 px-4 py-2.5 font-body text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-amber-gold/40 bg-white"
        >
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Category */}
      <div>
        <label
          htmlFor="category_id"
          className="block font-subhead text-xs font-semibold text-charcoal-soft uppercase tracking-wide mb-1.5"
        >
          Category{' '}
          <span className="font-normal text-charcoal-faint normal-case">
            (leave blank for all categories)
          </span>
        </label>
        <select
          id="category_id"
          name="category_id"
          className="w-full rounded-lg border border-charcoal/20 px-4 py-2.5 font-body text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-amber-gold/40 bg-white"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Position */}
      <fieldset>
        <legend className="font-subhead text-xs font-semibold text-charcoal-soft uppercase tracking-wide mb-2">
          Position <span aria-hidden="true">*</span>
        </legend>
        <div className="flex gap-3">
          {[1, 2, 3].map((pos) => (
            <label key={pos} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="position"
                value={pos}
                required
                defaultChecked={pos === 1}
                className="accent-amber-gold"
              />
              <span className="font-body text-sm text-brand-black">Position {pos}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Date range */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="starts_at"
            className="block font-subhead text-xs font-semibold text-charcoal-soft uppercase tracking-wide mb-1.5"
          >
            Starts <span aria-hidden="true">*</span>
          </label>
          <input
            id="starts_at"
            type="datetime-local"
            name="starts_at"
            required
            className="w-full rounded-lg border border-charcoal/20 px-4 py-2.5 font-body text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
          />
        </div>
        <div>
          <label
            htmlFor="ends_at"
            className="block font-subhead text-xs font-semibold text-charcoal-soft uppercase tracking-wide mb-1.5"
          >
            Ends <span aria-hidden="true">*</span>
          </label>
          <input
            id="ends_at"
            type="datetime-local"
            name="ends_at"
            required
            className="w-full rounded-lg border border-charcoal/20 px-4 py-2.5 font-body text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
          />
        </div>
      </div>

      {state.error && (
        <p
          role="alert"
          className="font-body text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5"
        >
          {state.error}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={pending || !selectedListing}
          className="h-10 px-6 rounded-full bg-brand-black text-white font-body font-bold text-sm hover:bg-charcoal transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? 'Creating…' : 'Create placement'}
        </button>
        <Link
          href="/admin/sponsored"
          className="h-10 px-6 rounded-full border border-charcoal/20 text-brand-black font-body font-bold text-sm hover:bg-charcoal/5 transition-colors inline-flex items-center"
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}
