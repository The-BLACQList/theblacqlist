'use client'

import { useState } from 'react'
import { ImageIcon, Loader2, ExternalLink } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

interface Props {
  receiptId: string
  /** Storage path, not a URL. Null when nothing was attached. */
  filePath: string | null
  /** Shown in the dialog title so an admin knows which receipt they opened. */
  businessLabel: string
}

/**
 * Opens the attached receipt file for the people allowed to see it.
 *
 * The signed URL is minted on click, not at render. `/api/receipts/[id]/signed-url`
 * already enforces owner-or-admin and returns a 15-minute URL, so the only
 * question was when to ask for one — and the admin list renders up to 100
 * receipts. Signing at render would mint 100 short-lived URLs per page load and
 * bake them into the HTML for files nobody opened.
 *
 * PDFs are a real case, not a hypothetical: the receipt-uploads bucket accepts
 * application/pdf (20260813010000_receipt_bucket_heic.sql), and a PDF in an
 * <img> renders as a broken image. They get a link instead. The link is placed
 * inside the dialog rather than calling window.open() in the fetch callback,
 * which popup blockers treat as unsolicited because it isn't in the click's
 * call stack.
 */
export function ReceiptImageButton({ receiptId, filePath, businessLabel }: Props) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!filePath) return null

  const isPdf = filePath.toLowerCase().endsWith('.pdf')

  async function handleOpen() {
    setOpen(true)

    // A signed URL lasts 15 minutes. Re-fetch on each open rather than caching
    // it — a dialog left closed on a background tab would otherwise reopen with
    // a dead link.
    setLoading(true)
    setError(null)
    setUrl(null)

    try {
      const res = await fetch(`/api/receipts/${receiptId}/signed-url`)
      const body = await res.json()

      if (!res.ok) {
        setError(
          res.status === 404
            ? 'This receipt no longer has a file attached.'
            : (body?.error ?? 'Could not open the receipt file.')
        )
        return
      }

      setUrl(body.data.url)
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-charcoal/20 text-charcoal-soft hover:border-amber-gold/40 hover:text-amber font-subhead text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold"
      >
        <ImageIcon className="size-3.5" aria-hidden="true" />
        {isPdf ? 'View PDF' : 'View receipt'}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="p-5 pb-3 pr-14">
            <DialogTitle>Receipt — {businessLabel}</DialogTitle>
            <DialogDescription>
              This file is private. Only the person who submitted it and BLACQList admins can open
              it.
            </DialogDescription>
          </DialogHeader>

          <div className="px-5 pb-5">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-12 text-charcoal-soft">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                <span className="font-body text-sm">Opening receipt…</span>
              </div>
            )}

            {error && (
              <p role="alert" className="font-body text-sm text-red-600 py-8 text-center">
                {error}
              </p>
            )}

            {url && !loading && !error && (
              <>
                {isPdf ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors"
                  >
                    Open PDF in a new tab
                    <ExternalLink className="size-4" aria-hidden="true" />
                  </a>
                ) : (
                  <div className="rounded-lg bg-[#f9f9fb] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Receipt submitted for ${businessLabel}`}
                      className="w-full max-h-[70vh] object-contain"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
