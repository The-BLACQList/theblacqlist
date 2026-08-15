'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import type { Route } from 'next'

/**
 * Shared URL-as-state helpers for the faceted discovery filters. The URL is the
 * single source of truth (shareable, SEO-friendly, survives refresh). Every
 * filter change resets pagination to page 1.
 */
export function useFacetParams() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const push = useCallback(
    (params: URLSearchParams) => {
      params.delete('page') // any filter change returns to the first page
      const qs = params.toString()
      router.push((qs ? `${pathname}?${qs}` : pathname) as Route)
    },
    [pathname, router]
  )

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set(key, value)
      else params.delete(key)
      push(params)
    },
    [searchParams, push]
  )

  /**
   * Writes several keys in one navigation. Near You needs this: lat, lng and
   * radius are only valid together, and three sequential setParam calls would
   * each push a URL the search schema rejects (a coordinate with no pair).
   * An empty-string value deletes its key.
   */
  const setParams = useCallback(
    (entries: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(entries)) {
        if (value) params.set(key, value)
        else params.delete(key)
      }
      push(params)
    },
    [searchParams, push]
  )

  const getCsv = useCallback(
    (key: string): string[] => {
      const raw = searchParams.get(key)
      return raw ? raw.split(',').filter(Boolean) : []
    },
    [searchParams]
  )

  const toggleCsv = useCallback(
    (key: string, value: string) => {
      const set = new Set(getCsv(key))
      if (set.has(value)) set.delete(value)
      else set.add(value)
      const params = new URLSearchParams(searchParams.toString())
      if (set.size) params.set(key, Array.from(set).join(','))
      else params.delete(key)
      push(params)
    },
    [getCsv, searchParams, push]
  )

  const removeCsv = useCallback(
    (key: string, value: string) => {
      const set = new Set(getCsv(key))
      set.delete(value)
      const params = new URLSearchParams(searchParams.toString())
      if (set.size) params.set(key, Array.from(set).join(','))
      else params.delete(key)
      push(params)
    },
    [getCsv, searchParams, push]
  )

  const clearKeys = useCallback(
    (keys: string[]) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const k of keys) params.delete(k)
      push(params)
    },
    [searchParams, push]
  )

  return { searchParams, setParam, setParams, getCsv, toggleCsv, removeCsv, clearKeys }
}

/** The URL keys the facet sidebar owns (everything except q + sort). */
export const FACET_KEYS = [
  'type',
  'category',
  'city',
  'trust_tier',
  'location_type',
  'ownership',
  'price',
  'attrs',
  'open_now',
]

/**
 * The Near You keys. Deliberately NOT part of FACET_KEYS: they are three URL
 * keys describing one filter, so counting them alongside the others would show
 * "3 filters" for a single "within 10 miles". Callers clear both lists.
 */
export const LOCATION_KEYS = ['lat', 'lng', 'radius']

/**
 * The entries for a "clear everything" write: every key blanked, plus `sort`
 * when it is the distance sort. A distance sort outliving its coordinates is a
 * lie the server cannot catch quietly — the RPC orders NULLS LAST and would
 * fall through to another key while the control still reads "Nearest".
 */
export function clearEntries(
  keys: string[],
  currentSort: string | null
): Record<string, string> {
  const next: Record<string, string> = Object.fromEntries(keys.map((k) => [k, '']))
  if (currentSort === 'distance') next.sort = ''
  return next
}
