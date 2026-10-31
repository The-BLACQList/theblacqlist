import Link from 'next/link'
import { Check } from 'lucide-react'
import type { PostingReadiness } from '@/lib/jobs/postingReadiness'

type NotLive = Exclude<PostingReadiness, { state: 'live' }>

interface Props {
  readiness: NotLive
  /** Smaller text for the dashboard card. */
  compact?: boolean
}

type StepState = 'done' | 'current' | 'todo'

const STEPS = ['Own a business page', 'Page is live', 'Post your job'] as const

const STATE_TEXT: Record<StepState, string> = {
  done: 'Done',
  current: 'Current step',
  todo: 'Not yet',
}

const primaryCls =
  'inline-flex min-h-11 items-center justify-center rounded-full bg-amber-gold px-5 font-subhead text-sm font-bold text-brand-black transition-colors hover:bg-light-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber'
const linkCls =
  'inline-flex min-h-11 items-center font-subhead text-sm font-semibold text-brand-black underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber'

function stepStates(state: NotLive['state']): StepState[] {
  return state === 'none' ? ['current', 'todo', 'todo'] : ['done', 'current', 'todo']
}

function CurrentStep({ readiness }: { readiness: NotLive }) {
  switch (readiness.state) {
    case 'none':
      return (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link href="/add-business" className={primaryCls}>
            Add your business
          </Link>
          <Link href="/add-business" className={linkCls}>
            Already listed? Find and claim it
          </Link>
        </div>
      )
    case 'draft':
      return (
        <div className="mt-1">
          <p className="font-body text-sm text-charcoal">{readiness.pageName} is still a draft.</p>
          <Link href={`/dashboard/pages/${readiness.pageId}/edit`} className={`${primaryCls} mt-2`}>
            Finish your page
          </Link>
        </div>
      )
    case 'review':
      return (
        <div className="mt-1">
          <p className="font-body text-sm text-charcoal">
            {readiness.name}: in review, usually 3 to 5 business days.
          </p>
          <Link href="/dashboard" className={linkCls}>
            See your page
          </Link>
        </div>
      )
  }
}

/**
 * The three steps to posting a job (ticket 156, layout A). State is written out
 * in text and announced, never shown by colour alone.
 */
export function PostingChecklist({ readiness, compact = false }: Props) {
  const states = stepStates(readiness.state)
  return (
    <ol className={`flex flex-col ${compact ? 'gap-2' : 'gap-3'}`}>
      {STEPS.map((label, i) => {
        const s = states[i]!
        return (
          <li key={label} aria-current={s === 'current' ? 'step' : undefined} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full font-subhead text-xs font-bold ${
                s === 'done'
                  ? 'bg-brand-black text-white'
                  : s === 'current'
                    ? 'border-2 border-amber bg-white text-brand-black'
                    : 'border border-charcoal/25 bg-white text-charcoal-soft'
              }`}
            >
              {s === 'done' ? <Check className="size-3.5" /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-subhead text-sm text-brand-black">
                <span className={s === 'current' ? 'font-semibold' : undefined}>{label}</span>
                <span className="text-charcoal-soft">
                  <span aria-hidden="true"> · </span>
                  <span className={s === 'todo' ? 'sr-only' : undefined}>{STATE_TEXT[s]}</span>
                </span>
              </p>
              {s === 'current' && <CurrentStep readiness={readiness} />}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
