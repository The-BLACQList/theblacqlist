'use client'

import { useActionState, useState } from 'react'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { updateListingContentAction } from '@/lib/actions/dashboard/updateListingContent'

interface Props {
  listingId: string
  metaTitle: string | null
  metaDescription: string | null
  name: string
  description: string | null
}

export function SeoSection({ listingId, metaTitle, metaDescription, name, description }: Props) {
  const [state, formAction, isPending] = useActionState(updateListingContentAction, null)
  const [titleChars, setTitleChars] = useState(metaTitle?.length ?? 0)
  const [descChars, setDescChars] = useState(metaDescription?.length ?? 0)

  return (
    <div className="rounded-xl border border-charcoal/10 bg-white">
      <div className="px-5 py-4 border-b border-charcoal/8">
        <h2 className="font-headline text-base text-brand-black">SEO</h2>
        <p className="font-body text-xs text-charcoal-soft mt-0.5">
          These fields control how your page appears in Google search results. Defaults to your
          business name and description if left blank.
        </p>
      </div>
      <form action={formAction} className="px-5 py-4 space-y-4">
        <input type="hidden" name="listing_id" value={listingId} />

        <div>
          <label
            htmlFor="seo-title"
            className="block font-subhead text-xs font-semibold text-charcoal-soft mb-1"
          >
            SEO title <span className="font-normal text-charcoal-faint">(max 60 chars)</span>
          </label>
          <input
            id="seo-title"
            name="meta_title"
            type="text"
            defaultValue={metaTitle ?? ''}
            placeholder={`${name} | The BLACQList`}
            maxLength={60}
            onChange={(e) => setTitleChars(e.target.value.length)}
            className="w-full px-3 py-2 rounded-lg border border-charcoal/20 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
          />
          <p
            className={`font-body text-xs text-right mt-0.5 ${titleChars > 55 ? 'text-amber' : 'text-charcoal-faint'}`}
          >
            {titleChars}/60
          </p>
        </div>

        <div>
          <label
            htmlFor="seo-desc"
            className="block font-subhead text-xs font-semibold text-charcoal-soft mb-1"
          >
            SEO description <span className="font-normal text-charcoal-faint">(max 160 chars)</span>
          </label>
          <textarea
            id="seo-desc"
            name="meta_description"
            rows={3}
            defaultValue={metaDescription ?? ''}
            placeholder={description?.slice(0, 160) ?? 'Describe your business for search engines…'}
            maxLength={160}
            onChange={(e) => setDescChars(e.target.value.length)}
            className="w-full px-3 py-2 rounded-lg border border-charcoal/20 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40 resize-none"
          />
          <p
            className={`font-body text-xs text-right mt-0.5 ${descChars > 150 ? 'text-amber' : 'text-charcoal-faint'}`}
          >
            {descChars}/160
          </p>
        </div>

        {state && 'error' in state && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2"
          >
            <AlertCircle className="size-4 text-red-500 shrink-0" aria-hidden="true" />
            <p className="font-body text-sm text-red-700">{state.error}</p>
          </div>
        )}
        {state && 'success' in state && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
            <CheckCircle className="size-4 text-green-600 shrink-0" aria-hidden="true" />
            <p className="font-body text-sm text-green-700">Saved.</p>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-amber-gold text-brand-black font-subhead font-bold text-sm hover:bg-light-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}
