'use client'

// Which page gets the free month, for an owner tester who got their link
// before they had a page and now owns more than one. The tiers come from the
// server card; the claim route checks the page is theirs, live and unused.

import { useId, useState } from 'react'
import { ClaimTrialButton } from '@/components/tour/ClaimTrialButton'
import type { TesterTrialTier } from '@/lib/tour/trial'

export interface PickablePage {
  listingId: string
  listingName: string
  /** Already on a live plan, so the month can't start on it yet. */
  paid: boolean
  tiers: { tier: TesterTrialTier; name: string; open: boolean }[]
}

interface Props {
  pages: PickablePage[]
}

export function FreeMonthPagePicker({ pages }: Props) {
  const groupName = useId()
  const [picked, setPicked] = useState<string | null>(null)
  const page = pages.find((p) => p.listingId === picked) ?? null

  return (
    <div className="mt-4 space-y-4">
      <fieldset>
        <legend className="mb-2 font-subhead text-sm font-bold text-brand-black">
          Which page?
        </legend>
        <ul className="space-y-2">
          {pages.map((p) => (
            <li key={p.listingId}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-charcoal/10 bg-white px-4 py-2 has-[:checked]:border-amber-gold has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
                <input
                  type="radio"
                  name={groupName}
                  value={p.listingId}
                  checked={picked === p.listingId}
                  disabled={p.paid}
                  onChange={() => setPicked(p.listingId)}
                  className="size-4 accent-amber-gold"
                />
                <span className="font-body text-sm text-brand-black">{p.listingName}</span>
                {p.paid && (
                  <span className="ml-auto font-body text-xs text-charcoal-faint">
                    Already on a paid plan
                  </span>
                )}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      {page && (
        <ul
          className="grid grid-cols-1 gap-3 sm:grid-cols-3"
          aria-label={`Plans for ${page.listingName}`}
        >
          {page.tiers.map(({ tier, name, open }) => (
            <li
              key={tier}
              className="flex flex-col rounded-lg border border-charcoal/10 bg-white p-4"
            >
              <p className="mb-3 font-subhead text-sm font-bold text-brand-black">{name}</p>
              {open ? (
                <ClaimTrialButton
                  plan={tier}
                  label={`Use it on ${name}`}
                  listingId={page.listingId}
                />
              ) : (
                <p className="font-body text-xs text-charcoal-faint">
                  Coming soon. Your free month will wait.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
