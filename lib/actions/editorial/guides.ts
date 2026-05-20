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

export type GuideActionState =
  | { success: true; id?: string; slug?: string }
  | { error: string }
  | null

export type SectionActionState = { success: true } | { error: string } | null

// ─── Create guide ─────────────────────────────────────────────────────────────

export async function createGuideAction(
  _prev: GuideActionState,
  formData: FormData
): Promise<GuideActionState> {
  await requireAdmin()

  const title = formData.get('title')?.toString().trim() ?? ''
  const slugInput = formData.get('slug')?.toString().trim()
  const subtitle = formData.get('subtitle')?.toString().trim() || null
  const description = formData.get('description')?.toString().trim() || null
  const city = formData.get('city')?.toString().trim() || null
  const metaDescription = formData.get('meta_description')?.toString().trim() || null
  const publish = formData.get('action') === 'publish'

  if (!title) return { error: 'Title is required.' }

  const slug = slugInput || slugify(title)
  if (!slug) return { error: 'Could not generate a valid slug from the title.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from('guides')
    .insert({
      title,
      slug,
      subtitle,
      description,
      city,
      meta_description: metaDescription,
      status: publish ? 'published' : 'draft',
      published_at: publish ? new Date().toISOString() : null,
      created_by: user?.id ?? null,
    })
    .select('id, slug')
    .single()

  if (error) {
    if (error.code === '23505') return { error: 'A guide with that slug already exists.' }
    return { error: 'Failed to create guide. Please try again.' }
  }

  revalidatePath('/guides')
  revalidatePath('/admin/guides')
  return { success: true, id: data.id, slug: data.slug }
}

// ─── Update guide ─────────────────────────────────────────────────────────────

export async function updateGuideAction(
  _prev: GuideActionState,
  formData: FormData
): Promise<GuideActionState> {
  await requireAdmin()

  const id = formData.get('id')?.toString() ?? ''
  const title = formData.get('title')?.toString().trim() ?? ''
  const slug = formData.get('slug')?.toString().trim() ?? ''
  const subtitle = formData.get('subtitle')?.toString().trim() || null
  const description = formData.get('description')?.toString().trim() || null
  const city = formData.get('city')?.toString().trim() || null
  const metaDescription = formData.get('meta_description')?.toString().trim() || null
  const action = formData.get('action')?.toString()

  if (!id) return { error: 'Invalid guide.' }
  if (!title) return { error: 'Title is required.' }
  if (!slug) return { error: 'Slug is required.' }

  const serviceClient = createServiceClient()

  const { data: current } = await serviceClient
    .from('guides')
    .select('status, published_at')
    .eq('id', id)
    .single()

  let status = current?.status ?? 'draft'
  let publishedAt: string | null = current?.published_at ?? null

  if (action === 'publish' && status !== 'published') {
    status = 'published'
    publishedAt = new Date().toISOString()
  } else if (action === 'unpublish') {
    status = 'draft'
  }

  const { error } = await serviceClient
    .from('guides')
    .update({
      title,
      slug,
      subtitle,
      description,
      city,
      meta_description: metaDescription,
      status,
      published_at: publishedAt,
    })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') return { error: 'A guide with that slug already exists.' }
    return { error: 'Failed to update guide. Please try again.' }
  }

  revalidatePath('/guides')
  revalidatePath(`/guides/${slug}`)
  revalidatePath('/admin/guides')
  return { success: true }
}

// ─── Delete guide ─────────────────────────────────────────────────────────────

export async function deleteGuideAction(
  _prev: GuideActionState,
  formData: FormData
): Promise<GuideActionState> {
  await requireAdmin()

  const id = formData.get('id')?.toString() ?? ''
  if (!id) return { error: 'Invalid guide.' }

  const serviceClient = createServiceClient()
  const { error } = await serviceClient.from('guides').delete().eq('id', id)

  if (error) return { error: 'Failed to delete guide. Please try again.' }

  revalidatePath('/guides')
  revalidatePath('/admin/guides')
  return { success: true }
}

// ─── Create section ───────────────────────────────────────────────────────────

export async function createGuideSectionAction(
  _prev: SectionActionState,
  formData: FormData
): Promise<SectionActionState> {
  await requireAdmin()

  const guideId = formData.get('guide_id')?.toString() ?? ''
  const heading = formData.get('heading')?.toString().trim() ?? ''
  const body = formData.get('body')?.toString().trim() || null
  const displayOrder = parseInt(formData.get('display_order')?.toString() ?? '0') || 0

  if (!guideId) return { error: 'Invalid guide.' }
  if (!heading) return { error: 'Heading is required.' }

  const serviceClient = createServiceClient()
  const { error } = await serviceClient
    .from('guide_sections')
    .insert({ guide_id: guideId, heading, body, display_order: displayOrder })

  if (error) return { error: 'Failed to add section. Please try again.' }

  revalidatePath(`/admin/guides/${guideId}/edit`)
  return { success: true }
}

// ─── Update section ───────────────────────────────────────────────────────────

export async function updateGuideSectionAction(
  _prev: SectionActionState,
  formData: FormData
): Promise<SectionActionState> {
  await requireAdmin()

  const id = formData.get('id')?.toString() ?? ''
  const heading = formData.get('heading')?.toString().trim() ?? ''
  const body = formData.get('body')?.toString().trim() || null

  if (!id) return { error: 'Invalid section.' }
  if (!heading) return { error: 'Heading is required.' }

  const serviceClient = createServiceClient()
  const { error } = await serviceClient
    .from('guide_sections')
    .update({ heading, body })
    .eq('id', id)

  if (error) return { error: 'Failed to update section. Please try again.' }

  revalidatePath('/admin/guides')
  return { success: true }
}

// ─── Delete section ───────────────────────────────────────────────────────────

export async function deleteGuideSectionAction(
  _prev: SectionActionState,
  formData: FormData
): Promise<SectionActionState> {
  await requireAdmin()

  const id = formData.get('id')?.toString() ?? ''
  if (!id) return { error: 'Invalid section.' }

  const serviceClient = createServiceClient()
  const { error } = await serviceClient.from('guide_sections').delete().eq('id', id)

  if (error) return { error: 'Failed to delete section. Please try again.' }

  revalidatePath('/admin/guides')
  return { success: true }
}
