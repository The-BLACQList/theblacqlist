import Link from 'next/link'
import { PhotoPanelGround } from '@/components/media/PhotoPanelGround'
import { CITY_PHOTOS, PHOTO_PLATE } from '@/lib/design/surfaces'

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
 * Each live tile is a 16:9 picture region over a caption plate. The picture is a
 * skyline where `CITY_PHOTOS` has one and the ember wash where it does not —
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          {live.map((city) => (
            <Link
              key={city.slug}
              href={`/discover/${city.slug}`}
              className="group flex flex-col rounded-xl bg-deep-bg overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
            >
              <span className="relative block aspect-[16/9] overflow-hidden">
                <PhotoPanelGround
                  src={CITY_PHOTOS[city.slug]}
                  sizes="(max-width: 640px) 100vw, (max-width: 1280px) 33vw, 400px"
                  alt={`${city.name} skyline`}
                />
              </span>
              <span className={`flex grow flex-col ${PHOTO_PLATE} p-5`}>
                <span className="font-headline text-[26px] text-white group-hover:text-light-gold transition-colors duration-150">
                  {city.name}
                </span>
                <span className="font-subhead text-xs font-semibold text-gold mt-0.5">
                  {city.count.toLocaleString()} businesses · {city.stateCode}
                </span>
              </span>
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
