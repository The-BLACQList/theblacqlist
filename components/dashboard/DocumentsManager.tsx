'use client'

import { useRef, useState, useTransition } from 'react'
import { ArrowDown, ArrowUp, FileText, Loader2, Pencil, Trash2, Upload } from 'lucide-react'
import {
  deleteDocumentAction,
  finishDocumentUploadAction,
  renameDocumentAction,
  reorderDocumentsAction,
  startDocumentUploadAction,
  type DocumentsState,
} from '@/lib/actions/dashboard/documents'
import {
  DOCUMENT_LABEL_MAX,
  LISTING_DOCUMENT_MIME,
  checkDocumentFile,
  documentSizeLabel,
  type OwnerDocument,
} from '@/lib/listings/documents'
import type { UpgradeTarget } from '@/lib/stripe/planChecks'
import { PlanLimitNote } from '@/components/dashboard/PlanLimitNote'

// Documents (ticket 194), the owner's side: the list in the page's order with
// Rename, Move Up/Down and Remove, and an upload form (a name and a PDF). The
// file goes straight to storage on a one-time URL; the server then checks it.

interface Props {
  listingId: string
  initial: OwnerDocument[]
  /** Documents the page's plan shows: 0 on Free. */
  limit: number
  upgradeTo: UpgradeTarget
}

const INPUT =
  'w-full h-10 px-3 rounded-lg border border-charcoal/20 bg-white font-body text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-amber-gold/40'
const LABEL = 'block font-subhead text-xs font-semibold text-charcoal-soft mb-1'
const ICON_BUTTON =
  'inline-flex items-center justify-center size-8 rounded-full border border-charcoal/15 bg-white text-charcoal disabled:opacity-40'
const PRIMARY =
  'inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-brand-black text-white font-subhead text-sm font-bold disabled:opacity-50'

async function putFile(url: string, file: File): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'content-type': LISTING_DOCUMENT_MIME, 'x-upsert': 'false' },
      body: file,
    })
    return res.ok
  } catch {
    return false
  }
}

