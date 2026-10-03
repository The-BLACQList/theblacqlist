import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'

import { Container } from '@/components/layout/container'
import { createClient } from '@/lib/supabase/server'
import { getPlanAvailability } from '@/lib/stripe/availability'
import { PricingPlans } from '../pricing/PricingPlans'

// Plan availability comes from the live `plans` table, same as /pricing. A
// prerendered page would keep showing a buy button after a tier is withheld.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'For Business | The BLACQList',
  description:
    'Claim your page on The BLACQList, keep it right, and see who finds you. Free to start, and open to every business, labeled Black-Owned or Ally.',
}

// Ticket 115, For Business A ("Documentary"). Spec:
// docs/blacqlist/design/page-workshop-2026-10-spec.md §2.

const STEPS = [
  {
    title: 'Find your page',
    body: "Search for your business. If it isn't listed yet, add it in a few minutes.",
  },
  {
    title: "Show it's yours",
    body: 'Send a quick claim. We check it by hand, so only real owners run a page.',
  },
  {
    title: 'Make it yours',
    body: 'Add photos, hours, and your story. Keep it current so customers trust what they see.',
  },
]

// `starter` marks the items gated in lib/stripe/features.ts: `review_response`
// and `analytics` are both tier 1, so Free gets neither.
const WHAT_YOU_GET = [
  {
    title: 'Your story and photos',
    body: 'Tell people who you are, in your words, with your pictures.',
  },
  {
    title: 'Hours, links, and contact',
    body: 'Keep the basics right so customers never show up to a locked door.',
  },
  {
    title: 'Reviews you can answer',
    body: "Reply in public so customers see you're listening.",
    starter: true,
  },
  {
    title: 'See who finds you',
    body: 'Views, saves, and taps on your page, all in one place.',
    starter: true,
  },
  {
    title: 'A place in The Collective',
    body: 'Once customers track 5 or more receipts with you, your business shows up on our live map of community spending.',
  },
]

// Must match .claude/rules/moderation-policy.md and lib/services/trust/certification.ts.
const LADDER = [
  { tier: 'Unclaimed', line: 'Listed from public info. Nobody has claimed it yet.' },
  { tier: 'Claimed', line: 'An owner claimed it and we approved the claim.' },
  {
    tier: 'Verified',
    line: 'The owner sent documents and we checked them by hand. Available on Starter and up.',
  },
  {
    tier: 'Certified',
    line: "Earned over time: 5 or more reviews, a 3.5 average or better, 90 days since the claim, and complete details. It's automatic. Nobody can buy it.",
  },
] as const

const button =
  'inline-flex w-full sm:w-auto items-center justify-center min-h-[48px] px-6 rounded-[3px] font-subhead text-[15px] font-semibold transition-colors duration-150'
const eyebrowDark = 'font-subhead text-xs font-bold uppercase tracking-[0.14em] text-gold'
const eyebrowLight = 'font-subhead text-xs font-bold uppercase tracking-[0.14em] text-amber'
const h2 = 'font-headline font-medium text-[30px] md:text-[44px] leading-[1.1] text-balance'

function OwnerButtons() {
  return (
    <div className="flex flex-col sm:flex-row flex-wrap gap-3">
      <Link href="/claim" className={`${button} bg-gold text-brand-black hover:bg-light-gold`}>
        Claim your page
      </Link>
      <Link
        href="/add-business"
        className={`${button} border border-off-white/70 text-off-white hover:bg-off-white/10`}
      >
        List a new business
      </Link>
    </div>
  )
}

