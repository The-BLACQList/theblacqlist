'use client'

import Link from 'next/link'
import { useState } from 'react'

import type { BoardTester, WalkState } from '@/lib/tester/board'
import { EndEnrollmentButton } from '@/components/admin/TesterTourActions'
import { MUTED, PILL_BASE, PILL_CLASS } from '@/components/admin/testerBoardStyles'

interface Props {
  tester: BoardTester
}

const WALK_WORD: Record<WalkState, string | null> = {
  done: 'Done',
  stuck: 'Stuck here',
  next: 'Next',
  todo: null,
}

/** One tester: who they are, how far they walked, what they said. */
export function TesterDetailPanel({ tester }: Props) {
  const [copied, setCopied] = useState(false)

  async function copyEmail() {
    if (!tester.email) return
    try {
      await navigator.clipboard.writeText(tester.email)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section
      aria-labelledby="tester-detail-heading"
      className="@container rounded-xl border border-charcoal/10 bg-white p-5 space-y-5"
    >
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="tester-detail-heading" className="font-headline text-xl text-ink">
            {tester.label}
          </h2>
          <span className={`${PILL_BASE} ${PILL_CLASS[tester.status.state]}`}>
            {tester.status.label}
          </span>
        </div>
        <p className={`font-body text-sm break-all ${MUTED}`}>
          {tester.email ?? 'Email not available'}
        </p>
      </header>

      <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 font-body text-sm @[18rem]:grid-cols-[auto_1fr]">
        <dt className={MUTED}>Type</dt>
        <dd className="text-ink">{tester.owner ? 'Business owner' : 'Supporter'}</dd>
        <dt className={MUTED}>Page</dt>
        <dd className="text-ink min-w-0">
          {tester.pageHref && tester.pageName ? (
            <Link
              href={tester.pageHref}
              className="text-amber underline underline-offset-2 hover:text-ink"
            >
              {tester.pageName}
            </Link>
          ) : (
            (tester.pageName ?? (tester.owner ? 'No page yet' : 'None'))
          )}
        </dd>
        <dt className={MUTED}>Joined</dt>
        <dd className="text-ink">{tester.joinedText}</dd>
        <dt className={MUTED}>Last active</dt>
        <dd className="text-ink">{tester.lastActiveText}</dd>
        {tester.endedText && (
          <>
            <dt className={MUTED}>Ended</dt>
            <dd className="text-ink">{tester.endedText}</dd>
          </>
        )}
        <dt className={MUTED}>Free month</dt>
        <dd className="text-ink">{tester.freeMonth}</dd>
      </dl>

      <div>
        <h3 className="font-subhead text-xs font-bold uppercase tracking-wide text-ink">
          The walk
        </h3>
        <ol className="mt-2 space-y-3">
          {tester.walk.map((step, i) => (
            <li key={step.key} className="flex gap-3">
              <StepDot state={step.state} index={i + 1} />
              <div className="min-w-0 flex-1">
                <p className="font-subhead text-sm font-semibold text-ink">
                  {step.title}
                  {WALK_WORD[step.state] ? (
                    <span
                      className={`ml-2 font-normal ${step.state === 'stuck' ? 'text-[#7a5600]' : MUTED}`}
                    >
                      {WALK_WORD[step.state]}
                    </span>
                  ) : (
                    <span className="sr-only"> Not done yet</span>
                  )}
                </p>
                {step.answer && (
                  <div className="mt-1.5">
                    {step.prompt && (
                      <p className={`font-body text-xs italic ${MUTED}`}>{step.prompt}</p>
                    )}
                    <p className="mt-1 border-l-2 border-gold pl-3 font-body text-sm text-ink whitespace-pre-wrap">
                      {step.answer}
                    </p>
                    {step.answeredText && (
                      <p className={`mt-1 pl-3 font-body text-xs ${MUTED}`}>{step.answeredText}</p>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {tester.endedText === null && (
        <div className="space-y-3 border-t border-charcoal/10 pt-4">
          {tester.email && (
            <div>
              <button
                type="button"
                onClick={copyEmail}
                className="min-h-11 rounded-lg border border-charcoal/20 bg-white px-4 font-subhead text-sm font-semibold text-ink hover:border-charcoal/40"
              >
                {copied ? 'Copied' : 'Copy email'}
              </button>
            </div>
          )}
          {/* Keyed on the tester so a half-open confirm never carries over. */}
          <EndEnrollmentButton
            key={tester.id}
            enrollmentId={tester.id}
            testerLabel={tester.label}
            warning={tester.endWarning}
          />
        </div>
      )}
    </section>
  )
}

function StepDot({ state, index }: { state: WalkState; index: number }) {
  const look =
    state === 'done'
      ? 'bg-ink text-white border-ink'
      : state === 'stuck'
        ? 'bg-gold text-ink border-gold'
        : 'bg-white text-[#55545a] border-charcoal/30'
  return (
    <span
      aria-hidden="true"
      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold font-subhead ${look}`}
    >
      {state === 'done' ? '✓' : index}
    </span>
  )
}
