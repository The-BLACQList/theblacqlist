'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Route } from 'next'

import { cn } from '@/lib/utils'
import { JOB_EMPLOYMENT_TYPE_META } from '@/lib/constants/listing'
import {
  JOB_TYPE_CHIP_ORDER,
  buildJobsUrl,
  hasJobFilters,
  parseJobFilters,
  toggleJobType,
} from '@/lib/validations/jobs'
import type { JobFilterOptions } from '@/lib/listings/jobs'

interface Props {
  options: JobFilterOptions
  /** Roles matching the current filters. Omit while the list is unavailable. */
  total?: number
}

const chipBase =
  'inline-flex min-h-[44px] shrink-0 items-center rounded-full border px-4 font-subhead text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber disabled:cursor-not-allowed disabled:opacity-50'
const chipOff = 'border-charcoal/25 bg-white text-charcoal hover:bg-pale-lavender'
const whereOn = 'border-brand-black bg-brand-black text-white'
const typeOn = 'border-jobs-ink bg-jobs-ink text-white'

function ChipGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-labelledby={`jobs-filter-${label}`} className="min-w-0">
      <p
        id={`jobs-filter-${label}`}
        className="mb-1 font-subhead text-xs font-semibold uppercase tracking-wide text-charcoal"
      >
        {label}
      </p>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {children}
      </div>
    </div>
  )
}

/** Where and Kind of work chips. Filters live in the URL and apply on tap. */
export function JobFilters({ options, total }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  const filters = parseJobFilters(Object.fromEntries(params.entries()))
  const active = hasJobFilters(filters)

  function go(next: Pick<typeof filters, 'where' | 'types'>) {
    startTransition(() => {
      router.replace(buildJobsUrl(next) as Route, { scroll: false })
    })
  }

  const whereChips = [
    ...(options.hasRemote ? [{ slug: 'remote', label: 'Remote' }] : []),
    ...options.cities,
  ]
  // A link can carry a place nobody is hiring in; keep its chip so it can be undone.
  if (filters.where && !whereChips.some((c) => c.slug === filters.where)) {
    whereChips.push({ slug: filters.where, label: filters.where.replace(/-/g, ' ') })
  }

  return (
    <div className="space-y-4" aria-busy={pending}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-8">
        {whereChips.length > 0 && (
          <ChipGroup label="Where">
            {whereChips.map((c) => {
              const on = filters.where === c.slug
              return (
                <button
                  key={c.slug}
                  type="button"
                  aria-pressed={on}
                  className={cn(chipBase, on ? whereOn : chipOff)}
                  onClick={() => go({ types: filters.types, where: on ? null : c.slug })}
                >
                  {c.label}
                </button>
              )
            })}
          </ChipGroup>
        )}
        <ChipGroup label="Kind of work">
          {JOB_TYPE_CHIP_ORDER.map((t) => {
            const on = filters.types.includes(t)
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                className={cn(chipBase, on ? typeOn : chipOff)}
                onClick={() => go({ where: filters.where, types: toggleJobType(filters.types, t) })}
              >
                {JOB_EMPLOYMENT_TYPE_META[t].label}
              </button>
            )
          })}
        </ChipGroup>
      </div>
      <div className="flex min-h-[44px] flex-wrap items-center gap-x-4">
        <p aria-live="polite" className="font-subhead text-sm text-charcoal">
          {active && total !== undefined
            ? `Showing ${total.toLocaleString()} ${total === 1 ? 'role' : 'roles'}`
            : ''}
        </p>
        {active && (
          <button
            type="button"
            onClick={() => go({ where: null, types: [] })}
            className="min-h-[44px] rounded-sm font-subhead text-sm text-amber hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  )
}

/** The same chips, inert, while the board loads. Nothing jumps when the real ones arrive. */
export function JobFiltersFallback() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <ChipGroup label="Kind of work">
        {JOB_TYPE_CHIP_ORDER.map((t) => (
          <button key={t} type="button" disabled className={cn(chipBase, chipOff)}>
            {JOB_EMPLOYMENT_TYPE_META[t].label}
          </button>
        ))}
      </ChipGroup>
      <div className="min-h-[44px]" />
    </div>
  )
}
