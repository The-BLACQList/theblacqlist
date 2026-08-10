import Link from 'next/link'
import { PhotoPanelCaption } from '@/components/media/PhotoPanelCaption'
import { PhotoPanelGround } from '@/components/media/PhotoPanelGround'
import { CITY_PHOTOS } from '@/lib/design/surfaces'

export interface CityChapter {
  name: string
  slug: string
  stateCode: string
  count: number
  isActive: boolean
}

interface Props {
  cities: CityChapter[]
}

/**
 * City chapters — live cities as dark chapter cards with real counts;
 * coming-soon cities stay quiet and typographic (LCI direction).
 *
 * Each live tile is a full-bleed frame with a feathered caption band across its
 * bottom, holding 16:9 of open picture above it. The picture is a skyline where
 * `CITY_PHOTOS` has one and the ember wash where it does not —
 * `PhotoPanelGround` decides, so a city opening without a photograph still
 * renders in the same shape. Alt text names the city because the photograph is
 * informative here, not decorative.
 */
export function CityChapters({ cities }: Props) {
  const live = cities.filter((c) => c.isActive)
  const comingSoon = cities.filter((c) => !c.isActive)
  if (live.length === 0) return null

  return (
    <section aria-labelledby="cities-heading" className="bg-off-white py-12 md:py-16">
      <div className="max-w-7xl mx-auto w-full px-5 md:px-8 lg:px-10">
        <p className="font-subhead text-xs font-bold uppercase tracking-[0.12em] text-amber mb-1.5">
          City chapters
        </p>
        <h2 id="cities-heading" className="font-headline text-[26px] md:text-[32px] text-brand-black">
          Your city&apos;s index
        </h2>

        {/* Three-across at lg, not sm. At 640 the old break gave each city a
            189px tile holding 50px of open skyline under a 75%-covered caption
            — the worst panel in the system, and a band the harness had never
            sampled. Full width until 1024 costs scroll length and returns the
            picture. `[Measured — scripts/measure-plate-contrast.ts, 2026-08-10]` */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
          {live.map((city) => (
            <Link
              key={city.slug}
              href={`/discover/${city.slug}`}
              className="group relative flex flex-col rounded-xl bg-deep-bg overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
            >
              <PhotoPanelGround
                src={CITY_PHOTOS[city.slug]}
                sizes="(max-width: 1023px) 100vw, (max-width: 1279px) 33vw, 400px"
                alt={`${city.name} skyline`}
              />
              {/* Spacer, not a wrapper — the frame fills the whole tile behind
                  it; this only holds the open picture above the caption open.
                  `grow` keeps the three tiles flush when one city name wraps.

                  16:9 stays at every width. These are skylines: the source is
                  3:2, so a taller spacer would take the crop off the sides and
                  shear the towers — the one thing a skyline cannot spare. */}
              <span aria-hidden="true" className="block grow min-h-0 aspect-[16/9]" />
              <PhotoPanelCaption className="p-4">
                <span className="font-headline text-[26px] leading-tight text-white group-hover:text-light-gold transition-colors duration-150">
                  {city.name}
                </span>
                <span className="font-subhead text-xs font-semibold text-light-gold mt-0.5">
                  {city.count.toLocaleString()} businesses · {city.stateCode}
                </span>
              </PhotoPanelCaption>
            </Link>
          ))}
        </div>

        {comingSoon.length > 0 && (
          <p className="font-subhead text-[13px] text-charcoal-soft mt-5">
            Coming soon:{' '}
            {comingSoon
              .slice(0, 8)
              .map((c) => c.name)
              .join(' · ')}
            {comingSoon.length > 8 ? ` · +${comingSoon.length - 8} more` : ''}
          </p>
        )}
      </div>
    </section>
  )
}
