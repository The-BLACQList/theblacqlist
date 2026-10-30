import type { JobFact } from '@/lib/listings/jobFacts'

interface Props {
  facts: JobFact[]
}

/** Type, Where, Pay, Closes as a real description list. Label over value on a phone. */
export function JobFactSheet({ facts }: Props) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 rounded-xl border border-charcoal/10 bg-off-white/60 p-5">
      {facts.map((f) => (
        <div key={f.label}>
          <dt className="font-subhead text-xs font-semibold uppercase tracking-wide text-charcoal-soft">
            {f.label}
          </dt>
          <dd className="font-body text-base text-brand-black mt-0.5">
            {f.dateTime ? <time dateTime={f.dateTime}>{f.value}</time> : f.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
