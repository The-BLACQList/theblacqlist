import { Suspense } from 'react'

import { normalizeOnboardingRole } from '@/lib/auth/onboardingRole'
import { createClient } from '@/lib/supabase/server'
import { OnboardingFlow } from './_components/OnboardingFlow'

export default async function OnboardingPage() {
  const supabase = await createClient()

  // The role the user picked at sign-up. Reading it here is the whole reason
  // the owner branch is reachable: auth-callback lands on a bare /onboarding
  // with no query string (app/auth/callback/route.ts:42), so without this every
  // new signup falls through to the supporter default.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const savedRole = normalizeOnboardingRole(user?.user_metadata?.onboarding_role)

  return (
    <Suspense>
      <OnboardingFlow savedRole={savedRole} />
    </Suspense>
  )
}
