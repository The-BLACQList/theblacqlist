import Image from 'next/image'
import Link from 'next/link'
import { Suspense } from 'react'
import { SearchBar } from '@/components/discovery/SearchBar'

const QUICK_FILTERS = [
  { label: 'Open now', href: '/discover?open_now=1' },
  { label: 'Restaurants', href: '/discover?category=food-dining' },
  { label: 'Beauty & Grooming', href: '/discover?category=beauty-grooming' },
  { label: 'Professionals', href: '/discover?category=professional-services' },
] as const

/**
 * HP-A "Immersive Search" hero: the platform's core action lives inside the
 * photographic hero — search bar + quick-filter chips over the cover image.
 * The hero image is the page's only preloaded image (LCP guardrail).
 */
export function HomeHero() {
  return (
    <section aria-label="Search The BLACQList" className="relative min-h-[480px] md:min-h-[72vh] flex items-center">
      <Image
        src="/images/hero-bg.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-[center_20%]"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to right, rgba(4,4,5,0.82) 0%, rgba(4,4,5,0.55) 55%, rgba(4,4,5,0.25) 100%)',
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 max-w-7xl mx-auto w-full px-5 md:px-8 lg:px-10 py-20">
        <h1 className="font-headline text-[42px] md:text-[60px] lg:text-[68px] text-white leading-[1.05] text-balance max-w-[16ch]">
          Find &amp; Be Found.
        </h1>
        <p className="font-body text-base md:text-lg text-off-white/90 mt-3 max-w-[46ch]">
          Every kind of Black-owned enterprise: brick & mortar, products & services, professionals, creatives, events, and more. One living index.
        </p>

        <div className="mt-7 max-w-xl">
          <Suspense fallback={<div className="h-12 rounded-full bg-white/90" aria-hidden="true" />}>
            <SearchBar placeholder="Search businesses, food, services…" targetPath="/search" />
          </Suspense>
        </div>

        <ul className="flex flex-wrap gap-2 mt-4 list-none p-0 m-0" aria-label="Quick filters">
          {QUICK_FILTERS.map((filter) => (
            <li key={filter.label}>
              <Link
                href={filter.href}
                className="inline-flex items-center min-h-11 px-4 rounded-full border border-off-white/40 bg-off-white/10 text-off-white font-subhead text-[13px] font-semibold backdrop-blur-sm hover:bg-off-white/20 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                {filter.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
