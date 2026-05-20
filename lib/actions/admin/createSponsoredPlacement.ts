'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getAdminSession } from '@/lib/admin/guard'

export type CreateSponsoredPlacementState = {
  error?: string
  success?: boolean
}

function isValidUUID(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

export async function createSponsoredPlacement(
  _prev: CreateSponsoredPlacementState,
  formData: FormData
): Promise<CreateSponsoredPlacementState> {
  const session = await getAdminSession()
  if (!session) return { error: 'Unauthorized' }

  const listing_id = (formData.get('listing_id') as string | null) ?? ''
  const city_id = (formData.get('city_id') as string | null) || null
  const category_id = (formData.get('category_id') as string | null) || null
  const position = parseInt((formData.get('position') as string | null) ?? '', 10)
  const starts_at = (formData.get('starts_at') as string | null) ?? ''
  const ends_at = (formData.get('ends_at') as string | null) ?? ''

  if (!listing_id || !isValidUUID(listing_id)) return { error: 'A listing is required' }
  if (city_id && !isValidUUID(city_id)) return { error: 'Invalid city' }
  if (category_id && !isValidUUID(category_id)) return { error: 'Invalid category' }
  if (isNaN(position) || position < 1 || position > 3)
    return { error: 'Position must be 1, 2, or 3' }
  if (!starts_at || !ends_at) return { error: 'Start and end dates are required' }

  const startsDate = new Date(starts_at)
  const endsDate = new Date(ends_at)
  if (isNaN(startsDate.getTime()) || isNaN(endsDate.getTime())) return { error: 'Invalid dates' }
  if (endsDate <= startsDate) return { error: 'End date must be after start date' }

  const now = new Date().toISOString()
  const status = starts_at <= now ? 'active' : 'scheduled'

  const supabase = createServiceClient()
  const { error } = await supabase.from('sponsored_placements').insert({
    listing_id,
    city_id,
    category_id,
    position,
    starts_at: startsDate.toISOString(),
    ends_at: endsDate.toISOString(),
    status,
    placement_type: 'boost',
    placement_zone: 'discover',
  })

  if (error) {
    console.error('[createSponsoredPlacement]', error)
    return { error: 'Failed to create placement. Please try again.' }
  }

  revalidatePath('/admin/sponsored')
  revalidatePath('/discover')

  return { success: true }
}
