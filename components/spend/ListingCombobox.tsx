'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Check, Loader2, X } from 'lucide-react'

import type { ListingSearchResult } from '@/app/api/listings/search/route'

/**
 * Business-name field for receipt entry, with a typeahead over published
 * listings.
 *
 * Why this exists: `createReceiptSubmission` has always read a `listing_id`
 * from the form, and the form has never sent one — so every receipt in the
 * database has `listing_id = null`, and the community-spend aggregates that
 * join through it (top cities, top categories) cannot populate. Binding the
 * receipt to a real listing at entry time is what unblocks them.
 *
 * Two rules the design turns on:
 *   * Selecting a listing LOCKS the field into a chip. There is no way to edit
 *     the text while an ID is attached, so "the typed name disagrees with the
 *     attached listing" is structurally impossible rather than something a
 *     clear-on-retype handler has to catch.
 *   * Free text with no match still submits. The action accepts either a name
 *     or a listing, and a business that isn't on the platform yet is a real
 *     case — never force a match.
 */

/** The fields the chip actually renders — `slug` is never read here. */
type SelectedListing = Pick<ListingSearchResult, 'id' | 'name' | 'cityName'>

interface Props {
  id: string
  /** Pre-filled name, e.g. when re-rendering after a validation error. */
  defaultName?: string
  /**
   * Start in the locked-chip state against an already-attached listing. The
   * edit form needs this: rendering a bound receipt as loose text would drop
   * its `listing_id` on the next save, and a receipt with no listing never
   * reaches the community-spend breakdowns. The user can still clear it.
   */
  defaultSelected?: SelectedListing | null
  describedBy?: string
  invalid?: boolean
  className: string
}

const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 250

export function ListingCombobox({
  id,
  defaultName = '',
  defaultSelected = null,
  describedBy,
  invalid,
  className,
}: Props) {
  const [query, setQuery] = useState(defaultSelected?.name ?? defaultName)
  const [selected, setSelected] = useState<SelectedListing | null>(defaultSelected)
  const [results, setResults] = useState<ListingSearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [highlight, setHighlight] = useState(-1)

  const listboxId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounce + abort. The admin typeahead this is modelled on does neither, so
  // it fires a request per keystroke and a slow early response can overwrite a
  // fast later one.
  useEffect(() => {
    if (selected) return
    const trimmed = query.trim()
    // Below the threshold there is nothing to fetch, and the results were
    // already cleared by the change handler — clearing them here instead would
    // be a synchronous setState inside an effect.
    if (trimmed.length < MIN_QUERY_LENGTH) return

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/listings/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        })
        if (!res.ok) {
          setResults([])
          return
        }
        const json: { data?: { listings?: ListingSearchResult[] } } = await res.json()
        setResults(json.data?.listings ?? [])
        setHighlight(-1)
        setOpen(true)
      } catch {
        // An abort is the expected path on every keystroke — nothing to report.
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [query, selected])

  function onQueryChange(value: string) {
    setQuery(value)
    if (value.trim().length < MIN_QUERY_LENGTH) {
      setResults([])
      setOpen(false)
      setHighlight(-1)
      setLoading(false)
    }
  }

  function select(listing: ListingSearchResult) {
    setSelected(listing)
    setQuery(listing.name)
    setResults([])
    setOpen(false)
    setHighlight(-1)
  }

  function clearSelection() {
    setSelected(null)
    setQuery('')
    setResults([])
    setOpen(false)
    setHighlight(-1)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false)
      setHighlight(-1)
      return
    }
    if (e.key === 'Tab') {
      setOpen(false)
      return
    }
    if (!open || results.length === 0) {
      if (e.key === 'ArrowDown' && results.length > 0) {
        e.preventDefault()
        setOpen(true)
        setHighlight(0)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => (h + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => (h <= 0 ? results.length - 1 : h - 1))
    } else if (e.key === 'Enter') {
      const choice = results[highlight]
      if (choice) {
        // Only swallow Enter when it is actually picking an option — otherwise
        // it must still submit the form.
        e.preventDefault()
        select(choice)
      }
    }
  }

  if (selected) {
    return (
      <div>
        {/* Both are sent: the ID drives the aggregates, and the name is what a
            receipt still reads as if the listing is later removed
            (receipt_uploads.listing_id is ON DELETE SET NULL). */}
        <input type="hidden" name="listing_id" value={selected.id} />
        <input type="hidden" name="raw_business_name" value={selected.name} />

        <div className="flex items-center justify-between gap-3 rounded-lg border border-charcoal/20 bg-pale-lavender/30 px-3 py-2.5">
          <span className="flex min-w-0 items-center gap-2">
            <Check className="size-4 flex-shrink-0 text-amber-gold" aria-hidden="true" />
            <span className="truncate font-body text-sm text-brand-black">
              {selected.name}
              {selected.cityName && (
                <span className="text-charcoal-soft"> · {selected.cityName}</span>
              )}
            </span>
          </span>
          <button
            type="button"
            onClick={clearSelection}
            className="flex size-11 flex-shrink-0 items-center justify-center rounded-md text-charcoal-soft hover:text-brand-black focus:outline-none focus:ring-2 focus:ring-amber-gold/60"
          >
            <X className="size-4" aria-hidden="true" />
            <span className="sr-only">Clear {selected.name}</span>
          </button>
        </div>
        <p className="mt-1 font-body text-xs text-charcoal-soft">
          Linked. This receipt counts toward community totals for this business.
        </p>
      </div>
    )
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        name="raw_business_name"
        type="text"
        role="combobox"
        autoComplete="off"
        maxLength={200}
        placeholder="e.g. The Brown Sugar Bakery"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-expanded={open && results.length > 0}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        aria-activedescendant={
          open && highlight >= 0 ? `${listboxId}-option-${highlight}` : undefined
        }
        className={className}
      />

      {loading && (
        <Loader2
          className="absolute right-3 top-3.5 size-4 animate-spin text-charcoal-soft"
          aria-hidden="true"
        />
      )}

      <ul
        id={listboxId}
        role="listbox"
        aria-label="Matching businesses"
        className={
          open && results.length > 0
            ? 'absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-charcoal/20 bg-white py-1 shadow-lg'
            : 'hidden'
        }
      >
        {results.map((listing, i) => (
          // A listbox option must not contain a nested interactive element —
          // the li itself is the option, activated on mousedown so the choice
          // registers before the input's blur closes the list.
          <li
            key={listing.id}
            id={`${listboxId}-option-${i}`}
            role="option"
            aria-selected={i === highlight}
            onMouseDown={(e) => {
              e.preventDefault()
              select(listing)
            }}
            onMouseEnter={() => setHighlight(i)}
            className={`flex min-h-11 cursor-pointer flex-col justify-center px-3 py-2 font-body text-sm ${
              i === highlight ? 'bg-pale-lavender/50 text-brand-black' : 'text-brand-black'
            }`}
          >
            <span className="font-medium">{listing.name}</span>
            {listing.cityName && (
              <span className="text-xs text-charcoal-soft">{listing.cityName}</span>
            )}
          </li>
        ))}
      </ul>

      <p aria-live="polite" role="status" className="sr-only">
        {open && results.length > 0
          ? `${results.length} ${results.length === 1 ? 'business' : 'businesses'} found. Use arrow keys to review.`
          : ''}
      </p>
    </div>
  )
}
