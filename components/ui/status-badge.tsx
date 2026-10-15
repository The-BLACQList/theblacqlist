import type { LucideIcon } from 'lucide-react'
import { CheckCircle, Star } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { TrustBadgeExplainer } from '@/components/ui/TrustBadgeExplainer'
import { cn } from '@/lib/utils'

type TrustTier = 'unclaimed' | 'claimed' | 'verified' | 'certified'

interface StatusBadgeProps {
  tier: TrustTier
  size?: 'small' | 'standard'
  className?: string
  /**
   * Makes the badge a button that explains its tier. Opt-in because a button
   * cannot sit inside a link: leave it off for badges rendered in cards.
   */
  explain?: boolean
}

interface TierConfig {
  label: string
  bgClass: string
  textClass: string
  Icon: LucideIcon | null
}

const TIER_CONFIG: Record<TrustTier, TierConfig> = {
  unclaimed: {
    label: 'Unclaimed',
    bgClass: 'bg-charcoal',
    textClass: 'text-white',
    Icon: null,
  },
  claimed: {
    label: 'Claimed',
    bgClass: 'bg-[#2563EB]', // blue-600 — white text ≈ 5:1 (AA); was #3B82F6 at 3.67:1
    textClass: 'text-white',
    Icon: CheckCircle,
  },
  verified: {
    label: 'Verified',
    bgClass: 'bg-light-gold', // bright gold, black text — distinct from champagne certified
    textClass: 'text-brand-black',
    Icon: CheckCircle,
  },
  certified: {
    label: 'BLACQList Certified',
    bgClass: 'bg-gold', // champagne gold — top tier
    textClass: 'text-brand-black',
    Icon: Star,
  },
}

// One-line meanings, shortened from app/(public)/about/trust/page.tsx. Keep in
// step with that page: it is the source of truth for what each tier means.
export const TIER_MEANING: Record<TrustTier, string> = {
  unclaimed:
    'Nobody has stepped forward as the owner yet. The details came from public sources or the community.',
  claimed:
    'The owner has claimed this page and we approved it. That means an owner is present, not that their paperwork is checked.',
  verified: 'A person on our team reviewed documents that tie the owner to this business.',
  certified:
    'Earned, not granted. A verified business that has kept its page complete and earned real community standing.',
}

export function StatusBadge({
  tier,
  size = 'small',
  className,
  explain = false,
}: StatusBadgeProps) {
  const config = TIER_CONFIG[tier]
  const iconSize = size === 'small' ? 11 : 13

  const sizeClasses = size === 'small' ? 'h-[26px] px-2 text-[12px]' : 'h-[32px] px-3 text-[14px]'

  const pillClass = cn(
    'inline-flex items-center gap-1 rounded-full border border-transparent font-semibold leading-none',
    sizeClasses,
    config.bgClass,
    config.textClass,
    className
  )
  const content = (
    <>
      {config.Icon !== null && (
        <config.Icon size={iconSize} className="shrink-0" aria-hidden="true" />
      )}
      {config.label}
    </>
  )

  if (explain) {
    return (
      <TrustBadgeExplainer label={config.label} meaning={TIER_MEANING[tier]}>
        <span className={pillClass}>{content}</span>
      </TrustBadgeExplainer>
    )
  }

  return <Badge className={pillClass}>{content}</Badge>
}
