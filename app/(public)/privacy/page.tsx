import type { Metadata } from 'next'
import { PolicyUpdateBanner } from '@/components/legal/PolicyUpdateBanner'
import { isPolicyUpdateInEffect, livePolicyVersion } from '@/lib/legal/policyUpdate'
import { PrivacyPolicy } from './PrivacyPolicy'

export const metadata: Metadata = {
  title: 'Privacy Policy | The BLACQList',
  description: 'How The BLACQList collects, uses, and protects your personal information.',
  robots: { index: true, follow: true },
}

// Re-render hourly so the page switches to the updated text on its own once
// it takes effect (POLICY_PAGE_REVALIDATE_SECONDS in lib/legal/policyUpdate.ts).
export const revalidate = 3600

export default function PrivacyPage() {
  const inEffect = isPolicyUpdateInEffect()
  return (
    <PrivacyPolicy
      version={livePolicyVersion()}
      notice={
        inEffect ? undefined : (
          <PolicyUpdateBanner kind="coming" docName="Privacy Policy" href="/privacy/upcoming" />
        )
      }
    />
  )
}
