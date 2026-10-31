export type MatchOwnership = 'open' | 'yours' | 'managed'

// What a signed-in caller can do with a name match in the add-business front
// door. Open pages can be claimed; anything else would be refused at submit
// (ticket 159), so it gets no claim action.
export function matchOwnership(
  listing: { owner_user_id: string | null; trust_tier: string },
  callerId: string
): MatchOwnership {
  if (listing.owner_user_id === callerId) return 'yours'
  if (listing.owner_user_id === null && listing.trust_tier === 'unclaimed') return 'open'
  return 'managed'
}
