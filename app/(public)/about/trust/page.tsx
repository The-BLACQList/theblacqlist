import Link from 'next/link'
import type { Metadata } from 'next'

import { Section } from '@/components/layout/section'
import { SectionHeading } from '@/components/ui/section-heading'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'How Trust Works | The BLACQList',
  description:
    'Every listing carries a trust tier: Unclaimed, Claimed, Verified, or Certified. Here is exactly what each one means and how a business moves between them.',
}

// SOURCE OF TRUTH: .claude/rules/moderation-policy.md. This page is the public
// half of that rule and must stay in sync with it — if the certification
// criteria change in `lib/services/trust/certification.ts` and its nightly
// counterpart `auto_grant_certified()`, the numbers below change too.
//
// WHAT IS DELIBERATELY NOT ON THIS PAGE. The claimed→verified evidence bar
// (which specific documents clear which signal, and how many are required) is
// an internal moderation playbook. Publishing it hands a checklist to anyone
// assembling a forged claim. What a business owner needs to know — bring
// third-party documents that name both the business and you — is stated below
// without the decision rule behind it.

const LADDER = [
  {
    tier: 'Unclaimed',
    who: 'The default',
    body: 'The listing exists and the information is public, but nobody has stepped forward to say they run this business. Anything on an unclaimed page came from public sources or the community, not from the owner.',
  },
  {
    tier: 'Claimed',
    who: 'The owner has stepped forward',
    body: 'Someone has claimed the business and we approved that claim. They can now edit the page, respond to reviews, and keep the details current. Claimed means an owner is present — not that we have verified their paperwork.',
  },
  {
    tier: 'Verified',
    who: 'Reviewed by a person, one at a time',
    body: 'The owner submitted documents issued by someone other than themselves — the kind that establish the business legally exists and tie them to it. A human on our team reviewed them. Verification is never batched, never automated, and never granted by request.',
  },
  {
    tier: 'Certified',
    who: 'Earned, not granted',
    body: 'The highest tier, and the only one no person hands out. Certified is computed: a verified business that has been here a while, kept its page complete, and earned real community standing crosses the line on its own.',
  },
]

const CERTIFICATION_CRITERIA = [
  'The listing is already Verified. Certification never skips a rung.',
  'The page is published and in good standing.',
  'At least 5 published reviews.',
  'An average published rating of 3.5 or higher.',
  'At least 90 days since the claim was approved.',
  'Complete business details — a description, a way to reach them, and a location.',
]

export default function TrustPage() {
  return (
    <>
      <Section variant="deep-bg" as="header">
        <div className="max-w-2xl">
          <h1 className="font-headline text-3xl md:text-5xl font-bold text-white leading-tight text-balance">
            How trust works here
          </h1>
          <p className="font-subhead text-base md:text-lg text-off-white/90 mt-4 leading-relaxed">
            Trust is visible and earned, not assumed. Every listing on The BLACQList carries one of
            four tiers, and every tier means a specific thing. No badge on this platform can be
            bought.
          </p>
        </div>
      </Section>

      <Section variant="white">
        <div className="max-w-3xl">
          <SectionHeading subtitle="Four tiers, in order. A listing moves up one rung at a time.">
            The trust ladder
          </SectionHeading>

          <ol className="mt-8 space-y-6">
            {LADDER.map((rung, i) => (
              <li
                key={rung.tier}
                className="rounded-lg border border-pale-lavender bg-white p-5 md:p-6"
              >
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span
                    className="font-mono text-xs text-charcoal-soft tabular-nums"
                    aria-hidden="true"
                  >
                    0{i + 1}
                  </span>
                  <h3 className="font-headline text-lg text-brand-black">{rung.tier}</h3>
                  <span className="font-subhead text-xs text-charcoal-soft uppercase tracking-wide">
                    {rung.who}
                  </span>
                </div>
                <p className="font-subhead text-sm md:text-base text-charcoal leading-relaxed mt-2">
                  {rung.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <Section variant="cream">
        <div className="max-w-2xl">
          <SectionHeading subtitle="All six, or it doesn't happen. There is no waiting list and no way to ask.">
            What Certified requires
          </SectionHeading>
          <ul className="mt-6 space-y-3">
            {CERTIFICATION_CRITERIA.map((criterion) => (
              <li
                key={criterion}
                className="font-subhead text-sm md:text-base text-charcoal leading-relaxed pl-5 relative"
              >
                <span
                  className="absolute left-0 top-[0.6em] size-1.5 rounded-full bg-amber-gold"
                  aria-hidden="true"
                />
                {criterion}
              </li>
            ))}
          </ul>
          <p className="font-subhead text-sm text-charcoal-soft leading-relaxed mt-6">
            The check runs automatically. A business that meets all six is certified without anyone
            asking, and a business that meets five is not certified no matter who asks.
          </p>
        </div>
      </Section>

      <Section variant="white">
        <div className="max-w-2xl">
          <SectionHeading subtitle="What we will and won't remove.">Reviews</SectionHeading>
          <div className="mt-4 space-y-4 font-subhead text-base text-charcoal leading-relaxed">
            <p>
              A negative review that reflects a real experience stays up. We do not remove reviews
              for being unflattering, and a business cannot pay to have one taken down.
            </p>
            <p>
              We remove reviews that violate policy: spam and advertising, hate or harassment,
              content that exposes someone&rsquo;s personal information, reviews written by the
              owner about their own business, and coordinated fake reviews — whether they are
              padding a rating or sabotaging a competitor.
            </p>
            <p>
              Stars are one signal, not the whole picture. They sit alongside the trust tier,
              community corrections, and everything on the business&rsquo;s own page.
            </p>
          </div>
        </div>
      </Section>

      <Section variant="white">
        <div className="max-w-2xl">
          <SectionHeading subtitle="Ownership is labeled, never hidden.">
            Black-Owned and Ally
          </SectionHeading>
          <div className="mt-4 space-y-4 font-subhead text-base text-charcoal leading-relaxed">
            <p>
              Every listing is labeled either <strong>Black-Owned</strong> or <strong>Ally</strong>{' '}
              so you always know who you are supporting. Moderation checks that the label matches
              reality — an honestly labeled Ally is welcome, and a business presented as Black-Owned
              when it is not is what we act on.
            </p>
            <p>
              The label is never tied to price. Every paid tier costs the same for every business
              regardless of which label it carries.{' '}
              <Link
                href="/how-ranking-works"
                className="text-amber hover:text-light-gold underline underline-offset-2 font-semibold"
              >
                How ranking works
              </Link>{' '}
              covers what does and doesn&rsquo;t affect placement.
            </p>
          </div>
        </div>
      </Section>

      <Section variant="deep-bg">
        <div className="max-w-xl">
          <SectionHeading
            onDark
            subtitle="Trust holds because the community keeps it honest. If something on a page is wrong, tell us."
          >
            Found something wrong?
          </SectionHeading>
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <Button
              asChild
              className="bg-amber-gold text-brand-black font-body font-bold hover:bg-light-gold rounded-full px-6 py-2.5 min-h-[44px] h-auto"
            >
              <Link href="/corrections">Suggest a correction</Link>
            </Button>
            <Button
              asChild
              className="border border-white/40 text-white bg-transparent hover:bg-white/10 rounded-full px-6 py-2.5 min-h-[44px] h-auto"
            >
              <Link href="/claim">Claim your business</Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  )
}
