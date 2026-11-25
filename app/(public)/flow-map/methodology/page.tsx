import type { Metadata } from 'next'
import Link from 'next/link'

import { Section } from '@/components/layout/section'
import { PageHeader } from '@/components/layout/page-header'
import { AGGREGATE_MIN_TRANSACTIONS } from '@/lib/spend/aggregate-privacy'
import { ADMIN_FALLBACK_DAYS } from '@/lib/spend/owner-receipts'

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
 * disagree. ADMIN_FALLBACK_DAYS is interpolated for the same reason.
 *
 * Who reviews a receipt is worded so it stays true whether owner review
 * (FEATURE_OWNER_RECEIPT_REVIEW) is on or off: "the business or our team can",
 * and "when the business reviews" (ticket 279).
 */
export default function FlowMapMethodologyPage() {
  return (
    <>
      <Section variant="pale-lavender">
        <PageHeader
          title="How We Count Community Spend"
          subtitle="Where every dollar figure on this site comes from, what it means, and what it does not mean."
        />
      </Section>

      <Section variant="white">
        <div className="max-w-2xl space-y-10 font-body text-charcoal leading-relaxed">
          <p className="text-lg">
            Numbers about a community should be checkable by that community. Every figure we publish
            about community spend traces back through the process below. If a number cannot be found
            on this page, we do not publish it.
          </p>

          <section id="one-number" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">1. What One Unit of Spend Is</h2>
            <p>
              <span className="font-semibold">
                One receipt, approved by the business it names or by a person on our team, is one
                unit of measured spend, and it is counted once.
              </span>
            </p>
            <p>
              A dollar enters this dataset when someone reports paying it to a business on The
              BLACQList and that receipt is approved. Nothing follows the dollar after that. What
              the business goes on to pay its suppliers, its staff, or its landlord is not something
              we can see, and we do not model or estimate it.
            </p>
          </section>

          <section id="pipeline" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">
              2. How a Receipt Becomes a Number
            </h2>
            <ol className="list-decimal list-outside space-y-2 pl-5">
              <li>
                <span className="font-semibold">You submit.</span> You enter an amount, the date on
                the receipt, and the business. A photo or PDF of the receipt is required. At this
                point nothing you submitted has reached any public figure.
              </li>
              <li>
                <span className="font-semibold">It is approved or rejected.</span> The business
                named on the receipt or our team can approve or reject it. An owner cannot approve a
                receipt submitted from their own account. Our team reviews receipts for businesses
                no one has claimed and any still waiting after {ADMIN_FALLBACK_DAYS} days, and can
                review any other. A rejected receipt contributes nothing unless you fix it and send
                it back for review, where it starts over. A receipt still waiting for review
                contributes nothing either.{' '}
                <span className="font-semibold">
                  Every public figure here is a figure about approved receipts only.
                </span>
              </li>
              <li>
                <span className="font-semibold">Only businesses on The BLACQList count.</span> If
                you add a receipt from a business we don&rsquo;t list, it is kept but not approved.
                It waits up to 90 days for that business to join. If it does, you link the receipt
                to its listing and it is reviewed like any other. If it doesn&rsquo;t, the receipt
                never counts toward a public figure.
              </li>
              <li>
                <span className="font-semibold">
                  The approved receipt becomes one anonymous record
                </span>{' '}
                holding an amount, a date, and the business it names. That record has no account
                attached to it. It is what the community-wide totals are summed from.
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
            <p>
              <span className="font-semibold">
                From 13 November 2026, we count less in the totals.
              </span>{' '}
              Before that date, a receipt from a business we don&rsquo;t list could be approved, and
              its amount was added to the community-wide totals, and never to a named business or
              city. We now leave that older spend out of every public figure, so the totals only
              ever describe businesses on The BLACQList.
            </p>
          </section>

          <section id="circulation" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">
              3. Why We Do Not Say &ldquo;Circulated&rdquo;
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
              business-to-business figure here to be misread, because there is no
              business-to-business data. The Collective&rsquo;s Demo view draws made-up businesses,
              amounts, and links between them to show the idea. It is marked as sample data, and
              none of it is in any real figure.
            </p>
            <p>
              Circulation is still what this platform is <span className="italic">for</span>, and we
              will keep saying so. It just does not get to label a number.
            </p>
            <div className="rounded-xl border border-charcoal/10 bg-cream/60 px-5 py-4">
              <p className="font-subhead text-sm font-semibold text-brand-black mb-2">
                So We Say This, Not That
              </p>
              <ul className="space-y-2 text-sm">
                <li>
                  <span className="font-semibold">Spent with Black-owned businesses,</span> not
                  circulated: one hop, not velocity.
                </li>
                <li>
                  <span className="font-semibold">Reported spend,</span> not verified spend: the
                  business or our team approved a receipt, and nothing reconciled it against a bank
                  or a card processor.
                </li>
                <li>
                  <span className="font-semibold">Tracked purchases,</span> not transactions:
                  &ldquo;transaction&rdquo; implies a payment record we do not hold.
                </li>
                <li>
                  <span className="font-semibold">Businesses supported,</span> not businesses
                  reached: we know money was reported to them, not what it did for them.
                </li>
              </ul>
            </div>
          </section>

          <section id="figures" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">
              4. What Each Figure Actually Is
            </h2>
            <ul className="list-disc list-outside space-y-2 pl-5">
              <li>
                <span className="font-semibold">Total spent with Black-owned businesses:</span>{' '}
                every approved receipt from a business on The BLACQList added together, excluding
                receipts whose submitter asked to be left out of community figures. The Collective
                calls it Spent.
              </li>
              <li>
                <span className="font-semibold">Tracked purchases:</span> how many receipts are
                behind that total. The Collective calls it Receipts.
              </li>
              <li>
                <span className="font-semibold">Businesses supported:</span> how many distinct
                businesses on The BLACQList those receipts name.
              </li>
              <li>
                <span className="font-semibold">Links:</span> on The Collective, how many published
                businesses have a line, which takes at least one counted receipt. This can differ
                from Businesses supported, because a business that is no longer published keeps its
                past receipts in the totals but has no line.
              </li>
              <li>
                <span className="font-semibold">Business and city totals:</span> running totals for
                a single named business or city, published only once they clear the privacy rule
                below.
              </li>
            </ul>
            <p>
              Totals are counted from the beginning and are not limited to a date range. They are
              always whole: choosing a business or a floor on the map does not change them.
            </p>
          </section>

          <section id="privacy" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">
              5. How We Protect the People Behind the Numbers
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
              The community-wide totals are not held to that rule. They are one sum across
              everything reported and they name no one. While few receipts are counted, someone
              comparing a total with the Latest list could work out the amount of a single receipt.
            </p>
            <p>
              We never publish a receipt photo, the amount on a single receipt, or who submitted it.
              The record described in section 2 carries no account. Until you delete your account,
              we can still match it to your receipt.
            </p>
            <p>
              When the business reviews a receipt, its owner can see the photo, the amount, the
              date, and your first name and last initial. They can open the photo only until the
              receipt is reviewed.
            </p>
            <p>
              On The Collective map, every published business on The BLACQList shows as a dot from
              day one, so you can see how they are spread out. Each dot shows the business by name,
              because its Page is already public. Once one counted receipt is behind a business, it
              gets a line, so you can see money reach it. Every line under the rule looks the same:
              it says someone shopped there, never how much. The dollar figure and the receipt count
              still wait for {AGGREGATE_MIN_TRANSACTIONS} or more purchases. The Latest list on The
              Collective names the businesses behind the three newest counted receipts, and the day
              each was counted. It never shows an amount or a shopper.
            </p>
            <p>
              A receipt you add for a business on The BLACQList shows on your own map straight away
              as a dashed line to that business, unless you keep it out of community figures. Only
              you can see it. It turns into a regular line once it&rsquo;s approved and counted.
            </p>
            <p>
              When you add a receipt you can choose to keep it out of community figures. Section 8
              explains how long that choice stays open.
            </p>
          </section>

          <section id="your-own" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">
              6. Your Own Numbers Work Differently
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
              7. What These Numbers Cannot Tell You
            </h2>
            <ul className="list-disc list-outside space-y-2 pl-5">
              <li>
                <span className="font-semibold">Amounts are self-reported.</span> Someone looks at
                the receipt; nothing checks it against a bank or a card processor. Every figure here
                is &ldquo;what the community reported and the business or our team accepted&rdquo;
                and never &ldquo;what was transacted.&rdquo;
              </li>
              <li>
                <span className="font-semibold">A business can be confirming its own sale.</span>{' '}
                When the business named on a receipt approves it, the approval comes from the
                business that received the money. It is not an independent check.
              </li>
              <li>
                <span className="font-semibold">Coverage is voluntary and partial.</span> This
                measures receipts people chose to upload. It is not a survey, it was not designed to
                represent anyone, and it should never be scaled up into a claim about total spending
                with Black-owned businesses in a city or in the country.
              </li>
              <li>
                <span className="font-semibold">Downloads can be older than the pages.</span> Pages
                work out their figures when you open them. The files in section 10 are saved copies
                and can be about a day old. Nothing here is live to the second.
              </li>
            </ul>
          </section>

          <section id="gaps" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">
              8. Where This Currently Falls Short
            </h2>
            <p>
              Two things on this page are not yet as good as the promise around them. We would
              rather write them down than let someone find them.
            </p>
            <p>
              <span className="font-semibold">
                Older per-business and per-city totals may still include spend that was opted out.
              </span>{' '}
              From 16 August 2026, a receipt whose submitter opted out is kept out of the named
              business and city totals as well as the community-wide totals. Totals built up before
              that date were not, and no change to our code corrects a number that is already
              stored. That takes a deliberate recalculation, which has not been done. Until it is,
              the named business and city figures may include spend its submitter asked us to leave
              out. The community-wide totals have always honored the opt-out.
            </p>
            <p>
              <span className="font-semibold">
                The opt-out can be changed while a receipt is waiting for review, and not after it
                is approved.
              </span>{' '}
              It is a checkbox on the receipt form, and you can go back and change your mind from
              Account → Receipts for as long as that receipt is still waiting or needs a fix. Once
              it is approved, the receipt is locked, because its amount has already been folded into
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
              9. What Happens If You Delete Your Account
            </h2>
            <p>
              Your receipts and the images you uploaded are deleted with your account. The anonymous
              records described in section 2 remain, because they never carried your identity in the
              first place. What is left is an amount, a date, and a business, with no path back to
              you.
            </p>
            <p>
              Put plainly: the receipts go, the anonymous dollar figure stays. That is also what our{' '}
              <Link href="/privacy" className="text-amber hover:underline">
                Privacy Policy
              </Link>{' '}
              says.
            </p>
          </section>

          <section id="download" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">10. Download the Data</h2>
            <p>
              Check our numbers yourself. Each file is a CSV spreadsheet listing every business or
              city with {AGGREGATE_MIN_TRANSACTIONS} or more counted purchases behind its total,
              with that total in dollars and in cents. Anything below that line is left out, so
              these files add up to less than the community-wide figures. That gap is the privacy
              rule in section 5 doing its job.
            </p>
            <p className="flex flex-wrap gap-x-6 gap-y-2">
              <a
                href="/api/flow-map/export?dataset=businesses"
                download
                className="font-semibold text-amber hover:underline"
              >
                Businesses CSV
              </a>
              <a
                href="/api/flow-map/export?dataset=cities"
                download
                className="font-semibold text-amber hover:underline"
              >
                Cities CSV
              </a>
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
              . You can see the figures themselves on{' '}
              <Link href="/flow-map" className="text-amber hover:underline">
                The Collective map
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
