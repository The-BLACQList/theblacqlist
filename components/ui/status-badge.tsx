import type { LucideIcon } from 'lucide-react'
import { CheckCircle, Star } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type TrustTier = 'unclaimed' | 'claimed' | 'verified' | 'certified'

interface StatusBadgeProps {
  tier: TrustTier
  size?: 'small' | 'standard'
  className?: string
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

export function StatusBadge({ tier, size = 'small', className }: StatusBadgeProps) {
  const config = TIER_CONFIG[tier]
  const iconSize = size === 'small' ? 11 : 13

  const sizeClasses = size === 'small' ? 'h-[26px] px-2 text-[12px]' : 'h-[32px] px-3 text-[14px]'

  return (
    <Badge
      className={cn(
        'inline-flex items-center gap-1 rounded-full border-transparent font-semibold leading-none',
        sizeClasses,
        config.bgClass,
        config.textClass,
        className
      )}
    >
      {config.Icon !== null && (
        <config.Icon size={iconSize} className="shrink-0" aria-hidden="true" />
      )}
      {config.label}
    </Badge>
  )
}
