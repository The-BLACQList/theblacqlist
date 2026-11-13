'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { isFeatureEnabled } from '@/lib/env'
import { buildEntityUrl } from '@/lib/listings/url'
import { checkPostAdd } from '@/lib/stripe/planChecks'
import { offerGrowthTo, offerPremiumTo } from '@/lib/marketplace/entitlements'
import { revalidateOwnerEditors } from '@/lib/dashboard/revalidateEditors'
import {
  countsTowardLimit,
  isLive,
  isUploadedPostImagePath,
  parsePost,
  toOwnerPosts,
  type OwnerPost,
} from '@/lib/listings/happeningNow'

// Happening now posts (owner-experience round 2, part F). The owner posts,
// edits, ends and deletes short dated posts for their page. Writes run on the
// owner's own client, so the listing_posts RLS policies apply as well as the
// checks here. Every action returns the page's posts as saved.
//
// There is no word filter for owner text in this codebase yet; post text gets
// the same checks as other owner text (length, one line) plus no links in the
// text, since links belong in the button.

export type PostsState = { success: true; posts: OwnerPost[] } | { error: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NOT_FOUND = 'Page not found, or you can’t edit it.'
const TRY_AGAIN = 'We couldn’t save your post. Please try again.'
const OFF = 'Happening now posts aren’t available yet.'
/** Saved posts per page, drafts and ended ones included. */
const MAX_SAVED_POSTS = 50

const POST_COLUMNS = 'id, headline, body, image_path, button_label, button_url, starts_at, ends_at, status, created_at'

type Supabase = Awaited<ReturnType<typeof createClient>>

interface OwnedListing {
  id: string
  slug: string
  status: string | null
  entity_type: string
  tier: string | null
  cities: unknown
}

async function ownedListing(
  listingId: unknown
): Promise<{ ok: false; error: string } | { ok: true; supabase: Supabase; listing: OwnedListing }> {
  if (!isFeatureEnabled('happeningNow')) return { ok: false, error: OFF }
  const owner = await getOwnerSession()
  if (!owner) return { ok: false, error: 'Please sign in again.' }
  if (typeof listingId !== 'string' || !UUID_RE.test(listingId)) return { ok: false, error: NOT_FOUND }

  const supabase = await createClient()
  const { data: listing } = await supabase
    .from('listings')
    .select('id, slug, status, entity_type, tier, cities(slug)')
    .eq('id', listingId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!listing) return { ok: false, error: NOT_FOUND }
  // Jobs and events are dated posts already.
  if (listing.entity_type === 'job' || listing.entity_type === 'event') return { ok: false, error: NOT_FOUND }
  return { ok: true, supabase, listing: listing as OwnedListing }
}

async function readPosts(supabase: Supabase, listingId: string): Promise<OwnerPost[] | null> {
  const { data, error } = await supabase
    .from('listing_posts')
    .select(POST_COLUMNS)
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false })
  if (error) return null
  return toOwnerPosts(data)
}

function revalidate(listing: OwnedListing): void {
  if (listing.status === 'published') {
    const citySlug = (listing.cities as { slug: string } | null)?.slug
    if (citySlug && listing.slug) revalidatePath(buildEntityUrl(listing.entity_type, citySlug, listing.slug))
  }
  revalidatePath(`/dashboard/pages/${listing.id}/posts`)
  revalidateOwnerEditors(listing.id)
}

async function done(supabase: Supabase, listing: OwnedListing): Promise<PostsState> {
  revalidate(listing)
  const posts = await readPosts(supabase, listing.id)
  return posts ? { success: true, posts } : { error: TRY_AGAIN }
}

/** Removes an image the owner uploaded for a post. Best effort. */
async function removeImage(listingId: string, path: string | null | undefined): Promise<void> {
  if (!path || !isUploadedPostImagePath(listingId, path)) return
  try {
    await createServiceClient().storage.from('listing-media').remove([path])
  } catch {
    // A leftover file is harmless; the post no longer points at it.
  }
}

/** The uploaded file must be there: only the owner can upload into this folder. */
async function imageExists(listingId: string, path: string): Promise<boolean> {
  const folder = `listings/${listingId}/post`
  const name = path.slice(folder.length + 1)
  const { data } = await createServiceClient().storage.from('listing-media').list(folder, { search: name, limit: 1 })
  return Boolean(data?.some((f) => f.name === name))
}

