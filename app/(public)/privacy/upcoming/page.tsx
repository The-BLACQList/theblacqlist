import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'
import { PolicyUpdateBanner } from '@/components/legal/PolicyUpdateBanner'
import { isPolicyUpdateInEffect } from '@/lib/legal/policyUpdate'
import { PrivacyPolicy } from '../PrivacyPolicy'

export const metadata: Metadata = {
  title: 'Updated Privacy Policy | The BLACQList',
  description: 'The updated BLACQList Privacy Policy, before it takes effect.',
  robots: { index: false, follow: true },
}

export const revalidate = 3600

// The notice email links here. Once the update is in effect, /privacy shows
// the same text, so this page sends readers there.
export default function UpcomingPrivacyPage() {
  if (isPolicyUpdateInEffect()) permanentRedirect('/privacy')
  return (
    <PrivacyPolicy
      version="next"
      notice={<PolicyUpdateBanner kind="preview" docName="Privacy Policy" href="/privacy" />}
    />
  )
}
