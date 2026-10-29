import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'

import { Container } from '@/components/layout/container'
import { isFeatureEnabled } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'
import { getPlanAvailability, isPlanPurchasable, isTierOpen } from '@/lib/stripe/availability'
import { aiQuota } from '@/lib/stripe/features'
import { PricingPlans } from '../pricing/PricingPlans'

// Plan availability comes from the live `plans` table, same as /pricing. A
// prerendered page would keep showing a buy button after a tier is withheld.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'For Business | The BLACQList',
  description:
    'Claim your page for free, keep your details right, and see how people find you. Open to every business.',
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
    body: 'Send a claim. A real person checks it, so only the owner runs the page.',
  },
  {
    title: 'Make it yours',
    body: 'Add photos, hours, and your story. Keep it current so customers trust what they see.',
  },
]

// `starter` marks the items gated in lib/stripe/features.ts: `review_response`
// and `analytics` are both tier 1, so Free gets neither. The story row names
// the Starter extras enforced by ticket 119 (photos, video, common questions).
// Social links are Starter too, which is why the contact row no longer says
// "links".
const WHAT_YOU_GET = [
  {
    title: 'Your story and photos',
    body: 'Tell people who you are, in your words. Add more photos, a video, and common questions on Starter.',
  },
  {
    title: 'Hours, website, and contact',
    body: 'Keep the basics right so customers never show up to a locked door.',
  },
  {
    title: 'Reviews you can answer',
    body: "Reply in public so customers see you're listening.",
    starter: true,
  },
  {
    title: 'See who finds you',
    body: 'Views, saves, and taps on your page over the last 30 days.',
    starter: true,
  },
  {
    title: 'A place in The Collective',
    body: 'Once customers log 5 or more receipts with you, your business can appear by name on our map of where the community spends.',
  },
]

// AI writing help leads the owner pitch (founder, 2026-10-29, ticket 146).
// Every line names something that ships: the /add-business drafts (ticket 128,
// FEATURE_AI_ONBOARDING, free) and the Write buttons and Explain my numbers on
// Edit content and analytics (ticket 138, FEATURE_AI_BETA, Starter and up,
// counted against aiQuota). A line only shows while its flag is on.
const AI_SIGNUP_ITEM = {
  title: 'A first draft when you add your business',
  body: 'Tell us a little about what you do. We suggest a category, a tagline, your about text, and the title and summary search engines show. Use what you like and change any word.',
}

const AI_PAID_ITEMS = [
  {
    title: 'Your about text',
    body: "Get a draft written from what's already on your page, in your voice.",
  },
  {
    title: 'Your search title and summary',
    body: 'The short lines Google and other search engines show for your page.',
  },
  {
    title: 'Instagram captions',
    body: 'A caption about your business, ready to copy into a post.',
  },
  {
    title: 'Explain my numbers',
    body: 'A plain read on your views, saves, and taps over the last 30 days.',
  },
]

