import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'
import { PolicyUpdateBanner } from '@/components/legal/PolicyUpdateBanner'
import { isPolicyUpdateInEffect } from '@/lib/legal/policyUpdate'
import { TermsOfService } from '../TermsOfService'

export const metadata: Metadata = {
  title: 'Updated Terms of Service | The BLACQList',
  description: 'The updated BLACQList Terms of Service, before they take effect.',
  robots: { index: false, follow: true },
}

export const revalidate = 3600

// The notice email links here. Once the update is in effect, /terms shows
// the same text, so this page sends readers there.
export default function UpcomingTermsPage() {
  if (isPolicyUpdateInEffect()) permanentRedirect('/terms')
  return (
    <TermsOfService
      version="next"
      notice={<PolicyUpdateBanner kind="preview" docName="Terms of Service" href="/terms" />}
    />
  )
}
