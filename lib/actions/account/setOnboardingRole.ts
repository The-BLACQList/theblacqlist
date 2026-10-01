'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { ONBOARDING_COMPLETED_KEY, hasCompletedOnboarding } from '@/lib/services/auth/onboarding'
import { INTERESTS_METADATA_KEY, parseInterests } from '@/lib/onboarding/interests'

type OnboardingRole = 'supporter' | 'owner'

type SetOnboardingRoleState =
  | { error: string; code: string }
  | { success: true; role: OnboardingRole }
  | null

export async function setOnboardingRoleAction(
  _prev: SetOnboardingRoleState,
  formData: FormData
): Promise<SetOnboardingRoleState> {
  const roleRaw = formData.get('role')?.toString()

  if (roleRaw !== 'supporter' && roleRaw !== 'owner') {
    return {
      error: 'Invalid role selection.',
      code: 'VALIDATION_ERROR',
    }
  }

  const role: OnboardingRole = roleRaw

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You must be signed in.', code: 'AUTH_REQUIRED' }
  }

  // Every exit from the onboarding flow — Get started, Skip, and the save-intent
  // shortcut — passes through this action, so this is where onboarding is
  // marked done. Sign-in reads the stamp to decide whether to route back here
  // (lib/services/auth/onboarding.ts). Best-effort: a failed stamp only means
  // the person sees onboarding once more on their next sign-in.
  //
  // The same call carries the interests the supporter picked. Skip and the owner
  // buttons send none, so nothing is written for them. Saving is best-effort and
  // never blocks the redirect.
  const metadata: Record<string, unknown> = {}
  if (!hasCompletedOnboarding(user)) {
    metadata[ONBOARDING_COMPLETED_KEY] = new Date().toISOString()
  }
  const interests = parseInterests(formData.getAll('interests').map(String))
  if (interests && interests.length > 0) {
    metadata[INTERESTS_METADATA_KEY] = interests
  }
  try {
    if (Object.keys(metadata).length > 0) {
      await supabase.auth.updateUser({ data: metadata })
    }

    // City: the form sends a slug. Resolve it to an id here and write it to the
    // user's own profile row. RLS allows owners to update their own profile
    // ("profiles: authenticated update own"), so the session client is enough.
    const citySlug = formData.get('city')?.toString().trim()
    if (citySlug && /^[a-z0-9-]{1,100}$/.test(citySlug)) {
      const { data: city } = await supabase
        .from('cities')
        .select('id')
        .eq('slug', citySlug)
        .eq('is_active', true)
        .maybeSingle()
      if (city) {
        await supabase.from('profiles').update({ city_id: city.id }).eq('id', user.id)
      }
    }
  } catch {
    // Best-effort: onboarding still completes.
  }

  // Uses service client to bypass RLS per api-contract.md Section 2 spec.
  try {
    const serviceClient = createServiceClient()

    // Check for existing role to satisfy idempotency (ROLE_ALREADY_SET = 409 equivalent)
    const { data: existing } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['supporter', 'owner'])
      .maybeSingle()

    if (existing) {
      // Already set — return success without error (idempotent)
      return { success: true, role: existing.role as OnboardingRole }
    }

    const { error } = await serviceClient.from('user_roles').insert({
      user_id: user.id,
      role,
      listing_id: null,
      granted_by: null,
    })

    if (error) {
      // Table does not exist yet — graceful no-op until schema migration runs
      if (
        error.code === '42P01' ||
        error.message.includes('does not exist') ||
        error.message.includes('relation')
      ) {
        return { success: true, role }
      }
      return { error: 'Something went wrong. Please try again.', code: 'SERVER_ERROR' }
    }

    return { success: true, role }
  } catch {
    return { error: 'Something went wrong. Please try again.', code: 'SERVER_ERROR' }
  }
}