// Must match .claude/rules/moderation-policy.md and lib/services/trust/certification.ts.
const LADDER = [
  { tier: 'Unclaimed', line: 'Listed from public info. Nobody has claimed it yet.' },
  { tier: 'Claimed', line: 'An owner claimed it and we approved the claim.' },
  {
    tier: 'Verified',
    line: 'The owner sent proof, like a business license, and we checked it by hand. Free for every owner.',
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

// [Decision, founder, 2026-10-15: one owner door. Every general owner link
// lands here at #start, on one question: is your business already listed?
// Find first, since claiming an existing page avoids duplicates.]
function OwnerChoice() {
  return (
    <div
      id="start"
      className="scroll-mt-24 flex flex-col gap-4 rounded-[3px] border border-off-white/20 bg-off-white/5 p-5"
    >
      <div className="flex flex-col gap-1">
        <h2 className="font-headline font-medium text-[24px] leading-tight text-off-white text-balance">
          Is your business already on the list?
        </h2>
        <p className="font-body text-base leading-relaxed text-ink-soft">
          Search for it and claim it, or add it in a few minutes.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row flex-wrap gap-3">
        <Link href="/claim" className={`${button} bg-gold text-brand-black hover:bg-light-gold`}>
          Find my business
        </Link>
        <Link
          href="/add-business"
          className={`${button} border border-off-white/70 text-off-white hover:bg-off-white/10`}
        >
          Add my business
        </Link>
      </div>
    </div>
  )
}

export default async function ForBusinessPage() {
  const supabase = await createClient()
  const availability = await getPlanAvailability(supabase)
  // Names what is open and what is still coming, read from the same
  // availability the cards use. Growth can open before Premium (ticket 143);
  // once every paid tier is open the line goes away.
  const starterOpen = isPlanPurchasable(availability, 'starter', 'monthly')
  const growthOpen = isTierOpen(availability, 'growth')
  const premiumOpen = isTierOpen(availability, 'premium')
  const openLine = !starterOpen || premiumOpen
    ? null
    : growthOpen
      ? 'Starter and Growth are open now. Premium opens once everything in it works.'
      : 'Starter is open now. Growth and Premium open once everything in them works.'
  const aiSignupOn = isFeatureEnabled('aiOnboarding')
  const aiPaidOn = isFeatureEnabled('aiBeta')
  const aiOn = aiSignupOn || aiPaidOn

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
              {aiOn
                ? 'Claim your page for free, and let AI help you write it. Keep your details right, and see how people find you. Open to every business.'
                : 'Claim your page for free, keep your details right, and see how people find you. Open to every business.'}
            </p>
            <div className="pt-2">
              <OwnerChoice />
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[3px]">
            <Image
              src="/images/editorial/citrus-harvest.webp"
              alt="A grower in work gloves checks ripe oranges on a tree in his orchard."
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover object-[40%_40%]"
            />
          </div>
        </Container>
      </section>

      {/* 2. AI writing help, while either AI flag is on */}
      {aiOn && (
        <section className="bg-white" aria-labelledby="ai-heading">
          <Container className="py-16 md:py-24 grid gap-10 lg:grid-cols-[2fr_3fr]">
            <div className="flex flex-col gap-3">
              <p className={eyebrowLight}>AI writing help</p>
              <h2 id="ai-heading" className={`${h2} text-ink`}>
                Stuck on what to say? Start from a draft.
              </h2>
              <p className="font-body text-lg leading-relaxed text-charcoal max-w-[44ch]">
                Every draft is written from your own page. Nothing goes live until you save it.
              </p>
            </div>
            <ul className="list-none m-0 p-0 flex flex-col">
              {aiSignupOn && (
                <AiItem title={AI_SIGNUP_ITEM.title} body={AI_SIGNUP_ITEM.body} note=", free" />
              )}
              {aiPaidOn &&
                AI_PAID_ITEMS.map((item) => (
                  <AiItem
                    key={item.title}
                    title={item.title}
                    body={item.body}
                    note=", on Starter and up"
                  />
                ))}
              {aiPaidOn && (
                <li className="border-t border-hairline pt-5">
                  <p className="font-body text-base leading-relaxed text-charcoal">
                    Starter includes {aiQuota('starter')} drafts every 30 days. Growth includes{' '}
                    {aiQuota('growth')}.
                  </p>
                </li>
              )}
            </ul>
          </Container>
        </section>
      )}

      {/* 3. How it works */}
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

      {/* 4. What you get */}
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

      {/* 5. Trust ladder */}
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

      {/* 6. Plans: the same component and data as /pricing */}
      <section className="bg-off-white" aria-labelledby="plans-heading">
        <Container className="py-16 md:py-24">
          <div className="flex flex-col gap-3 text-center items-center">
            <p className={eyebrowLight}>Plans</p>
            <h2 id="plans-heading" className={`${h2} text-ink`}>
              Start free. Grow when you&apos;re ready.
            </h2>
            {openLine && (
              <p className="font-body text-lg leading-relaxed text-charcoal max-w-[52ch]">
                {openLine}
              </p>
            )}
          </div>
          <PricingPlans
            availability={availability}
            showFeatured={false}
            freeHref="/for-business#start"
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

      {/* 7. Closing band */}
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
              Claiming is free. Sending a claim takes a few minutes, and we review it by hand.
              Upgrade any time, or never.
            </p>
            <div className="pt-2">
              <OwnerChoice />
            </div>
          </div>
        </Container>
      </section>
    </>
  )
}

function AiItem({ title, body, note }: { title: string; body: string; note: string }) {
  return (
    <li className="flex gap-4 border-t border-hairline py-5">
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        aria-hidden="true"
        className="mt-1.5 shrink-0 text-amber"
      >
        <path d="M7 0.5 8.6 5.4 13.5 7 8.6 8.6 7 13.5 5.4 8.6 0.5 7 5.4 5.4Z" fill="currentColor" />
      </svg>
      <div className="flex flex-col gap-1">
        <h3 className="font-subhead text-[17px] font-semibold text-ink">
          {title}
          <span className="font-subhead text-sm font-semibold text-amber">{note}</span>
        </h3>
        <p className="font-body text-base leading-relaxed text-charcoal">{body}</p>
      </div>
    </li>
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
