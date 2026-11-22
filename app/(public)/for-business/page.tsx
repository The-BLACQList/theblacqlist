import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'

import { isFeatureEnabled } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'
import { getPlanAvailability, isPlanPurchasable, isTierOpen } from '@/lib/stripe/availability'
import { EXAMPLE_VARIANT_LABEL, type ExampleVariant } from '@/lib/example/fixtures'
import { TrustMark } from '@/components/brand/TrustMark'
import { Reveal } from '@/components/motion/Reveal'
import { PricingPlans } from '../pricing/PricingPlans'

// Plan availability comes from the live `plans` table, same as /pricing. A
// prerendered page would keep showing a buy button after a tier is withheld.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'For Business | The BLACQList',
  description:
    'Claiming your Page on The BLACQList is free, and so is adding your business. Then keep your hours and details right yourself.',
}

// Ticket 240 (founder, 2026-11-21): the page uses the home page's building
// blocks (full-width photo hero, eyebrow + headline bands, pill buttons, the
// site's Jost headlines over Inter text) instead of ticket 206's own
// stylesheet, and drops the section numbers. The facts are ticket 206's,
// trimmed. Marketing owns the words (WF-042 copy deck).

type Row = { title: string; body: string; plan: 'free' | 'starter' | 'freeToStart'; note?: string }

const PLAN_LABEL: Record<Row['plan'], string> = {
  free: 'Free',
  starter: 'Starter and Up',
  freeToStart: 'Free to Start',
}

// What a Page can do. `plan: 'starter'` marks what lib/stripe/features.ts gates
// at tier 1 or above (access works by rank, so Starter and up): extra photos,
// `chapters_layout`, `map_logo_pin`, `listing_video`, `faqs`, `social_links`,
// `review_response`, `analytics`.
// AI is one row (founder 2026-11-21, wording workshopped together), built in
// the page from the flags: it shows while FEATURE_AI_BETA is on (Explain My
// Numbers and the Write buttons, Starter and up, counted against aiQuota), and
// reads Free to Start when FEATURE_AI_ONBOARDING's free /add-business writing
// help is on too. The title says AI, which is the disclosure. Never call them drafts;
// not Cue (the dashboard tools aren't called Cue, and Marketing keeps Cue in
// the supporter lane). The Collective is out: it is gated
// (FEATURE_COLLECTIVE_OPEN).
const ROWS: Row[] = [
  {
    title: 'Hours and How to Reach You',
    body: "What you do, when you're open, and how to reach you.",
    plan: 'free',
  },
  {
    title: 'Your Story and Photos',
    body: 'Your story in your own words, and add up to 3 photos.',
    plan: 'free',
  },
  {
    title: 'More on Your Page',
    body: 'Up to 10 photos, a video, common questions, and your social links.',
    plan: 'starter',
  },
  {
    // Ticket 239 (founder, 2026-11-21): the full layout is Starter and up,
    // gated as `chapters_layout` in lib/stripe/features.ts.
    title: 'The Full Page Layout',
    body: 'For businesses, restaurants, and vendors: your photos in a gallery and your story in chapters.',
    plan: 'starter',
  },
  {
    // Ticket 244 (founder, 2026-11-21): gated as `map_logo_pin`. Only the look
    // is paid; the order of pins on the map stays trust-based.
    title: 'Your Logo on the Map',
    body: 'Your logo as your map pin, once your page is claimed. Where you sit on the map still comes from trust, not your plan.',
    plan: 'starter',
  },
  {
    title: 'Reviews You Can Answer',
    body: 'Reply to reviews in public.',
    plan: 'starter',
  },
  {
    title: 'See Who Finds You',
    body: 'Your views, saves, and taps over the last 30 days.',
    plan: 'starter',
  },
]

const AI_ROW = {
  title: 'AI Help for What Matters',
  body: 'Your words, sharpened. Your numbers, explained. AI helps you write what customers and search engines read first, and explains your numbers with one thing to try next.',
}

// One sample page per layout, so an owner can see a Page filled in before
// claiming theirs. Each line names what its sample really shows
// (lib/example/fixtures). The shots are screenshots of /example itself.
const SAMPLES: { variant: ExampleVariant; shot: string; body: string }[] = [
  {
    variant: 'storefront',
    shot: '/images/for-business/sample-storefront.webp',
    body: 'For places people visit, like cafés, shops, and salons. The sample is a café with a menu and bookings.',
  },
  {
    variant: 'professional',
    shot: '/images/for-business/sample-professional.webp',
    body: 'For services and advice, like consultants and accountants. The sample is a consulting firm with prices and a team.',
  },
  {
    variant: 'creative',
    shot: '/images/for-business/sample-creative.webp',
    body: 'For makers and artists, like designers and photographers. The sample is a design studio with a portfolio and prints.',
  },
]

