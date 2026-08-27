import Link from 'next/link'
import { AlertCircle, Info } from 'lucide-react'

import type { MarketplaceAllowance } from '@/lib/marketplace/entitlements'

interface AllowanceNoticeProps {
  /** Every listing the owner has, with its allowance already resolved. */
  allowances: MarketplaceAllowance[]
  /** Name lookup, so the notice can say which business page is full. */
  names: Record<string, string>
  kind: 'product' | 'service'
}

/**
 * Says what the owner's plan allows *before* they fill in a form.
 *
 * Two shapes:
 * - **Blocking** — no listing can take another item. The form is not rendered at
 *   all; this explains why and where to go.
 * - **Advisory** — at least one listing has room. The form renders, and this is a
 *   quiet line above it naming what is left.
 *
 * The counter it reads is products + services combined, which is why the copy
 * says "marketplace listings" rather than naming one or the other.
 */
export function AllowanceNotice({ allowances, names, kind }: AllowanceNoticeProps) {
  const eligible = allowances.filter((a) => a.canAddMore)
  const noun = kind === 'product' ? 'product' : 'service'

  if (eligible.length === 0) {
    const needsUpgrade = allowances.some((a) => !a.tierIncludesStorefront)
    return (
      <div
        role="alert"
        className="rounded-xl border border-amber-gold/40 bg-amber-gold/5 p-5 space-y-3"
      >
        <div className="flex items-start gap-2.5">
          <AlertCircle className="size-4 mt-0.5 shrink-0 text-charcoal" aria-hidden="true" />
          <div className="space-y-1">
            <h2 className="font-subhead text-sm font-semibold text-brand-black">
              {needsUpgrade
                ? `Your plan doesn't include a marketplace storefront yet`
                : `You've used all your marketplace listings`}
            </h2>
            <p className="font-body text-sm text-charcoal-soft">
              {needsUpgrade
                ? `Selling in the BLACQList Marketplace is part of the Growth plan and above. Upgrade to add your first ${noun}.`
                : `Products and services share one allowance on each business page. Archive something you're no longer offering, or upgrade for more room.`}
            </p>
          </div>
        </div>

        <ul className="space-y-1 pl-7">
          {allowances.map((a) => (
            <li key={a.listingId} className="font-body text-xs text-charcoal-faint">
              {names[a.listingId] ?? 'Business page'} —{' '}
              {a.tierIncludesStorefront
                ? `${a.used} of ${a.limit} marketplace listings used`
                : 'no storefront on this plan'}
            </li>
          ))}
        </ul>

        <Link
          href="/pricing"
          className="inline-flex items-center h-10 px-5 rounded-full bg-brand-black text-white font-subhead font-bold text-sm hover:bg-charcoal transition-colors min-h-[44px]"
        >
          See plans
        </Link>
      </div>
    )
  }

  const limited = eligible.filter((a) => a.limit !== null)
  if (limited.length === 0) return null

  return (
    <div className="flex items-start gap-2 rounded-lg border border-charcoal/10 bg-off-white px-4 py-3">
      <Info className="size-3.5 mt-0.5 shrink-0 text-charcoal-faint" aria-hidden="true" />
      <p className="font-body text-xs text-charcoal-soft">
        {limited.map((a, i) => (
          <span key={a.listingId}>
            {i > 0 && ' · '}
            <span className="font-semibold">{names[a.listingId] ?? 'Business page'}</span>:{' '}
            {(a.limit ?? 0) - a.used} of {a.limit} marketplace listings left
          </span>
        ))}
      </p>
    </div>
  )
}
