'use client'

// Search + facet controls for the admin entity queue.
//
// ⚠ One component, not the two the plan named (`EntitySearchInput` plus a
// separate selects bar). The reason is a real constraint, not a preference: the
// text input holds its own draft in `useState`, and "Clear filters" has to blank
// that draft. Split across two components, Clear would change the URL and the
// input would have to re-sync from its prop inside an effect —
// `react-hooks/set-state-in-effect` is an ERROR in this repo, and the remount
// alternative (`key={q}`) drops focus on every keystroke. Co-locating the
// controls removes the sync entirely.

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'

import { ENTITY_TYPES, LOCATION_TYPES } from '@/components/discovery/facetConstants'
import { MIN_ADMIN_QUERY_LENGTH, sanitizeAdminQuery } from '@/lib/admin/entitySearch'

/** Matches components/spend/ListingCombobox.tsx:48 — one typeahead convention. */
const DEBOUNCE_MS = 250

interface Props {
  /** The query the server actually ran, already sanitised. */
  query: string
  entityType: string
  locationType: string
  /** Whether the URL names a status the founder chose, vs. the derived default. */
  status: string
}

export function EntityQueueControls({ query, entityType, locationType, status }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [draft, setDraft] = useState(query)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // A pending keystroke must not fire after the founder has navigated away.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  function navigate(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString())
    mutate(params)
    // Any filter change invalidates the offset — page 7 of the old result set is
    // usually empty in the new one. Same rule as useFacetParams.ts:18.
    params.delete('page')
    const qs = params.toString()
    // `replace`, not `push`: typing "consulting" would otherwise leave ten
    // history entries between the founder and the Back button.
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  function commitQuery(next: string) {
    const clean = sanitizeAdminQuery(next)
    if (clean === query) return
    // One character is noise, not a search — wait for the second before hitting
    // the database. Zero characters is a real intent: it clears the search.
    if (clean.length > 0 && clean.length < MIN_ADMIN_QUERY_LENGTH) return

    navigate((params) => {
      if (clean) {
        params.set('q', clean)
        // ⚠ Deliberate: searching from the DEFAULT queue widens to all statuses.
        // "I need to find it quickly" is the ask, and a search that hides the
        // answer because the listing happens to be archived is worse than no
        // search. An explicitly chosen tab (Published / Rejected / All) is a
        // decision the founder made and is left alone.
        if (params.get('status') === 'pending') params.delete('status')
      } else {
        params.delete('q')
      }
    })
  }

  function onChange(value: string) {
    setDraft(value)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => commitQuery(value), DEBOUNCE_MS)
  }

  function clearAll() {
    if (timer.current) clearTimeout(timer.current)
    setDraft('')
    router.replace(pathname)
  }

  const hasFilters = Boolean(query || entityType || locationType || status !== 'pending')

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1 min-w-[16rem] flex-1">
        <label
          htmlFor="admin-entity-search"
          className="font-subhead text-xs text-charcoal-soft"
        >
          Search
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-charcoal-soft"
            aria-hidden="true"
          />
          <input
            id="admin-entity-search"
            type="search"
            value={draft}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              if (timer.current) clearTimeout(timer.current)
              commitQuery(draft)
            }}
            placeholder="Name or tagline…"
            autoComplete="off"
            className="h-9 w-full rounded-lg border border-charcoal/20 bg-white pl-9 pr-3 font-body text-sm text-brand-black placeholder:text-charcoal-soft focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="admin-entity-type" className="font-subhead text-xs text-charcoal-soft">
          Type
        </label>
        <select
          id="admin-entity-type"
          value={entityType}
          onChange={(e) =>
            navigate((params) => {
              if (e.target.value) params.set('type', e.target.value)
              else params.delete('type')
            })
          }
          className="h-9 rounded-lg border border-charcoal/20 bg-white px-3 font-body text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
        >
          <option value="">All types</option>
          {ENTITY_TYPES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="admin-entity-location" className="font-subhead text-xs text-charcoal-soft">
          Location type
        </label>
        <select
          id="admin-entity-location"
          value={locationType}
          onChange={(e) =>
            navigate((params) => {
              if (e.target.value) params.set('location_type', e.target.value)
              else params.delete('location_type')
            })
          }
          className="h-9 rounded-lg border border-charcoal/20 bg-white px-3 font-body text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
        >
          <option value="">All location types</option>
          {LOCATION_TYPES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {hasFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="mb-1 inline-flex items-center gap-1 font-body text-xs text-charcoal-soft underline underline-offset-2 transition-colors hover:text-brand-black"
        >
          <X className="size-3" aria-hidden="true" />
          Clear filters
        </button>
      )}
    </div>
  )
}
