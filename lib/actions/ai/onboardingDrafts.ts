'use server'

import { loadOwnerNames } from '@/lib/ai/ownerName'
import { generate } from '@/lib/ai/provider'
import {
  DAY_LIMIT_LINE,
  DRAFT_CATEGORY_NAME_MAX,
  DRAFT_CATEGORY_NAME_MIN,
  DRAFT_FOCUSES,
  DRAFT_STYLES,
  FALLBACK_LINE,
  PAGE_LIMIT_LINE,
  fallbackDrafts,
  onboardingContextFrom,
  type CategoryOption,
  type DraftFocus,
  type DraftStyle,
  type OnboardingDrafts,
} from '@/lib/ai/onboarding'
import type { GuideCategory } from '@/lib/categories/sorting-guide'
import { revalidateOwnerEditors } from '@/lib/dashboard/revalidateEditors'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { isFeatureEnabled } from '@/lib/env'
import { isCreatorCategory } from '@/lib/listings/creatorCategories'
import { createClient } from '@/lib/supabase/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const OWNER_WORDS_MAX = 500

/**
 * The drafts after "Save my draft" (ticket 128). Always comes back with drafts
 * once the caller is proven to own the page: written ones when a generation
 * passes every check, and simple rules-only ones otherwise, with one plain line
 * saying so. `capped` hides the buttons that would ask again.
 */
export type OnboardingDraftsState =
  | {
      ok: true
      drafts: OnboardingDrafts
      /** Null when the drafts were written for this page. */
      fallbackLine: string | null
      capped: boolean
      /** The mock wrote these: the cards say "Sample text", as writing help does. */
      sample: boolean
      /** The top-level groups, for a new category idea. */
      groups: CategoryOption[]
      currentCategoryId: string | null
    }
  | { ok: false; error: string; code: 'off' | 'auth' | 'invalid' }

interface DraftListing {
  id: string
  name: string
  status: string
  entity_type: string
  category_id: string | null
  cities: unknown
  listing_details_business: unknown
}

function one<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null
  return (value as T | null) ?? null
}

/** The owner's draft page, or null when it is not theirs or not a new draft. */
async function loadOwnDraft(listingId: string, ownerId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('listings')
    .select(
      `id, name, status, entity_type, category_id,
       cities!listings_city_id_fkey(name, states!cities_state_id_fkey(code)),
       listing_details_business(description, city_text, state)`
    )
    .eq('id', listingId)
    .eq('owner_user_id', ownerId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error || !data) return null
  const row = data as unknown as DraftListing
  // Drafts are for a page that has not gone out yet. Creators have their own path.
  if (row.status !== 'draft' || row.entity_type === 'creator') return null
  return { supabase, row }
}

async function loadCategories(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<GuideCategory[] | null> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug, parent_id')
    .eq('is_active', true)
    .order('display_order')
  if (error || !data) return null
  return data as GuideCategory[]
}

export async function requestOnboardingDraftsAction(input: {
  listingId: string
  style: DraftStyle
  focus: DraftFocus
  aboutFromSite: boolean
}): Promise<OnboardingDraftsState> {
  // Off means today's flow exactly: no call and no audit row.
  if (!isFeatureEnabled('aiOnboarding')) {
    return { ok: false, error: "Drafts aren't available yet.", code: 'off' }
  }

  const owner = await getOwnerSession()
  if (!owner) return { ok: false, error: 'Sign in to get drafts for your page.', code: 'auth' }

  const listingId = typeof input?.listingId === 'string' ? input.listingId.trim() : ''
  if (
    !UUID_RE.test(listingId) ||
    !DRAFT_STYLES.includes(input.style) ||
    !DRAFT_FOCUSES.includes(input.focus) ||
    typeof input.aboutFromSite !== 'boolean'
  ) {
    return { ok: false, error: "Couldn't get drafts for this page.", code: 'invalid' }
  }

  // generate() writes with the service role and trusts its caller, so this
  // ownership check is the authorization boundary.
  const own = await loadOwnDraft(listingId, owner.user.id)
  if (!own) {
    return {
      ok: false,
      error: 'Page not found or you do not have permission to edit it.',
      code: 'invalid',
    }
  }
  const { supabase, row } = own

  const details = one<{ description: string | null; city_text: string | null; state: string | null }>(
    row.listing_details_business
  )
  const city = one<{ name: string; states: unknown }>(row.cities)
  const stateCode = one<{ code: string }>(city?.states)?.code ?? null
  const cityName = city?.name ?? details?.city_text ?? null
  const locationLabel = city
    ? `${city.name}${stateCode ? `, ${stateCode}` : ''}`
    : details?.city_text
      ? `${details.city_text}${details.state ? `, ${details.state}` : ''}`
      : null
  const description = details?.description ?? ''

  const categories = (await loadCategories(supabase)) ?? []
  const context = onboardingContextFrom({
    businessName: row.name,
    cityName,
    description,
    aboutFromSite: input.aboutFromSite,
    categories,
  })

  const base = { groups: [...context.groups], currentCategoryId: row.category_id }
  const simple = (fallbackLine: string, capped = false): OnboardingDraftsState => ({
    ok: true,
    drafts: fallbackDrafts({
      businessName: row.name,
      locationLabel,
      about: description,
      bestMatch: context.candidates[0] ?? null,
    }),
    fallbackLine,
    capped,
    sample: false,
    ...base,
  })

  // No categories means nothing to offer and nothing to check an answer against.
  if (categories.length === 0) return simple(FALLBACK_LINE)

  // The owner's name is read only to take it out of their words. Fail closed.
  const ownerNames = await loadOwnerNames(owner.user.id)
  if (!ownerNames.ok) return simple(FALLBACK_LINE)

  const result = await generate({
    kind: 'onboarding',
    listingId,
    triggeredBy: owner.user.id,
    context,
    ownerNames: ownerNames.names,
    request: { style: input.style, focus: input.focus },
  })

  if (!result.ok) {
    if (result.code === 'rate_limited') {
      return simple(result.scope === 'page' ? PAGE_LIMIT_LINE : DAY_LIMIT_LINE, true)
    }
    return simple(FALLBACK_LINE)
  }

  return {
    ok: true,
    drafts: result.drafts,
    fallbackLine: null,
    capped: false,
    sample: result.provider === 'mock',
    ...base,
  }
}

