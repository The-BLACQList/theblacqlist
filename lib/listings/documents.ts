import { canAccess, documentLimit } from '@/lib/stripe/features'
import type { DocumentItem } from '@/types'

// Documents (ticket 194): the menu, the rate card, the commission guide. The
// rules shared by the owner's actions, the dashboard and the page loader.
// Pure. Files live in their own public bucket, PDF only, and the page links
// to them as downloads, never rendered inline.

export const LISTING_DOCUMENT_BUCKET = 'listing-documents'
export const LISTING_DOCUMENT_MIME = 'application/pdf'
/** Matches the bucket's file_size_limit and the table's size CHECK. */
export const LISTING_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024
export const DOCUMENT_LABEL_MAX = 60
export const DOCUMENT_COLUMNS = 'id, label, path, size_bytes, sort_order'

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

export interface OwnerDocument {
  id: string
  label: string
  path: string
  sizeBytes: number
  sortOrder: number
}

/** Business pages whose plan offers documents: Starter and up. */
export function documentsShowOn(page: { tier: string | null; entity_type: string }): boolean {
  if (page.entity_type === 'job' || page.entity_type === 'event') return false
  return canAccess(page.tier, 'documents')
}

export function listingDocumentFolder(listingId: string): string {
  return `listings/${listingId}/documents`
}

/** A fresh path in this listing's folder. The server picks it; the filename never counts. */
export function buildListingDocumentPath(
  listingId: string,
  id: string = crypto.randomUUID()
): string {
  return `${listingDocumentFolder(listingId)}/${id}.pdf`
}

/** True only for a path this listing could have been issued. */
export function isListingDocumentPath(path: unknown, listingId: string): path is string {
  if (typeof path !== 'string') return false
  return (
    new RegExp(`^listings/${UUID}/documents/${UUID}\\.pdf$`, 'i').test(path) &&
    path.startsWith(`${listingDocumentFolder(listingId)}/`)
  )
}

export type ParsedLabel = { ok: true; value: string } | { ok: false; error: string }

/** The label on the download button: one line, 1–60 characters. */
export function parseDocumentLabel(value: unknown): ParsedLabel {
  const label = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
  if (!label) return { ok: false, error: 'Give the document a name, like “Menu” or “Rate Card”.' }
  if (label.length > DOCUMENT_LABEL_MAX) {
    return { ok: false, error: `Keep the name to ${DOCUMENT_LABEL_MAX} characters.` }
  }
  return { ok: true, value: label }
}

/** Checks a file before an upload starts. Null when it can go. */
export function checkDocumentFile(mime: unknown, size: unknown): string | null {
  if (mime !== LISTING_DOCUMENT_MIME) return 'Choose a PDF file.'
  if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) {
    return 'That file looks empty. Choose another PDF.'
  }
  if (size > LISTING_DOCUMENT_MAX_BYTES) return 'PDFs can be up to 10 MB.'
  return null
}

/** Adding a document: needs room under the plan's limit. Null when allowed. */
export function checkDocumentAdd(tier: string | null, savedCount: number): string | null {
  const limit = documentLimit(tier)
  if (limit === 0) return 'Documents come with Starter. Upgrade to add your menu or rate card.'
  if (savedCount >= limit) {
    return limit === 1
      ? 'Your plan includes 1 document. Remove it to add another, or upgrade for more.'
      : `Your plan includes ${limit} documents. Remove one to add another, or upgrade for more.`
  }
  return null
}

/** "240 KB", "1.2 MB". Null when the size is unknown. */
export function documentSizeLabel(bytes: unknown): string | null {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return null
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  const mb = Math.round((bytes / (1024 * 1024)) * 10) / 10
  return `${mb} MB`
}

/** The saved file's name: the label, made safe for a filename. */
export function documentFileName(label: string): string {
  const base = label
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, DOCUMENT_LABEL_MAX)
  return `${base || 'document'}.pdf`
}

/** The public link, sent as an attachment (`?download=`) so it never opens inline. */
export function documentHref(supabaseUrl: string, path: string, label: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${LISTING_DOCUMENT_BUCKET}/${path}?download=${encodeURIComponent(documentFileName(label))}`
}

export function toOwnerDocuments(rows: unknown): OwnerDocument[] {
  if (!Array.isArray(rows)) return []
  return (rows as Record<string, unknown>[]).flatMap((r) =>
    typeof r?.id === 'string' && typeof r.label === 'string' && typeof r.path === 'string'
      ? [
          {
            id: r.id,
            label: r.label,
            path: r.path,
            sizeBytes: typeof r.size_bytes === 'number' ? r.size_bytes : 0,
            sortOrder: typeof r.sort_order === 'number' ? r.sort_order : 0,
          },
        ]
      : []
  )
}

export function toPublicDocuments(
  docs: readonly OwnerDocument[],
  supabaseUrl: string
): DocumentItem[] {
  if (!supabaseUrl) return []
  return docs.map((d) => ({
    id: d.id,
    label: d.label,
    href: documentHref(supabaseUrl, d.path, d.label),
    sizeLabel: documentSizeLabel(d.sizeBytes),
  }))
}
