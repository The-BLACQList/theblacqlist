'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2, Send } from 'lucide-react'
import { updateListingContentAction } from '@/lib/actions/dashboard/updateListingContent'
import { submitListingForReviewAction } from '@/lib/actions/listings/submitListingForReview'

interface Props {
  listingId: string
  name: string
  /** Short labels of the checklist items still open. */
  missing: string[]
  /** Typed but unsaved fields, saved first so nothing is lost on submit. */
  unsaved: Partial<Record<'name' | 'tagline' | 'description', string>>
}

// The send-for-review step for a new business page (ticket 126). The button is
// never disabled: a thin page can still go to review, the list just says what
// would make it stronger.
export function FinishSubmit({ listingId, name, missing, unsaved }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function send() {
    setBusy(true)
    setError(null)
    try {
      const fields = Object.entries(unsaved)
      if (fields.length > 0) {
        const save = new FormData()
        save.set('listing_id', listingId)
        for (const [key, value] of fields) save.set(key, value ?? '')
        const saved = await updateListingContentAction(null, save)
        if (saved && 'error' in saved) {
          setError(saved.error)
          return
        }
      }

      const form = new FormData()
      form.set('listing_id', listingId)
      const result = await submitListingForReviewAction(null, form)
      if (result && 'error' in result) {
        setError(result.error)
        return
      }
      router.push(`/add-business/submitted?name=${encodeURIComponent(unsaved.name ?? name)}`)
    } catch {
      setError('Something went wrong. Your page is still saved. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      aria-labelledby="send-heading"
      className="rounded-xl border border-amber-gold/40 bg-white px-5 py-5"
    >
      <h2 id="send-heading" className="font-headline text-lg text-brand-black">
        Send it for review
      </h2>
      <p className="mt-1 font-body text-sm leading-relaxed text-charcoal">
        Our team checks every page before it goes live, usually within 3 to 5 business days.
        We&apos;ll email you either way. You can keep editing after you send it.
      </p>

      {missing.length > 0 && (
        <p className="mt-3 font-body text-sm text-charcoal-soft">
          <span className="font-semibold text-brand-black">Could still add:</span>{' '}
          {missing.join(', ')}. You can send it now and add these later.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 flex items-start gap-1.5 font-body text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={send}
          disabled={busy}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-amber-gold px-7 font-subhead text-base font-bold text-brand-black hover:bg-light-gold disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="size-4" aria-hidden="true" />
          )}
          {busy ? 'Sending…' : 'Send for review'}
        </button>
        <Link
          href={`/add-business/submitted?name=${encodeURIComponent(name)}&type=draft`}
          className="inline-flex min-h-11 items-center justify-center px-3 font-subhead text-sm font-semibold text-charcoal underline decoration-charcoal/30 underline-offset-4 hover:text-brand-black"
        >
          Finish later
        </Link>
      </div>
    </section>
  )
}
