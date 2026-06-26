import type { EntityType } from '@/types'

export const ENTITY_TYPES: { value: EntityType; label: string }[] = [
  { value: 'business', label: 'Businesses' },
  { value: 'professional', label: 'Professionals' },
  { value: 'creative', label: 'Creatives' },
  { value: 'event', label: 'Events' },
  { value: 'job', label: 'Jobs' },
  { value: 'vendor', label: 'Vendors' },
]

export const TRUST_TIERS: { value: string; label: string }[] = [
  { value: 'claimed', label: 'Claimed' },
  { value: 'verified', label: 'Verified' },
  { value: 'certified', label: 'BLACQList Certified' },
]

export const ENTITY_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  ENTITY_TYPES.map((t) => [t.value, t.label])
)

export const TRUST_TIER_LABEL: Record<string, string> = Object.fromEntries(
  TRUST_TIERS.map((t) => [t.value, t.label])
)
