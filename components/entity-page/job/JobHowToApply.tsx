import { ExternalLink, Send } from 'lucide-react'

import { CopyEmailButton } from '@/components/entity-page/job/CopyEmailButton'

interface Props {
  applyUrl: string | null
  applyEmail: string | null
}

export const APPLY_EMAIL_ID = 'job-apply-email'

/** The apply link opens in a new tab; an email is plain text with a Copy button. */
export const applyLinkClass =
  'inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full bg-amber-gold text-brand-black font-subhead text-sm font-bold hover:bg-amber-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-black transition-colors'

export function JobHowToApply({ applyUrl, applyEmail }: Props) {
  return (
    <section aria-labelledby="job-apply-heading" className="scroll-mt-32">
      <h2 id="job-apply-heading" className="font-headline text-xl text-brand-black mb-3">
        How to apply
      </h2>
      {!applyUrl && !applyEmail ? (
        <p className="font-body text-sm text-charcoal">Contact details missing</p>
      ) : (
        <div className="space-y-4">
          {applyUrl && (
            <a href={applyUrl} target="_blank" rel="noopener noreferrer" className={applyLinkClass}>
              <Send className="size-4" aria-hidden="true" />
              Apply
              <ExternalLink className="size-3.5" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
          {applyEmail && (
            <div className="space-y-2">
              <p className="font-body text-sm text-charcoal">
                {applyUrl ? 'Or email your application to' : 'Email your application to'}
              </p>
              <p
                id={APPLY_EMAIL_ID}
                className="font-body text-base font-semibold text-brand-black break-all select-all"
              >
                {applyEmail}
              </p>
              <CopyEmailButton email={applyEmail} selectTargetId={APPLY_EMAIL_ID} />
            </div>
          )}
        </div>
      )}
    </section>
  )
}
