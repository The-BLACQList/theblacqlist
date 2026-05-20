import Link from 'next/link'

interface FlowNode {
  entity_id: string
  name: string
  slug?: string
  total_amount_cents: number
  transaction_count: number
}

interface FlowNodeTableProps {
  nodes: FlowNode[]
  title: string
  linkToEntity?: boolean
  emptyText?: string
}

function formatDollars(cents: number) {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

function percentOfMax(value: number, max: number): number {
  if (max === 0) return 0
  return Math.round((value / max) * 100)
}

export function FlowNodeTable({
  nodes,
  title,
  linkToEntity = false,
  emptyText = 'No data yet.',
}: FlowNodeTableProps) {
  const maxAmount = Math.max(...nodes.map((n) => n.total_amount_cents), 1)

  return (
    <div className="rounded-xl bg-white border border-charcoal/10 overflow-hidden">
      <div className="px-5 py-4 border-b border-charcoal/5">
        <h2 className="font-headline text-base text-brand-black">{title}</h2>
      </div>

      {nodes.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="font-body text-sm text-charcoal/50">{emptyText}</p>
        </div>
      ) : (
        <div className="divide-y divide-charcoal/5">
          {nodes.map((node, i) => {
            const barWidth = percentOfMax(node.total_amount_cents, maxAmount)
            const nameEl =
              linkToEntity && node.slug ? (
                <Link
                  href={`/b/${node.slug}`}
                  className="font-subhead text-sm font-semibold text-brand-black hover:text-amber-gold transition-colors truncate"
                >
                  {node.name}
                </Link>
              ) : (
                <span className="font-subhead text-sm font-semibold text-brand-black truncate">
                  {node.name}
                </span>
              )

            return (
              <div key={node.entity_id} className="px-5 py-3.5">
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="font-subhead text-xs text-charcoal/30 w-5 text-right shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">{nameEl}</div>
                  <div className="text-right shrink-0">
                    <span className="font-subhead text-sm font-semibold text-brand-black tabular-nums">
                      {formatDollars(node.total_amount_cents)}
                    </span>
                    <span className="font-body text-xs text-charcoal/40 ml-2">
                      {node.transaction_count}{' '}
                      {node.transaction_count === 1 ? 'receipt' : 'receipts'}
                    </span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="ml-8 h-1 bg-charcoal/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-gold rounded-full"
                    style={{ width: `${barWidth}%` }}
                    aria-hidden="true"
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
