'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { trackServerEvent } from '@/lib/analytics/server'
import {
  VALID_ENTITY_TYPES,
  VALID_LOCATION_TYPES,
  VALID_CTA_TYPES,
  VALID_OWNERSHIP_LABELS,
  JOB_EMPLOYMENT_TYPES,
  JOB_WORKPLACE_TYPES,
  JOB_SALARY_PERIODS,
} from '@/lib/constants/listing'

type FieldErrors = Partial<Record<string, string>>

export type CreateListingState =
  | { error: string; fieldErrors?: FieldErrors }
  | { success: true; listingId: string; listingName: string; slug: string }
  | null

function generateSlug(name: string): string {
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

function isValidUrl(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('http://')
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function createListingAction(
  _prev: CreateListingState,
  formData: FormData
): Promise<CreateListingState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You must be signed in to submit a listing.' }
  }

  const entityType = formData.get('entity_type')?.toString().trim() ?? ''
  const name = formData.get('name')?.toString().trim() ?? ''
  const tagline = formData.get('tagline')?.toString().trim() ?? ''
  const categoryId = formData.get('category_id')?.toString().trim() ?? ''
  const description = formData.get('description')?.toString().trim() ?? ''
  const locationType = formData.get('location_type')?.toString().trim() ?? ''
  const cityText = formData.get('city_text')?.toString().trim() || null
  const stateText = formData.get('state_text')?.toString().trim() || null
  const serviceAreaDescription = formData.get('service_area_description')?.toString().trim() || null
  const shipsNationwide = formData.get('ships_nationwide') === 'true'
  const websiteUrl = formData.get('website_url')?.toString().trim() || null
  const email = formData.get('email')?.toString().trim() || null
  const phone = formData.get('phone')?.toString().trim() || null
  const ctaType = formData.get('cta_type')?.toString().trim() ?? ''
  const ctaUrl = formData.get('cta_url')?.toString().trim() || null
  const socialInstagram = formData.get('social_instagram')?.toString().trim() || null
  const socialFacebook = formData.get('social_facebook')?.toString().trim() || null
  const socialTwitter = formData.get('social_twitter')?.toString().trim() || null
  const socialTiktok = formData.get('social_tiktok')?.toString().trim() || null
  const socialLinkedin = formData.get('social_linkedin')?.toString().trim() || null
  const socialYoutube = formData.get('social_youtube')?.toString().trim() || null
  const logoPath = formData.get('logo_path')?.toString().trim() || null
  const coverImagePath = formData.get('cover_image_path')?.toString().trim() || null
  const tempEntityId = formData.get('temp_entity_id')?.toString().trim() || null
  const ownershipAttested = formData.get('ownership_attested') === 'true'
  // Ownership label is authoritative and required. Default to 'black_owned' only
  // if the field is entirely absent (older clients); an explicit invalid value is
  // rejected below.
  const ownershipLabelRaw = formData.get('ownership_label')
  const ownershipLabel =
    ownershipLabelRaw === null ? 'black_owned' : ownershipLabelRaw.toString().trim()

  // Event-only fields (read regardless; used only when entityType === 'event').
  const isEvent = entityType === 'event'
  const startsAtRaw = formData.get('starts_at')?.toString().trim() || ''
  const endsAtRaw = formData.get('ends_at')?.toString().trim() || ''
  const isOnline = formData.get('is_online') === 'true'
  const venueName = formData.get('venue_name')?.toString().trim() || null
  const venueAddress = formData.get('venue_address')?.toString().trim() || null
  const ticketUrl = formData.get('ticket_url')?.toString().trim() || null
  const priceText = formData.get('price_text')?.toString().trim() || null

  // Job-only fields (read regardless; used only when entityType === 'job').
  const isJob = entityType === 'job'
  const employmentType = formData.get('employment_type')?.toString().trim() ?? ''
  const workplaceType = formData.get('workplace_type')?.toString().trim() ?? ''
  const salaryMinRaw = formData.get('salary_min')?.toString().trim() || ''
  const salaryMaxRaw = formData.get('salary_max')?.toString().trim() || ''
  const salaryPeriod = formData.get('salary_period')?.toString().trim() || ''
  const applyUrl = formData.get('apply_url')?.toString().trim() || null
  const applyEmail = formData.get('apply_email')?.toString().trim() || null
  const closesAtRaw = formData.get('closes_at')?.toString().trim() || ''

  const fieldErrors: FieldErrors = {}

  if (!VALID_ENTITY_TYPES.includes(entityType as (typeof VALID_ENTITY_TYPES)[number])) {
    fieldErrors.entity_type = 'Select a listing type.'
  }

  if (!VALID_OWNERSHIP_LABELS.includes(ownershipLabel as (typeof VALID_OWNERSHIP_LABELS)[number])) {
    fieldErrors.ownership_label = 'Select whether your business is Black-Owned or an Ally.'
  }

  if (name.length < 2) {
    fieldErrors.name = 'Name must be at least 2 characters.'
  } else if (name.length > 120) {
    fieldErrors.name = 'Name must be 120 characters or fewer.'
  }

  if (tagline.length < 10) {
    fieldErrors.tagline = 'Short description must be at least 10 characters.'
  } else if (tagline.length > 120) {
    fieldErrors.tagline = 'Short description must be 120 characters or fewer.'
  }

  if (!categoryId) {
    fieldErrors.category_id = 'Select a category.'
  }

  if (description.length < 20) {
    fieldErrors.description = 'Description must be at least 20 characters.'
  } else if (description.length > 2000) {
    fieldErrors.description = 'Description must be 2000 characters or fewer.'
  }

  // Events derive their location_type from the online toggle, and jobs from the
  // workplace type — a remote role is 'virtual', hybrid is 'hybrid', on-site is
  // 'physical'. Everything else submits an explicit location_type.
  const effectiveLocationType = isEvent
    ? isOnline
      ? 'virtual'
      : 'physical'
    : isJob
      ? workplaceType === 'remote'
        ? 'virtual'
        : workplaceType === 'hybrid'
          ? 'hybrid'
          : 'physical'
      : locationType
  if (
    !VALID_LOCATION_TYPES.includes(effectiveLocationType as (typeof VALID_LOCATION_TYPES)[number])
  ) {
    fieldErrors.location_type = 'Select where you operate.'
  }

  // Parsed event timestamps (only meaningful when isEvent).
  let startsAtIso: string | null = null
  let endsAtIso: string | null = null

  if (isEvent) {
    const start = startsAtRaw ? new Date(startsAtRaw) : null
    if (!start || isNaN(start.getTime())) {
      fieldErrors.starts_at = 'Enter a valid start date and time.'
    } else {
      startsAtIso = start.toISOString()
    }
    if (endsAtRaw) {
      const end = new Date(endsAtRaw)
      if (isNaN(end.getTime())) {
        fieldErrors.ends_at = 'Enter a valid end date and time.'
      } else if (start && !isNaN(start.getTime()) && end < start) {
        fieldErrors.ends_at = 'End must be after the start.'
      } else {
        endsAtIso = end.toISOString()
      }
    }
    if (ticketUrl && !isValidUrl(ticketUrl)) {
      fieldErrors.ticket_url = 'Ticket link must start with https://'
    }
    if (!isOnline && !venueName) {
      fieldErrors.venue_name = 'Add a venue name, or mark the event online.'
    }
  } else if (isJob) {
    if (!JOB_EMPLOYMENT_TYPES.includes(employmentType as (typeof JOB_EMPLOYMENT_TYPES)[number])) {
      fieldErrors.employment_type = 'Select an employment type.'
    }
    if (!JOB_WORKPLACE_TYPES.includes(workplaceType as (typeof JOB_WORKPLACE_TYPES)[number])) {
      fieldErrors.workplace_type = 'Select where the work happens.'
    }

    // Salary is optional, but the DB CHECKs require a period whenever either
    // bound is set, and max >= min. Mirror both here so the failure is a field
    // message rather than a raw constraint violation.
    if (salaryMinRaw && (isNaN(Number(salaryMinRaw)) || Number(salaryMinRaw) < 0)) {
      fieldErrors.salary_min = 'Enter a number, or leave pay blank.'
    }
    if (salaryMaxRaw && (isNaN(Number(salaryMaxRaw)) || Number(salaryMaxRaw) < 0)) {
      fieldErrors.salary_max = 'Enter a number, or leave pay blank.'
    }
    if (
      salaryMinRaw &&
      salaryMaxRaw &&
      !fieldErrors.salary_min &&
      !fieldErrors.salary_max &&
      Number(salaryMaxRaw) < Number(salaryMinRaw)
    ) {
      fieldErrors.salary_max = 'Maximum pay must be at least the minimum.'
    }
    if ((salaryMinRaw || salaryMaxRaw) && !salaryPeriod) {
      fieldErrors.salary_period = 'Choose a pay period (per hour, per year, …).'
    }
    if (
      salaryPeriod &&
      !JOB_SALARY_PERIODS.includes(salaryPeriod as (typeof JOB_SALARY_PERIODS)[number])
    ) {
      fieldErrors.salary_period = 'Choose a valid pay period.'
    }

    // A posting nobody can respond to is not a posting.
    if (!applyUrl && !applyEmail) {
      fieldErrors.apply_url = 'Add an application link or an email to apply to.'
    }
    if (applyUrl && !isValidUrl(applyUrl)) {
      fieldErrors.apply_url = 'Application link must start with https://'
    }
    if (applyEmail && !isValidEmail(applyEmail)) {
      fieldErrors.apply_email = 'Enter a valid email address.'
    }

    if (closesAtRaw) {
      const closes = new Date(closesAtRaw)
      if (isNaN(closes.getTime())) {
        fieldErrors.closes_at = 'Enter a valid closing date.'
      } else if (closes.getTime() < Date.now()) {
        fieldErrors.closes_at = 'The closing date must be in the future.'
      }
    }
  } else {
    if (!VALID_CTA_TYPES.includes(ctaType as (typeof VALID_CTA_TYPES)[number])) {
      fieldErrors.cta_type = 'Select a primary call to action.'
    }
    if (websiteUrl && !isValidUrl(websiteUrl)) {
      fieldErrors.website_url = 'Website must start with https://'
    }
    if (email && !isValidEmail(email)) {
      fieldErrors.email = 'Enter a valid email address.'
    }
    // cta_url holds different value kinds depending on the action: an email for
    // "message", a phone for "call", a web link otherwise. Validate accordingly.
    if (ctaUrl) {
      if (ctaType === 'message') {
        if (!isValidEmail(ctaUrl)) fieldErrors.cta_url = 'Enter a valid email address.'
      } else if (ctaType === 'call') {
        // phone number — accept as entered (rendered as a tel: link)
      } else if (!isValidUrl(ctaUrl)) {
        fieldErrors.cta_url = 'URL must start with https://'
      }
    }

    const socialFields: [string, string | null][] = [
      ['social_instagram', socialInstagram],
      ['social_facebook', socialFacebook],
      ['social_twitter', socialTwitter],
      ['social_tiktok', socialTiktok],
      ['social_linkedin', socialLinkedin],
      ['social_youtube', socialYoutube],
    ]
    for (const [key, val] of socialFields) {
      if (val && !isValidUrl(val)) {
        fieldErrors[key] = 'Must be a valid URL starting with https://'
      }
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { error: 'Please fix the errors below.', fieldErrors }
  }

  const { data: category } = await supabase
    .from('categories')
    .select('id')
    .eq('id', categoryId)
    .eq('is_active', true)
    .maybeSingle()

  if (!category) {
    return {
      error: 'Please fix the errors below.',
      fieldErrors: { category_id: 'Invalid category. Please select again.' },
    }
  }

  let slug = generateSlug(name)
  if (!slug) slug = `listing-${Date.now().toString(36)}`

  const { data: existingSlug } = await supabase
    .from('listings')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existingSlug) {
    slug = `${slug}-${Date.now().toString(36)}`
  }

  const useId = tempEntityId && /^[0-9a-f-]{36}$/.test(tempEntityId) ? tempEntityId : undefined

  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .insert({
      ...(useId ? { id: useId } : {}),
      name,
      entity_type: entityType,
      category_id: categoryId,
      location_type: effectiveLocationType,
      status: 'draft',
      source: 'owner',
      submitted_by: user.id,
      owner_user_id: user.id,
      tagline: tagline || null,
      slug,
      tier: 'free',
      trust_tier: 'unclaimed',
      ships_nationwide: shipsNationwide,
      service_area_description: serviceAreaDescription,
      logo_path: logoPath,
      cover_image_path: coverImagePath,
      ownership_label: ownershipLabel,
      ownership_attested: ownershipAttested,
      ownership_attested_at: ownershipAttested ? new Date().toISOString() : null,
    })
    .select('id')
    .single()

  if (listingError || !listing) {
    console.error('[createListing] listings insert error:', listingError)
    return { error: 'Something went wrong creating your listing. Please try again.' }
  }

  const detailsError = isJob
    ? (
        await (supabase as unknown as SupabaseClient).from('listing_details_job').insert({
          listing_id: listing.id,
          description,
          employment_type: employmentType,
          workplace_type: workplaceType,
          salary_min: salaryMinRaw ? Number(salaryMinRaw) : null,
          salary_max: salaryMaxRaw ? Number(salaryMaxRaw) : null,
          // Nulled when no bound was given — the DB CHECK only requires a period
          // alongside an amount, and a lone period would render as nothing.
          salary_period: salaryMinRaw || salaryMaxRaw ? salaryPeriod : null,
          apply_url: applyUrl,
          apply_email: applyEmail,
          closes_at: closesAtRaw ? new Date(closesAtRaw).toISOString() : null,
          cta_type: 'apply',
          cta_url: applyUrl,
        })
      ).error
    : isEvent
    ? (
        await (supabase as unknown as SupabaseClient).from('listing_details_event').insert({
          listing_id: listing.id,
          description,
          starts_at: startsAtIso!,
          ends_at: endsAtIso,
          is_online: isOnline,
          venue_name: venueName,
          venue_address: venueAddress,
          city_text: cityText,
          state: stateText,
          ticket_url: ticketUrl,
          price_text: priceText,
          cta_type: 'get-tickets',
          cta_url: ticketUrl,
        })
      ).error
    : (
        await supabase.from('listing_details_business').insert({
          listing_id: listing.id,
          description,
          cta_type: ctaType,
          cta_url: ctaUrl,
          email,
          phone,
          website_url: websiteUrl,
          city_text: cityText,
          state: stateText,
          ships_nationwide: shipsNationwide,
          social_instagram: socialInstagram,
          social_facebook: socialFacebook,
          social_twitter: socialTwitter,
          social_tiktok: socialTiktok,
          social_linkedin: socialLinkedin,
          social_youtube: socialYoutube,
        })
      ).error

  if (detailsError) {
    await supabase.from('listings').delete().eq('id', listing.id)
    return {
      error: isJob
        ? 'Failed to save your job details. Please try again.'
        : isEvent
          ? 'Failed to save your event details. Please try again.'
          : 'Failed to save your business details. Please try again.',
    }
  }

  trackServerEvent({
    event_name: 'listing_draft_created',
    entity_id: listing.id,
    entity_type: 'listing',
    user_id: user.id,
    properties: { entity_type: entityType, category_id: categoryId, source: 'web_form' },
  })

  return { success: true, listingId: listing.id, listingName: name, slug }
}
