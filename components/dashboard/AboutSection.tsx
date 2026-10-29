'use client'

import { useLivePage, useSaveLabel } from './SaveLabel'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import {
  updateListingContentAction,
  type UpdateListingContentState,
} from '@/lib/actions/dashboard/updateListingContent'
import { PlanLimitNote } from '@/components/dashboard/PlanLimitNote'
import type { UpgradeTarget } from '@/lib/stripe/planChecks'
import { SuggestionPanel, useFieldHelp } from '@/components/listings/finish/WritingHelp'
import { CollectiveSubmit, useSectionSave } from '@/components/listings/finish/ProfileSave'
import type { Suggestion } from '@/lib/ai/writingHelp'

interface Props {
  listingId: string
  description: string | null
  /** Plan character limit, or null for no limit (ticket 119). */
  charLimit: number | null
  /** The plan the limit note offers (`upgradeTarget`), or null for no link. */
  upgradeTo: UpgradeTarget
  /** Unsaved typing, for a live preview beside the form (ticket 129). */
  onDraftChange?: (patch: { description: string }) => void
  /** An open suggestion from earlier, shown under the box (ticket 138). */
  initialSuggestion?: Suggestion
}

export function AboutSection({
  listingId,
  description,
  charLimit,
  upgradeTo,
  onDraftChange,
  initialSuggestion,
}: Props) {
  const field = useFieldHelp('listing_description', description ?? '', initialSuggestion, (v) =>
    onDraftChange?.({ description: v })
  )
  const {
    state,
    pending: isPending,
    collective,
    formProps,
  } = useSectionSave({
    id: 'about',
    label: 'About',
    action: async (prev: UpdateListingContentState, formData: FormData) => {
      const result = await updateListingContentAction(prev, formData)
      if (result && 'success' in result) field.markSaved()
      return result
    },
  })
  const saveLabel = useSaveLabel()
  const live = useLivePage()
  const value = field.state.value
  const chars = value.length
  // A description saved before the limit existed stays as it is. Only an edit
  // has to fit, so say that plainly instead of letting the save fail.
  const savedOverLimit = charLimit !== null && (description?.length ?? 0) > charLimit
  const overLimit = charLimit !== null && chars > charLimit

  return (
    <div className="rounded-xl border border-charcoal/10 bg-white">
      <div className="px-5 py-4 border-b border-charcoal/8">
        <h2 className="font-headline text-base text-brand-black">Story</h2>
        <p className="font-body text-xs text-charcoal-soft mt-0.5">
          Tell the community about your business. Who you are, what you do, and why it matters.
        </p>
      </div>
      <form {...formProps} className="px-5 py-4 space-y-4">
        <input type="hidden" name="listing_id" value={listingId} />
        {field.usedId && <input type="hidden" name="ai_suggestion_id" value={field.usedId} />}

        <div>
          <label
            htmlFor="about-description"
            className="block font-subhead text-xs font-semibold text-charcoal-soft mb-1"
          >
            Business description
          </label>
          <textarea
            id="about-description"
            name="description"
            rows={6}
            value={value}
            onChange={(e) => field.setValue(e.target.value)}
            aria-describedby="about-description-count"
            placeholder="Describe your business, its history, and what makes it special…"
            className="w-full px-3 py-2 rounded-lg border border-charcoal/20 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40 resize-none"
          />
          <p
            id="about-description-count"
            className={`font-body text-xs text-right mt-0.5 ${overLimit ? 'text-red-700' : 'text-charcoal-faint'}`}
          >
            {charLimit === null ? `${chars} characters` : `${chars} of ${charLimit} characters`}
          </p>
        </div>

        <SuggestionPanel field={field} fieldId="about-description" charLimit={charLimit} />

        {charLimit !== null && (savedOverLimit || overLimit) && (
          <PlanLimitNote upgradeTo={upgradeTo}>
            {savedOverLimit
              ? `Your description is longer than your plan's ${charLimit} characters. It stays on your page as it is. To change it, shorten it to ${charLimit} or fewer, or upgrade for no limit.`
              : `Your plan includes a description of up to ${charLimit} characters. Shorten it, or upgrade for no limit.`}
          </PlanLimitNote>
        )}

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
          {!collective && state && 'success' in state && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
              <CheckCircle className="size-4 text-green-600 shrink-0" aria-hidden="true" />
              <p className="font-body text-sm text-green-700">
                About text saved.{live && " It's on your page now."}
              </p>
            </div>
          )}
        </div>

        {collective ? (
          <CollectiveSubmit />
        ) : (
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex w-full items-center justify-center gap-2 h-11 px-5 rounded-lg bg-amber-gold text-brand-black font-subhead font-bold text-sm hover:bg-light-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors sm:w-auto"
            >
              {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {isPending ? 'Saving…' : saveLabel}
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
