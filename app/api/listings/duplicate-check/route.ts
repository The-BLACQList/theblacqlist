import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const bodySchema = z.object({
  name: z.string().min(2).max(200).trim(),
  // Optional since ticket 126: the quick start checks the name before the owner
  // picks a city, so a match in any city shows up as "is this yours?".
  city_id: z.string().uuid().optional(),
})

interface DuplicateResult {
  id: string
  name: string
  slug: string
  entity_type: string
  trust_tier: string
  match_score: number
  cover_image_url: string | null
  city: { name: string; slug: string } | null
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required.', code: 'AUTH_REQUIRED' },
      { status: 401 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body.', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Validation failed.',
        code: 'VALIDATION_ERROR',
        fields: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    )
  }

  const { name, city_id } = parsed.data
  const duplicates = await findDuplicates(name, city_id)

  return NextResponse.json({ data: { duplicates } })
}

// Ilike matching only: check_listing_similarity (pg_trgm) never shipped as a
// migration, so the old RPC branch always threw and fell through to this.
async function findDuplicates(name: string, cityId: string | undefined): Promise<DuplicateResult[]> {
  const supabase = await createClient()
  const serviceClient = createServiceClient()

  if (cityId) {
    const { data: city } = await supabase
      .from('cities')
      .select('id')
      .eq('id', cityId)
      .eq('is_active', true)
      .maybeSingle()
    if (!city) return []
  }

  // `%` and `_` in a business name are literal characters, not wildcards.
  const pattern = `%${name.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
  let query = supabase
    .from('listings')
    .select('id, name, slug, entity_type, trust_tier, cover_image_path, cities!listings_city_id_fkey(name, slug)')
    .ilike('name', pattern)
    .eq('status', 'published')
    .is('deleted_at', null)
    .limit(5)
  if (cityId) query = query.eq('city_id', cityId)

  const { data: rows } = await query
  if (!rows || rows.length === 0) return []

  return rows.map((row) => {
    const city = Array.isArray(row.cities) ? row.cities[0] : row.cities
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      entity_type: row.entity_type,
      trust_tier: row.trust_tier,
      match_score: 0,
      cover_image_url: row.cover_image_path
        ? serviceClient.storage.from('listing-media').getPublicUrl(row.cover_image_path).data
            .publicUrl
        : null,
      city: city ? { name: city.name, slug: city.slug } : null,
    }
  })
}
