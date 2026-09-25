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
 * search_listings_faceted (20260924000000_type_shortcuts_relevance.sql). If the ranking
 * changes, this page changes in the same PR.
 *
 * Rewritten 2026-09-23. Section 2 used to read "Black-owned businesses are
 * centered" and described the `(ownership_label = 'black_owned') DESC` key that
 * sat second in the ORDER BY. That key is gone: order is now sponsored first,
 * then match quality, then how active and well-kept a listing is, with paid tier
 * breaking remaining ties on keyword searches only
 * [Decision — founder, 2026-09-21, refined 2026-09-23]. Sections 4, 5 and 6 each
 * asserted the old key too ("a subscription will not move an Ally above a
 * Black-owned one", "an A-to-Z sort reads as the Black-owned businesses in
 * alphabetical order, then the Allies"), so all three changed with it rather
 * than being left to contradict the code. The label itself is unchanged and
 * still shown on every listing; what changed is that it no longer affects order.
 * moderation-policy.md:48 still binds: no paid tier, placement, or badge is
 * contingent on the label, and nothing here makes one so.
 *
 * Rewritten again 2026-09-25 for 20260924000000_type_shortcuts_relevance.sql.
 * `is_featured DESC` was the first ORDER BY key, above match quality, so a
 * featured restaurant whose description said "photographs" outranked real
 * photography studios. Now: with a keyword and the relevance sort, match band
 * leads and featured only breaks ties inside a band; browsing is unchanged
 * (featured first). Name, tagline and category hits (tsvector weights A and B)
 * form a higher band than description-only hits. Sponsored placements are no
 * longer spliced into keyword results (lib/listings/query.ts injectSponsored).
 * Featured got its own section because it and Sponsored were described as one
 * thing before; they are two ("Featured" badge vs the "Sponsored" chip).
 * [Decision — founder, 2026-09-24] relevance first on a keyword search.
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
              1. Sponsored placements are always labeled, and never appear on a keyword search
            </h2>
            <p>
              A business can buy a placement at the top of a specific city or category. When one is
              running and you are browsing, it appears first and carries a visible{' '}
              <span className="font-semibold">Sponsored</span> chip on the card. There are never
              more than three, they expire on a set date, and they disappear entirely once you
              filter deeply enough that they would no longer be relevant.
            </p>
            <p>
              When you type a search, there are no Sponsored slots at all. What you searched for
              decides the order, not a placement someone bought.
            </p>
            <p>If it does not say Sponsored, nobody paid to put it in that position.</p>
          </section>

          <section id="match" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">
              2. When you search, the best match comes first
            </h2>
            <p>
              When you type something, this is the first thing that matters. We score every business
              against your search terms and group the results by how well they matched. A business
              whose name, tagline, or category matches your words is listed ahead of one that only
              mentions them somewhere in its description. Nothing further down this page can lift a
              weaker match above a better one.
            </p>
            <p>
              When you are browsing rather than searching, on a city page, a category, or the map,
              there is nothing to match against. This step does nothing there.
            </p>
          </section>

          <section id="featured" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">
              3. Then: featured businesses break ties
            </h2>
            <p>
              Some businesses carry a visible <span className="font-semibold">Featured</span> badge.
              When you are browsing, featured businesses are listed first. When you search, being
              featured only decides the order between businesses that matched your search equally
              well. A featured business never outranks a better match.
            </p>
          </section>

          <section id="activity" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">
              4. Then: how active and well-kept the business is
            </h2>
            <p>
              Among businesses that matched your search about equally well, the more positively
              active one is listed first. This is the factor you can actually move, and it is the
              main thing ordering every page you browse without searching.
            </p>
            <p>What counts toward it:</p>
            <ul className="list-disc ml-5 space-y-2">
              <li>People saving the business.</li>
              <li>Published reviews, with a good average rating counting for more.</li>
              <li>Recent visits to the listing.</li>
              <li>An owner replying to the reviews they receive.</li>
              <li>
                An owner keeping the listing current, and claiming or verifying it so you know who
                is behind it.
              </li>
            </ul>
            <p>
              Only the last 90 days count, and recent activity counts for more than older activity.
              A business that was busy last year and quiet since then falls back. Nothing on this
              list subtracts: a poor average rating counts for less rather than against, and we
              recalculate the whole directory once a night.
            </p>
            <p>
              <span className="font-semibold">
                The ownership label is not part of this, in either direction.
              </span>{' '}
              Every listing shows whether it is <span className="font-semibold">Black-Owned</span>{' '}
              or an <span className="font-semibold">Ally</span>, and neither label moves a business
              up or down.
            </p>
          </section>

          <section id="subscription" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">
              5. Then: a subscription breaks the ties that are left
            </h2>
            <p>
              Businesses on our Growth and Premium plans get priority placement. That means
              something narrower than it sounds, so here is exactly what it does:
            </p>
            <ul className="list-disc ml-5 space-y-2">
              <li>
                It only applies when two or more businesses matched your search{' '}
                <span className="font-semibold">about equally well</span> and are{' '}
                <span className="font-semibold">equally active</span>. Among those, the subscribing
                business is listed first.
              </li>
              <li>
                <span className="font-semibold">
                  A subscription never outranks a better match, and never outranks a more active
                  business.
                </span>{' '}
                If a business with no paid plan is the better answer to what you typed, or is simply
                more active, it is listed first. Every time.
              </li>
              <li>
                It only applies when you actually searched for something. Browsing a city page, a
                category, or the map is completely unaffected. Those are ordered the same way for
                everyone.
              </li>
              <li>
                Growth and Premium get exactly the same weight here. Paying more does not buy a
                higher position.
              </li>
              <li>
                It cannot lift a business past the things above it, and it cannot displace a labeled
                Sponsored placement or a Featured business.
              </li>
            </ul>
          </section>

          <section id="never" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">6. What money never affects</h2>
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
                the other. The label is shown on every listing and it does not change the order of
                results. No plan can buy a label, and no label can be bought.
              </li>
              <li>
                <span className="font-semibold">Reviews and ratings are not for sale.</span> A paid
                plan does not remove, hide, or reweight a review, and it does not change how a
                review counts toward the activity above. A negative but genuine review stays.
              </li>
              <li>
                <span className="font-semibold">Activity itself is not for sale.</span> Saves,
                reviews, visits, and owner replies are things people do. There is no plan that adds
                to them.
              </li>
            </ul>
          </section>

          <section id="sorting" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">
              7. If you choose your own sort, we use it
            </h2>
            <p>
              Sort by name, rating, review count, newest, or most-saved and that is what orders your
              results. Subscriptions have no effect on any of those orderings. If you asked for
              alphabetical, paying for a plan will not move a business up the alphabet.
            </p>
            <p>
              One thing above still applies: a labeled Sponsored placement or a Featured business
              stays at the top. Nothing else reorders what you asked for. Within each of those, an
              A-to-Z sort reads straight through, A to Z.
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
            <p className="text-sm text-charcoal-soft">Last updated 25 September 2026.</p>
          </section>
        </div>
      </Section>
    </>
  )
}
