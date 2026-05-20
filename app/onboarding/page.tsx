import { Suspense } from 'react'

import { createClient } from '@/lib/supabase/server'
import { OnboardingFlow } from './_components/OnboardingFlow'

export default async function OnboardingPage() {
  const supabase = await createClient()

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
      <OnboardingFlow cities={cities} />
    </Suspense>
  )
}
