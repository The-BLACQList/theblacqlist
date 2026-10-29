'use client'

import { useState, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import type { Route } from 'next'
import { Search } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface SearchBarProps {
  placeholder?: string
  /** Destination path when the form is submitted. Defaults to /search. */
  targetPath?: string
  /** Names the search landmark when a page has more than one. */
  formLabel?: string
  /** Id of a visible label outside the bar; replaces the hidden one. */
  labelledBy?: string
  /** On a dark photo: a gold focus outline the dark can show. */
  onDark?: boolean
}

export function SearchBar({
  placeholder = 'Search businesses, categories, or cities…',
  targetPath = '/search',
  formLabel,
  labelledBy,
  onDark = false,
}: SearchBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [query, setQuery] = useState(searchParams.get('q') ?? '')

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const params = new URLSearchParams(searchParams.toString())
      const trimmed = query.trim()
      if (trimmed) {
        params.set('q', trimmed)
      } else {
        params.delete('q')
      }
      // Navigate to targetPath preserving other filter params, or stay on
      // the current page if it's already the target path.
      // Staying on the same page keeps the scroll position, like the filters
      // do; arriving from another page starts at the top as usual.
      const samePage = pathname === targetPath
      const dest = samePage ? pathname : targetPath
      router.push(`${dest}?${params.toString()}` as Route, { scroll: !samePage })
    },
    [query, searchParams, pathname, targetPath, router]
  )

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      aria-label={formLabel}
      className="flex items-center gap-2 w-full max-w-2xl"
    >
      {!labelledBy && (
        <label htmlFor="discovery-search" className="sr-only">
          Search businesses
        </label>
      )}
      <div className="relative flex-1">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-charcoal-soft pointer-events-none"
          aria-hidden="true"
        />
        <input
          id="discovery-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          aria-labelledby={labelledBy}
          className={`w-full h-11 pl-9 pr-4 rounded-full border border-charcoal/30 bg-white font-subhead text-sm text-brand-black placeholder:text-charcoal-faint focus:border-brand-black ${
            onDark
              ? 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold'
              : 'focus:outline-none focus:ring-2 focus:ring-brand-black/20'
          }`}
        />
      </div>
      <Button
        type="submit"
        className="bg-brand-black text-white font-body font-bold rounded-full px-5 min-h-[44px] h-auto hover:bg-charcoal"
      >
        Search
      </Button>
    </form>
  )
}
