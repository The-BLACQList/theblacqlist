'use client'

import { Loader2 } from 'lucide-react'

import { GoldBrandMark } from '@/components/ui/gold-brand-mark'
import type { MatchedListing } from '@/lib/spend/receipt-read'

interface Props {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  reading: boolean
  /** Read aloud by screen readers: the read starting, and what it filled. */
  status: string
  /** Listings that might be the business, when none clearly fits. */
  matches: MatchedListing[]
  onPickMatch: (listing: MatchedListing) => void
}

/**
 * "Read my receipt for me" under the photo (ticket 163). Unticked by default:
 * nothing is sent to the AI provider unless the shopper asks. A read that
 * fails says nothing, and the form stays as the shopper left it.
 */
export function ReceiptReadOptIn({
  checked,
  onCheckedChange,
  reading,
  status,
  matches,
  onPickMatch,
}: Props) {
  return (
    <div className="space-y-3">
      <label className="flex items-start gap-3 min-h-11 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          aria-describedby="receipt-read-hint"
          className="mt-0.5 size-4 rounded border-charcoal/30 accent-amber-gold"
        />
        <span>
          <span className="flex items-center gap-1.5 font-subhead text-sm font-semibold text-brand-black">
            <GoldBrandMark className="size-4" />
            Read my receipt for me
          </span>
          <span id="receipt-read-hint" className="block font-body text-xs text-charcoal-soft leading-relaxed">
            We send the photo to our AI provider to read the business, total and date. They
            don&apos;t use it to train their models. Works with JPEG, PNG and WebP photos. Check
            each field before you add the receipt.
          </span>
        </span>
      </label>

      {reading && (
        <p className="flex items-center gap-2 font-body text-xs text-charcoal-soft">
          <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          Reading your receipt…
        </p>
      )}
      <p aria-live="polite" className="sr-only">
        {status}
      </p>

      {matches.length > 0 && (
        <div className="space-y-2">
          <p className="font-subhead text-xs font-semibold text-brand-black">Is it one of these?</p>
          <ul className="flex flex-col gap-2">
            {matches.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onPickMatch(m)}
                  className="w-full min-h-11 px-4 py-2 rounded-lg border border-charcoal/15 bg-white hover:bg-charcoal/5 text-left font-body text-sm text-brand-black transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/60"
                >
                  {m.name}
                  {m.cityName && <span className="text-charcoal-soft"> · {m.cityName}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
