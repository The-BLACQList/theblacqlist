import type { Metadata } from 'next'
import { PolicyUpdateBanner } from '@/components/legal/PolicyUpdateBanner'
import { isPolicyUpdateInEffect, livePolicyVersion } from '@/lib/legal/policyUpdate'
import { TermsOfService } from './TermsOfService'

export const metadata: Metadata = {
  title: 'Terms of Service | The BLACQList',
  description: 'The terms governing your use of The BLACQList platform.',
  robots: { index: true, follow: true },
}

// Re-render hourly so the page switches to the updated text on its own once
// it takes effect (POLICY_PAGE_REVALIDATE_SECONDS in lib/legal/policyUpdate.ts).
export const revalidate = 3600

export default function TermsPage() {
  const inEffect = isPolicyUpdateInEffect()
  return (
    <TermsOfService
      version={livePolicyVersion()}
      notice={
        inEffect ? undefined : (
          <PolicyUpdateBanner kind="coming" docName="Terms of Service" href="/terms/upcoming" />
        )
      }
    />
  )
}