// Must match .claude/rules/moderation-policy.md and lib/services/trust/certification.ts.
const LADDER = [
  { tier: 0, name: 'Unclaimed', line: 'A Page we started. Nobody has claimed it yet.' },
  { tier: 1, name: 'Claimed', line: 'The owner sent a claim, and a real person approved it.' },
  {
    tier: 2,
    name: 'Verified',
    line: 'The owner sent proof, like a business license, and we checked it by hand. Free for every owner.',
  },
  {
    tier: 3,
    name: 'Certified by The BLACQList',
    line: "5 or more reviews, an average of 3.5 or better, 90 days since the claim, and complete details. It's automatic. Nobody can buy it.",
  },
] as const

// The home page's pill buttons and band layout (components/home/OwnerCta.tsx,
// HomeMapBand.tsx). Eyebrows are 14px, not the home's 12px: this page keeps
// ticket 206's 14px floor (e2e/for-business-brand.spec.ts).
const PILL =
  'inline-flex items-center justify-center h-12 px-6 md:px-7 rounded-full font-subhead text-sm font-bold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold'
const PILL_GOLD = `${PILL} bg-gold hover:bg-light-gold text-brand-black`
const PILL_LINE = `${PILL} border border-off-white/40 text-white hover:bg-off-white/10`
const WRAP = 'max-w-7xl mx-auto w-full px-5 md:px-8 lg:px-10'
const EYEBROW = 'font-subhead text-sm font-bold uppercase tracking-[0.12em] mb-1.5'
const H2 = 'font-headline text-[28px] md:text-[36px] leading-tight text-balance'
const LINK_UNDER =
  'font-subhead text-sm font-bold text-brand-black underline decoration-amber decoration-[1.5px] underline-offset-[5px]'

// [Decision, founder, 2026-10-15: one owner door. Every general owner link
// lands on #start, on one question: is your business already listed? Find
// first, since claiming an existing Page avoids duplicates.] The id lives on
// the hero only; the closing band repeats the buttons without it.
function DoorButtons({ center = false }: { center?: boolean }) {
  return (
    <div className={`flex gap-3 flex-wrap${center ? ' justify-center' : ''}`}>
      <Link href="/claim" className={PILL_GOLD}>
        Find My Business
        <span aria-hidden="true" className="ml-2">
          →
        </span>
      </Link>
      <Link href="/add-business" className={PILL_LINE}>
        Add My Business
      </Link>
    </div>
  )
}

