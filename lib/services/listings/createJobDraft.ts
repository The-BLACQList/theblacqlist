import type { SupabaseClient } from '@supabase/supabase-js'
import { trackServerEvent } from '@/lib/analytics/server'

// Ticket 152: the job half of listing creation, extracted from createListing.ts so
// the old server action and postJobAction write a job the same way. Callers do
// their own validation and ownership checks first; this only writes.

export interface JobDraftFields {
  name: string
  tagline: string
  categoryId: string
  cityId: string | null
  primaryLevel: string | null
  ownershipLabel: string
  ownershipAttested: boolean
  hiringListingId: string | null
  description: string
  employmentType: string
  workplaceType: string
  salaryMin: number | null
  salaryMax: number | null
  salaryPeriod: string | null
  applyUrl: string | null
  applyEmail: string | null
  /** ISO timestamp or null. */
  closesAt: string | null
}

export type CreateJobDraftResult =
  | { ok: true; listingId: string; slug: string; reused: boolean }
  | { ok: false; error: string }

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

/** A remote role is 'virtual', hybrid is 'hybrid', on-site is 'physical'. */
export function jobLocationType(workplaceType: string): 'virtual' | 'hybrid' | 'physical' {
  return workplaceType === 'remote' ? 'virtual' : workplaceType === 'hybrid' ? 'hybrid' : 'physical'
}

function detailsRow(f: JobDraftFields) {
  return {
    description: f.description,
    employment_type: f.employmentType,
    workplace_type: f.workplaceType,
    salary_min: f.salaryMin,
    salary_max: f.salaryMax,
    // Nulled when no bound was given: the DB CHECK only needs a period next to an
    // amount, and a lone period would render as nothing.
    salary_period: f.salaryMin !== null || f.salaryMax !== null ? f.salaryPeriod : null,
    apply_url: f.applyUrl,
    apply_email: f.applyEmail,
    closes_at: f.closesAt,
    cta_type: 'apply',
    cta_url: f.applyUrl,
    hiring_listing_id: f.hiringListingId,
  }
}

/**
 * Create a job draft. With `reuseId` (the client's idempotency key) a retry
 * finds the draft from the first attempt and updates it instead of making a
 * second one; it only ever touches a draft job this user owns.
 */
export async function createJobDraft(
  supabase: SupabaseClient,
  params: { userId: string; fields: JobDraftFields; reuseId?: string | null; source?: string }
): Promise<CreateJobDraftResult> {
  const { userId, fields: f, reuseId } = params
  const locationType = jobLocationType(f.workplaceType)

  if (reuseId) {
    const { data: existing } = await supabase
      .from('listings')
      .select('id, slug, status, entity_type, owner_user_id')
      .eq('id', reuseId)
      .maybeSingle()
    if (existing) {
      const row = existing as { id: string; slug: string; status: string; entity_type: string; owner_user_id: string }
      if (row.owner_user_id !== userId || row.entity_type !== 'job' || row.status !== 'draft') {
        return { ok: false, error: 'Something went wrong creating your job. Please try again.' }
      }
      const { error: upErr } = await supabase
        .from('listings')
        .update({
          name: f.name,
          tagline: f.tagline || null,
          category_id: f.categoryId,
          city_id: f.cityId,
          location_type: locationType,
          ownership_label: f.ownershipLabel,
        })
        .eq('id', row.id)
        .eq('owner_user_id', userId)
      const { error: detErr } = await supabase
        .from('listing_details_job')
        .update(detailsRow(f))
        .eq('listing_id', row.id)
      if (upErr || detErr) return { ok: false, error: 'Failed to save your job details. Please try again.' }
      return { ok: true, listingId: row.id, slug: row.slug, reused: true }
    }
  }

  let slug = generateSlug(f.name)
  if (!slug) slug = `listing-${Date.now().toString(36)}`
  const { data: existingSlug } = await supabase.from('listings').select('id').eq('slug', slug).maybeSingle()
  if (existingSlug) slug = `${slug}-${Date.now().toString(36)}`

  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .insert({
      ...(reuseId ? { id: reuseId } : {}),
      name: f.name,
      entity_type: 'job',
      category_id: f.categoryId,
      ...(f.cityId ? { city_id: f.cityId } : {}),
      location_type: locationType,
      status: 'draft',
      source: 'owner',
      submitted_by: userId,
      owner_user_id: userId,
      tagline: f.tagline || null,
      slug,
      tier: 'free',
      trust_tier: 'unclaimed',
      ships_nationwide: false,
      ownership_label: f.ownershipLabel,
      ownership_attested: f.ownershipAttested,
      ownership_attested_at: f.ownershipAttested ? new Date().toISOString() : null,
      ...(f.primaryLevel ? { primary_level: f.primaryLevel } : {}),
    })
    .select('id')
    .single()

  if (listingError || !listing) {
    console.error('[createJobDraft] listings insert error:', listingError)
    return { ok: false, error: 'Something went wrong creating your listing. Please try again.' }
  }

  const { error: detailsError } = await (supabase as unknown as SupabaseClient)
    .from('listing_details_job')
    .insert({ listing_id: listing.id, ...detailsRow(f) })

  if (detailsError) {
    await supabase.from('listings').delete().eq('id', listing.id)
    return { ok: false, error: 'Failed to save your job details. Please try again.' }
  }

  trackServerEvent({
    event_name: 'listing_draft_created',
    entity_id: listing.id,
    entity_type: 'listing',
    user_id: userId,
    properties: {
      entity_type: 'job',
      category_id: f.categoryId,
      source: params.source ?? 'web_form',
      has_city: f.cityId !== null,
      site_import: false,
      category_requested: false,
    },
  })

  return { ok: true, listingId: listing.id, slug, reused: false }
}
