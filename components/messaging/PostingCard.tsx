import { Briefcase, CalendarDays, ExternalLink, Mail, MapPin, Tag, Ticket } from 'lucide-react'
import type { PostingDetails } from '@/lib/messaging/postings'

/**
 * The posting a thread is about (part H), at the top of the thread, so both
 * sides see the role or event without leaving the conversation. Shown to the
 * owner and to the person who asked.
 */
export function PostingCard({ posting }: { posting: PostingDetails }) {
  const isJob = posting.kind === 'job'
  const ended = isJob ? posting.closed : posting.over
  const Icon = isJob ? Briefcase : CalendarDays

  return (
    <section
      aria-label={isJob ? 'About this job' : 'About this event'}
      className="px-4 py-3.5 border-b border-charcoal/10 bg-off-white/60"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Icon className="size-4 shrink-0 text-charcoal-soft" aria-hidden="true" />
        <span className="font-subhead text-xs font-semibold uppercase tracking-wide text-charcoal-soft">
          {isJob ? 'Job' : 'Event'}
        </span>
        {posting.url ? (
          <a
            href={posting.url}
            className="inline-flex items-center gap-1 font-subhead text-sm font-bold text-brand-black hover:underline underline-offset-2"
          >
            {posting.title}
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        ) : (
          <span className="font-subhead text-sm font-bold text-brand-black">{posting.title}</span>
        )}
        {ended && (
          <span className="rounded-full bg-charcoal/10 px-2 py-0.5 font-subhead text-[11px] font-semibold text-charcoal">
            {isJob ? 'Closed' : 'Over'}
          </span>
        )}
      </div>

      <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 font-body text-xs">
        {isJob ? (
          <>
            {posting.facts.map((f) => (
              <Fact key={f.label} label={f.label} value={f.value} />
            ))}
            {posting.applyUrl && (
              <Fact label="Apply" icon={<ExternalLink className="size-3" aria-hidden="true" />}>
                <a href={posting.applyUrl} className="underline underline-offset-2 hover:text-brand-black break-all">
                  Application link
                </a>
              </Fact>
            )}
            {posting.applyEmail && (
              <Fact label="Apply by email" icon={<Mail className="size-3" aria-hidden="true" />}>
                <a href={`mailto:${posting.applyEmail}`} className="underline underline-offset-2 hover:text-brand-black break-all">
                  {posting.applyEmail}
                </a>
              </Fact>
            )}
          </>
        ) : (
          <>
            {posting.when && <Fact label="When" value={posting.when} icon={<CalendarDays className="size-3" aria-hidden="true" />} />}
            {posting.where && <Fact label="Where" value={posting.where} icon={<MapPin className="size-3" aria-hidden="true" />} />}
            {posting.priceText && <Fact label="Price" value={posting.priceText} icon={<Tag className="size-3" aria-hidden="true" />} />}
            {posting.ticketUrl && (
              <Fact label="Tickets" icon={<Ticket className="size-3" aria-hidden="true" />}>
                <a href={posting.ticketUrl} className="underline underline-offset-2 hover:text-brand-black break-all">
                  Ticket link
                </a>
              </Fact>
            )}
          </>
        )}
      </dl>
    </section>
  )
}

function Fact({
  label,
  value,
  icon,
  children,
}: {
  label: string
  value?: string
  icon?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-baseline gap-1.5 min-w-0">
      <dt className="shrink-0 inline-flex items-center gap-1 font-semibold text-charcoal">
        {icon}
        {label}:
      </dt>
      <dd className="min-w-0 text-charcoal-soft">{children ?? value}</dd>
    </div>
  )
}
