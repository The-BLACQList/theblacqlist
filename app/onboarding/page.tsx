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

  const { data: rows } = await supabase
    .from('cities')
    .select('slug, name, states!cities_state_id_fkey(code)')
    .eq('is_active', true)
    .order('name')

  const cities = (rows ?? []).map((row) => {
    const code = (row.states as { code: string } | null)?.code ?? ''
    return {
      slug: row.slug,
      name: code ? `${row.name}, ${code}` : row.name,
    }
  })

  return (
    <Suspense>
      <OnboardingFlow cities={cities} savedRole={savedRole} />
    </Suspense>
  )
}
