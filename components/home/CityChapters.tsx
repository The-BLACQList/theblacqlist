import Link from 'next/link'

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
              className="group relative flex flex-col justify-end min-h-[150px] rounded-xl bg-deep-bg p-5 overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
            >
              <span
                className="absolute inset-0 opacity-70 group-hover:opacity-100 transition-opacity duration-200"
                aria-hidden="true"
                style={{ background: 'radial-gradient(120% 120% at 82% 18%, rgba(196,160,101,0.16), transparent 55%)' }}
              />
              <span className="relative font-headline text-[26px] text-white group-hover:text-light-gold transition-colors duration-150">
                {city.name}
              </span>
              <span className="relative font-subhead text-xs font-semibold text-gold mt-0.5">
                {city.count.toLocaleString()} businesses · {city.stateCode}
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
