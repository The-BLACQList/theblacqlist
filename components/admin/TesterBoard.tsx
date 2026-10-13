'use client'

import { useRef, useState, type ReactNode } from 'react'

import { formatTesterNumber } from '@/lib/tester/cap'
import { needsYou, needsYouReason, type BoardTester } from '@/lib/tester/board'
import { TesterDetailPanel } from '@/components/admin/TesterDetailPanel'
import { MUTED, PILL_BASE, PILL_CLASS, SEGMENT_CLASS } from '@/components/admin/testerBoardStyles'

interface Props {
  testers: BoardTester[]
  cap: number
  /** From ?tester=NN, so a refresh keeps the same tester open. */
  initialNumber: number | null
  /** The links strip, rendered on the server. */
  links: ReactNode
}

const LABEL = 'font-subhead text-xs font-bold uppercase tracking-wide text-ink'
const CHIP =
  'min-h-11 rounded-full border px-3 font-subhead text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

/** The fifteen spots, who needs the founder, and one tester at a time (ticket 137). */
export function TesterBoard({ testers, cap, initialNumber, links }: Props) {
  const live = testers.filter((t) => t.endedText === null).sort((a, b) => a.number - b.number)
  const left = testers.filter((t) => t.endedText !== null).sort((a, b) => a.number - b.number)
  const needs = live.filter((t) => needsYou(t.status))
  const open = Math.max(cap - live.length, 0)

  const fallback = (needs[0] ?? live[0] ?? left[0])?.number ?? null
  const [selected, setSelected] = useState<number | null>(
    testers.some((t) => t.number === initialNumber) ? initialNumber : fallback
  )
  const panelRef = useRef<HTMLDivElement>(null)
  const current = testers.find((t) => t.number === selected) ?? null

  function select(n: number) {
    setSelected(n)
    const url = new URL(window.location.href)
    url.searchParams.set('tester', String(n).padStart(2, '0'))
    window.history.replaceState(null, '', url)
    // Beside the grid on wide screens; under it on narrow ones, so bring it up.
    if (window.matchMedia('(max-width: 1023px)').matches) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      requestAnimationFrame(() =>
        panelRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
      )
    }
  }

  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className="min-w-0 flex-[999_1_520px] space-y-5">
        {needs.length > 0 && (
          <section
            aria-labelledby="needs-you-heading"
            className="rounded-xl border border-[#ecd9ad] bg-[#fbf3e2] p-4"
          >
            <h2 id="needs-you-heading" className="font-subhead text-sm font-bold text-[#7a5600]">
              Needs you
            </h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {needs.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => select(t.number)}
                    className={`${CHIP} border-[#ecd9ad] bg-white text-[#7a5600] hover:border-[#7a5600]`}
                  >
                    {t.label} · {needsYouReason(t.status)}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="spots-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="spots-heading" className={LABEL}>
              The {cap} spots
            </h2>
            <p className={`font-body text-xs ${MUTED}`}>
              {live.length} taken · {needs.length} need you · {open} open
            </p>
          </div>
          <ul className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(min(150px,100%),1fr))] gap-3">
            {live.map((t) => (
              <li key={t.id}>
                <SpotTile tester={t} pressed={t.number === selected} onSelect={select} />
              </li>
            ))}
            {Array.from({ length: open }, (_, i) => (
              <li
                key={`open-${i}`}
                className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-charcoal/25 font-subhead text-sm text-[#55545a]"
              >
                Open spot
              </li>
            ))}
          </ul>
          {live.length === 0 && (
            <p className={`mt-3 font-body text-sm ${MUTED}`}>
              No one is on the tour yet. Make a link or invite by listing to fill the first spot.
            </p>
          )}
        </section>

        {left.length > 0 && (
          <section aria-labelledby="left-heading">
            <h2 id="left-heading" className={LABEL}>
              Left the test
            </h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {left.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    aria-pressed={t.number === selected}
                    onClick={() => select(t.number)}
                    className={`${CHIP} ${
                      t.number === selected
                        ? 'border-ink bg-ink text-white'
                        : 'border-charcoal/20 bg-white text-ink hover:border-charcoal/40'
                    }`}
                  >
                    {t.label} · ended {t.endedText}
                  </button>
                </li>
              ))}
            </ul>
            <p className={`mt-2 font-body text-xs ${MUTED}`}>Their numbers are never reused.</p>
          </section>
        )}

        {links}
      </div>

      <div ref={panelRef} className="min-w-0 flex-[1_1_340px] scroll-mt-20 lg:scroll-mt-4 lg:sticky lg:top-4">
        {current ? (
          <TesterDetailPanel tester={current} />
        ) : (
          <div className="rounded-xl border border-charcoal/10 bg-white p-5">
            <p className={`font-body text-sm ${MUTED}`}>
              Pick a spot to see that tester&rsquo;s walk and answers.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function SpotTile({
  tester,
  pressed,
  onSelect,
}: {
  tester: BoardTester
  pressed: boolean
  onSelect: (n: number) => void
}) {
  const flagged = needsYou(tester.status)
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onSelect(tester.number)}
      className={`flex h-full min-h-32 w-full flex-col gap-1.5 rounded-xl border bg-white p-3 text-left transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
        pressed
          ? 'border-ink shadow-[0_0_0_3px_rgba(196,160,101,0.45)]'
          : 'border-charcoal/15 hover:border-charcoal/40'
      } ${flagged ? 'border-l-4 border-l-gold' : ''}`}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="font-headline text-[22px] leading-none text-ink">
          {String(tester.number).padStart(2, '0')}
          <span className="sr-only"> ({formatTesterNumber(tester.number)})</span>
        </span>
        <span className={`font-subhead text-xs ${MUTED}`}>
          {tester.owner ? 'Owner' : 'Supporter'}
        </span>
      </span>
      <span className="truncate font-body text-sm text-ink">
        {tester.pageName ?? (tester.owner ? 'No page yet' : 'No page')}
      </span>
      <span className="sr-only">
        {tester.walk.filter((s) => s.state === 'done').length} of {tester.walk.length} steps done.
      </span>
      <span className="mt-auto flex gap-1" aria-hidden="true">
        {tester.walk.map((s) => (
          <span key={s.key} className={`h-1.5 flex-1 rounded-full ${SEGMENT_CLASS[s.state]}`} />
        ))}
      </span>
      <span className={`${PILL_BASE} ${PILL_CLASS[tester.status.state]} self-start`}>
        {tester.status.label}
      </span>
    </button>
  )
}
