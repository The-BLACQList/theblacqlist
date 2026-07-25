'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import type { BillingCycle } from '@/lib/stripe/plans'

interface Props {
  planSlug: string
  listingId: string
  label: string
  highlighted: boolean
  billingCycle: BillingCycle
}

export function CheckoutButton({ planSlug, listingId, label, highlighted, billingCycle }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/stripe/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planSlug, listingId, billingCycle }),
        })
        const json = await res.json()
        if (!res.ok) {
          setError(json.error ?? 'Something went wrong. Please try again.')
          return
        }
        if (json.url) {
          window.location.href = json.url
        }
      } catch {
        setError('Network error. Please try again.')
      }
    })
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={isPending}
        className={cn(
          'w-full h-10 rounded-full font-body font-bold text-sm transition-colors',
          highlighted
            ? 'bg-amber-gold text-brand-black hover:bg-light-gold'
            : 'bg-brand-black text-white hover:bg-charcoal',
          isPending && 'opacity-60 cursor-not-allowed'
        )}
      >
        {isPending ? 'Redirecting…' : label}
      </button>
      {error && (
        <p role="alert" className="mt-2 font-body text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
