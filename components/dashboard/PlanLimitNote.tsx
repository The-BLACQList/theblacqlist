import Link from 'next/link'
import { Lock } from 'lucide-react'
import type { UpgradeTarget } from '@/lib/stripe/planChecks'

interface Props {
  /** Why this section is locked or full, in one or two plain sentences. */
  children: React.ReactNode
  /**
   * The plan the link offers, from `upgradeTarget`. Null when no higher plan is
   * for sale, so the owner gets the reason without a link they cannot use.
   */
  upgradeTo: UpgradeTarget
}

// Ticket 119. The same locked-state idea as the analytics page, sized to sit
// inside a dashboard section instead of replacing the page.
export function PlanLimitNote({ children, upgradeTo }: Props) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-charcoal/10 bg-pale-lavender px-4 py-3">
      <Lock className="size-4 text-charcoal-soft mt-0.5 shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="font-body text-sm text-charcoal">{children}</p>
        {upgradeTo && (
          <Link
            href="/dashboard/upgrade"
            className="inline-flex items-center mt-2 font-subhead font-bold text-sm text-brand-black underline underline-offset-4 decoration-amber-gold hover:decoration-brand-black"
          >
            Upgrade to {upgradeTo}
          </Link>
        )}
      </div>
    </div>
  )
}
