'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/admin/guard'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type CollectionActionState = { success: true; id?: string } | { error: string } | null

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createCollectionAction(
  _prev: CollectionActionState,
  formData: FormData
): Promise<CollectionActionState> {
  await requireAdmin()

  const title = formData.get('title')?.toString().trim() ?? ''
  const slugInput = formData.get('slug')?.toString().trim()
  const description = formData.get('description')?.toString().trim() || null
  const isActive = formData.get('is_active') === 'on'

  if (!title) return { error: 'Title is required.' }

  const slug = slugInput || slugify(title)
  if (!slug) return { error: 'Could not generate a valid slug from the title.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from('collections')
    .insert({ title, slug, description, is_active: isActive, created_by: user?.id ?? null })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return { error: 'A collection with that slug already exists.' }
    return { error: 'Failed to create collection. Please try again.' }
  }

  revalidatePath('/collections')
  revalidatePath('/admin/collections')
  return { success: true, id: data.id }
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateCollectionAction(
  _prev: CollectionActionState,
  formData: FormData
): Promise<CollectionActionState> {
  await requireAdmin()

  const id = formData.get('id')?.toString() ?? ''
  const title = formData.get('title')?.toString().trim() ?? ''
  const slug = formData.get('slug')?.toString().trim() ?? ''
  const description = formData.get('description')?.toString().trim() || null
  const isActive = formData.get('is_active') === 'on'

  if (!id) return { error: 'Invalid collection.' }
  if (!title) return { error: 'Title is required.' }
  if (!slug) return { error: 'Slug is required.' }

  const serviceClient = createServiceClient()
  const { error } = await serviceClient
    .from('collections')
    .update({ title, slug, description, is_active: isActive })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') return { error: 'A collection with that slug already exists.' }
    return { error: 'Failed to update collection. Please try again.' }
  }

  revalidatePath('/collections')
  revalidatePath(`/collections/${slug}`)
  revalidatePath('/admin/collections')
  return { success: true }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteCollectionAction(
  _prev: CollectionActionState,
  formData: FormData
): Promise<CollectionActionState> {
  await requireAdmin()

  const id = formData.get('id')?.toString() ?? ''
  if (!id) return { error: 'Invalid collection.' }

  const serviceClient = createServiceClient()
  const { error } = await serviceClient.from('collections').delete().eq('id', id)

  if (error) return { error: 'Failed to delete collection. Please try again.' }

  revalidatePath('/collections')
  revalidatePath('/admin/collections')
  return { success: true }
}

// ─── Add listing to collection ────────────────────────────────────────────────

export async function addCollectionItemAction(
  _prev: CollectionActionState,
  formData: FormData
): Promise<CollectionActionState> {
  await requireAdmin()

  const collectionId = formData.get('collection_id')?.toString() ?? ''
  const listingId = formData.get('listing_id')?.toString().trim() ?? ''

  if (!collectionId || !listingId) return { error: 'Collection and listing are required.' }

  const serviceClient = createServiceClient()
  const { error } = await serviceClient
    .from('collection_items')
    .insert({ collection_id: collectionId, listing_id: listingId })

  if (error) {
    if (error.code === '23505') return { error: 'This listing is already in the collection.' }
    if (error.code === '23503') return { error: 'Listing not found.' }
    return { error: 'Failed to add listing. Please try again.' }
  }

  revalidatePath('/admin/collections')
  return { success: true }
}

// ─── Remove listing from collection ──────────────────────────────────────────

export async function removeCollectionItemAction(
  _prev: CollectionActionState,
  formData: FormData
): Promise<CollectionActionState> {
  await requireAdmin()

  const itemId = formData.get('item_id')?.toString() ?? ''
  if (!itemId) return { error: 'Invalid item.' }

  const serviceClient = createServiceClient()
  const { error } = await serviceClient.from('collection_items').delete().eq('id', itemId)

  if (error) return { error: 'Failed to remove listing. Please try again.' }

  revalidatePath('/admin/collections')
  return { success: true }
}
