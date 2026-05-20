interface SummaryCardProps {
  label: string
  value: string
  subtext?: string
}

function SummaryCard({ label, value, subtext }: SummaryCardProps) {
  return (
    <div className="rounded-xl bg-white border border-charcoal/10 p-5">
      <p className="font-subhead text-xs text-charcoal/50 font-semibold uppercase tracking-wide">
        {label}
      </p>
      <p className="font-headline text-3xl text-brand-black mt-1">{value}</p>
      {subtext && <p className="font-body text-xs text-charcoal/40 mt-0.5">{subtext}</p>}
    </div>
  )
}

interface FlowSummaryCardsProps {
  totalAmountCents: number
  totalTransactions: number
  uniqueBusinesses: number
}

export function FlowSummaryCards({
  totalAmountCents,
  totalTransactions,
  uniqueBusinesses,
}: FlowSummaryCardsProps) {
  const dollars = (totalAmountCents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <SummaryCard label="Total circulated" value={dollars} subtext="Verified community spend" />
      <SummaryCard
        label="Businesses supported"
        value={uniqueBusinesses.toLocaleString()}
        subtext="Unique Black-owned businesses"
      />
      <SummaryCard
        label="Transactions"
        value={totalTransactions.toLocaleString()}
        subtext="Verified receipts recorded"
      />
    </div>
  )
}
