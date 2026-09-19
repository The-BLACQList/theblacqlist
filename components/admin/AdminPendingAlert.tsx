import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

interface Props {
  /** Listings with `status = 'pending'` and no soft delete. */
  count: number
}

/**
 * Priority alert for the admin overview: submissions a business owner is
 * waiting on. Sits above the stat grid and renders nothing at zero, so the
 * founder never sees an empty "all clear" panel and a non-zero one cannot be
 * mistaken for one of the five stat cards beneath it.
 */
export function AdminPendingAlert({ count }: Props) {
  if (count <= 0) return null

  const noun = count === 1 ? 'business is' : 'businesses are'

  return (
    <div
      role="status"
      data-testid="admin-pending-alert"
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-amber-300 bg-amber-50 px-5 py-4"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="size-5 shrink-0 text-amber-600 mt-0.5" aria-hidden="true" />
        <div>
          <p className="font-subhead text-sm font-semibold text-amber-900">
            {count.toLocaleString()} {noun} waiting for review
          </p>
          <p className="font-body text-sm text-amber-800 mt-0.5">
            Each one is an owner who submitted a business and cannot see it live yet.
          </p>
        </div>
      </div>
      <Link
        href="/admin/entities?status=pending"
        className="inline-flex items-center justify-center h-9 px-4 rounded-lg bg-amber-gold text-brand-black font-subhead font-bold text-sm hover:bg-light-gold transition-colors shrink-0"
      >
        Review submissions
      </Link>
    </div>
  )
}
