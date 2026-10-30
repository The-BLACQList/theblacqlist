import { ExternalLink, Send } from 'lucide-react'

import { CopyEmailButton } from '@/components/entity-page/job/CopyEmailButton'
import { applyLinkClass } from '@/components/entity-page/job/JobHowToApply'

interface Props {
  applyUrl: string | null
  applyEmail: string | null
}

/**
 * Phone-only apply action fixed to the bottom of the screen (hidden from md up).
 * Shows the link when there is one, otherwise Copy email. Renders nothing when the
 * role has no way to apply. The page reserves room for it (see JobBarSpacer).
 */
export function JobApplyBar({ applyUrl, applyEmail }: Props) {
  if (!applyUrl && !applyEmail) return null
  return (
    <div className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-charcoal/10 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
      {applyUrl ? (
        <a
          href={applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${applyLinkClass} w-full h-12`}
        >
          <Send className="size-4" aria-hidden="true" />
          Apply
          <ExternalLink className="size-3.5" aria-hidden="true" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      ) : (
        applyEmail && <CopyEmailButton email={applyEmail} className="w-full" />
      )}
    </div>
  )
}
