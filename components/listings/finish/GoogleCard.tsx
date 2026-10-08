'use client'

import { useActionState } from 'react'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { updateListingContentAction } from '@/lib/actions/dashboard/updateListingContent'
import { rulesSeo, type ListingSeoFields } from '@/lib/listings/seo'
import { SeoSection } from '@/components/dashboard/SeoSection'

interface Props {
  listingId: string
  publicUrl: string
  seoFields: ListingSeoFields
  metaTitle: string | null
  metaDescription: string | null
  description: string | null
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://theblacqlist.com'

function displayUrl(path: string): string {
  const host = SITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '')
  return [host, ...path.split('/').filter(Boolean)].join(' › ')
}

// How the page shows up in a Google search. Saved search text wins; without it
// the card offers a suggestion built from the page, with one tap to keep it.
export function GoogleCard({
  listingId,
  publicUrl,
  seoFields,
  metaTitle,
  metaDescription,
  description,
}: Props) {
  const [state, formAction, isPending] = useActionState(updateListingContentAction, null)
  const hasSaved = Boolean(metaTitle?.trim() || metaDescription?.trim())
  const suggestion = rulesSeo(seoFields)
  const title = hasSaved ? metaTitle?.trim() || suggestion.title : suggestion.title
  const desc = hasSaved ? metaDescription?.trim() || suggestion.description : suggestion.description

  return (
    <section
      aria-labelledby="google-heading"
      className="rounded-xl border border-charcoal/10 bg-white"
    >
      <div className="border-b border-charcoal/8 px-5 py-4">
        <h2 id="google-heading" className="font-headline text-base text-brand-black">
          How you show up on Google
        </h2>
        <p className="mt-0.5 font-body text-xs text-charcoal-soft">
          {hasSaved
            ? 'Your saved search title and description.'
            : 'A suggestion built from your page. Keep it, or write your own.'}
        </p>
      </div>

      <div className="flex flex-col gap-4 px-5 py-4">
        <div className="rounded-lg border border-charcoal/10 bg-pale-lavender/40 px-4 py-3">
          <p className="truncate font-body text-xs text-charcoal-soft">{displayUrl(publicUrl)}</p>
          <p className="mt-0.5 font-body text-lg leading-snug text-[#1a0dab] break-words">
            {title}
          </p>
          <p className="mt-1 font-body text-sm leading-relaxed text-charcoal break-words">{desc}</p>
        </div>

        {!hasSaved && (
          <form action={formAction} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="listing_id" value={listingId} />
            <input type="hidden" name="meta_title" value={suggestion.title} />
            <input type="hidden" name="meta_description" value={suggestion.description} />
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-amber-gold px-5 font-subhead text-sm font-bold text-brand-black hover:bg-light-gold disabled:opacity-50"
            >
              {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Use this
            </button>
            {state && 'error' in state && (
              <p role="alert" className="flex items-center gap-1.5 font-body text-xs text-red-700">
                <AlertCircle className="size-3.5" aria-hidden="true" />
                {state.error}
              </p>
            )}
          </form>
        )}
        {state && 'success' in state && (
          <p role="status" className="flex items-center gap-1.5 font-body text-xs text-green-700">
            <CheckCircle className="size-3.5" aria-hidden="true" />
            Saved.
          </p>
        )}

        <details className="group">
          <summary className="inline-flex min-h-9 cursor-pointer items-center font-subhead text-sm font-semibold text-brand-black underline decoration-amber-gold underline-offset-4">
            {hasSaved ? 'Edit your search text' : 'Write your own'}
          </summary>
          <div className="mt-3">
            <SeoSection
              key={`${metaTitle ?? ''}|${metaDescription ?? ''}`}
              listingId={listingId}
              metaTitle={metaTitle}
              metaDescription={metaDescription}
              name={seoFields.name}
              description={description}
            />
          </div>
        </details>
      </div>
    </section>
  )
}
