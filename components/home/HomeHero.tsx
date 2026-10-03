import Image from 'next/image'
import { Suspense } from 'react'
import { SearchBar } from '@/components/discovery/SearchBar'
import { HeroQuickFilters } from '@/components/home/HeroQuickFilters'

const QUICK_FILTERS = [
  { label: 'Open now', href: '/discover?open_now=1' },
  { label: 'Restaurants', href: '/discover?category=food-dining' },
  { label: 'Beauty & Grooming', href: '/discover?category=beauty-grooming' },
  { label: 'Professionals', href: '/discover?category=professional-services' },
] as const

/**
 * HP-A "Immersive Search" hero: the platform's core action lives inside the
 * photographic hero — search bar + quick-filter chips over the cover image.
 * Near me leads the chips; it is the one client piece, so the hero stays a
 * server component.
 * The hero image is the page's only preloaded image (LCP guardrail).
 */
export function HomeHero() {
  return (
    <section
      aria-label="Search The BLACQList"
      className="relative min-h-[480px] md:min-h-[72vh] flex items-end md:items-center"
    >
      <Image
        src="/images/hero-bg.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-[80%_0%] md:object-[center_20%]"
      />
      {/* Phones: the photo is cropped onto her and the copy sits below her face,
          so the shade rises from the bottom and leaves her face clear. */}
      <div
        className="absolute inset-0 md:hidden"
        style={{
          background:
            'linear-gradient(to bottom, rgba(4,4,5,0.15) 0%, rgba(4,4,5,0.3) 22%, rgba(4,4,5,0.8) 42%, rgba(4,4,5,0.9) 100%)',
        }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 hidden md:block"
        style={{
          background:
            'linear-gradient(to right, rgba(4,4,5,0.82) 0%, rgba(4,4,5,0.55) 55%, rgba(4,4,5,0.25) 100%)',
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 max-w-7xl mx-auto w-full px-5 md:px-8 lg:px-10 pt-[200px] pb-10 md:py-20">
        <h1 className="font-headline text-[42px] md:text-[60px] lg:text-[68px] text-white leading-[1.05] text-balance max-w-[16ch]">
          Find &amp; Be Found.
        </h1>
        <p className="font-body text-base md:text-lg text-off-white/90 mt-3 max-w-[46ch]">
          Every kind of Black-owned enterprise: brick & mortar, products & services, professionals, creatives, events, and more. One living index.
        </p>

        <div className="mt-7 max-w-xl">
          <Suspense fallback={<div className="h-12 rounded-full bg-white/90" aria-hidden="true" />}>
            <SearchBar placeholder="Search businesses, food…" targetPath="/search" />
          </Suspense>
        </div>

        <HeroQuickFilters filters={QUICK_FILTERS} />
      </div>
    </section>
  )
}
