import Link from 'next/link'
import { ArrowUpRight, Camera, Map as MapIcon, Store } from 'lucide-react'

import { FIRST_LOOK_SIGN_IN_HREF, type FirstLookState } from '@/lib/spend/collective-first-look'

/**
 * The Collective's first look (ticket 161): how it works in three steps, and
 * one button picked for the reader.
 *
 * Ticket 247 took the light hero off /flow-map, so these are dark pieces the
 * page places itself: the button rides in the map's HUD and opening title, and
 * the steps sit in the More sheet and in a band under the map.
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
  'inline-flex items-center justify-center gap-2 rounded-full bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-light-gold/70 focus-visible:ring-offset-2 focus-visible:ring-offset-deep-bg'

const SIZE = {
  md: 'h-11 px-5 text-sm',
  /** Still a 44px target, with less side padding for the HUD. */
  sm: 'h-11 px-4 text-[13px]',
} as const

interface ButtonProps {
  state: FirstLookState
  size?: keyof typeof SIZE
}

/** Add a Receipt, or Sign In first. The one action the page asks for. */
export function FirstLookButton({ state, size = 'md' }: ButtonProps) {
  const className = `${BUTTON} ${SIZE[size]}`
  if (state === 'out') {
    return (
      <Link href={FIRST_LOOK_SIGN_IN_HREF} className={className}>
        Sign In to Add a Receipt
        <ArrowUpRight className="size-4" aria-hidden="true" />
      </Link>
    )
  }
  return (
    <Link href="/account/receipts/new" className={className}>
      {state === 'new' ? 'Add Your First Receipt' : 'Add a Receipt'}
      <ArrowUpRight className="size-4" aria-hidden="true" />
    </Link>
  )
}

interface StepsProps {
  /** `sheet` stacks the steps for the More sheet; `band` lays them in a row. */
  layout?: 'band' | 'sheet'
}

/** The three steps, then the privacy line and the method. Dark only. */
export function FirstLookSteps({ layout = 'band' }: StepsProps) {
  const grid = layout === 'band' ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1'
  return (
    <>
      <ol className={`grid ${grid} gap-2`} aria-label="How The Collective works">
        {STEPS.map(({ icon: Icon, text }, i) => (
          <li
            key={text}
            className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5 border border-white/10"
          >
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-gold/15 text-light-gold"
              aria-hidden="true"
            >
              <Icon className="size-4" />
            </span>
            <span className="font-subhead text-sm text-[#fcfaf4] leading-snug">
              <span className="sr-only">Step {i + 1}: </span>
              {text}
            </span>
          </li>
        ))}
      </ol>
      <p className="font-body text-xs text-[#cdc6b6] mt-3">
        Nobody’s name is shown.{' '}
        <Link
          href="/flow-map/methodology"
          className="font-semibold text-light-gold underline-offset-4 hover:underline"
        >
          How we count
        </Link>
      </p>
    </>
  )
}

interface BandProps {
  state: FirstLookState
  /** The reader's counted (approved) total, already formatted. Used for `has`. */
  countedTotal: string
}

/** The dark band under the map: the steps, the button, and the reader's total. */
export function CollectiveHowItWorks({ state, countedTotal }: BandProps) {
  return (
    <section
      aria-labelledby="collective-how"
      className="border-t border-white/10 px-4 pt-12 pb-16 text-[#fcfaf4]"
    >
      <div className="max-w-[1100px] mx-auto">
        <h2
          id="collective-how"
          className="font-headline text-xs font-bold uppercase tracking-[0.16em] text-amber-gold mb-4"
        >
          How It Works
        </h2>
        <FirstLookSteps />
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
          <FirstLookButton state={state} />
          {state === 'has' && (
            <p className="font-subhead text-sm text-[#cdc6b6]">
              <span className="font-bold text-[#fcfaf4]">{countedTotal}</span> counted so far ·{' '}
              <Link
                href="/account/receipts"
                className="inline-flex items-center min-h-11 font-semibold text-light-gold underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/60 rounded"
              >
                My receipts
              </Link>
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
