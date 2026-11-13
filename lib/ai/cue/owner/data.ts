import 'server-only'

/**
 * What the owner Cue reads (ticket 203). Every read is the caller's own pages,
 * on the caller's own client (RLS) and filtered by `owner_user_id` as well.
 * Nothing here reads visitors, customers or messages.
 *
 * Page text goes through sanitizeForPrompt with the owner's name terms, so
 * emails, phones, street addresses and their name come out before anything
 * reaches the model. That throws when redaction fails; the tool loop turns a
 * throw into a stop, so nothing unredacted is sent.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { computePageChecklist } from '@/lib/ai/checklist'
import { ownerNameTerms } from '@/lib/ai/redact'
import { sanitizeForPrompt } from '@/lib/ai/sanitize'
import { creatorChecklistFacts } from '@/lib/listings/creatorAttributes'
import { FINISH_ITEMS, itemLabel } from '@/lib/listings/finishItems'
import { loadFinishData } from '@/lib/listings/finishData'

import { sectionForAnchor, type OwnerSection } from './sections'

/** Pages one chat knows about. An owner with more is asked which one. */
export const OWNER_CUE_MAX_PAGES = 25
const ABOUT_CHARS = 500
const SHORT_CHARS = 200

export interface OwnedPage {
  id: string
  name: string
  entityType: string
  tier: string
  status: string
}

/** The caller's pages, newest first. Null when the read fails. */
export async function loadOwnedPages(
  supabase: SupabaseClient,
  userId: string
): Promise<OwnedPage[] | null> {
  const { data, error } = await supabase
    .from('listings')
    .select('id, name, entity_type, tier, status')
    .eq('owner_user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(OWNER_CUE_MAX_PAGES)
  if (error || !data) return null
  return (
    data as { id: string; name: string; entity_type: string; tier: string | null; status: string }[]
  ).map((r) => ({
    id: r.id,
    name: r.name,
    entityType: r.entity_type,
    tier: r.tier ?? 'free',
    status: r.status,
  }))
}

export interface PageFacts {
  id: string
  name: string
  kind: string
  plan: string
  status: string
  city: string | null
  category: string | null
  tagline: string | null
  about: string | null
  aboutLength: number
  counts: { photos: number; services: number; daysWithHours: number; extraButtons: number }
  mainButton: string | null
  hasSearchTitle: boolean
  hasSearchDescription: boolean
  strengthPercent: number | null
  missing: { item: string; section: OwnerSection | null }[]
}

/**
 * One page's facts for get_my_page. Null when the page isn't the caller's.
 * Events and jobs have no edit page here, so they come back with the basics
 * only.
 */
export async function loadPageFacts(
  supabase: SupabaseClient,
  page: OwnedPage,
  userId: string,
  ownerNames: readonly string[]
): Promise<PageFacts | null> {
  const redaction = { ownerNameTerms: ownerNameTerms(ownerNames, page.name) }
  const data = await loadFinishData(supabase, page.id, userId)
  if (!data) {
    if (page.entityType !== 'event' && page.entityType !== 'job') return null
    return {
      id: page.id,
      name: page.name,
      kind: page.entityType,
      plan: page.tier,
      status: page.status,
      city: null,
      category: null,
      tagline: null,
      about: null,
      aboutLength: 0,
      counts: { photos: 0, services: 0, daysWithHours: 0, extraButtons: 0 },
      mainButton: null,
      hasSearchTitle: false,
      hasSearchDescription: false,
      strengthPercent: null,
      missing: [],
    }
  }

  const d = data.details
  const checklist = computePageChecklist(
    {
      tagline: data.tagline,
      meta_title: data.metaTitle,
      meta_description: data.metaDescription,
      cover_image_path: data.coverImagePath,
      entity_type: data.entityType,
    },
    d,
    data.media.length,
    data.services.length,
    data.hoursCount,
    data.tier ?? undefined,
    data.entityType === 'creator' ? creatorChecklistFacts(data) : null
  )
  const about = sanitizeForPrompt(d?.description ?? null, ABOUT_CHARS, redaction)

  return {
    id: data.id,
    name: sanitizeForPrompt(data.name, SHORT_CHARS),
    kind: data.entityType,
    plan: data.tier ?? 'free',
    status: data.status,
    city: data.locationLabel,
    category: data.categoryName,
    tagline: sanitizeForPrompt(data.tagline, SHORT_CHARS, redaction) || null,
    about: about || null,
    aboutLength: d?.description?.length ?? 0,
    counts: {
      photos: data.media.length,
      services: data.services.length,
      daysWithHours: data.hoursCount,
      extraButtons: data.buttons.length,
    },
    mainButton: d?.cta_type ?? null,
    hasSearchTitle: !!data.metaTitle,
    hasSearchDescription: !!data.metaDescription,
    strengthPercent: checklist.percent,
    missing: checklist.items
      .filter((i) => !i.passed)
      .map((i) => ({
        item: itemLabel(i.id, i.label),
        section: sectionForAnchor(FINISH_ITEMS[i.id]?.anchor ?? '#basics'),
      })),
  }
}
