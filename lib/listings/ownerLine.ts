// Ticket 158 (founder pick 5A): one line everywhere an owner learns the page is
// theirs, so the approved email, the claim-approved email and the dashboard
// header all say the same thing.

import { isFeatureEnabled } from '@/lib/env'

export const OWNER_MANAGES_LINE = 'You manage this page.'

/** Follows OWNER_MANAGES_LINE when Jobs is open. */
export const OWNER_CAN_POST_JOB_LINE = 'You can now post a job for it.'

/**
 * Whether to invite an owner to post a job. /add-job is a 404 without
 * postingSubmissions, so both switches must be on (same rule as PostJobCard).
 */
export function postJobInviteOpen(): boolean {
  return isFeatureEnabled('jobsOpen') && isFeatureEnabled('postingSubmissions')
}

/** Evidence note on the claim row written when an owner's own page is approved. */
export const OWNER_SUBMITTED_CLAIM_NOTE = 'Owner-submitted page, ownership attested at submission'

interface OwnerPathFields {
  entity_type: string
  source: string
  ownership_attested: boolean
  owner_user_id: string | null
  trust_tier: string
}

/**
 * A page the owner added themselves and attested to. Approving it is the same
 * review a claim gets, so it becomes Claimed (founder pick 3A). Events, jobs,
 * staff-seeded and imported pages are left alone.
 */
export function isOwnerSubmittedUnclaimed(listing: OwnerPathFields): boolean {
  return (
    listing.entity_type !== 'event' &&
    listing.entity_type !== 'job' &&
    listing.source === 'owner' &&
    listing.ownership_attested === true &&
    !!listing.owner_user_id &&
    listing.trust_tier === 'unclaimed'
  )
}
