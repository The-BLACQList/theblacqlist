'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { buildEntityUrl } from '@/lib/listings/url'
import { revalidateOwnerEditors } from '@/lib/dashboard/revalidateEditors'
import { checkRateLimit } from '@/lib/security/rate-limit'
import {
  matchesDeclaredType,
  SIGNATURE_HEADER_BYTES,
  SIGNATURE_MISMATCH_ERROR,
} from '@/lib/security/file-signature'
import {
  DOCUMENT_COLUMNS,
  LISTING_DOCUMENT_BUCKET,
  LISTING_DOCUMENT_MAX_BYTES,
  LISTING_DOCUMENT_MIME,
  buildListingDocumentPath,
  checkDocumentAdd,
  checkDocumentFile,
  isListingDocumentPath,
  listingDocumentFolder,
  parseDocumentLabel,
  toOwnerDocuments,
  type OwnerDocument,
} from '@/lib/listings/documents'

// Documents (ticket 194): the menu, the rate card, the commission guide.
//
// Upload: the browser sends the PDF straight to storage. A server function
// body tops out near 4.5 MB on Vercel, under a 10 MB PDF, so the server hands
// out a one-time upload URL for a path it chose, the browser uploads to it,
// and then the server checks what arrived (type, size, the `%PDF-` bytes)
// before a row points at it. Same flow as an uploaded video (ticket 130).
//
// Rows are written on the owner's own client, so the listing_documents RLS
// policies apply as well as the checks here; storage is written by the
// service client only. Adding needs room under the plan's limit; renaming,
// reordering and removing are always allowed, so an owner who moved down a
// plan can choose which documents still show.

export type DocumentsState = { success: true; items: OwnerDocument[] } | { error: string }
export type StartDocumentUploadResult = { path: string; signedUrl: string } | { error: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NOT_FOUND = 'Page not found, or you can’t edit it.'
const TRY_AGAIN = 'We couldn’t save that. Please try again.'
const ITEM_NOT_FOUND = 'That document wasn’t found. Reload the page and try again.'

// Each upload can be 10 MB. Twenty an hour covers retries on a bad connection
// and still caps what one account can push into storage.
const DOCUMENT_UPLOAD_RATE_LIMIT = 20
const DOCUMENT_UPLOAD_RATE_WINDOW_SECONDS = 60 * 60

// A signed upload URL lasts two hours. A file younger than that with no row
// may be an upload still in flight in another tab, so cleanup leaves it.
const UPLOAD_GRACE_MS = 2 * 60 * 60 * 1000

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
): Promise<
  | { ok: false; error: string }
  | { ok: true; supabase: Supabase; listing: OwnedListing; userId: string }
> {
  const owner = await getOwnerSession()
  if (!owner) return { ok: false, error: 'Please sign in again.' }
  if (typeof listingId !== 'string' || !UUID_RE.test(listingId)) {
    return { ok: false, error: NOT_FOUND }
  }

  const supabase = await createClient()
  const { data: listing } = await supabase
    .from('listings')
    .select('id, slug, status, entity_type, tier, cities(slug)')
    .eq('id', listingId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!listing) return { ok: false, error: NOT_FOUND }
  // A job or an event has no Offerings heading to carry documents.
  if (listing.entity_type === 'job' || listing.entity_type === 'event') {
    return { ok: false, error: NOT_FOUND }
  }
  return { ok: true, supabase, listing: listing as OwnedListing, userId: owner.user.id }
}

async function readItems(supabase: Supabase, listingId: string): Promise<OwnerDocument[] | null> {
  const { data, error } = await supabase
    .from('listing_documents')
    .select(DOCUMENT_COLUMNS)
    .eq('listing_id', listingId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) return null
  return toOwnerDocuments(data)
}

/**
 * Removes files in this listing's folder that no row points at: a removed
 * document, or an upload started and never finished. Best effort: a leftover
 * file costs storage, not correctness.
 */
async function removeUnusedFiles(supabase: Supabase, listingId: string): Promise<void> {
  try {
    const rows = await readItems(supabase, listingId)
    if (!rows) return
    const used = new Set(rows.map((r) => r.path))
    const storage = createServiceClient().storage.from(LISTING_DOCUMENT_BUCKET)
    const folder = listingDocumentFolder(listingId)
    const { data } = await storage.list(folder, { limit: 100 })
    const cutoff = Date.now() - UPLOAD_GRACE_MS
    const stale = (data ?? [])
      .filter((o) => {
        const created = o.created_at ? Date.parse(o.created_at) : NaN
        return Number.isNaN(created) || created < cutoff
      })
      .map((o) => `${folder}/${o.name}`)
      .filter((p) => !used.has(p))
    if (stale.length > 0) await storage.remove(stale)
  } catch {
    // Storage unreachable or the bucket not created yet. Nothing to clean.
  }
}

