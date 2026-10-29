'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { DEFAULT_PERIOD, type PeriodKey } from '@/lib/analytics/periods'

interface Props {
  period: PeriodKey
  /** The ranges this page's plan includes (lib/analytics/periods.ts). */
  options: { key: PeriodKey; label: string }[]
}

export function PeriodToggle({ period, options }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function setPeriod(p: PeriodKey) {
    const params = new URLSearchParams(searchParams.toString())
    if (p === DEFAULT_PERIOD) {
      params.delete('period')
    } else {
      params.set('period', p)
    }
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  return (
    <div
      role="group"
      aria-label="Date range"
      className="inline-flex flex-wrap rounded-lg border border-charcoal/10 bg-[#f9f9fb] p-0.5 gap-0.5"
    >
      {options.map((p) => (
        <button
          key={p.key}
          type="button"
          aria-pressed={period === p.key}
          onClick={() => setPeriod(p.key)}
          className={`px-3 py-1 rounded-md font-subhead text-xs font-semibold transition-colors ${
            period === p.key
              ? 'bg-amber-gold text-brand-black shadow-sm'
              : 'text-charcoal-soft hover:text-brand-black'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
