import Image from 'next/image'

import { PHOTO_FOCAL } from '@/lib/design/surfaces'
import { cn } from '@/lib/utils'

interface BannerContent {
  title: string
  line: string
  shot: string
  tone: string
  /**
   * The commissioned frame for this avenue. Absent means the `tone` gradient is
   * the finished ground — same contract as `CITY_PHOTOS`, where an unmapped
   * city renders the wash as a first-class outcome rather than a hole.
   */
  photo?: string
}

const P = '/images/editorial/categories'

// One banner per avenue plus the default Discover banner. The `shot` note is
// the brief each frame was made against; keep it even now that the frames
// exist, because it is the standard a replacement has to meet.
//
// ⚠ The frames are grounds, not evidence. A banner heads a *bin*, so it names
// a category and never a business — which is what keeps this file's own rule
// ("never stock passed off as real businesses") satisfied. That is also why
// every one is `alt=""`: nothing in the picture is a fact a reader needs, and
// the `<h1>` beneath already says what the bin is. Do not caption these, do not
// attribute them to a listing, and do not reuse one on a listing page.
//
// The `tone` gradients stay. They are the ground the type was set against, and
// they still paint while the photograph decodes. `default` ran on its gradient
// alone until 2026-09-25, when the founder supplied its frame (a shop owner at
// the counter); the "street scene" brief was the one that could not be shot
// without picking a city, so the frame answers it with a shop instead.
const BANNERS: Record<string, BannerContent> = {
  business: {
    title: 'Brick & Mortar',
    line: 'Shops and storefronts keeping the block alive.',
    shot: 'storefront at golden hour, owner in the doorway',
    tone: 'linear-gradient(135deg, #4a3423 0%, #7a5535 48%, #33251a 100%)',
    photo: `${P}/brick-and-mortar.webp`,
  },
  restaurant: {
    title: 'Restaurants',
    line: 'Plates, pop-ups, and the tables that gather us.',
    shot: 'kitchen pass in motion, warm light',
    tone: 'linear-gradient(140deg, #5c3420 0%, #8a5a35 50%, #3a2314 100%)',
    photo: `${P}/restaurants.webp`,
  },
  service_provider: {
    title: 'Products & Services',
    line: 'Book the appointment. Order the piece. Support the craft.',
    shot: 'maker’s hands at work, close frame',
    tone: 'linear-gradient(150deg, #5c4028 0%, #8a6a3f 52%, #2e2317 100%)',
    photo: `${P}/products-and-services.webp`,
  },
  vendor: {
    title: 'Products & Services',
    line: 'Book the appointment. Order the piece. Support the craft.',
    shot: 'market stall, goods forward',
    tone: 'linear-gradient(150deg, #5c4028 0%, #8a6a3f 52%, #2e2317 100%)',
    // Deliberately the same frame as `service_provider`. The two keys already
    // share a title and a line — two different pictures under one bin name
    // would read as two different bins.
    photo: `${P}/products-and-services.webp`,
  },
  professional: {
    title: 'Professionals',
    line: 'Counsel, care, and expertise from people who look out for you.',
    shot: 'consultation across the table, window light',
    tone: 'linear-gradient(125deg, #39292b 0%, #6e4a50 55%, #221619 100%)',
    photo: `${P}/professionals.webp`,
  },
  creative: {
    title: 'Creatives',
    line: 'Commission the work. Collect the culture.',
    shot: 'studio session, strobe + window mix',
    tone: 'linear-gradient(160deg, #2e2c3a 0%, #5a4a63 55%, #1d1a24 100%)',
    photo: `${P}/creatives.webp`,
  },
  event: {
    title: 'Events',
    line: 'Pull up. The culture is live.',
    shot: 'crowd at dusk, stage glow',
    tone: 'linear-gradient(140deg, #23392e 0%, #3f6b52 55%, #14231b 100%)',
    photo: `${P}/events.webp`,
  },
  job: {
    title: 'Jobs',
    line: 'Work that builds something. Roles open right now.',
    shot: 'team mid-shift, hands and faces at work',
    tone: 'linear-gradient(145deg, #1f2b3a 0%, #3d5570 55%, #141c26 100%)',
    photo: `${P}/jobs.webp`,
  },
  default: {
    title: 'Discover',
    line: 'Every kind of Black-owned enterprise, one living index.',
    shot: 'street scene: shops, people, motion',
    tone: 'linear-gradient(130deg, #241c12 0%, #4a3a24 55%, #17110a 100%)',
    photo: '/images/editorial/discover-cover.webp',
  },
}

