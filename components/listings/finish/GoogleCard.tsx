'use client'

import { useActionState } from 'react'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { updateListingContentAction } from '@/lib/actions/dashboard/updateListingContent'
import {
  rulesSeo,
  SEO_DESCRIPTION_MAX,
  SEO_TITLE_MAX,
  type ListingSeoFields,
} from '@/lib/listings/seo'
import { useLivePage, useSaveLabel } from '@/components/dashboard/SaveLabel'
import { SuggestionPanel, useFieldHelp } from './WritingHelp'
import type { InitialSuggestions } from '@/lib/ai/writingHelp'

interface Props {
  listingId: string
  publicUrl: string
  seoFields: ListingSeoFields
  metaTitle: string | null
  metaDescription: string | null
  /** Unsaved typing, for the checklist and the "Not saved yet" line. */
  onDraftChange?: (patch: { meta_title?: string; meta_description?: string }) => void
  /** Open suggestions from earlier for the two fields (ticket 138). */
  initial?: InitialSuggestions
}

type SaveState = { saved: string } | { error: string } | null

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://theblacqlist.com'

const INPUT =
  'w-full px-3 py-2 rounded-lg border border-charcoal/20 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40'

function displayUrl(path: string): string {
  const host = SITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '')
  return [host, ...path.split('/').filter(Boolean)].join(' › ')
}

function savedLabel(title: boolean, desc: boolean): string {
  if (title && desc) return 'Search title and description saved.'
  if (title) return 'Search title saved.'
  if (desc) return 'Search description saved.'
  return 'Search text saved.'
}

// How the page shows up in a Google search, and the two boxes that control it.
// Without saved text the card offers one built from the page; Use this fills
// both boxes and the section's save keeps them, like every other edit.
export function GoogleCard({
  listingId,
  publicUrl,
  seoFields,
  metaTitle,
  metaDescription,
  onDraftChange,
  initial,
}: Props) {
  const title = useFieldHelp('seo_coach_title', metaTitle ?? '', initial?.seo_coach_title, (v) =>
    onDraftChange?.({ meta_title: v })
  )
  const desc = useFieldHelp(
    'seo_coach_description',
    metaDescription ?? '',
    initial?.seo_coach_description,
    (v) => onDraftChange?.({ meta_description: v })
  )
  const saveLabel = useSaveLabel()
  const live = useLivePage()

  const [state, formAction, isPending] = useActionState(
    async (prev: SaveState, formData: FormData): Promise<SaveState> => {
      const nextTitle = formData.get('meta_title')?.toString().trim() ?? ''
      const nextDesc = formData.get('meta_description')?.toString().trim() ?? ''
      const result = await updateListingContentAction(null, formData)
      if (!result) return prev
      if ('error' in result) return { error: result.error }
      title.markSaved()
      desc.markSaved()
      return {
        saved: savedLabel(nextTitle !== (metaTitle ?? ''), nextDesc !== (metaDescription ?? '')),
      }
    },
    null
  )

  const hasSaved = Boolean(metaTitle?.trim() || metaDescription?.trim())
  const rules = rulesSeo(seoFields)
  const titleValue = title.state.value
  const descValue = desc.state.value
  const showRules = !hasSaved && !titleValue.trim() && !descValue.trim()

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
            ? 'Your search title and description. Change them below.'
            : 'Until you save your own, Google sees text built from your page.'}
        </p>
      </div>

      <div className="flex flex-col gap-4 px-5 py-4">
        <div className="rounded-lg border border-charcoal/10 bg-pale-lavender/40 px-4 py-3">
          <p className="truncate font-body text-xs text-charcoal-soft">{displayUrl(publicUrl)}</p>
          <p className="mt-0.5 font-body text-lg leading-snug text-[#1a0dab] break-words">
            {titleValue.trim() || rules.title}
          </p>
          <p className="mt-1 font-body text-sm leading-relaxed text-charcoal break-words">
            {descValue.trim() || rules.description}
          </p>
        </div>

        {showRules && (
          <div className="flex flex-col gap-2 rounded-lg border border-charcoal/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-body text-sm text-charcoal">
              Start from the text above, then change any word.
            </p>
            <button
              type="button"
              onClick={() => {
                title.setValue(rules.title)
                desc.setValue(rules.description)
              }}
              className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-charcoal/20 bg-white px-4 font-subhead text-sm font-semibold text-brand-black transition-colors hover:border-amber-gold sm:w-auto"
            >
              Use this
            </button>
          </div>
        )}

        <form action={formAction} className="flex flex-col gap-5">
          <input type="hidden" name="listing_id" value={listingId} />
          {title.usedId && <input type="hidden" name="ai_suggestion_id" value={title.usedId} />}
          {desc.usedId && <input type="hidden" name="ai_suggestion_id" value={desc.usedId} />}

          <div className="flex flex-col gap-3">
            <div>
              <label
                htmlFor="seo-title"
                className="block font-subhead text-xs font-semibold text-charcoal-soft mb-1"
              >
                Search title{' '}
                <span className="font-normal text-charcoal-faint">(up to {SEO_TITLE_MAX})</span>
              </label>
              <input
                id="seo-title"
                name="meta_title"
                type="text"
                value={titleValue}
                maxLength={SEO_TITLE_MAX}
                onChange={(e) => title.setValue(e.target.value)}
                placeholder={rules.title}
                aria-describedby="seo-title-count"
                className={INPUT}
              />
              <p
                id="seo-title-count"
                className={`font-body text-xs text-right mt-0.5 ${titleValue.length > SEO_TITLE_MAX ? 'text-red-700' : titleValue.length > 55 ? 'text-amber' : 'text-charcoal-faint'}`}
              >
                {titleValue.length} of {SEO_TITLE_MAX} characters
              </p>
            </div>
            <SuggestionPanel field={title} fieldId="seo-title" charLimit={SEO_TITLE_MAX} />
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <label
                htmlFor="seo-desc"
                className="block font-subhead text-xs font-semibold text-charcoal-soft mb-1"
              >
                Search description{' '}
                <span className="font-normal text-charcoal-faint">
                  (up to {SEO_DESCRIPTION_MAX})
                </span>
              </label>
              <textarea
                id="seo-desc"
                name="meta_description"
                rows={3}
                value={descValue}
                maxLength={SEO_DESCRIPTION_MAX}
                onChange={(e) => desc.setValue(e.target.value)}
                placeholder={rules.description}
                aria-describedby="seo-desc-count"
                className={`${INPUT} resize-none`}
              />
              <p
                id="seo-desc-count"
                className={`font-body text-xs text-right mt-0.5 ${descValue.length > SEO_DESCRIPTION_MAX ? 'text-red-700' : descValue.length > 150 ? 'text-amber' : 'text-charcoal-faint'}`}
              >
                {descValue.length} of {SEO_DESCRIPTION_MAX} characters
              </p>
            </div>
            <SuggestionPanel field={desc} fieldId="seo-desc" charLimit={SEO_DESCRIPTION_MAX} />
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
          <div role="status">
            {state && 'saved' in state && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                <CheckCircle className="size-4 text-green-600 shrink-0" aria-hidden="true" />
                <p className="font-body text-sm text-green-700">
                  {state.saved}
                  {live && " It's on your page now."}
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex w-full items-center justify-center gap-2 h-11 px-5 rounded-lg bg-amber-gold text-brand-black font-subhead font-bold text-sm hover:bg-light-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors sm:w-auto"
            >
              {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {isPending ? 'Saving…' : saveLabel}
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}
