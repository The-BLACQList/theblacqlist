'use client'

import { useActionState, useRef, useEffect } from 'react'
import { Loader2, Plus, AlertCircle, Trash2 } from 'lucide-react'
import { addListingFaqAction } from '@/lib/actions/dashboard/addListingFaq'
import { deleteListingFaqAction } from '@/lib/actions/dashboard/deleteListingFaq'

interface FaqRow {
  id: string
  question: string
  answer: string
}

interface Props {
  listingId: string
  faqs: FaqRow[]
}

function DeleteFaqButton({ faqId }: { faqId: string }) {
  const [state, formAction, isPending] = useActionState(deleteListingFaqAction, null)
  return (
    <form action={formAction}>
      <input type="hidden" name="faq_id" value={faqId} />
      <button
        type="submit"
        disabled={isPending}
        aria-label="Delete question"
        className="inline-flex items-center justify-center size-8 rounded-lg text-charcoal-faint hover:text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Trash2 className="size-4" aria-hidden="true" />
        )}
      </button>
      {state && 'error' in state && (
        <p className="font-body text-xs text-red-600 mt-1">{state.error}</p>
      )}
    </form>
  )
}

export function FaqSection({ listingId, faqs }: Props) {
  const [state, formAction, isPending] = useActionState(addListingFaqAction, null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state && 'success' in state) formRef.current?.reset()
  }, [state])

  return (
    <div className="rounded-xl border border-charcoal/10 bg-white">
      <div className="px-5 py-4 border-b border-charcoal/8">
        <h2 className="font-headline text-base text-brand-black">FAQ</h2>
        <p className="font-body text-xs text-charcoal-soft mt-0.5">
          Answer the questions customers ask most. They appear as an expandable list on your page.
        </p>
      </div>

      <div className="px-5 py-4 space-y-4">
        {faqs.length > 0 && (
          <ul className="space-y-2">
            {faqs.map((faq) => (
              <li
                key={faq.id}
                className="flex items-start gap-3 rounded-lg border border-charcoal/8 bg-white px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-subhead font-semibold text-sm text-brand-black">
                    {faq.question}
                  </p>
                  <p className="font-body text-xs text-charcoal-soft mt-0.5 line-clamp-2">
                    {faq.answer}
                  </p>
                </div>
                <DeleteFaqButton faqId={faq.id} />
              </li>
            ))}
          </ul>
        )}

        <form ref={formRef} action={formAction} className="space-y-3 border-t border-charcoal/8 pt-4">
          <input type="hidden" name="listing_id" value={listingId} />
          <div>
            <label
              htmlFor="faq-question"
              className="block font-subhead text-xs font-semibold text-charcoal-soft mb-1"
            >
              Question
            </label>
            <input
              id="faq-question"
              name="question"
              type="text"
              required
              maxLength={300}
              placeholder="e.g. Do you take walk-ins?"
              className="w-full px-3 py-2 rounded-lg border border-charcoal/20 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
            />
          </div>
          <div>
            <label
              htmlFor="faq-answer"
              className="block font-subhead text-xs font-semibold text-charcoal-soft mb-1"
            >
              Answer
            </label>
            <textarea
              id="faq-answer"
              name="answer"
              required
              maxLength={2000}
              rows={3}
              placeholder="Keep it short and clear."
              className="w-full px-3 py-2 rounded-lg border border-charcoal/20 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40 resize-y"
            />
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

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-amber-gold text-brand-black font-subhead font-bold text-sm hover:bg-light-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="size-4" aria-hidden="true" />
              )}
              {isPending ? 'Adding…' : 'Add question'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