export default async function ForBusinessPage() {
  const supabase = await createClient()
  const availability = await getPlanAvailability(supabase)
  // Read from the same availability the cards use, never typed. Growth can
  // open before Premium (ticket 143); once every paid tier is open the line
  // goes away.
  const starterOpen = isPlanPurchasable(availability, 'starter', 'monthly')
  const growthOpen = isTierOpen(availability, 'growth')
  const premiumOpen = isTierOpen(availability, 'premium')
  const openLine =
    !starterOpen || premiumOpen
      ? null
      : growthOpen
        ? 'Premium opens once everything in it works.'
        : 'The other plans open once everything in them works.'
  const aiOnboardingOn = isFeatureEnabled('aiOnboarding')
  const aiBetaOn = isFeatureEnabled('aiBeta')
  // The AI row sits between the Free rows and the Starter and Up rows
  // (founder 2026-11-21): it starts free and grows with the plan.
  const rows: Row[] = aiBetaOn
    ? [
        ...ROWS.filter((r) => r.plan === 'free'),
        aiOnboardingOn
          ? {
              ...AI_ROW,
              plan: 'freeToStart',
              note: 'Free when you add your business. Starter and up explains your numbers.',
            }
          : {
              ...AI_ROW,
              plan: 'starter',
              note: 'Your plan sets how often it helps every 30 days.',
            },
        ...ROWS.filter((r) => r.plan !== 'free'),
      ]
    : ROWS

  return (
    <div className="bg-white" id="fb-root">
      {/* Hero: full width, built like components/home/HomeHero.tsx. The dark
          ground under the photo gives the text a dark surface while it loads. */}
      <section
        aria-labelledby="door-h"
        className="relative bg-deep-bg min-h-[480px] md:min-h-[72vh] flex items-end md:items-center"
      >
        <Image
          src="/images/example/cafe-interior.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[50%_60%]"
        />
        {/* Darker than HomeHero's shade: this copy runs higher and wider over the
            bright skylight (measured 2026-11-21, every hero line at least 4.5:1). */}
        <div
          className="absolute inset-0 md:hidden"
          style={{
            background:
              'linear-gradient(to bottom, rgba(4,4,5,0.5) 0%, rgba(4,4,5,0.84) 15%, rgba(4,4,5,0.9) 40%, rgba(4,4,5,0.92) 100%)',
          }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 hidden md:block"
          style={{
            background:
              'linear-gradient(to right, rgba(4,4,5,0.9) 0%, rgba(4,4,5,0.82) 50%, rgba(4,4,5,0.55) 74%, rgba(4,4,5,0.2) 100%)',
          }}
          aria-hidden="true"
        />

        <div id="start" className={`relative z-10 ${WRAP} pt-[104px] pb-10 md:py-20 scroll-mt-20`}>
          <p className={`${EYEBROW} text-gold`}>For Business Owners</p>
          <h1
            id="door-h"
            className="font-headline text-[40px] md:text-[60px] lg:text-[68px] text-white leading-[1.05] text-balance max-w-[18ch]"
          >
            Is Your Business Already on the List?
          </h1>
          <p className="font-body text-base md:text-lg text-off-white/90 mt-3 max-w-[46ch]">
            Search for your business first. If it&apos;s here, claim it free. If not, add it free.
          </p>
          <div className="mt-7">
            <DoorButtons />
          </div>
          <ul className="mt-6 grid gap-1 font-body text-[15px] text-off-white/85 max-w-[52ch]">
            <li>A real person checks every claim.</li>
            <li>Already listed? We added it from public info. Claim it to make it yours.</li>
          </ul>
        </div>
      </section>

      {/* What a Page can do: one even grid, each feature tagged with its plan */}
      <Reveal>
        <section aria-labelledby="gets-h" className="bg-white py-12 md:py-16">
          <div className={WRAP}>
            <p className={`${EYEBROW} text-amber`}>Your Page</p>
            <h2 id="gets-h" data-fb-heading className={`${H2} text-brand-black`}>
              What Your Page Can Do
            </h2>
            <p className="font-body text-[15px] text-charcoal mt-3 max-w-[48ch]">
              Here&apos;s what&apos;s free, and what Starter adds.
            </p>

            {/* One even grid, no boxes: every cell is the same width and each
                row shares a height, whichever rows the flags turn on. The
                plan tag on each cell says who gets it. */}
            <ul className="mt-8 border-b border-stone-300">
              {rows.map((row) => (
                <li
                  key={row.title}
                  className="border-t border-stone-300 py-5 md:py-6 md:grid md:grid-cols-[160px_minmax(0,1fr)_minmax(0,1.3fr)] md:gap-x-8 md:items-baseline"
                >
                  <p
                    className={`font-subhead text-sm font-bold uppercase tracking-[0.1em] ${row.plan === 'starter' ? 'text-amber' : 'text-charcoal'}`}
                  >
                    {PLAN_LABEL[row.plan]}
                  </p>
                  <h3 className="font-headline text-[22px] leading-snug text-brand-black mt-2 md:mt-0">
                    {row.title}
                  </h3>
                  <div className="mt-1 md:mt-0">
                    <p className="font-body text-[15px] text-charcoal">{row.body}</p>
                    {row.note && <p className="font-body text-sm text-charcoal mt-2">{row.note}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </Reveal>

      {/* Sample pages (ticket 206), laid out like the home Showcase */}
      <Reveal>
        <section aria-labelledby="samples-h" className="bg-off-white py-12 md:py-16">
          <div className={WRAP}>
            <div className="flex items-end justify-between gap-6 flex-wrap mb-8">
              <div>
                <p className={`${EYEBROW} text-amber`}>Samples</p>
                <h2 id="samples-h" data-fb-heading className={`${H2} text-brand-black`}>
                  See a Sample Page
                </h2>
                <p className="font-body text-[15px] text-charcoal mt-3 max-w-[48ch]">
                  Pick the type closest to your business.
                </p>
              </div>
              <Link href="/for-business#start" className={PILL_GOLD}>
                Get Your Page
              </Link>
            </div>

            <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              {SAMPLES.map((sample) => {
                const label = EXAMPLE_VARIANT_LABEL[sample.variant]
                return (
                  <li key={sample.variant}>
                    <Link
                      href={`/example/${sample.variant}`}
                      className="group flex flex-col h-full rounded-2xl overflow-hidden bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
                    >
                      <div className="relative aspect-[16/10] bg-stone-200 overflow-hidden">
                        <Image
                          src={sample.shot}
                          alt=""
                          fill
                          sizes="(min-width: 768px) 33vw, 100vw"
                          className="object-cover object-top transition-transform duration-700 motion-safe:group-hover:scale-[1.025]"
                        />
                      </div>
                      <div className="flex flex-col grow p-5 md:p-6">
                        <h3 className="font-headline text-[22px] text-brand-black">{label}</h3>
                        <p className="font-body text-[15px] text-charcoal mt-1 grow">
                          {sample.body}
                        </p>
                        <span className={`${LINK_UNDER} mt-4`}>
                          See the {label} Sample
                          <span aria-hidden="true" className="ml-2">
                            →
                          </span>
                        </span>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
            <p className="font-body text-sm text-charcoal mt-5 max-w-[64ch]">
              The business on these pages is made up, and so are its reviews and numbers. Some
              features need a paid plan.
            </p>
          </div>
        </section>
      </Reveal>

      {/* Trust ladder, round marks (DR-004) */}
      <Reveal>
        <section aria-labelledby="trust-h" className="bg-deep-bg py-12 md:py-16">
          <div className={WRAP}>
            <p className={`${EYEBROW} text-gold`}>Trust</p>
            <h2 id="trust-h" data-fb-heading className={`${H2} text-white`}>
              How Trust Is Earned
            </h2>
            <p className="font-body text-[15px] text-off-white/80 mt-3 max-w-[48ch]">
              Claimed, Verified, and Certified are earned, never sold.
            </p>
            <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px mt-8 rounded-2xl overflow-hidden bg-off-white/15">
              {LADDER.map((rung) => (
                <li key={rung.name} className="bg-deep-bg p-5 md:p-6">
                  <h3 className="flex items-center gap-2.5 font-headline text-[20px] text-white">
                    <TrustMark tier={rung.tier} dark size={20} className="flex-none" />
                    {rung.name}
                  </h3>
                  <p className="font-body text-[15px] text-off-white/80 mt-2">{rung.line}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </Reveal>

      {/* Plans: the same component and data as /pricing */}
      <Reveal>
        <section aria-labelledby="plans-h" className="bg-white py-12 md:py-16">
          <div className={WRAP}>
            <p className={`${EYEBROW} text-amber`}>Plans</p>
            <h2 id="plans-h" data-fb-heading className={`${H2} text-brand-black`}>
              Start Free
            </h2>
            <p className="font-body text-[15px] text-charcoal mt-3 max-w-[48ch]">
              You don&apos;t need Starter to claim or keep your Page.
            </p>
            {/* data-fb-plans: the shared cards keep /pricing's own type (e2e audit skips them) */}
            <div className="mt-8" data-fb-plans>
              <PricingPlans
                availability={availability}
                showFeatured={false}
                freeHref="/for-business#start"
                waitlistHref="/pricing#pricing-waitlist"
              />
            </div>
            <div className="grid justify-items-center gap-2 mt-7 text-center">
              {openLine && <p className="font-body text-sm text-charcoal">{openLine}</p>}
              <Link href="/pricing" className={`${LINK_UNDER} inline-flex items-center min-h-11`}>
                Compare Every Plan
              </Link>
            </div>
          </div>
        </section>
      </Reveal>

      {/* Closing door, the home page's owner band: the same two buttons, without the #start id */}
      <Reveal>
        <section aria-labelledby="close-h" className="bg-brand-black py-14 md:py-16">
          <div className={`${WRAP} text-center`}>
            <h2
              id="close-h"
              className="font-headline text-[28px] md:text-[36px] text-white text-balance"
            >
              Claim or Add Your Business
            </h2>
            <p className="font-body text-[15px] text-off-white/80 mt-2 max-w-[48ch] mx-auto">
              Claiming is free, and so is adding your business.
              {starterOpen && ' Upgrade any time, or never.'}
            </p>
            <div className="mt-6">
              <DoorButtons center />
            </div>
          </div>
        </section>
      </Reveal>
    </div>
  )
}