export interface SavePostInput {
  listingId: unknown
  /** Left out for a new post. */
  id?: unknown
  headline: unknown
  body: unknown
  buttonLabel: unknown
  buttonUrl: unknown
  startsAt: unknown
  endsAt: unknown
  /** A new upload's path, null to remove the image, undefined to keep it. */
  imagePath?: unknown
  /** true posts it (or keeps it on); false saves it as a draft. */
  publish: unknown
}

/** Creates or edits one post. Turning a post on is checked against the plan's limit. */
export async function savePostAction(input: SavePostInput): Promise<PostsState> {
  const owned = await ownedListing(input?.listingId)
  if (!owned.ok) return { error: owned.error }
  const { supabase, listing } = owned

  const posts = await readPosts(supabase, listing.id)
  if (!posts) return { error: TRY_AGAIN }

  const now = new Date()
  const id = input.id === undefined || input.id === null ? null : input.id
  if (id !== null && (typeof id !== 'string' || !UUID_RE.test(id))) return { error: 'Post not found.' }
  const existing = id ? posts.find((p) => p.id === id) : undefined
  if (id && !existing) return { error: 'Post not found.' }
  if (!existing && posts.length >= MAX_SAVED_POSTS) {
    return { error: `You have ${MAX_SAVED_POSTS} saved posts. Delete an old one to add another.` }
  }

  // A running post keeps its start; anything else starts now at the earliest.
  const parsed = parsePost(input, now, existing && isLive(existing, now) ? existing.starts_at : null)
  if (!parsed.ok) return { error: parsed.error }

  let imagePath: string | null = existing?.image_path ?? null
  if (input.imagePath === null) imagePath = null
  else if (typeof input.imagePath === 'string' && input.imagePath !== existing?.image_path) {
    if (!isUploadedPostImagePath(listing.id, input.imagePath) || !(await imageExists(listing.id, input.imagePath))) {
      return { error: 'We couldn’t find that image. Please upload it again.' }
    }
    imagePath = input.imagePath
  }

  const publish = input.publish === true
  if (publish && !(existing && countsTowardLimit(existing, now))) {
    const on = posts.filter((p) => p.id !== existing?.id && countsTowardLimit(p, now)).length
    const [growthOpen, premiumOpen] = await Promise.all([offerGrowthTo(listing.tier), offerPremiumTo(listing.tier)])
    const limitError = checkPostAdd(listing.tier, on, growthOpen, premiumOpen)
    if (limitError) return { error: limitError }
  }

  const row = { ...parsed.value, image_path: imagePath, status: publish ? 'active' : 'draft' }
  const { error } = existing
    ? await supabase.from('listing_posts').update(row).eq('id', existing.id).eq('listing_id', listing.id)
    : await supabase.from('listing_posts').insert({ listing_id: listing.id, ...row })
  if (error) return { error: TRY_AGAIN }

  if (existing?.image_path && existing.image_path !== imagePath) await removeImage(listing.id, existing.image_path)
  return done(supabase, listing)
}

/** Ends a post now. Always allowed. */
export async function endPostAction(input: { listingId: unknown; id: unknown }): Promise<PostsState> {
  if (typeof input?.id !== 'string' || !UUID_RE.test(input.id)) return { error: 'Post not found.' }
  const owned = await ownedListing(input?.listingId)
  if (!owned.ok) return { error: owned.error }
  const { supabase, listing } = owned

  const { error } = await supabase
    .from('listing_posts')
    .update({ status: 'ended' })
    .eq('id', input.id)
    .eq('listing_id', listing.id)
  if (error) return { error: TRY_AGAIN }
  return done(supabase, listing)
}

/** Deletes a post and its image. Always allowed. */
export async function deletePostAction(input: { listingId: unknown; id: unknown }): Promise<PostsState> {
  if (typeof input?.id !== 'string' || !UUID_RE.test(input.id)) return { error: 'Post not found.' }
  const owned = await ownedListing(input?.listingId)
  if (!owned.ok) return { error: owned.error }
  const { supabase, listing } = owned

  const { data: removed, error } = await supabase
    .from('listing_posts')
    .delete()
    .eq('id', input.id)
    .eq('listing_id', listing.id)
    .select('image_path')
    .maybeSingle()
  if (error) return { error: TRY_AGAIN }
  await removeImage(listing.id, removed?.image_path)
  return done(supabase, listing)
}
