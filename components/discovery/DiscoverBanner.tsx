interface BannerContent {
  title: string
  line: string
  shot: string
  tone: string
}

// One banner per avenue plus the default Discover banner. Grounds are
// art-directed gradients standing in for commissioned documentary
// photography (the `shot` note is the brief for each frame) — never stock
// passed off as real businesses.
const BANNERS: Record<string, BannerContent> = {
  business: {
    title: 'Brick & Mortar',
    line: 'Shops and storefronts keeping the block alive.',
    shot: 'storefront at golden hour, owner in the doorway',
    tone: 'linear-gradient(135deg, #4a3423 0%, #7a5535 48%, #33251a 100%)',
  },
  restaurant: {
    title: 'Restaurants',
    line: 'Plates, pop-ups, and the tables that gather us.',
    shot: 'kitchen pass in motion, warm light',
    tone: 'linear-gradient(140deg, #5c3420 0%, #8a5a35 50%, #3a2314 100%)',
  },
  service_provider: {
    title: 'Products & Services',
    line: 'Book the appointment. Order the piece. Support the craft.',
    shot: 'maker’s hands at work, close frame',
    tone: 'linear-gradient(150deg, #5c4028 0%, #8a6a3f 52%, #2e2317 100%)',
  },
  vendor: {
    title: 'Products & Services',
    line: 'Book the appointment. Order the piece. Support the craft.',
    shot: 'market stall, goods forward',
    tone: 'linear-gradient(150deg, #5c4028 0%, #8a6a3f 52%, #2e2317 100%)',
  },
  professional: {
    title: 'Professionals',
    line: 'Counsel, care, and expertise from people who look out for you.',
    shot: 'consultation across the table, window light',
    tone: 'linear-gradient(125deg, #39292b 0%, #6e4a50 55%, #221619 100%)',
  },
  creative: {
    title: 'Creatives',
    line: 'Commission the work. Collect the culture.',
    shot: 'studio session, strobe + window mix',
    tone: 'linear-gradient(160deg, #2e2c3a 0%, #5a4a63 55%, #1d1a24 100%)',
  },
  event: {
    title: 'Events',
    line: 'Pull up — the culture is live.',
    shot: 'crowd at dusk, stage glow',
    tone: 'linear-gradient(140deg, #23392e 0%, #3f6b52 55%, #14231b 100%)',
  },
  default: {
    title: 'Discover',
    line: 'Every kind of Black-owned enterprise, one living index.',
    shot: 'street scene: shops, people, motion',
    tone: 'linear-gradient(130deg, #241c12 0%, #4a3a24 55%, #17110a 100%)',
  },
}

interface Props {
  type?: string | null
}

/**
 * Photographic banner atop /discover that swaps with the selected avenue
 * (?type=) — six type banners plus the default. Discovery UI continues
 * unchanged below it.
 */
export function DiscoverBanner({ type }: Props) {
  const banner = (type && BANNERS[type]) || BANNERS.default!

  return (
    <div
      className="relative overflow-hidden"
      style={{ background: banner.tone }}
    >
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(110% 90% at 78% 20%, rgba(255,222,160,0.20), transparent 55%), linear-gradient(to top, rgba(4,4,5,0.55), transparent 60%)',
        }}
      />
      {/* TODO: commissioned documentary photograph per banner — brief: {banner.shot} */}
      <div className="relative max-w-7xl mx-auto w-full px-5 md:px-8 lg:px-10 py-16 md:py-24 min-h-[220px] md:min-h-[300px] flex flex-col justify-end">
        <h1 className="font-headline text-[34px] md:text-[52px] text-white text-balance">
          {banner.title}
        </h1>
        <p className="font-body text-[15px] text-off-white/90 mt-1.5 max-w-[52ch]">{banner.line}</p>
      </div>
    </div>
  )
}
