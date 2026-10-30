import Link from 'next/link'
import { isFeatureEnabled } from '@/lib/env'
import type { ConfirmationModel, TimelineStep } from '@/lib/jobs/confirmation'
import { PostedHeading } from './PostedHeading'
import { PaymentPending } from './PaymentPending'

interface Props {
  model: Exclude<ConfirmationModel, { kind: 'redirect' }>
  entityId: string
  roleTitle: string
  businessName: string | null
  /** Public page path, used when the role is live. */
  publicHref: string | null
}

const btn = 'inline-flex h-11 min-w-11 items-center justify-center rounded-full px-6 font-subhead text-sm font-bold'
const primary = `${btn} bg-amber-gold text-brand-black`
const secondary = `${btn} border border-charcoal/30 bg-white text-brand-black`

function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="mt-6 space-y-4" aria-label="Where your role is">
      {steps.map((s) => (
        <li
          key={s.label}
          aria-current={s.state === 'current' ? 'step' : undefined}
          className="flex items-start gap-3"
        >
          <span
            aria-hidden="true"
            className={`mt-1 size-3 shrink-0 rounded-full border-2 ${
              s.state === 'done'
                ? 'border-brand-black bg-brand-black'
                : s.state === 'current'
                  ? 'border-amber-gold bg-amber-gold'
                  : 'border-charcoal/40 bg-white'
            }`}
          />
          <div>
            <p className="font-subhead text-sm font-semibold text-brand-black">
              {s.label} <span className="font-normal text-charcoal-soft">({s.stateText})</span>
            </p>
            <p className="font-subhead text-sm text-charcoal-soft">{s.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

export function PostedView({ model, entityId, roleTitle, businessName, publicHref }: Props) {
  // /add-job is a 404 while submissions are closed, so the link follows the flag.
  const canPostAnother = isFeatureEnabled('postingSubmissions')
  return (
    <div className="mx-auto w-full max-w-160">
      <div className="rounded-xl border border-charcoal/10 bg-white p-6 sm:p-8">
        <p className="mb-2 font-subhead text-xs font-semibold uppercase tracking-widest text-jobs-ink">Jobs</p>
        <PostedHeading clearDraft={model.kind === 'review' || model.kind === 'live'}>{model.heading}</PostedHeading>
        <p className="mt-2 font-subhead text-base text-charcoal">
          {roleTitle}
          {businessName ? ` at ${businessName}` : ''}
        </p>

        {(model.kind === 'review' || model.kind === 'live') && (
          <>
            <p className="mt-4 font-subhead text-sm text-brand-black">{model.costLine}</p>
            <Timeline steps={model.timeline} />
          </>
        )}

        {model.kind === 'confirming' && (
          <div className="mt-4">
            <PaymentPending />
          </div>
        )}

        {model.kind === 'rejected' && (
          <div className="mt-4 rounded-lg border border-charcoal/15 bg-pale-lavender p-4 font-subhead text-sm text-brand-black">
            <p className="font-semibold">What our team said</p>
            <p className="mt-1 whitespace-pre-line">{model.reason}</p>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link href="/dashboard" className={`${primary} w-full sm:w-auto`}>
          Back to your dashboard
        </Link>
        {model.kind === 'rejected' ? (
          <Link href={`/dashboard/pages/${entityId}/edit`} className={`${secondary} w-full sm:w-auto`}>
            Edit your role
          </Link>
        ) : (
          <>
            {canPostAnother && (
              <Link href="/add-job" className={`${secondary} w-full sm:w-auto`}>
                Post another role
              </Link>
            )}
            {model.kind === 'live' && publicHref ? (
              <Link href={publicHref} className={`${secondary} w-full sm:w-auto`}>
                See your role
              </Link>
            ) : (
              <Link href={`/dashboard/pages/${entityId}/edit`} className={`${secondary} w-full sm:w-auto`}>
                See your role
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  )
}
