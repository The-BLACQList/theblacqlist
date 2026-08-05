'use client'

import { cn } from '@/lib/utils'
import type { BillingCycle } from '@/lib/stripe/plans'

interface Props {
  value: BillingCycle
  onChange: (cycle: BillingCycle) => void
  /** Optional label shown next to the annual option, e.g. "Save 17%". */
  annualBadge?: string
  className?: string
}

const OPTIONS: { value: BillingCycle; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'annual', label: 'Annual' },
]

/**
 * Accessible segmented control for choosing a billing cadence.
 * Implemented as a radiogroup: arrow keys move between options,
 * selection state is conveyed by aria-checked (not colour alone).
 */
export function BillingCycleToggle({ value, onChange, annualBadge, className }: Props) {
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      onChange('annual')
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      onChange('monthly')
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="Billing cadence"
      onKeyDown={handleKeyDown}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-charcoal/15 bg-white p-1',
        className
      )}
    >
      {OPTIONS.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 font-subhead text-sm font-semibold transition-colors min-h-[36px]',
              selected
                ? 'bg-brand-black text-white'
                : 'text-charcoal hover:text-brand-black'
            )}
          >
            {opt.label}
            {opt.value === 'annual' && annualBadge && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                  selected ? 'bg-amber-gold text-brand-black' : 'bg-amber-gold/15 text-amber'
                )}
              >
                {annualBadge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
