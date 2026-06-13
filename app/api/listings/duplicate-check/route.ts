import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const bodySchema = z.object({
  name: z.string().min(2).max(200).trim(),
  city_id: z.string().uuid(),
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

async function findDuplicates(name: string, cityId: string): Promise<DuplicateResult[]> {
  const supabase = await createClient()
  const serviceClient = createServiceClient()

  // Validate city_id exists
  const { data: city } = await supabase
    .from('cities')
    .select('id, name, slug')
    .eq('id', cityId)
    .eq('is_active', true)
    .maybeSingle()

  if (!city) return []

  // Try pg_trgm similarity first
  try {
    const { data: simRows, error } = await (
      supabase.rpc as (fn: string, args: Record<string, unknown>) => ReturnType<typeof supabase.rpc>
    )('check_listing_similarity', {
      name_query: name,
      city_id: cityId,
      threshold: 0.3,
      max_results: 5,
    })

    if (error) throw error

    if (simRows && Array.isArray(simRows) && simRows.length > 0) {
      return (
        simRows as Array<{
          id: string
          name: string
          slug: string
          entity_type: string
          trust_tier: string
          cover_image_path: string | null
          similarity_score: number
        }>
      ).map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        entity_type: row.entity_type,
        trust_tier: row.trust_tier,
        match_score: row.similarity_score,
        cover_image_url: row.cover_image_path
          ? serviceClient.storage.from('listing-media').getPublicUrl(row.cover_image_path).data
              .publicUrl
          : null,
        city: { name: city.name, slug: city.slug },
      }))
    }

    return []
  } catch {
    // pg_trgm not available — fall back to ilike
  }

  const { data: ilikeRows } = await supabase
    .from('listings')
    .select('id, name, slug, entity_type, trust_tier, cover_image_path')
    .eq('city_id', cityId)
    .ilike('name', `%${name}%`)
    .eq('status', 'published')
    .is('deleted_at', null)
    .limit(5)

  if (!ilikeRows || ilikeRows.length === 0) return []

  return ilikeRows.map((row) => ({
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
    city: { name: city.name, slug: city.slug },
  }))
}
