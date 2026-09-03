'use client'

// The review form mounts on INTENT, not on page load.
//
// `ReviewForm` embeds `TurnstileWidget` (ReviewForm.tsx:266), and that widget
// injects Cloudflare's script and then polls every 200ms for up to 10s
// (TurnstileWidget.tsx:71-72). `EntityReviewsSection` renders the form for every
// signed-in non-owner who has not reviewed yet — so a captcha was booting on
// essentially every listing page a tester browsed, before anyone had shown the
// slightest intent to write anything. The founder's words: "Does the cloudflare
// turnstile have to be on every listing page?? I don't like it."
//
// ⚠ `ReviewForm` is imported HERE and rendered by this component. It is
// deliberately NOT accepted as a child from the server parent: a child passed
// down is created by the parent and mounts with it, which is exactly the
// behaviour being removed. If a future refactor turns this into a generic
// disclosure that renders whatever it is handed, the captcha comes back on load.
// tests/turnstile.test.ts asserts the prop is absent so that refactor fails CI.
//
// Server-side verification is untouched. `createReviewAction` still calls
// `verifyTurnstileFormData` and still fails closed on a missing or bad token.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { PenLine } from 'lucide-react'

import { ReviewForm } from '@/components/entity-page/ReviewForm'
import type { ReviewCriterion } from '@/types'

/**
 * Hashes that mean "I came here to write a review".
 *
 * `#review-body` is the textarea's id and the Tester Tour's step-5 selector
 * (lib/tour/targets.ts) — with the form closed that anchor does not exist, so
 * without this a deep link would land on a page with nothing on it.
 */
const OPENING_HASHES = new Set(['#review-body', '#write-review'])

function subscribeToHash(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

interface Props {
  listingId: string
  listingName: string
  criteria?: ReviewCriterion[]
  /** Zero-review pages ask for the first one; pages with reviews just offer. */
  hasReviews: boolean
}

export function ReviewFormDisclosure({ listingId, listingName, criteria, hasReviews }: Props) {
  const [openedByClick, setOpenedByClick] = useState(false)
  const panelRef = useRef<HTMLDivElement | null>(null)

  // The hash is read through `useSyncExternalStore` rather than set into state
  // from an effect. Two reasons, both real: `setState` in an effect body is a
  // lint error in this repo, and seeding `useState` from `location.hash`
  // instead would render a form on the client where the server sent a button —
  // a hydration mismatch. The server snapshot is `''`, so the server and the
  // first client render agree, and React re-reads immediately after.
  const hash = useSyncExternalStore(
    subscribeToHash,
    () => window.location.hash,
    () => ''
  )
  const open = openedByClick || OPENING_HASHES.has(hash)

  // The trigger is REPLACED by the form rather than hidden, so the element that
  // had focus is gone the moment it opens — without moving focus a keyboard user
  // is dumped back at the top of the document.
  //
  // Focus lands on the panel, not on the first field: the first field is the
  // star rating, whose radios are `sr-only` (ReviewForm.tsx:80-87), so focusing
  // one would put a keyboard user's focus somewhere with no visible ring at all.
  //
  // Only on a click. A hash arrival scrolls instead — the same reasoning as
  // ReportCorrectionForm's "auto-opening would steal focus on mount from anyone
  // who arrived by keyboard".
  useEffect(() => {
    if (!open) return
    if (openedByClick) panelRef.current?.focus()
    else panelRef.current?.scrollIntoView({ block: 'start' })
  }, [open, openedByClick])

  if (open) {
    return (
      <div
        ref={panelRef}
        id="write-review"
        tabIndex={-1}
        role="group"
        aria-label={`Write a review of ${listingName}`}
        className="focus:outline-none"
      >
        <ReviewForm listingId={listingId} listingName={listingName} criteria={criteria} />
      </div>
    )
  }

  return (
    <button
      type="button"
      id="write-review"
      // Product anchor for the Tester Tour's step 5 — see lib/tour/targets.ts.
      // Tried AFTER `#review-body` so an already-open form wins, and BEFORE
      // `[data-tour="report-correction"]` so "Show me" prefers the review path
      // over the correction link that renders above it.
      data-tour="write-review"
      onClick={() => setOpenedByClick(true)}
      className="inline-flex h-11 items-center gap-2 rounded-lg bg-amber-gold px-5 font-subhead text-sm font-bold text-brand-black transition-colors hover:bg-light-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/50"
    >
      <PenLine className="size-4" aria-hidden="true" />
      {hasReviews ? 'Write a review' : 'Be the first to review'}
    </button>
  )
}