// ── Use this, on the category card ─────────────────────────────────────────

export type ApplyDraftCategoryState = { ok: true; message: string } | { ok: false; error: string }

const APPLY_FAILED = "Couldn't change your category. Try again."

/**
 * Puts the page in a category the owner picked from a draft, or sends the new
 * category they named (and may have edited) to the team, the same request path
 * as "Suggest a new category" in the quick start (ticket 126). Only for the
 * owner's own new draft; a live page keeps its category.
 */
export async function applyDraftCategoryAction(input: {
  listingId: string
  choice: { kind: 'existing'; categoryId: string } | { kind: 'new'; name: string; groupId: string }
}): Promise<ApplyDraftCategoryState> {
  if (!isFeatureEnabled('aiOnboarding')) return { ok: false, error: APPLY_FAILED }

  const owner = await getOwnerSession()
  if (!owner) return { ok: false, error: 'Sign in to change your category.' }

  const listingId = typeof input?.listingId === 'string' ? input.listingId.trim() : ''
  const choice = input?.choice
  const targetId =
    choice?.kind === 'existing' ? choice.categoryId : choice?.kind === 'new' ? choice.groupId : ''
  if (!UUID_RE.test(listingId) || typeof targetId !== 'string' || !UUID_RE.test(targetId)) {
    return { ok: false, error: APPLY_FAILED }
  }

  const proposedName = choice.kind === 'new' && typeof choice.name === 'string' ? choice.name.trim() : ''
  if (
    choice.kind === 'new' &&
    (proposedName.length < DRAFT_CATEGORY_NAME_MIN || proposedName.length > DRAFT_CATEGORY_NAME_MAX)
  ) {
    return { ok: false, error: 'Category name must be 2 to 60 characters.' }
  }

  const own = await loadOwnDraft(listingId, owner.user.id)
  if (!own) return { ok: false, error: 'Page not found or you do not have permission to edit it.' }
  const { supabase, row } = own

  const categories = await loadCategories(supabase)
  if (!categories) return { ok: false, error: APPLY_FAILED }
  const target = categories.find((c) => c.id === targetId)
  // Active only (the list is), never Creators, and a new idea goes under a group.
  if (!target || isCreatorCategory(target, categories) || (choice.kind === 'new' && target.parent_id !== null)) {
    return { ok: false, error: 'That category is not available. Pick another.' }
  }

  if (choice.kind === 'new') {
    const description =
      one<{ description: string | null }>(row.listing_details_business)?.description?.trim() ?? ''
    const { error: requestError } = await supabase.from('category_requests').insert({
      listing_id: listingId,
      requested_by: owner.user.id,
      owner_words: (description || proposedName).slice(0, OWNER_WORDS_MAX),
      proposed_name: proposedName,
      parent_category_id: target.id,
    })
    if (requestError) {
      if (requestError.code === '23505') {
        return {
          ok: false,
          error:
            "You've already suggested a new category for this page. Our team will look at it and email you either way.",
        }
      }
      return { ok: false, error: APPLY_FAILED }
    }
  }

  if (row.category_id !== target.id) {
    const { error: updateError } = await supabase
      .from('listings')
      .update({ category_id: target.id })
      .eq('id', listingId)
      .eq('owner_user_id', owner.user.id)
    if (updateError) {
      return {
        ok: false,
        error:
          choice.kind === 'new'
            ? 'Your new category idea was sent, but your page stayed in its old category for now.'
            : APPLY_FAILED,
      }
    }
  }

  revalidateOwnerEditors(listingId)
  return {
    ok: true,
    message:
      choice.kind === 'new'
        ? `Saved. Your page sits under ${target.name} for now, and our team will look at "${proposedName}" and email you either way.`
        : `Saved. Your page is now under ${target.name}.`,
  }
}
