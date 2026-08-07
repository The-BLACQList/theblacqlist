import Link from 'next/link'

/** The page's single owner CTA — one ask, one place (was three). */
export function OwnerCta() {
  return (
    <section aria-labelledby="owner-cta-heading" className="bg-brand-black py-14 md:py-16">
      <div className="max-w-7xl mx-auto w-full px-5 md:px-8 lg:px-10 text-center">
        <h2 id="owner-cta-heading" className="font-headline text-[28px] md:text-[36px] text-white text-balance">
          Ready to be found?
        </h2>
        <p className="font-body text-[15px] text-off-white/80 mt-2 max-w-[48ch] mx-auto">
          Storefront, service, practice, studio, or stage — get your official home on The BLACQList,
          with reviews, verification, and a community that&apos;s looking for you.
        </p>
        <div className="flex justify-center gap-3 flex-wrap mt-6">
          <Link
            href="/for-business"
            className="inline-flex items-center justify-center h-12 px-7 rounded-full bg-gold hover:bg-light-gold text-brand-black font-subhead text-sm font-bold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            Get your business on The BLACQList
          </Link>
          <Link
            href="/discover"
            className="inline-flex items-center justify-center h-12 px-7 rounded-full border border-off-white/40 text-white font-subhead text-sm font-bold hover:bg-off-white/10 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            Keep exploring
          </Link>
        </div>
      </div>
    </section>
  )
}
