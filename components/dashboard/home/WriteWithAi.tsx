import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { GoldBrandMark } from '@/components/ui/gold-brand-mark'

// Ticket 146: AI writing help, moved out of the old home (ticket 253). Shown
// only while FEATURE_AI_BETA is on and the page's plan includes it; the
// allowance is read and enforced on Edit Page. Never "drafts" (ticket 242).
export function WriteWithAi({
  listingId,
  listingName,
  quota,
}: {
  listingId: string
  listingName: string
  quota: number | null
}) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-charcoal/10 bg-white px-5 py-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <GoldBrandMark className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0">
          <h2 className="font-subhead text-base font-semibold text-brand-black">Write with AI</h2>
          <p className="mt-0.5 font-body text-sm text-charcoal">
            AI help with your about text, search title and summary, Instagram captions, review
            replies, and Happening now posts, written from your page.
            {quota !== null && ` Up to ${quota} times a month for this page.`}
          </p>
        </div>
      </div>
      <Link
        href={`/dashboard/pages/${listingId}/edit`}
        aria-label={`Open the Writer for ${listingName}`}
        className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-full border border-charcoal/20 bg-white px-4 font-subhead text-sm font-semibold text-brand-black transition-colors hover:bg-off-white sm:ml-auto"
      >
        Open the Writer <ChevronRight className="size-4" aria-hidden="true" />
      </Link>
    </section>
  )
}