interface Props {
  type?: string | null
}

/**
 * Photographic banner atop /discover that swaps with the selected avenue
 * (?type=) — eight type banners plus the default. Discovery UI continues
 * unchanged below it.
 *
 * ## Why this one lays a tint across the photograph
 *
 * `PhotoPanelGround` forbids that outright, and the ban is right *there*: a
 * photo panel sets its caption on a separate feathered plate, so the picture
 * never has to carry type and never has to be dimmed to do it. This banner is
 * the opposite shape — the `<h1>` sits directly on the ground, ~32–62% up the
 * frame, which is precisely the band the old bottom-only scrim reaches with
 * roughly 0.31 alpha and less. That was fine against a `tone` gradient whose
 * lightest stop is about #8a6a3f, and it is not fine against a photograph that
 * can be white anywhere.
 *
 * So the tint is flat and covers the whole frame at the alpha of
 * `PHOTO_PLATE_TINT` — the value the plate harness measured over 310 runs
 * `[Measured — scripts/measure-plate-contrast.ts, 2026-08-10]`. Borrowing that
 * number buys the property that made it worth measuring: **the worst case is
 * alpha-determined, not image-determined.** White on 0.67 black over a pure
 * white pixel is 7.46:1, so no frame in the set — nor any frame added later —
 * can regress the headline, and swapping a photograph needs no contrast sweep.
 * ⚠ Lowering the alpha would move all eight banners at once, and would make the
 * result depend on the picture again. Don't.
 */
export function DiscoverBanner({ type }: Props) {
  const banner = (type && BANNERS[type]) || BANNERS.default!

  return (
    <div
      className="relative overflow-hidden"
      style={{ background: banner.tone }}
    >
      {banner.photo !== undefined && (
        <>
          {/* Above the fold on the busiest route in the product, and the LCP
              element on it — so `priority`, and full-width `sizes` because the
              banner is edge-to-edge at every breakpoint. */}
          <Image
            src={banner.photo}
            alt=""
            fill
            priority
            sizes="100vw"
            className={cn('object-cover', PHOTO_FOCAL[banner.photo])}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{ background: 'rgba(8,8,10,0.67)' }}
          />
        </>
      )}
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(110% 90% at 78% 20%, rgba(255,222,160,0.20), transparent 55%), linear-gradient(to top, rgba(4,4,5,0.55), transparent 60%)',
        }}
      />
      {/* Height doubled 2026-09-21 (founder, pre-invite item 2) to 440/600,
          then cut back by about 200px on 2026-09-25 (founder) to 280/400, so
          the results start sooner. The min-height sets the size; the padding
          is only a floor, small enough never to push past it. Content stays
          pinned to the bottom edge so the title keeps its place above the
          search bar. */}
      <div className="relative max-w-7xl mx-auto w-full px-5 md:px-8 lg:px-10 pt-16 pb-10 md:pt-20 md:pb-14 min-h-[280px] md:min-h-[400px] flex flex-col justify-end">
        <h1 className="font-headline text-[34px] md:text-[52px] text-white text-balance">
          {banner.title}
        </h1>
        <p className="font-body text-[15px] text-off-white/90 mt-1.5 max-w-[52ch]">{banner.line}</p>
      </div>
    </div>
  )
}
