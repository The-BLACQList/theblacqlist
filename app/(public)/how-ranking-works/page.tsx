import type { Metadata } from 'next'
import Link from 'next/link'
import { Section } from '@/components/layout/section'
import { PageHeader } from '@/components/layout/page-header'

export const metadata: Metadata = {
  title: 'How Ranking Works | The BLACQList',
  description:
    'Exactly how BLACQList orders search results, including where paid placement does and does not apply.',
  robots: { index: true, follow: true },
}

export const revalidate = false

/**
 * The single site-wide disclosure for ranking. Linked persistently beside the
 * result count in DiscoveryGrid — there is deliberately no per-card badge on
 * tier-boosted results, because the "Sponsored" chip is reserved for the manual
 * placement engine, where it means something materially different.
 *
 * The order of the sections below mirrors the actual ORDER BY in
 * search_listings_faceted (20260809000000_search_tier_tiebreak.sql). If the
 * ranking changes, this page changes in the same PR.
 */
export default function HowRankingWorksPage() {
  return (
    <>
      <Section variant="pale-lavender">
        <PageHeader
          title="How ranking works"
          subtitle="What decides the order of search results, in plain language, and in the order it actually happens."
        />
      </Section>

      <Section variant="white">
        <div className="max-w-2xl space-y-10 font-body text-charcoal leading-relaxed">
          <p className="text-lg">
            We would rather tell you this than have you guess. Here is every factor that moves a
            business up or down in search results, in the order we apply them.
          </p>

          <section id="sponsored" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">
              1. Sponsored placements come first, and they are always labeled
            </h2>
            <p>
              A business can buy a placement at the top of a specific city or category. When one is
              running, it appears first and carries a visible{' '}
              <span className="font-semibold">Sponsored</span> chip on the card. There are never
              more than three, they expire on a set date, and they disappear entirely once you
              filter deeply enough that they would no longer be relevant.
            </p>
            <p>
              If it does not say Sponsored, nobody paid to put it in that position.
            </p>
          </section>

          <section id="centering" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">
              2. Then: Black-owned businesses are centered
            </h2>
            <p>
              This is the whole point of the platform, so we do it in the ranking itself rather than
              only in what we choose to feature. Within a set of results, businesses labeled{' '}
              <span className="font-semibold">Black-Owned</span> are listed above businesses labeled{' '}
              <span className="font-semibold">Ally</span>.
            </p>
            <p>
              Allies are genuinely welcome here and are listed, searchable, and sold exactly the same
              plans at exactly the same prices. What they do not get is the editorial spotlight. That
              is reserved, on purpose, and it is not something a subscription can buy back. A paying
              Ally business is still listed below Black-owned businesses.
            </p>
          </section>

          <section id="match" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">
              3. Then: how well the business matches what you searched
            </h2>
            <p>
              This is the main thing. We score every business against your search terms: its name,
              description, category, and tags. The closest matches rise to the top, and nothing
              below this point can override a genuinely better match.
            </p>
          </section>

          <section id="subscription" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">
              4. Then: a subscription breaks ties between close matches
            </h2>
            <p>
              Businesses on our Growth and Premium plans get priority placement. That means
              something narrower than it sounds, so here is exactly what it does:
            </p>
            <ul className="list-disc ml-5 space-y-2">
              <li>
                It only applies when two or more businesses matched your search{' '}
                <span className="font-semibold">about equally well</span>. Among those, the
                subscribing business is listed first.
              </li>
              <li>
                <span className="font-semibold">
                  A subscription never outranks a better match.
                </span>{' '}
                If a business with no paid plan is the better answer to what you typed, it is listed
                first. Every time.
              </li>
              <li>
                It only applies to search results. Browsing a city page, a category, or the map is
                completely unaffected. Those are ordered the same way for everyone.
              </li>
              <li>
                Growth and Premium get exactly the same weight here. Paying more does not buy a
                higher position.
              </li>
              <li>
                It cannot lift a business past the two things above it. A subscription will not move
                an Ally business above a Black-owned one, and it will not displace a labeled
                Sponsored placement.
              </li>
            </ul>
          </section>

          <section id="never" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">
              5. What money never affects
            </h2>
            <ul className="list-disc ml-5 space-y-2">
              <li>
                <span className="font-semibold">Map prominence is never for sale.</span> How large
                and visible a business appears on the map is set entirely by its trust level:
                whether it has been claimed by its owner and verified. Prominence there is earned by
                trust, not bought.
              </li>
              <li>
                <span className="font-semibold">
                  The two labels cost exactly the same and buy exactly the same things.
                </span>{' '}
                Every plan is sold to every business at the same price whether it is Black-Owned or
                an Ally, and no plan, placement, or badge is offered to one label and withheld from
                the other. The difference is editorial and it runs one way only: Black-owned
                businesses are centered in ranking, as described above. Money does not change that
                in either direction. An Ally cannot pay to be centered, and a Black-owned business
                does not have to pay to be.
              </li>
              <li>
                <span className="font-semibold">Reviews and ratings are not for sale.</span> A paid
                plan does not remove, hide, or reweight a review. A negative but genuine review
                stays.
              </li>
            </ul>
          </section>

          <section id="sorting" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">
              6. If you choose your own sort, we use it
            </h2>
            <p>
              Sort by name, rating, review count, newest, or most-saved and that is what orders your
              results. Subscriptions have no effect on any of those orderings. If you asked for
              alphabetical, paying for a plan will not move a business up the alphabet.
            </p>
            <p>
              The two things above still apply: a labeled Sponsored placement stays at the top, and
              Black-owned businesses are still centered. An A-to-Z sort reads as the Black-owned
              businesses in alphabetical order, then the Allies in alphabetical order.
            </p>
          </section>

          <section id="questions" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">Questions</h2>
            <p>
              If something in your results looks wrong or unexplained, tell us. We will look at it.{' '}
              <Link href="/contact" className="text-amber hover:underline">
                Get in touch
              </Link>
              . You can also see what each plan includes on our{' '}
              <Link href="/pricing" className="text-amber hover:underline">
                pricing page
              </Link>
              .
            </p>
          </section>
        </div>
      </Section>
    </>
  )
}
