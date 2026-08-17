import type { Metadata } from 'next'
import Link from 'next/link'

import { Section } from '@/components/layout/section'
import { PageHeader } from '@/components/layout/page-header'
import { AGGREGATE_MIN_TRANSACTIONS } from '@/lib/spend/aggregate-privacy'

export const metadata: Metadata = {
  title: 'How We Count Community Spend | The BLACQList',
  description:
    'Where every community spend figure on The BLACQList comes from, what it does and does not measure, how we protect the people behind it, and where it currently falls short.',
  robots: { index: true, follow: true },
}

export const revalidate = false

/**
 * The public methodology disclosure for every community spend figure the
 * product publishes. Same contract as /how-ranking-works: if the pipeline
 * changes, this page changes in the same PR.
 *
 * A methodology page that has drifted from the code is worse than no
 * methodology page, because it is quotable.
 *
 * The internal engineering companion is
 * docs/blacqlist/flow-map/data-sourcing-and-methodology.md. This page is the
 * reader-facing half: same facts, no file paths, and nothing softened. The
 * threshold below is interpolated from AGGREGATE_MIN_TRANSACTIONS rather than
 * typed, so the number in this promise and the number in the query cannot
 * disagree.
 */
export default function FlowMapMethodologyPage() {
  return (
    <>
      <Section variant="pale-lavender">
        <PageHeader
          title="How we count community spend"
          subtitle="Where every dollar figure on this site comes from, what it means, and what it does not mean."
        />
      </Section>

      <Section variant="white">
        <div className="max-w-2xl space-y-10 font-body text-charcoal leading-relaxed">
          <p className="text-lg">
            Numbers about a community should be checkable by that community. Every figure we
            publish about community spend traces back through the process below. If a number
            cannot be found on this page, we do not publish it.
          </p>

          <section id="one-number" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">
              1. What one unit of spend is
            </h2>
            <p>
              <span className="font-semibold">
                One receipt, approved by a person on our team, is one unit of measured spend, and it
                is counted once.
              </span>
            </p>
            <p>
              A dollar enters this dataset when someone reports paying it to a business on the
              BLACQList and a reviewer approves that receipt. Nothing follows the dollar after
              that. What the business goes on to pay its suppliers, its staff, or its landlord is
              not something we can see, and we do not model or estimate it.
            </p>
          </section>

          <section id="pipeline" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">
              2. How a receipt becomes a number
            </h2>
            <ol className="list-decimal list-outside space-y-2 pl-5">
              <li>
                <span className="font-semibold">You submit.</span> You enter an amount, the date on
                the receipt, and the business. A photo of the receipt is optional. At this point
                nothing you submitted has reached any public figure.
              </li>
              <li>
                <span className="font-semibold">A reviewer approves or rejects it.</span> A rejected
                receipt contributes nothing, permanently. A receipt still waiting for review
                contributes nothing either.{' '}
                <span className="font-semibold">
                  Every public figure here is a figure about approved receipts only.
                </span>
              </li>
              <li>
                <span className="font-semibold">The approved receipt becomes one anonymous
                record</span> holding an amount, a date, and the business it names. That record has
                no account attached to it. It is what the community-wide totals are summed from.
              </li>
              <li>
                <span className="font-semibold">Running totals update</span> for that business and
                its city, and for the link between them.
              </li>
              <li>
                <span className="font-semibold">The page you were reading shows them,</span> subject
                to the privacy rule in section 5.
              </li>
            </ol>
            <p>
              There is no scheduled job and no batch anywhere in that path. A total moves at the
              moment a receipt is approved.
            </p>
          </section>

          <section id="circulation" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">
              3. Why we do not say &ldquo;circulated&rdquo;
            </h2>
            <p>
              In economics, circulation means a dollar being spent again and again, counted on each
              hop as it moves through a community. We measure one hop: a person to a business.
              Publishing a one-hop total under a word that means multi-hop velocity would overstate
              what we found, and it is the kind of overstatement that gets checked the first time
              the number actually matters.
            </p>
            <p>
              This is not only a wording choice. Our data cannot represent multi-hop flow even in
              principle, because we never observe a business paying anyone. There is no
              business-to-business figure here to be misread, because there is no business-to-business
              data.
            </p>
            <p>
              Circulation is still what this platform is <span className="italic">for</span>, and we
              will keep saying so. It just does not get to label a number.
            </p>
            <div className="rounded-xl border border-charcoal/10 bg-cream/60 px-5 py-4">
              <p className="font-subhead text-sm font-semibold text-brand-black mb-2">
                So we say this, not that
              </p>
              <ul className="space-y-2 text-sm">
                <li>
                  <span className="font-semibold">Spent with Black-owned businesses,</span> not
                  circulated &mdash; one hop, not velocity.
                </li>
                <li>
                  <span className="font-semibold">Reported spend,</span> not verified spend &mdash;
                  a reviewer approved a receipt; nothing reconciled it against a bank or a card
                  processor.
                </li>
                <li>
                  <span className="font-semibold">Tracked purchases,</span> not transactions &mdash;
                  &ldquo;transaction&rdquo; implies a payment record we do not hold.
                </li>
                <li>
                  <span className="font-semibold">Businesses supported,</span> not businesses
                  reached &mdash; we know money was reported to them, not what it did for them.
                </li>
              </ul>
            </div>
          </section>

          <section id="figures" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">
              4. What each figure on the page actually is
            </h2>
            <ul className="list-disc list-outside space-y-2 pl-5">
              <li>
                <span className="font-semibold">Total spent with Black-owned businesses</span>
                &nbsp;&mdash; every approved receipt added together, excluding receipts whose
                submitter asked to be left out of community figures.
              </li>
              <li>
                <span className="font-semibold">Tracked purchases</span> &mdash; how many receipts
                are behind that total.
              </li>
              <li>
                <span className="font-semibold">Businesses supported</span> &mdash; how many
                distinct businesses on the BLACQList those receipts name. A receipt for a business
                we do not list yet still counts toward the total above, and toward nothing else.
                That is why the headline and the tables can legitimately disagree.
              </li>
              <li>
                <span className="font-semibold">The business and city tables</span> &mdash; running
                totals for a single named business or city, published only once they clear the
                privacy rule below.
              </li>
            </ul>
            <p>
              Totals are counted from the beginning and are not limited to a date range. Filtering
              the page by city or category changes which businesses are listed; it never changes
              the three community-wide figures at the top, which stay whole.
            </p>
          </section>

          <section id="privacy" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">
              5. How we protect the people behind the numbers
            </h2>
            <p>
              A named business or city appears beside a dollar figure only once{' '}
              <span className="font-semibold">
                {AGGREGATE_MIN_TRANSACTIONS} or more separate purchases
              </span>{' '}
              are behind that total. Below that, one person&rsquo;s receipt could be worked out from
              the number, so we withhold it rather than round it.
            </p>
            <p>
              The community-wide totals at the top are deliberately not held to that rule. They are
              one sum across everything reported and they name no one, so suppressing them would
              cost the headline and buy nobody any privacy.
            </p>
            <p>
              Individual receipts, amounts, and the identity of whoever submitted them are never
              part of any public view. The anonymous record described in section 2 carries no
              account, so there is no path from a published figure back to a person.
            </p>
          </section>

          <section id="your-own" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">
              6. Your own numbers work differently
            </h2>
            <p>
              The personal impact figures in your account are calculated from your own receipts, and
              they are shown only to you. They carry no threshold, because it is your data. They
              also include receipts you asked to keep out of community figures: opting out withholds
              your spend from the public numbers, it does not hide it from you.
            </p>
            <p>
              Your personal total and the community total are built from different things and will
              not reconcile. That is expected.
            </p>
          </section>

          <section id="limits" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">
              7. What these numbers cannot tell you
            </h2>
            <ul className="list-disc list-outside space-y-2 pl-5">
              <li>
                <span className="font-semibold">Amounts are self-reported.</span> A reviewer looks
                at the receipt; nothing checks it against a bank or a card processor. Every figure
                here is &ldquo;what the community reported and a reviewer accepted&rdquo; and never
                &ldquo;what was transacted.&rdquo;
              </li>
              <li>
                <span className="font-semibold">Coverage is voluntary and partial.</span> This
                measures receipts people chose to upload. It is not a survey, it was not designed to
                represent anyone, and it should never be scaled up into a claim about total spending
                with Black-owned businesses in a city or in the country.
              </li>
              <li>
                <span className="font-semibold">Figures can be up to an hour old.</span> The public
                pages are cached for an hour. Nothing here is live to the second.
              </li>
            </ul>
          </section>

          <section id="gaps" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">
              8. Where this currently falls short
            </h2>
            <p>
              Two things on this page are not yet as good as the promise around them. We would
              rather write them down than let someone find them.
            </p>
            <p>
              <span className="font-semibold">
                Older per-business and per-city totals still include spend that was opted out.
              </span>{' '}
              From 16 August 2026, a receipt whose submitter opted out is kept out of the named
              business and city totals as well as the headline. Totals built up before that date
              were not, and no change to our code corrects a number that is already stored &mdash;
              that takes a deliberate recalculation, which is scheduled. Until it runs, treat the
              named business and city figures as including a small amount of spend its submitter
              asked us to leave out. The community-wide totals at the top of the page have always
              honored the opt-out.
            </p>
            <p>
              <span className="font-semibold">
                The opt-out can be changed while a receipt is waiting for review, and not after it
                is approved.
              </span>{' '}
              It is a checkbox on the receipt form, and you can go back and change your mind from
              Account → Receipts for as long as that receipt is still pending. Once a reviewer
              approves it, the receipt is locked, because its amount has already been folded into
              the totals and pulling it back out is a deliberate recalculation rather than something
              a form should trigger. There is no single account-wide switch, and no way to withdraw
              spend that has already been counted. If that is what you need,{' '}
              <Link href="/contact" className="text-amber hover:underline">
                contact us
              </Link>{' '}
              and we will handle it by hand.
            </p>
          </section>

          <section id="deletion" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">
              9. What happens if you delete your account
            </h2>
            <p>
              Your receipts and the images you uploaded are deleted with your account. The anonymous
              records described in section 2 remain, because they never carried your identity in the
              first place &mdash; what is left is an amount, a date, and a business, with no path
              back to you.
            </p>
            <p>
              Put plainly: the receipts go, the anonymous dollar figure stays. That is also what our{' '}
              <Link href="/privacy" className="text-amber hover:underline">
                Privacy Policy
              </Link>{' '}
              says.
            </p>
          </section>

          <section id="questions" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">Questions</h2>
            <p>
              If a figure here looks wrong, or you want to know how a specific number was built, ask
              us and we will show our work.{' '}
              <Link href="/contact" className="text-amber hover:underline">
                Get in touch
              </Link>
              . You can see the figures themselves on the{' '}
              <Link href="/flow-map" className="text-amber hover:underline">
                community dollar flow map
              </Link>
              , and how we order search results on{' '}
              <Link href="/how-ranking-works" className="text-amber hover:underline">
                how ranking works
              </Link>
              .
            </p>
          </section>
        </div>
      </Section>
    </>
  )
}
