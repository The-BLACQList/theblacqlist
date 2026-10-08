import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { ownershipLabelText, type OwnershipLabel } from '@/lib/constants/listing'

interface OwnershipBadgeProps {
  label: OwnershipLabel
  /** Creator pages read "Black Creator / Ally Creator". */
  entityType?: string | null
  size?: 'small' | 'standard'
  className?: string
}

// The ownership label (Black-Owned / Ally) is DISTINCT from the trust-tier badge
// (unclaimed/claimed/verified/certified). Trust badges signal verification; this
// signals who the business is. Colors are deliberately separated from the gold
// trust palette so the two badges never read as the same system. Both pairings
// meet WCAG AA contrast.
const LABEL_CLASSES: Record<OwnershipLabel, string> = {
  black_owned: 'bg-brand-black text-light-gold',
  ally: 'bg-pale-lavender text-brand-black',
}

export function OwnershipBadge({
  label,
  entityType,
  size = 'small',
  className,
}: OwnershipBadgeProps) {
  const sizeClasses = size === 'small' ? 'h-[26px] px-2 text-[12px]' : 'h-[32px] px-3 text-[14px]'

  return (
    <Badge
      className={cn(
        'inline-flex items-center rounded-full border-transparent font-semibold leading-none',
        sizeClasses,
        LABEL_CLASSES[label],
        className
      )}
    >
      {ownershipLabelText(label, entityType)}
    </Badge>
  )
}
