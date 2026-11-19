import { TrustMark } from '@/components/brand/TrustMark'
import { VALID_TRUST_TIERS, type TrustTier } from '@/lib/constants/listing'

// The trust tier as a round DR-004 mark beside its name, for the trust panels
// on today's listing page (ticket 232). It matches the chapters layout's badges
// (chapters/model.ts TIER_BADGE), so trust looks the same on every business
// page. The mark is decorative; the name carries the meaning. Inline pairing
// per the For Business spec §4: a 16px mark with a 7px gap.

const LABELS: Record<TrustTier, string> = {
  unclaimed: 'Unclaimed',
  claimed: 'Claimed',
  verified: 'Verified',
  certified: 'BLACQList Certified',
}

/** The TrustMark rung for a tier: the ladder order, 0 to 3. */
export function trustMarkTier(tier: TrustTier): 0 | 1 | 2 | 3 {
  const i = VALID_TRUST_TIERS.indexOf(tier)
  return (i < 0 ? 0 : i) as 0 | 1 | 2 | 3
}

export function TrustTierLabel({ tier }: { tier: TrustTier }) {
  return (
    <span
      className="inline-flex items-center gap-[7px] font-subhead text-base font-semibold text-brand-black"
      data-trust-tier={tier}
    >
      <TrustMark tier={trustMarkTier(tier)} size={16} />
      {LABELS[tier]}
    </span>
  )
}
