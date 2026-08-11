import Link from 'next/link'
import { PhotoPanelGround } from '@/components/media/PhotoPanelGround'

// Each panel is grounded in a licensed editorial photograph [Decision —
// 2026-08-09], which overrides row 1 of the placement table in
// photographic-style-direction.md ("the feature trio stays color-only").
// The frames were chosen for what they actually depict, not for the
// aspirational business names in their filenames:
//   Discover → a maker mid-work in a market interior
//   Support  → a chef mid-service, the archetypal business you spend money at
//   Connect  → two people collaborating, and the only frame already dark
//              enough to need almost no scrim work
// None of these three appear in CATEGORY_PHOTOS: the bento renders in the same
// scroll, and a repeated frame reads as a bug.
const PANELS = [
  {
    index: '01',
    title: 'Discover',
    body: 'Every Black-owned business, one index.',
    href: '/discover',
    photo: '/images/editorial/asha-osei-photography.webp',
  },
  {
    index: '02',
    title: 'Support',
    body: 'Track the dollars you keep in community.',
    href: '/flow-map',
    photo: '/images/editorial/peach-and-rye-kitchen.webp',
  },
  {
    index: '03',
    title: 'Connect',
    body: 'Owners, events, and the people behind them.',
    href: '/blacqlight',
    photo: '/images/editorial/diaspora-creative-agency.webp',
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
            <PhotoPanelGround
              src={panel.photo}
              sizes="(max-width: 768px) 100vw, 33vw"
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
