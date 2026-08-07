import Link from 'next/link'
import { ShowcaseCarousel, type ShowcaseItem } from '@/components/home/ShowcaseCarousel'

interface Props {
  items: ShowcaseItem[]
}

/** "Your BLACQList Page" — carousel of real page previews (LCI §7). */
export function MicrositeShowcase({ items }: Props) {
  if (items.length === 0) return null

  return (
    <section aria-labelledby="showcase-heading" className="bg-white py-12 md:py-16">
      <div className="max-w-7xl mx-auto w-full px-5 md:px-8 lg:px-10">
        <div className="flex items-end justify-between gap-6 flex-wrap mb-6">
          <div>
            <p className="font-subhead text-xs font-bold uppercase tracking-[0.12em] text-amber mb-1.5">
              Your official page
            </p>
            <h2 id="showcase-heading" className="font-headline text-[26px] md:text-[32px] text-brand-black max-w-[22ch] text-balance">
              More than a listing — your business&apos;s home
            </h2>
          </div>
          <Link
            href="/for-business"
            className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-gold hover:bg-light-gold text-brand-black font-subhead text-sm font-bold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            Claim your page
          </Link>
        </div>

        <ShowcaseCarousel items={items} />

        <p className="font-subhead text-xs text-charcoal-soft mt-2.5">
          Real pages on the platform right now — menus, services, portfolios, event tickets,
          reviews, and verification, for every kind of Black enterprise. Swipe, use the arrows, or arrow keys.
        </p>
      </div>
    </section>
  )
}
