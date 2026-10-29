import Link from 'next/link'
import { EyeOff } from 'lucide-react'
import { HIDDEN_NOTICE_FOOTNOTE, hiddenLine, type HiddenCount } from '@/lib/stripe/downgrade'

interface Props {
  counts: HiddenCount[]
  /** Replaces the default footnote, for a kind that is hidden all or nothing. */
  footnote?: string
  /** Link to Growth under the lines. Callers decide with `offersGrowth` (ticket 143). */
  offerGrowth?: boolean
}

// Ticket 105. After a move to a lower plan, tells the owner what their public
// page leaves out. Nothing is deleted; each section below tags the items.
export function HiddenContentNotice({
  counts,
  footnote = HIDDEN_NOTICE_FOOTNOTE,
  offerGrowth = false,
}: Props) {
  if (counts.length === 0) return null
  return (
    <div
      role="status"
      className="flex gap-3 rounded-xl border border-charcoal/10 bg-pale-lavender px-4 py-3"
    >
      <EyeOff className="mt-0.5 size-4 shrink-0 text-charcoal-soft" aria-hidden="true" />
      <div className="min-w-0 space-y-1">
        <p className="font-subhead text-sm font-semibold text-brand-black">
          Some of your page is hidden on your current plan
        </p>
        <ul className="space-y-0.5">
          {counts.map((c) => (
            <li key={c.kind} className="font-body text-sm leading-relaxed text-charcoal">
              {hiddenLine(c)}
            </li>
          ))}
        </ul>
        <p className="font-body text-xs leading-relaxed text-charcoal-soft">{footnote}</p>
        {offerGrowth && (
          <Link
            href="/dashboard/upgrade"
            className="inline-flex items-center min-h-[44px] font-subhead font-bold text-sm text-brand-black underline underline-offset-4 decoration-amber-gold hover:decoration-brand-black"
          >
            Upgrade to Growth to show them again
          </Link>
        )}
      </div>
    </div>
  )
}
