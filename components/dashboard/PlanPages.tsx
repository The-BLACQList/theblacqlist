'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setPlanPagesAction } from '@/lib/actions/billing/planPages'
import { getPlanMeta, type PlanSlug } from '@/lib/stripe/plans'
import { coverageLabel } from '@/components/dashboard/PlanStrip'

// Ticket 238: Pages on Your Plan. A plan belongs to the owner and covers up to
// Starter 1 / Growth 2 / Premium 3 of their pages; the owner picks which. Every
// change goes through setPlanPagesAction, which the database checks again.
// Founder 2026-11-21: say nothing about what happens to pages off the plan.

export interface PlanPageRow {
  id: string
  name: string
  covered: boolean
}

type Change = { add?: string[]; remove?: string[] }

const BUTTON =
  'inline-flex min-h-[44px] items-center rounded-full px-4 font-body text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2'
const PRIMARY = `${BUTTON} bg-amber-gold text-brand-black hover:bg-light-gold`
const SECONDARY = `${BUTTON} border border-brand-black bg-white text-brand-black hover:bg-brand-black hover:text-white`

export function PlanPages({
  tier,
  cap,
  pages,
}: {
  tier: PlanSlug
  cap: number
  pages: PlanPageRow[]
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const covered = pages.filter((p) => p.covered)
  const count = covered.length
  const onlyCovered = count === 1 ? covered[0] : undefined
  const planName = getPlanMeta(tier).name

  function run(change: Change) {
    setError(null)
    startTransition(async () => {
      const result = await setPlanPagesAction(change)
      if (result.ok) {
        setConfirming(null)
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  /** Taking a page off the plan (or moving the plan) asks once before it happens. */
  function confirmFirst(pageId: string, change: Change) {
    if (confirming === pageId) run(change)
    else {
      setError(null)
      setConfirming(pageId)
    }
  }

  return (
    <section
      id="plan-pages"
      aria-labelledby="plan-pages-heading"
      className="mb-10 scroll-mt-24 rounded-xl border border-amber-gold/60 bg-amber-gold/5 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="plan-pages-heading" className="font-headline text-lg text-brand-black">
          Pages on Your Plan
        </h2>
        <p data-plan-coverage className="font-subhead text-sm font-semibold text-charcoal-soft">
          {coverageLabel({ count, cap })}
        </p>
      </div>
      <p className="mt-1 max-w-lg font-body text-sm text-charcoal-soft">
        Your {planName} Plan covers {cap === 1 ? '1 page' : `up to ${cap} pages`}. Choose which.
      </p>

      <ul className="mt-4 divide-y divide-charcoal/10">
        {pages.map((page) => {
          const isConfirming = confirming === page.id
          let action: React.ReactNode = null
          if (page.covered) {
            if (count > 1) {
              action = (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => confirmFirst(page.id, { remove: [page.id] })}
                  className={SECONDARY}
                >
                  {isConfirming ? 'Confirm Remove' : 'Remove'}
                </button>
              )
            }
          } else if (count < cap) {
            action = (
              <button
                type="button"
                disabled={isPending}
                onClick={() => run({ add: [page.id] })}
                className={PRIMARY}
              >
                Add to Plan
              </button>
            )
          } else if (cap === 1 && onlyCovered) {
            action = (
              <button
                type="button"
                disabled={isPending}
                onClick={() => confirmFirst(page.id, { add: [page.id], remove: [onlyCovered.id] })}
                className={SECONDARY}
              >
                {isConfirming ? 'Confirm Move' : 'Move Plan Here'}
              </button>
            )
          }

          return (
            <li
              key={page.id}
              data-plan-page={page.id}
              data-covered={page.covered ? 'true' : undefined}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-body text-sm font-semibold text-brand-black">{page.name}</p>
                {page.covered && (
                  <span className="mt-1 inline-block rounded-full border border-amber-gold/60 px-2 py-0.5 font-subhead text-sm text-brand-black">
                    On Your Plan
                  </span>
                )}
                {isConfirming && (
                  <p className="mt-1 font-body text-sm text-charcoal-soft">
                    {page.covered
                      ? `${page.name} loses ${planName} features.`
                      : `${onlyCovered?.name ?? 'Your other page'} loses ${planName} features.`}
                  </p>
                )}
              </div>
              {action && (
                <div className="flex shrink-0 items-center gap-2">
                  {action}
                  {isConfirming && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => setConfirming(null)}
                      className="min-h-[44px] px-2 font-subhead text-sm font-semibold text-charcoal-soft hover:underline"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {count >= cap && cap > 1 && pages.some((p) => !p.covered) && (
        <p className="mt-2 font-body text-sm text-charcoal-soft">
          To add another page, remove one first.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 font-body text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  )
}
