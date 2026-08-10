import Link from 'next/link'
import { PhotoPanelCaption } from '@/components/media/PhotoPanelCaption'
import { PhotoPanelGround } from '@/components/media/PhotoPanelGround'

// Each panel is grounded in a licensed editorial photograph [Decision —
// 2026-08-09], which overrides row 1 of the placement table in
// photographic-style-direction.md ("the feature trio stays color-only").
// The frames were chosen for what they actually depict, not for the
// aspirational business names in their filenames:
//   Discover → a maker mid-work in a market interior
//   Support  → a chef mid-service, the archetypal business you spend money at
//   Connect  → two people collaborating
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-px">
        {PANELS.map((panel) => (
          <Link
            key={panel.index}
            href={panel.href}
            className="group relative flex flex-col bg-deep-bg overflow-hidden focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-gold"
          >
            <PhotoPanelGround
              src={panel.photo}
              // A tile taller than the source's 3:2 scales by height, so the
              // frame renders 1.5 × its own height wide — past its CSS width.
              // In the lg band that is 1.125 × the panel, hence 38vw, not 33.
              sizes="(max-width: 1023px) 100vw, (max-width: 1279px) 38vw, 34vw"
            />
            {/* Spacer, not a wrapper — the frame fills the whole panel behind
                it and the caption sits over its bottom edge. The aspect ratio
                still sets how much open picture is held above the caption.

                4:3 only in the lg band. The row breaks to three-across at
                1024px now, so each panel is ~341px wide and a 16:9 picture is
                192px tall against a ~166px caption — survivable, but thin, and
                4:3 lifts it to 255px for free. By xl the panel is wide enough
                that 16:9 wins again. This exception used to sit at md, when the
                row broke at 768 and each panel was ~256px — a 144px picture
                under a 177px caption, which inverted the panel outright. Moving
                the break retired that case; the exception just moved up a rung.

                `grow` keeps the three panels flush across the row when one
                body wraps to a second line and the others do not; it lives on
                the spacer now rather than the caption, because a caption that
                grows would stretch the veil's solid zone away from the text it
                is there to carry. */}
            <span
              aria-hidden="true"
              className="block grow min-h-0 aspect-[16/9] lg:aspect-[4/3] xl:aspect-[16/9]"
            />
            <PhotoPanelCaption className="p-6 md:p-8">
              <span className="font-subhead text-xs font-bold tracking-[0.16em] text-light-gold">
                {panel.index}
              </span>
              <span className="font-headline text-[26px] md:text-[30px] leading-tight text-white mt-1 group-hover:text-light-gold transition-colors duration-150">
                {panel.title}
              </span>
              <span className="font-body text-sm text-off-white/80 mt-1 max-w-[32ch]">
                {panel.body}
              </span>
            </PhotoPanelCaption>
          </Link>
        ))}
      </div>
    </section>
  )
}
