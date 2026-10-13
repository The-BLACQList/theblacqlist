'use client'

import { useState } from 'react'

import { InviteTesterForm } from '@/components/admin/TesterTourActions'
import { MintTesterLinkForm } from '@/components/admin/TesterLinkCard'

type Open = 'invite' | 'link' | null

const OUTLINE =
  'min-h-11 rounded-lg border border-charcoal/25 bg-white px-4 font-subhead text-sm font-semibold text-ink hover:border-charcoal/50'
const SOLID =
  'min-h-11 rounded-lg bg-ink px-4 font-subhead text-sm font-semibold text-white hover:bg-charcoal'

/**
 * The two ways to add a tester, tucked behind buttons so the spots come first
 * (ticket 137). The forms are unchanged. A made link lives in the form's own
 * state, so closing the panel drops it, as reloading always has.
 */
export function TesterBoardHeader({ taken, cap }: { taken: number; cap: number }) {
  const [open, setOpen] = useState<Open>(null)

  const toggle = (which: Exclude<Open, null>) => setOpen((o) => (o === which ? null : which))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl text-ink">Testers</h1>
          <p className="mt-0.5 font-body text-sm text-ink">
            <strong>
              {taken} of {cap} spots taken.
            </strong>{' '}
            <span className="text-[#55545a]">
              {taken >= cap
                ? 'The test is full. New people see a waitlist message until you end someone.'
                : 'Tap a spot to see that tester.'}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-expanded={open === 'invite'}
            aria-controls="tester-add-panel"
            onClick={() => toggle('invite')}
            className={OUTLINE}
          >
            Invite by listing
          </button>
          <button
            type="button"
            aria-expanded={open === 'link'}
            aria-controls="tester-add-panel"
            onClick={() => toggle('link')}
            className={SOLID}
          >
            Make a link
          </button>
        </div>
      </div>

      {open && (
        <section
          id="tester-add-panel"
          aria-labelledby="tester-add-heading"
          className="rounded-xl border border-charcoal/10 bg-white p-5"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2
                id="tester-add-heading"
                className="font-subhead text-sm font-bold uppercase tracking-wide text-ink"
              >
                {open === 'invite' ? 'Invite by listing' : 'Make a one-tap link'}
              </h2>
              {open === 'link' && (
                <p className="mt-1 font-body text-xs text-[#55545a]">
                  One tap signs the tester in, enrolls them and opens the tour. No sign-up form.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="min-h-11 rounded-lg px-3 font-subhead text-sm font-semibold text-[#55545a] hover:text-ink"
            >
              Close
            </button>
          </div>
          <div className="mt-3">
            {open === 'invite' ? <InviteTesterForm /> : <MintTesterLinkForm />}
          </div>
        </section>
      )}
    </div>
  )
}
