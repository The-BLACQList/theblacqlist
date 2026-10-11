import { Store } from 'lucide-react'

import { EmptyState } from '@/components/ui/empty-state'

/**
 * What a signed-in user with no listing sees on /dashboard and
 * /dashboard/pages (ticket 050, "No listing" state). Ownership comes only
 * from listings.owner_user_id, so this covers someone who said "I own a
 * business" at sign-up but hasn't claimed or added one yet. Both ways in are
 * offered here, because the person can't know which one applies until they
 * search.
 */
export function GetListedEmptyState() {
  return (
    <EmptyState
      heading="Create your BLACQList page"
      body="Let's get you found. Find your business to claim it, or make a new page."
      action={{ href: '/claim', label: 'Find my business to claim' }}
      secondaryAction={{ href: '/add-business', label: 'Create a new page' }}
      icon={Store}
    />
  )
}