export function DocumentsManager({ listingId, initial, limit, upgradeTo }: Props) {
  const [items, setItems] = useState(initial)
  const [renaming, setRenaming] = useState<{ id: string; label: string } | null>(null)
  const [label, setLabel] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)
  const busy = isPending || uploading

  function run(action: () => Promise<DocumentsState>, after?: () => void) {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if ('error' in result) {
        setError(result.error)
        return
      }
      setItems(result.items)
      after?.()
    })
  }

  function move(index: number, by: -1 | 1) {
    const next = [...items]
    const [item] = next.splice(index, 1)
    if (!item) return
    next.splice(index + by, 0, item)
    run(() => reorderDocumentsAction({ listingId, ids: next.map((d) => d.id) }))
  }

  async function upload() {
    if (!file) return
    setError(null)
    const fileError = checkDocumentFile(file.type, file.size)
    if (fileError) {
      setError(fileError)
      return
    }
    setUploading(true)
    try {
      const started = await startDocumentUploadAction({
        listingId,
        mime: file.type,
        size: file.size,
      })
      if ('error' in started) {
        setError(started.error)
        return
      }
      if (!(await putFile(started.signedUrl, file))) {
        setError('The upload stopped. Check your connection and try again.')
        return
      }
      const finished = await finishDocumentUploadAction({ listingId, path: started.path, label })
      if ('error' in finished) {
        setError(finished.error)
        return
      }
      setItems(finished.items)
      setLabel('')
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
    } finally {
      setUploading(false)
    }
  }

  const canAdd = items.length < limit
  const hiddenFrom = limit

  return (
    <div className="space-y-6">
      {limit === 0 && (
        <PlanLimitNote upgradeTo={upgradeTo}>
          Documents come with Starter. Anything saved here stays, and shows again when your page is
          on Starter or higher.
        </PlanLimitNote>
      )}

      <section className="rounded-2xl border border-charcoal/10 bg-white p-5">
        {items.length === 0 ? (
          <p className="font-body text-sm text-charcoal">
            Nothing yet. Add your menu, rate card or commission guide.
          </p>
        ) : (
          <ol className="divide-y divide-charcoal/10">
            {items.map((d, i) => (
              <li key={d.id} className="py-3">
                {renaming?.id === d.id ? (
                  <form
                    className="flex items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      const r = renaming
                      run(
                        () => renameDocumentAction({ listingId, id: r.id, label: r.label }),
                        () => setRenaming(null)
                      )
                    }}
                  >
                    <label htmlFor={`doc-rename-${d.id}`} className="sr-only">
                      Document name
                    </label>
                    <input
                      id={`doc-rename-${d.id}`}
                      className={INPUT}
                      required
                      maxLength={DOCUMENT_LABEL_MAX}
                      value={renaming.label}
                      onChange={(e) => setRenaming({ id: d.id, label: e.target.value })}
                    />
                    <button type="submit" disabled={busy} className={PRIMARY}>
                      Save
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setRenaming(null)}
                      className="inline-flex items-center h-9 px-4 rounded-full border border-charcoal/20 bg-white text-charcoal font-subhead text-sm font-bold disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-3">
                    <FileText className="size-5 shrink-0 text-charcoal-soft" aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <p className="font-subhead text-sm font-semibold text-brand-black">
                        {d.label}
                      </p>
                      <p className="font-body text-xs text-charcoal-soft">
                        {[
                          'PDF',
                          documentSizeLabel(d.sizeBytes),
                          i >= hiddenFrom ? 'Hidden on your plan' : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <button
                      type="button"
                      className={ICON_BUTTON}
                      disabled={busy || i === 0}
                      onClick={() => move(i, -1)}
                      aria-label={`Move ${d.label} up`}
                    >
                      <ArrowUp className="size-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={ICON_BUTTON}
                      disabled={busy || i === items.length - 1}
                      onClick={() => move(i, 1)}
                      aria-label={`Move ${d.label} down`}
                    >
                      <ArrowDown className="size-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={ICON_BUTTON}
                      disabled={busy}
                      onClick={() => {
                        setError(null)
                        setRenaming({ id: d.id, label: d.label })
                      }}
                      aria-label={`Rename ${d.label}`}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={ICON_BUTTON}
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Remove “${d.label}” from your page?`)) {
                          run(() => deleteDocumentAction({ listingId, id: d.id }))
                        }
                      }}
                      aria-label={`Remove ${d.label}`}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}

        {limit > 0 && !canAdd && (
          <div className="mt-4">
            <PlanLimitNote upgradeTo={upgradeTo}>
              Your plan includes {limit} {limit === 1 ? 'document' : 'documents'}. Remove one to add
              another.
            </PlanLimitNote>
          </div>
        )}

        {canAdd && (
          <form
            className="mt-5 border-t border-charcoal/10 pt-5 grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault()
              void upload()
            }}
          >
            <div>
              <label htmlFor="doc-label" className={LABEL}>
                Name
              </label>
              <input
                id="doc-label"
                className={INPUT}
                required
                maxLength={DOCUMENT_LABEL_MAX}
                placeholder="Menu"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="doc-file" className={LABEL}>
                PDF File
              </label>
              <input
                id="doc-file"
                ref={fileRef}
                type="file"
                accept={LISTING_DOCUMENT_MIME}
                required
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full font-body text-sm text-charcoal file:mr-3 file:h-9 file:px-3 file:rounded-full file:border-0 file:bg-pale-lavender file:font-subhead file:text-xs file:font-bold"
              />
              <p className="mt-1 font-body text-xs text-charcoal-soft">
                PDF only, up to 10 MB. Visitors download it; it doesn&rsquo;t open on your page.
              </p>
            </div>
            <div className="sm:col-span-2">
              <button type="submit" disabled={busy || !file} className={PRIMARY}>
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Upload className="size-4" aria-hidden="true" />
                )}
                {uploading ? 'Uploading…' : 'Add Document'}
              </button>
            </div>
          </form>
        )}

        {error && (
          <p role="alert" className="mt-4 font-body text-sm text-red-700">
            {error}
          </p>
        )}
      </section>
    </div>
  )
}
