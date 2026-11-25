import { unstable_cache } from 'next/cache'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isFeatureEnabled } from '@/lib/env'
import { isCovered } from '@/lib/features/covered'
import { SITE_TOUR_SEEN_METADATA } from '@/lib/site-tour/state'
import { resolveTourViewer } from '@/lib/tour/witness'
import { SiteTourLauncher } from './SiteTourLauncher'

/** Is there a published story? Read once an hour, not once a page. */
const hasStories = unstable_cache(
  async (): Promise<boolean> => {
    const { data, error } = await createServiceClient()
      .from('editorial_articles')
      .select('id')
      .eq('status', 'published')
      .limit(1)
    if (error) throw new Error(error.message)
    return (data ?? []).length > 0
  },
  ['site-tour-has-stories'],
  { revalidate: 3600 }
)

// The site tour's server-side gate (ticket 280). It mounts in the root layout,
// so it runs on every page: the flag check is all it costs when the tour is
// off, and nothing here may throw. A tester on a live Tester Tour never gets
// it, so the two can't show at once.
export async function SiteTourMount() {
  if (!isFeatureEnabled('siteTour')) return null
  const props = await readProps()
  return props && <SiteTourLauncher {...props} />
}

async function readProps() {
  try {
    if (await resolveTourViewer()) return null
    const supabase = await createClient()
    const [{ data }, stories] = await Promise.all([
      supabase.auth.getUser(),
      hasStories().catch(() => false),
    ])
    const seen: unknown = data.user?.user_metadata?.[SITE_TOUR_SEEN_METADATA]
    return {
      signedIn: data.user !== null,
      accountSeenAt: typeof seen === 'string' ? seen : null,
      context: {
        cue: isFeatureEnabled('aiAssistant'),
        stories,
        collective: !isCovered('collective'),
        ownerReview: isFeatureEnabled('ownerReceiptReview'),
      },
    }
  } catch {
    return null
  }
}
