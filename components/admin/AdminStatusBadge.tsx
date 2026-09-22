import { cn } from '@/lib/utils'

interface Props {
  status: string
  className?: string
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  // Listing statuses
  pending: { label: 'Pending', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  published: { label: 'Published', className: 'bg-green-50 text-green-700 border-green-200' },
  rejected: { label: 'Rejected', className: 'bg-red-50 text-red-700 border-red-200' },
  // Claim statuses
  under_review: { label: 'Under review', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  approved: { label: 'Approved', className: 'bg-green-50 text-green-700 border-green-200' },
  withdrawn: { label: 'Withdrawn', className: 'bg-charcoal/5 text-charcoal-soft border-charcoal/15' },
  // Trust tiers
  unclaimed: { label: 'Unclaimed', className: 'bg-charcoal/5 text-charcoal-soft border-charcoal/15' },
  claimed: { label: 'Claimed', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  verified: { label: 'Verified', className: 'bg-green-50 text-green-700 border-green-200' },
  certified: { label: 'Certified', className: 'bg-purple-50 text-purple-700 border-purple-200' },
  // Review statuses
  intake: { label: 'Pending review', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  pending_approval: {
    label: 'Pending approval',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  removed: { label: 'Removed', className: 'bg-charcoal/5 text-charcoal-soft border-charcoal/15' },
  // Queue statuses
  assigned: { label: 'Assigned', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  resolved: { label: 'Resolved', className: 'bg-green-50 text-green-700 border-green-200' },
  dismissed: { label: 'Dismissed', className: 'bg-charcoal/5 text-charcoal-soft border-charcoal/15' },
  // problem_reports (supabase/migrations/20260921000000_problem_reports.sql)
  new: { label: 'New', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  triaged: { label: 'Triaged', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  fixed: { label: 'Fixed', className: 'bg-green-50 text-green-700 border-green-200' },
}

export function AdminStatusBadge({ status, className }: Props) {
  const config = STATUS_MAP[status] ?? {
    label: status,
    className: 'bg-charcoal/5 text-charcoal-soft border-charcoal/15',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold font-subhead',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  )
}
