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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px">
        {PANELS.map((panel) => (
          <Link
            key={panel.index}
            href={panel.href}
            className="group relative flex flex-col bg-deep-bg overflow-hidden focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-gold"
          >
            <PhotoPanelGround
              src={panel.photo}
              sizes="(max-width: 768px) 100vw, 33vw"
            />
            {/* Spacer, not a wrapper — the frame fills the whole panel behind
                it and the caption sits over its bottom edge. The aspect ratio
                still sets how much open picture is held above the caption.

                4:3 only in the md band. The three panels go side-by-side at
                768px, so each is ~256px wide and a 16:9 picture is 144px tall
                against a ~177px caption — the caption outweighing the
                photograph, which inverts the panel. 4:3 puts the picture back
                on top at 192px, and by lg the panel is wide enough that 16:9
                wins again. `[Measured — headless, 375/768/1280, 2026-08-09]`

                `grow` keeps the three panels flush across the row when one
                body wraps to a second line and the others do not; it lives on
                the spacer now rather than the caption, because a caption that
                grows would stretch the veil's solid zone away from the text it
                is there to carry. */}
            <span
              aria-hidden="true"
              className="block grow min-h-0 aspect-[16/9] md:aspect-[4/3] lg:aspect-[16/9]"
            />
            <PhotoPanelCaption className="p-6 md:p-8">
              <span className="font-subhead text-xs font-bold tracking-[0.16em] text-gold">
                {panel.index}
              </span>
              <span className="font-headline text-[26px] md:text-[30px] text-white mt-1 group-hover:text-light-gold transition-colors duration-150">
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
