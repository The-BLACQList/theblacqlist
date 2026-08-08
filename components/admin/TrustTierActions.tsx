'use client'

import { useActionState } from 'react'
import { updateTrustTier } from '@/lib/actions/admin/updateTrustTier'
import type { UpdateTrustTierState } from '@/lib/actions/admin/updateTrustTier'
import { MANUAL_TRUST_TIERS, TRUST_TIER_META } from '@/lib/constants/listing'

interface Props {
  listingId: string
  currentTier: string
}

const initial: UpdateTrustTierState = {}

// Canonical ladder from lib/constants/listing.ts — do not redeclare. The old
// local list offered 'Unverified', which is not a valid trust_tier: the DB
// CHECK rejected it every time and the admin only saw "Please try again".
const TIERS = MANUAL_TRUST_TIERS.map((value) => ({
  value,
  label: TRUST_TIER_META[value].label,
}))

export function TrustTierActions({ listingId, currentTier }: Props) {
  const [state, action, pending] = useActionState(updateTrustTier, initial)

  if (state.success) {
    return (
      <p className="font-body text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
        Trust tier updated. Refresh to see the new value.
      </p>
    )
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="listing_id" value={listingId} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="trust-tier-select" className="font-subhead text-xs text-charcoal-soft">
          New tier
        </label>
        <select
          id="trust-tier-select"
          name="trust_tier"
          defaultValue={currentTier}
          className="w-full rounded-lg border border-charcoal/20 px-3 py-2 font-body text-sm text-brand-black bg-white focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
        >
          {TIERS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="trust-tier-reason" className="font-subhead text-xs text-charcoal-soft">
          Reason <span aria-hidden="true">*</span>
        </label>
        <textarea
          id="trust-tier-reason"
          name="reason"
          required
          rows={2}
          placeholder="Reason for change…"
          className="w-full rounded-lg border border-charcoal/20 px-3 py-2 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40 resize-none"
        />
      </div>

      {state.error && (
        <p role="alert" className="font-body text-xs text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-8 px-4 rounded-full bg-brand-black text-white font-body font-bold text-xs hover:bg-charcoal transition-colors disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Update tier'}
      </button>
    </form>
  )
}
