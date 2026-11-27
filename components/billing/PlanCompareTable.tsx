import { cn } from '@/lib/utils'
import { PLANS, type PlanSlug } from '@/lib/stripe/plans'
import { COMPARE_TIERS, visibleCompareGroups, type CompareCell } from '@/lib/stripe/planCompare'

// Ticket 239: every plan side by side, row by row, with each step up from the
// plan to the left marked in gold. Used on /pricing and /dashboard/upgrade.
//
// A tier nobody can buy (`open[tier]` false) shows its name and Coming Soon
// with empty cells, the same rule as the cards: a closed tier lists nothing.
//
// On a phone the table keeps its width and scrolls inside its own box, with
// the feature names pinned on the left, so the page itself never scrolls
// sideways.

interface Props {
  open: Record<PlanSlug, boolean>
  /** Marks the owner's plan on Upgrade. */
  currentTier?: PlanSlug
  className?: string
  /** FEATURE_JOBS_OPEN. Closed, no row sells job postings (ticket 289). */
  jobsOpen: boolean
}

export function PlanCompareTable({ open, currentTier, className, jobsOpen }: Props) {
  const groups = visibleCompareGroups(open, { jobsOpen })
  const names = Object.fromEntries(PLANS.map((p) => [p.slug, p.name])) as Record<PlanSlug, string>

  return (
    <div
      // `relative` keeps the cells' sr-only labels (position: absolute) inside
      // this scroll box; without it they pushed the phone page 200px wide.
      className={cn(
        'relative overflow-x-auto rounded-xl border border-charcoal/15 bg-white',
        className
      )}
      data-plan-compare=""
    >
      <table className="w-full min-w-[600px] border-collapse text-left">
        <caption className="sr-only">
          What each plan includes. Gold marks what a plan adds over the plan before it.
        </caption>
        <thead>
          <tr className="border-b border-charcoal/15">
            <th
              scope="col"
              className="sticky left-0 z-10 bg-white px-4 py-3 font-subhead text-sm font-semibold text-charcoal-soft"
            >
              Compare Plans
            </th>
            {COMPARE_TIERS.map((tier) => (
              <th
                key={tier}
                scope="col"
                className={cn(
                  'px-3 py-3 text-center align-bottom',
                  tier === currentTier && 'bg-amber-gold/10'
                )}
              >
                <span className="block font-headline text-base text-brand-black">
                  {names[tier]}
                </span>
                {!open[tier] ? (
                  <span className="block font-subhead text-sm text-charcoal-faint">
                    Coming Soon
                  </span>
                ) : tier === currentTier ? (
                  <span className="block font-subhead text-sm text-amber">Your Plan</span>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.title}>
            <tr>
              <th
                scope="colgroup"
                colSpan={COMPARE_TIERS.length + 1}
                className="sticky left-0 bg-pale-lavender/60 px-4 py-2 font-subhead text-sm font-semibold uppercase tracking-wide text-brand-black"
              >
                {group.title}
              </th>
            </tr>
            {group.rows.map((row) => (
              <tr key={row.label} className="border-t border-charcoal/8">
                <th
                  scope="row"
                  className="sticky left-0 z-10 max-w-[200px] bg-white px-4 py-2.5 align-top font-subhead text-sm font-normal text-charcoal"
                >
                  {row.label}
                  {row.note && (
                    <span className="mt-0.5 block text-sm leading-snug text-charcoal-faint">
                      {row.note}
                    </span>
                  )}
                </th>
                {COMPARE_TIERS.map((tier) => (
                  <td
                    key={tier}
                    className={cn(
                      'px-3 py-2.5 text-center align-top',
                      tier === currentTier && 'bg-amber-gold/10'
                    )}
                  >
                    {open[tier] ? (
                      <Cell cell={row.cells[tier]} />
                    ) : (
                      <span className="sr-only">Coming soon</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  )
}

function Cell({ cell }: { cell: CompareCell }) {
  if (cell.kind === 'no') {
    return (
      <>
        <span aria-hidden="true" className="font-subhead text-sm text-charcoal-faint">
          &ndash;
        </span>
        <span className="sr-only">Not included</span>
      </>
    )
  }
  const upLabel = cell.up ? <span className="sr-only"> (more than the plan before)</span> : null
  if (cell.kind === 'yes') {
    return (
      <>
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          aria-hidden="true"
          className={cn('mx-auto', cell.up ? 'text-amber' : 'text-charcoal-soft')}
        >
          <path
            d="M3.5 9.5l3.6 3.4L14.5 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="sr-only">Included</span>
        {upLabel}
      </>
    )
  }
  return (
    <span
      className={cn(
        'inline-block whitespace-nowrap rounded-full px-2 py-0.5 font-subhead text-sm',
        cell.up ? 'bg-amber-gold/20 font-semibold text-brand-black' : 'text-charcoal-soft'
      )}
    >
      {cell.text}
      {upLabel}
    </span>
  )
}
