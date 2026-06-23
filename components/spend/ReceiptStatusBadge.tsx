interface Props {
  status: string
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending_review: {
    label: 'Pending review',
    className: 'bg-amber-50 text-amber-700 border border-amber-200',
  },
  approved: {
    label: 'Approved',
    className: 'bg-green-50 text-green-700 border border-green-200',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-red-50 text-red-700 border border-red-200',
  },
}

export function ReceiptStatusBadge({ status }: Props) {
  const config = statusConfig[status] ?? {
    label: status,
    className: 'bg-charcoal/5 text-charcoal-soft border border-charcoal/10',
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-subhead text-xs font-semibold ${config.className}`}
    >
      {config.label}
    </span>
  )
}
