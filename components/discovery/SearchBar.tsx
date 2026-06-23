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
}

export function SearchBar({
  placeholder = 'Search businesses, categories, or cities…',
  targetPath = '/search',
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
      const dest = pathname === targetPath ? pathname : targetPath
      router.push(`${dest}?${params.toString()}` as Route)
    },
    [query, searchParams, pathname, targetPath, router]
  )

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className="flex items-center gap-2 w-full max-w-2xl"
    >
      <label htmlFor="discovery-search" className="sr-only">
        Search businesses
      </label>
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
          className="w-full h-11 pl-9 pr-4 rounded-full border border-charcoal/30 bg-white font-subhead text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-brand-black/20 focus:border-brand-black"
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