export default async function ForBusinessPage() {
  const supabase = await createClient()
  const availability = await getPlanAvailability(supabase)

  return (
    <>
      {/* 1. Hero */}
      <section className="bg-deep-bg" aria-labelledby="for-business-heading">
        <Container className="py-14 md:py-24 grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="flex flex-col gap-5">
            <p className={`${eyebrowDark} flex items-center gap-2`}>
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <circle cx="7" cy="7" r="3" fill="currentColor" />
                <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" />
              </svg>
              For business owners
            </p>
            <h1
              id="for-business-heading"
              className="font-headline font-medium text-[40px] md:text-[60px] leading-[1.05] tracking-[-0.01em] text-off-white text-balance"
            >
              Your page. Your story. Your customers.
            </h1>
            <p className="font-body text-lg leading-relaxed text-ink-soft max-w-[52ch]">
              Claim your page on The BLACQList, keep it right, and see who finds you. Free to start,
              and open to every business, labeled Black-Owned or Ally.
            </p>
            <div className="pt-2">
              <OwnerButtons />
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[3px]">
            <Image
              src="/images/editorial/peach-and-rye-kitchen.webp"
              alt="A chef in a gray apron smiles while stirring a pot in a bright restaurant kitchen."
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        </Container>
      </section>

      {/* 2. How it works */}
      <section className="bg-off-white" aria-labelledby="how-heading">
        <Container className="py-16 md:py-24 flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <p className={eyebrowLight}>How it works</p>
            <h2 id="how-heading" className={`${h2} text-ink`}>
              Three steps to a page that&apos;s really yours.
            </h2>
          </div>
          <ol className="grid gap-8 md:grid-cols-3 list-none m-0 p-0">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex flex-col gap-3 border-t border-hairline pt-5">
                <span
                  aria-hidden="true"
                  className="font-headline text-[40px] leading-none text-amber"
                >
                  {i + 1}
                </span>
                <h3 className="font-headline font-medium text-[22px] text-ink">{step.title}</h3>
                <p className="font-body text-base leading-relaxed text-charcoal">{step.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* 3. What you get */}
      <section className="bg-white" aria-labelledby="get-heading">
        <Container className="py-16 md:py-24 grid gap-10 lg:grid-cols-[2fr_3fr]">
          <div className="flex flex-col gap-3">
            <p className={eyebrowLight}>What you get</p>
            <h2 id="get-heading" className={`${h2} text-ink`}>
              A page that works as hard as you do.
            </h2>
          </div>
          <ul className="list-none m-0 p-0 flex flex-col">
            {WHAT_YOU_GET.map((item) => (
              <li key={item.title} className="flex gap-4 border-t border-hairline py-5">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  aria-hidden="true"
                  className="mt-1.5 shrink-0 text-amber"
                >
                  <circle cx="7" cy="7" r="4" fill="currentColor" />
                </svg>
                <div className="flex flex-col gap-1">
                  <h3 className="font-subhead text-[17px] font-semibold text-ink">
                    {item.title}
                    {item.starter && (
                      <span className="font-subhead text-sm font-semibold text-amber">
                        , on Starter and up
                      </span>
                    )}
                  </h3>
                  <p className="font-body text-base leading-relaxed text-charcoal">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* 4. Trust ladder */}
      <section className="bg-deep-bg" aria-labelledby="trust-heading">
        <Container className="py-16 md:py-24 flex flex-col gap-10">
          <div className="flex flex-col gap-3 max-w-[60ch]">
            <p className={eyebrowDark}>Trust ladder</p>
            <h2 id="trust-heading" className={`${h2} text-off-white`}>
              Trust, earned in steps.
            </h2>
            <p className="font-body text-lg leading-relaxed text-ink-soft">
              Customers see your badge on every search. Badges are earned, never sold.
            </p>
          </div>
          <ol className="grid gap-8 md:grid-cols-4 list-none m-0 p-0">
            {LADDER.map((rung, i) => (
              <li key={rung.tier} className="flex flex-col gap-3 border-t border-off-white/20 pt-5">
                <LadderMark step={i} />
                <h3 className="font-headline font-medium text-[22px] text-off-white">
                  {rung.tier}
                </h3>
                <p className="font-body text-base leading-relaxed text-ink-soft">{rung.line}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* 5. Plans: the same component and data as /pricing */}
      <section className="bg-off-white" aria-labelledby="plans-heading">
        <Container className="py-16 md:py-24">
          <div className="flex flex-col gap-3 text-center items-center">
            <p className={eyebrowLight}>Plans</p>
            <h2 id="plans-heading" className={`${h2} text-ink`}>
              Start free. Grow when you&apos;re ready.
            </h2>
          </div>
          <PricingPlans
            availability={availability}
            showFeatured={false}
            freeHref="/claim"
            waitlistHref="/pricing#pricing-waitlist"
          />
          <div className="mt-8 flex justify-center">
            <Link
              href="/pricing"
              className="inline-flex min-h-[44px] items-center font-subhead text-[15px] font-semibold text-amber underline underline-offset-4 hover:text-brand-black"
            >
              Compare every plan
            </Link>
          </div>
        </Container>
      </section>

      {/* 6. Closing band */}
      <section className="bg-deep-bg" aria-labelledby="closing-heading">
        <Container className="py-16 md:py-24 grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[3px] order-2 lg:order-1">
            <Image
              src="/images/editorial/crown-and-coil-studio.webp"
              alt="A stylist smiles while braiding a client's red hair in a salon."
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
          <div className="flex flex-col gap-5 order-1 lg:order-2">
            <h2 id="closing-heading" className={`${h2} text-off-white`}>
              Your page is waiting for you.
            </h2>
            <p className="font-body text-lg leading-relaxed text-ink-soft max-w-[48ch]">
              Claiming is free and takes a few minutes. You can upgrade any time, or never.
            </p>
            <div className="pt-2">
              <OwnerButtons />
            </div>
          </div>
        </Container>
      </section>
    </>
  )
}

/** The badge marks from the board: hollow, filled, gold, and gold with a ring. */
function LadderMark({ step }: { step: number }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      {step === 0 && (
        <circle cx="12" cy="12" r="6" fill="none" stroke="#b5b5b7" strokeWidth="1.5" />
      )}
      {step === 1 && <circle cx="12" cy="12" r="6" fill="#b5b5b7" />}
      {step === 2 && <circle cx="12" cy="12" r="7" fill="#c4a065" />}
      {step === 3 && (
        <>
          <circle cx="12" cy="12" r="6" fill="#ffd867" />
          <circle cx="12" cy="12" r="11" fill="none" stroke="#ffd867" />
        </>
      )}
    </svg>
  )
}
