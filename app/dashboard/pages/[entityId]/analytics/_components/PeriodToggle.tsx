'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

interface Props {
  period: '7d' | '30d'
}

export function PeriodToggle({ period }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function setPeriod(p: '7d' | '30d') {
    const params = new URLSearchParams(searchParams.toString())
    if (p === '30d') {
      params.delete('period')
    } else {
      params.set('period', p)
    }
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  return (
    <div className="inline-flex rounded-lg border border-charcoal/10 bg-[#f9f9fb] p-0.5 gap-0.5">
      {(['7d', '30d'] as const).map((p) => (
        <button
          key={p}
          onClick={() => setPeriod(p)}
          className={`px-3 py-1 rounded-md font-subhead text-xs font-semibold transition-colors ${
            period === p
              ? 'bg-amber-gold text-brand-black shadow-sm'
              : 'text-charcoal/50 hover:text-brand-black'
          }`}
        >
          {p === '7d' ? '7 days' : '30 days'}
        </button>
      ))}
    </div>
  )
}
