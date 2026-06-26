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

  return { searchParams, setParam, getCsv, toggleCsv, removeCsv, clearKeys }
}

/** The URL keys the facet sidebar owns (everything except q + sort). */
export const FACET_KEYS = [
  'type',
  'category',
  'city',
  'trust_tier',
  'location_type',
  'price',
  'attrs',
  'open_now',
]
