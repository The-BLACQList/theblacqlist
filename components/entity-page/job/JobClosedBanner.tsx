interface Props {
  date: string
}

export function JobClosedBanner({ date }: Props) {
  return (
    <div
      role="status"
      className="rounded-xl border border-charcoal/20 bg-charcoal/5 px-5 py-4 font-subhead text-sm font-semibold text-brand-black"
    >
      Applications closed on {date}
    </div>
  )
}