function revalidate(listing: OwnedListing): void {
  if (listing.status === 'published' && listing.slug) {
    const citySlug = (listing.cities as { slug: string } | null)?.slug
    revalidatePath(buildEntityUrl(listing.entity_type, citySlug, listing.slug))
  }
  revalidatePath(`/dashboard/pages/${listing.id}/documents`)
  revalidateOwnerEditors(listing.id)
}

async function done(supabase: Supabase, listing: OwnedListing): Promise<DocumentsState> {
  revalidate(listing)
  const items = await readItems(supabase, listing.id)
  return items ? { success: true, items } : { error: TRY_AGAIN }
}

/** Reads the first bytes of the uploaded object back from storage. */
async function readStoredHeader(path: string): Promise<Uint8Array | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  try {
    const res = await fetch(`${base}/storage/v1/object/public/${LISTING_DOCUMENT_BUCKET}/${path}`, {
      headers: { Range: `bytes=0-${SIGNATURE_HEADER_BYTES - 1}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return new Uint8Array(await res.arrayBuffer()).slice(0, SIGNATURE_HEADER_BYTES)
  } catch {
    return null
  }
}

/** Step 1: checks the file and the plan, then issues a one-time upload URL. */
export async function startDocumentUploadAction(input: {
  listingId: unknown
  mime: unknown
  size: unknown
}): Promise<StartDocumentUploadResult> {
  const fileError = checkDocumentFile(input?.mime, input?.size)
  if (fileError) return { error: fileError }
  const owned = await ownedListing(input.listingId)
  if (!owned.ok) return { error: owned.error }
  const { supabase, listing, userId } = owned

  const items = await readItems(supabase, listing.id)
  if (!items) return { error: 'We couldn’t start the upload. Please try again.' }
  const refusal = checkDocumentAdd(listing.tier, items.length)
  if (refusal) return { error: refusal }

  if (
    !(await checkRateLimit({
      bucket: 'document_upload',
      identifier: userId,
      limit: DOCUMENT_UPLOAD_RATE_LIMIT,
      windowSeconds: DOCUMENT_UPLOAD_RATE_WINDOW_SECONDS,
    }))
  ) {
    return { error: 'Too many uploads. Please wait a while and try again.' }
  }

  const path = buildListingDocumentPath(listing.id)
  const { data, error } = await createServiceClient()
    .storage.from(LISTING_DOCUMENT_BUCKET)
    .createSignedUploadUrl(path)
  if (error || !data) return { error: 'We couldn’t start the upload. Please try again.' }
  return { path, signedUrl: data.signedUrl }
}

/** Step 2: checks what arrived in storage, then saves the document. */
export async function finishDocumentUploadAction(input: {
  listingId: unknown
  path: unknown
  label: unknown
}): Promise<DocumentsState> {
  const label = parseDocumentLabel(input?.label)
  if (!label.ok) return { error: label.error }
  const owned = await ownedListing(input.listingId)
  if (!owned.ok) return { error: owned.error }
  const { supabase, listing } = owned

  // Only a path this listing could have been issued.
  const path = input.path
  if (!isListingDocumentPath(path, listing.id)) {
    return { error: 'That upload isn’t for this page.' }
  }

  const items = await readItems(supabase, listing.id)
  if (!items) return { error: TRY_AGAIN }
  if (items.some((d) => d.path === path)) return { success: true, items }
  const refusal = checkDocumentAdd(listing.tier, items.length)
  if (refusal) return { error: refusal }

  const storage = createServiceClient().storage.from(LISTING_DOCUMENT_BUCKET)
  const folder = listingDocumentFolder(listing.id)
  const name = path.slice(folder.length + 1)
  const { data: found } = await storage.list(folder, { search: name, limit: 1 })
  const object = (found ?? []).find((o) => o.name === name)
  if (!object) return { error: 'The upload didn’t finish. Please try again.' }

  // The bucket already enforced type and size on the way in. These are the
  // same checks against what storage says it holds, plus the bytes themselves.
  const meta = (object.metadata ?? {}) as { size?: number; mimetype?: string }
  const fail = async (error: string): Promise<DocumentsState> => {
    await storage.remove([path])
    return { error }
  }
  if (meta.mimetype !== LISTING_DOCUMENT_MIME) return fail('Choose a PDF file.')
  if (typeof meta.size !== 'number' || meta.size <= 0) {
    return fail('That file looks empty. Choose another PDF.')
  }
  if (meta.size > LISTING_DOCUMENT_MAX_BYTES) return fail('PDFs can be up to 10 MB.')
  const header = await readStoredHeader(path)
  if (!header) return fail('We couldn’t check the upload. Please try again.')
  if (!matchesDeclaredType(header, LISTING_DOCUMENT_MIME)) return fail(SIGNATURE_MISMATCH_ERROR)

  const sortOrder = items.reduce((max, d) => Math.max(max, d.sortOrder + 1), 0)
  const { error } = await supabase.from('listing_documents').insert({
    listing_id: listing.id,
    label: label.value,
    path,
    size_bytes: meta.size,
    sort_order: sortOrder,
  })
  if (error) return fail(TRY_AGAIN)
  await removeUnusedFiles(supabase, listing.id)
  return done(supabase, listing)
}

/** Renames the download button. Always allowed. */
export async function renameDocumentAction(input: {
  listingId: unknown
  id: unknown
  label: unknown
}): Promise<DocumentsState> {
  const label = parseDocumentLabel(input?.label)
  if (!label.ok) return { error: label.error }
  const owned = await ownedListing(input.listingId)
  if (!owned.ok) return { error: owned.error }
  const { supabase, listing } = owned

  const items = await readItems(supabase, listing.id)
  if (!items) return { error: TRY_AGAIN }
  if (!items.some((d) => d.id === input.id)) return { error: ITEM_NOT_FOUND }

  const { error } = await supabase
    .from('listing_documents')
    .update({ label: label.value })
    .eq('id', input.id as string)
    .eq('listing_id', listing.id)
  if (error) return { error: TRY_AGAIN }
  return done(supabase, listing)
}

/** Saves a new order. The first ones are what a lower plan shows. */
export async function reorderDocumentsAction(input: {
  listingId: unknown
  ids: unknown
}): Promise<DocumentsState> {
  const owned = await ownedListing(input?.listingId)
  if (!owned.ok) return { error: owned.error }
  const { supabase, listing } = owned

  const items = await readItems(supabase, listing.id)
  if (!items) return { error: TRY_AGAIN }

  const ids = input.ids
  if (
    !Array.isArray(ids) ||
    ids.length !== items.length ||
    new Set(ids).size !== ids.length ||
    !ids.every((x) => typeof x === 'string' && items.some((d) => d.id === x))
  ) {
    return { error: 'Your list changed in another tab. Reload the page and try again.' }
  }

  const moves = (ids as string[])
    .map((docId, order) => ({ docId, order }))
    .filter(({ docId, order }) => items.find((d) => d.id === docId)?.sortOrder !== order)
  const results = await Promise.all(
    moves.map(({ docId, order }) =>
      supabase
        .from('listing_documents')
        .update({ sort_order: order })
        .eq('id', docId)
        .eq('listing_id', listing.id)
    )
  )
  if (results.some((r) => r.error)) return { error: TRY_AGAIN }
  return done(supabase, listing)
}

/** Removes a document and its file. Always allowed. */
export async function deleteDocumentAction(input: {
  listingId: unknown
  id: unknown
}): Promise<DocumentsState> {
  const owned = await ownedListing(input?.listingId)
  if (!owned.ok) return { error: owned.error }
  const { supabase, listing } = owned

  const items = await readItems(supabase, listing.id)
  if (!items) return { error: TRY_AGAIN }
  const doc = items.find((d) => d.id === input.id)
  if (!doc) return { error: ITEM_NOT_FOUND }

  const { error } = await supabase
    .from('listing_documents')
    .delete()
    .eq('id', doc.id)
    .eq('listing_id', listing.id)
  if (error) return { error: TRY_AGAIN }
  try {
    await createServiceClient().storage.from(LISTING_DOCUMENT_BUCKET).remove([doc.path])
  } catch {
    // The row is gone, so the page no longer links it; the next cleanup retries.
  }
  return done(supabase, listing)
}
