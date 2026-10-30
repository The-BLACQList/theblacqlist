'use server'

import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { isFeatureEnabled } from '@/lib/env'
import { loadCategoryLevels } from '@/lib/listings/levelRows'
import { levelsForCategory } from '@/lib/listings/levels'
import { CREATOR_PARENT_SLUG } from '@/lib/listings/creatorCategories'
import { createJobDraft } from '@/lib/services/listings/createJobDraft'
import { submitJobForReview } from '@/lib/services/listings/submitJobForReview'
import { VALID_OWNERSHIP_LABELS } from '@/lib/constants/listing'
import {
  attemptIdSchema,
  endOfDayEastern,
  isVolunteer,
  postJobBaseSchema,
  postJobSchema,
  type PostJobErrors,
  type PostJobField,
} from '@/lib/validations/postJob'

// Ticket 152: one action for the four step flow. Create the draft, then run the
// same pay ladder as the dashboard's Submit button. The client sends only what the
// poster typed; the label, the city and the ownership check all come from the
// hiring business on the server.

export type PostJobResult =
  | { ok: true; listingId: string; outcome: 'included' | 'checkout'; checkoutUrl?: string }
  | { ok: false; error: string; fieldErrors?: PostJobErrors }

const inputSchema = z.object({ values: postJobBaseSchema, attemptId: attemptIdSchema })

const RATE_LIMIT = 10
const RATE_WINDOW_SECONDS = 60 * 60
const GENERIC = 'Something went wrong posting your job. Please try again.'

function fail(error: string, fieldErrors?: PostJobErrors): PostJobResult {
  return { ok: false, error, ...(fieldErrors ? { fieldErrors } : {}) }
}

export async function postJobAction(input: unknown): Promise<PostJobResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('You must be signed in to post a job.')

  if (
    !(await checkRateLimit({
      bucket: 'listing_submit',
      identifier: user.id,
      limit: RATE_LIMIT,
      windowSeconds: RATE_WINDOW_SECONDS,
    }))
  ) {
    return fail("You've posted a lot just now. Try again in a little while.")
  }

  // Server Action ids are callable without the page, so the flag is checked here too.
  if (!isFeatureEnabled('postingSubmissions')) return fail('Job submissions are not open yet.')

  const parsedInput = inputSchema.safeParse(input)
  if (!parsedInput.success) return fail(GENERIC)
  const { values: raw, attemptId } = parsedInput.data

  const checked = postJobSchema.safeParse(raw)
  if (!checked.success) {
    const fieldErrors: PostJobErrors = {}
    for (const issue of checked.error.issues) {
      const key = issue.path[0] as PostJobField | undefined
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message
    }
    return fail('Please fix the errors below.', fieldErrors)
  }
  const v = checked.data

  // Ownership: the picked business must be a published, business-shaped page this
  // user owns. Its label, attestation and city are copied, never read from the form.
  const { data: business } = await supabase
    .from('listings')
    .select('id, city_id, ownership_label, ownership_attested')
    .eq('id', v.hiringListingId)
    .eq('owner_user_id', user.id)
    .eq('status', 'published')
    .is('deleted_at', null)
    .not('entity_type', 'in', '(event,job)')
    .maybeSingle()
  if (!business) {
    return fail('Please fix the errors below.', {
      hiringListingId: 'Pick a business of yours that is published.',
    })
  }
  const label = (business as { ownership_label: string }).ownership_label
  if (!(VALID_OWNERSHIP_LABELS as readonly string[]).includes(label)) return fail(GENERIC)

  const { data: category, error: categoryError } = await supabase
    .from('categories')
    .select('id, slug, parent_id')
    .eq('id', v.categoryId)
    .eq('is_active', true)
    .maybeSingle()
  if (categoryError) return fail(GENERIC)
  let parentSlug: string | null = null
  if (category?.parent_id) {
    const { data: parent } = await supabase
      .from('categories')
      .select('slug')
      .eq('id', category.parent_id)
      .maybeSingle()
    parentSlug = parent?.slug ?? null
  }
  if (!category || category.slug === CREATOR_PARENT_SLUG || parentSlug === CREATOR_PARENT_SLUG) {
    return fail('Please fix the errors below.', { categoryId: 'Choose a different category.' })
  }
  const levelMap = await loadCategoryLevels(supabase, [category.id])
  const primaryLevel = levelMap
    ? (levelMap.get(category.id) ?? levelsForCategory(null)).default_level
    : null

  // Volunteer roles carry no pay, whatever the client sent.
  const paid = !isVolunteer(v.employmentType)
  const draft = await createJobDraft(supabase as unknown as SupabaseClient, {
    userId: user.id,
    reuseId: attemptId,
    fields: {
      name: v.name.trim(),
      tagline: v.tagline.trim(),
      categoryId: v.categoryId,
      cityId: (business as { city_id: string | null }).city_id,
      primaryLevel,
      ownershipLabel: label,
      ownershipAttested: Boolean((business as { ownership_attested: boolean }).ownership_attested),
      hiringListingId: v.hiringListingId,
      description: v.description.trim(),
      employmentType: v.employmentType,
      workplaceType: v.workplaceType,
      salaryMin: paid ? Number(v.salaryMin) : null,
      salaryMax: paid ? Number(v.salaryMax) : null,
      salaryPeriod: paid ? v.salaryPeriod : null,
      applyUrl: v.applyUrl.trim() || null,
      applyEmail: v.applyEmail.trim() || null,
      closesAt: v.closesAt.trim() ? endOfDayEastern(v.closesAt.trim()) : null,
    },
  })
  if (!draft.ok) return fail(draft.error)

  const { data: row } = await supabase
    .from('listings')
    .select('id, name, created_at')
    .eq('id', draft.listingId)
    .maybeSingle()
  if (!row) return fail(GENERIC)

  const result = await submitJobForReview(
    supabase as unknown as SupabaseClient,
    { id: user.id, email: user.email },
    { id: row.id, name: row.name, created_at: row.created_at }
  )
  if ('error' in result) return fail(result.error)
  if ('requiresPayment' in result) {
    return { ok: true, listingId: draft.listingId, outcome: 'checkout', checkoutUrl: result.checkoutUrl }
  }
  return { ok: true, listingId: draft.listingId, outcome: 'included' }
}
