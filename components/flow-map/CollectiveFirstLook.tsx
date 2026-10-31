import Link from 'next/link'
import { ArrowUpRight, Camera, Map as MapIcon, Store } from 'lucide-react'

import { FIRST_LOOK_SIGN_IN_HREF, type FirstLookState } from '@/lib/spend/collective-first-look'

/**
 * The Collective's first look (ticket 161): how it works in three steps, then
 * one button picked for the reader. Sits in the /flow-map hero under the h1.
 *
 * The step wording is shared with the My receipts empty state (ticket 164), so
 * a member who lands on either page reads the same three lines.
 */
const STEPS = [
  { icon: Store, text: 'Shop at a business on the list.' },
  { icon: Camera, text: 'Add a receipt.' },
  { icon: MapIcon, text: 'Your spend joins the map.' },
] as const

const BUTTON =
  'inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/60'

interface Props {
  state: FirstLookState
  /** The reader's counted (approved) total, already formatted. Used for `has`. */
  countedTotal: string
}

export function CollectiveFirstLook({ state, countedTotal }: Props) {
  return (
    <div className="mt-5">
      <ol className="grid grid-cols-1 sm:grid-cols-3 gap-3" aria-label="How The Collective works">
        {STEPS.map(({ icon: Icon, text }, i) => (
          <li
            key={text}
            className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 border border-charcoal/10"
          >
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-gold/15 text-amber-700"
              aria-hidden="true"
            >
              <Icon className="size-4" />
            </span>
            <span className="font-subhead text-sm text-brand-black leading-snug">
              <span className="sr-only">Step {i + 1}: </span>
              {text}
            </span>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 mt-6">
        {state === 'out' ? (
          <Link href={FIRST_LOOK_SIGN_IN_HREF} className={BUTTON}>
            Sign in to add a receipt
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        ) : (
          <Link href="/account/receipts/new" className={BUTTON}>
            {state === 'new' ? 'Add your first receipt' : 'Add a receipt'}
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        )}

        {state === 'has' && (
          <p className="font-subhead text-sm text-charcoal">
            <span className="font-bold text-brand-black">{countedTotal}</span> counted so far ·{' '}
            <Link
              href="/account/receipts"
              className="inline-flex items-center min-h-11 font-semibold text-amber-700 underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/60 rounded"
            >
              My receipts
            </Link>
          </p>
        )}
      </div>

      <p className="font-body text-xs text-charcoal-soft mt-3">Nobody’s name is shown.</p>
    </div>
  )
}
