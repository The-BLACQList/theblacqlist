import { AlertTriangle } from 'lucide-react'
import { pageHideReasonLabel } from '@/lib/admin/pageHide'
import type { MarkMatch } from '@/lib/admin/pageVisibility'

/** Ticket 284: warns the reviewer of a new Page. It never blocks approval. */
export function PageMarkWarning({ match }: { match: MarkMatch }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-300 px-4 py-3"
    >
      <AlertTriangle className="size-4 mt-0.5 text-amber-700 shrink-0" aria-hidden="true" />
      <div className="font-body text-sm text-amber-900 space-y-1">
        {match.kind === 'match' ? (
          <>
            <p className="font-subhead font-semibold">Marked Do Not Re-Add</p>
            <p>
              {match.name}
              {match.cityName ? ` in ${match.cityName}` : ''} was taken down on {match.markedOn}.
              Reason: {pageHideReasonLabel(match.reason)}. Check it&apos;s meant to come back before
              you approve.
            </p>
          </>
        ) : (
          <p>We couldn&apos;t check the do-not-re-add marks. Reload before you approve.</p>
        )}
      </div>
    </div>
  )
}
