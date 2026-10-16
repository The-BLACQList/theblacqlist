import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'
import { PolicyUpdateBanner } from '@/components/legal/PolicyUpdateBanner'
import { isPolicyUpdateInEffect } from '@/lib/legal/policyUpdate'
import { CookiePolicy } from '../CookiePolicy'

export const metadata: Metadata = {
  title: 'Updated Cookie Policy | The BLACQList',
  description: 'The updated BLACQList Cookie Policy, before it takes effect.',
  robots: { index: false, follow: true },
}

export const revalidate = 3600

// The notice email links here. Once the update is in effect, /cookies shows
// the same text, so this page sends readers there.
export default function UpcomingCookiesPage() {
  if (isPolicyUpdateInEffect()) permanentRedirect('/cookies')
  return (
    <CookiePolicy
      version="next"
      notice={<PolicyUpdateBanner kind="preview" docName="Cookie Policy" href="/cookies" />}
    />
  )
}
