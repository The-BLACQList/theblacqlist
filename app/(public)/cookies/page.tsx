import type { Metadata } from 'next'
import { PolicyUpdateBanner } from '@/components/legal/PolicyUpdateBanner'
import { isPolicyUpdateInEffect, livePolicyVersion } from '@/lib/legal/policyUpdate'
import { CookiePolicy } from './CookiePolicy'

export const metadata: Metadata = {
  title: 'Cookie Policy | The BLACQList',
  description: 'How The BLACQList uses cookies and similar tracking technologies.',
  robots: { index: true, follow: true },
}

// Re-render hourly so the page switches to the updated text on its own once
// it takes effect (POLICY_PAGE_REVALIDATE_SECONDS in lib/legal/policyUpdate.ts).
export const revalidate = 3600

export default function CookiesPage() {
  const inEffect = isPolicyUpdateInEffect()
  return (
    <CookiePolicy
      version={livePolicyVersion()}
      notice={
        inEffect ? undefined : (
          <PolicyUpdateBanner kind="coming" docName="Cookie Policy" href="/cookies/upcoming" />
        )
      }
    />
  )
}
