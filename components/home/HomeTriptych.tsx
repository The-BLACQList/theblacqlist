import Link from 'next/link'

// TODO: replace the designed dark panels with commissioned documentary
// photography (LCI direction) when owned imagery lands — the structure and
// copy stay, the ground becomes a photo with scrim.
const PANELS = [
  {
    index: '01',
    title: 'Discover',
    body: 'Every Black-owned business, one index.',
    href: '/discover',
  },
  {
    index: '02',
    title: 'Support',
    body: 'Track the dollars you keep in community.',
    href: '/flow-map',
  },
  {
    index: '03',
    title: 'Connect',
    body: 'Owners, events, and the people behind them.',
    href: '/blacqlight',
  },
] as const

/** Discover / Support / Connect triptych — three tall editorial panels. */
export function HomeTriptych() {
  return (
    <section aria-label="What The BLACQList does" className="bg-brand-black">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px">
        {PANELS.map((panel) => (
          <Link
            key={panel.index}
            href={panel.href}
            className="group relative flex flex-col justify-end min-h-[180px] md:min-h-[260px] bg-deep-bg p-6 md:p-8 overflow-hidden focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-gold"
          >
            <span
              className="absolute inset-0 opacity-70 group-hover:opacity-100 transition-opacity duration-200"
              aria-hidden="true"
              style={{ background: 'radial-gradient(120% 120% at 82% 18%, rgba(196,160,101,0.16), transparent 55%)' }}
            />
            <span className="relative font-subhead text-xs font-bold tracking-[0.16em] text-gold">
              {panel.index}
            </span>
            <span className="relative font-headline text-[26px] md:text-[30px] text-white mt-1 group-hover:text-light-gold transition-colors duration-150">
              {panel.title}
            </span>
            <span className="relative font-body text-sm text-off-white/80 mt-1 max-w-[32ch]">
              {panel.body}
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
