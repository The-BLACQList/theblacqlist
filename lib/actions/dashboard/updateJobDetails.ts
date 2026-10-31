'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isFeatureEnabled } from '@/lib/env'
import { endOfDayEastern } from '@/lib/validations/postJob'
import {
  REOPEN_NEEDS_NEW_POSTING,
  reopenClosedJob,
  reopenCoverage,
} from '@/lib/services/listings/reopenClosedJob'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { buildEntityUrl } from '@/lib/listings/url'
import {
  JOB_EMPLOYMENT_TYPES,
  JOB_WORKPLACE_TYPES,
  JOB_SALARY_PERIODS,
} from '@/lib/constants/listing'

export type UpdateJobDetailsState = { success: true } | { error: string; field?: string } | null

function isHttpsUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function updateJobDetailsAction(
  _prev: UpdateJobDetailsState,
  formData: FormData
): Promise<UpdateJobDetailsState> {
  const owner = await getOwnerSession()
  if (!owner) return { error: 'You must be signed in to edit this job.' }

  const listingId = formData.get('listing_id')?.toString().trim() ?? ''
  if (!listingId) return { error: 'Missing listing ID.' }

  const employmentType = formData.get('employment_type')?.toString().trim() ?? ''
  const workplaceType = formData.get('workplace_type')?.toString().trim() ?? ''
  const salaryMinRaw = formData.get('salary_min')?.toString().trim() || ''
  const salaryMaxRaw = formData.get('salary_max')?.toString().trim() || ''
  const salaryPeriod = formData.get('salary_period')?.toString().trim() || ''
  const salaryCurrency = formData.get('salary_currency')?.toString().trim() || 'USD'
  const applyUrl = formData.get('apply_url')?.toString().trim() || null
  const applyEmail = formData.get('apply_email')?.toString().trim() || null
  const closesAtRaw = formData.get('closes_at')?.toString().trim() || ''
  const description = formData.get('description')?.toString().trim() || null
  const hiringRaw = formData.get('hiring_listing_id')?.toString().trim() || ''

  if (!JOB_EMPLOYMENT_TYPES.includes(employmentType as (typeof JOB_EMPLOYMENT_TYPES)[number])) {
    return { error: 'Select an employment type.', field: 'employment_type' }
  }
  if (!JOB_WORKPLACE_TYPES.includes(workplaceType as (typeof JOB_WORKPLACE_TYPES)[number])) {
    return { error: 'Select where the work happens.', field: 'workplace_type' }
  }

  // The two salary CHECKs on listing_details_job, mirrored so the owner gets a
  // field message instead of a raw constraint violation.
  const salaryMin = salaryMinRaw ? Number(salaryMinRaw) : null
  const salaryMax = salaryMaxRaw ? Number(salaryMaxRaw) : null
  if (salaryMin !== null && (isNaN(salaryMin) || salaryMin < 0)) {
    return { error: 'Enter a number, or leave pay blank.', field: 'salary_min' }
  }
  if (salaryMax !== null && (isNaN(salaryMax) || salaryMax < 0)) {
    return { error: 'Enter a number, or leave pay blank.', field: 'salary_max' }
  }
  if (salaryMin !== null && salaryMax !== null && salaryMax < salaryMin) {
    return { error: 'Maximum pay must be at least the minimum.', field: 'salary_max' }
  }
  const hasSalary = salaryMin !== null || salaryMax !== null
  if (hasSalary && !JOB_SALARY_PERIODS.includes(salaryPeriod as (typeof JOB_SALARY_PERIODS)[number])) {
    return { error: 'Choose a pay period (per hour, per year, …).', field: 'salary_period' }
  }

  if (!applyUrl && !applyEmail) {
    return { error: 'Add an application link or an email to apply to.', field: 'apply_url' }
  }
  if (applyUrl && !isHttpsUrl(applyUrl)) {
    return { error: 'Application link must start with https://', field: 'apply_url' }
  }
  if (applyEmail && !isValidEmail(applyEmail)) {
    return { error: 'Enter a valid email address.', field: 'apply_email' }
  }

  // The date input sends YYYY-MM-DD. Store the end of that day in Eastern time,
  // the same instant the Post a job flow stores (ticket 152), so the role closes
  // after the day the poster picked, not at the start of it.
  let closesAtIso: string | null = null
  if (closesAtRaw) {
    const closes = /^\d{4}-\d{2}-\d{2}$/.test(closesAtRaw)
      ? new Date(endOfDayEastern(closesAtRaw))
      : new Date(closesAtRaw)
    if (isNaN(closes.getTime())) {
      return { error: 'Enter a valid closing date.', field: 'closes_at' }
    }
    closesAtIso = closes.toISOString()
  }

  const supabase = await createClient()
  const { data: listing } = await supabase
    .from('listings')
    .select('id, slug, status, entity_type, created_at, cities(slug)')
    .eq('id', listingId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!listing || listing.entity_type !== 'job') {
    return { error: 'Job not found or you do not have permission to edit it.' }
  }

  // Ticket 155: a closed role whose closing date moves into the future goes back
  // on the board, but only if a posting window covers the new date. If none
  // does, nothing is saved and the editor says a new posting is needed.
  const wantsReopen =
    listing.status === 'closed' && closesAtIso !== null && new Date(closesAtIso).getTime() > Date.now()
  if (wantsReopen) {
    const coverage = await reopenCoverage(supabase, {
      listingId,
      createdAt: listing.created_at,
      closesAt: new Date(closesAtIso!),
      paidPostingsOn: isFeatureEnabled('paidPostings'),
    })
    if (!coverage.ok) {
      return { error: 'Could not check this job posting right now. Please try again.' }
    }
    if (!coverage.covered) {
      return { error: REOPEN_NEEDS_NEW_POSTING, field: 'closes_at' }
    }
  }

  // The hiring company must be a listing this owner controls.
  let hiringId: string | null = null
  if (hiringRaw) {
    const { data: co } = await supabase
      .from('listings')
      .select('id')
      .eq('id', hiringRaw)
      .eq('owner_user_id', owner.user.id)
      .is('deleted_at', null)
      .maybeSingle()
    if (co) hiringId = co.id
  }

  const sb = supabase as unknown as SupabaseClient
  const { error } = await sb
    .from('listing_details_job')
    .update({
      employment_type: employmentType,
      workplace_type: workplaceType,
      salary_min: salaryMin,
      salary_max: salaryMax,
      salary_period: hasSalary ? salaryPeriod : null,
      salary_currency: salaryCurrency,
      apply_url: applyUrl,
      apply_email: applyEmail,
      cta_url: applyUrl,
      closes_at: closesAtIso,
      description,
      hiring_listing_id: hiringId,
    })
    .eq('listing_id', listingId)

  if (error) return { error: 'Failed to save job details. Please try again.' }

  // Keep the parent listing's location_type consistent with the workplace type.
  await supabase
    .from('listings')
    .update({
      location_type:
        workplaceType === 'remote' ? 'virtual' : workplaceType === 'hybrid' ? 'hybrid' : 'physical',
    })
    .eq('id', listingId)

  if (wantsReopen) {
    // Service role: the listings owner guard refuses job status changes from a
    // user session. Ownership, job type and coverage are checked above, and the
    // write itself only moves this owner's closed job.
    // try/catch: createServiceClient() throws synchronously when the key is unset.
    let reopened = false
    try {
      const moved = await reopenClosedJob(createServiceClient(), listingId, owner.user.id)
      reopened = moved.ok && moved.reopened
    } catch {
      reopened = false
    }
    if (!reopened) {
      return { error: 'Your changes were saved, but the role could not be reopened. Please try again.' }
    }
    revalidatePath('/jobs')
  }

  if (listing.status === 'published' || listing.status === 'closed') {
    const citySlug = (listing.cities as { slug: string } | null)?.slug
    if (citySlug && listing.slug) {
      revalidatePath(buildEntityUrl(listing.entity_type, citySlug, listing.slug))
    }
  }
  revalidatePath(`/dashboard/pages/${listingId}/edit`)

  return { success: true }
}
