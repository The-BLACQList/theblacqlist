import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'

import { isFeatureEnabled } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'
import { getPlanAvailability, isPlanPurchasable, isTierOpen } from '@/lib/stripe/availability'
import { EXAMPLE_VARIANT_LABEL, type ExampleVariant } from '@/lib/example/fixtures'
import { PricingPlans } from '../pricing/PricingPlans'
import './for-business.css'

// Plan availability comes from the live `plans` table, same as /pricing. A
// prerendered page would keep showing a buy button after a tier is withheld.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'For Business | The BLACQList',
  description:
    'Claiming your Page on The BLACQList is free, and so is adding your business. Then keep your hours and details right yourself.',
}

// Ticket 206, the For Business workshop (2026-11-18). Layout: Creative's
// approved build spec (blacqlist-for-business, DR-003 to DR-006). Words:
// Marketing's copy deck (WF-042), with the Author OS voice pass. Marketing owns
// the words; change them in the deck first.

const STEPS = ['Find Your Page', 'Claim It', 'Keep It Right']

type Row = { title: string; body: string; plan: 'free' | 'starter'; flag?: 'onboarding' | 'beta' }

// The compare table. `plan: 'starter'` marks what lib/stripe/features.ts gates
// at tier 1 or above (access works by rank, so Starter and up): extra photos,
// `listing_video`, `faqs`, `social_links`, `review_response`, `analytics`. The
// AI rows render only while their flag is on: the /add-business draft is
// FEATURE_AI_ONBOARDING and free; Explain My Numbers and the Write buttons are
// FEATURE_AI_BETA, Starter and up, counted against aiQuota. Each AI row says
// that AI writes it. The Collective is out: it is gated (FEATURE_COLLECTIVE_OPEN).
const ROWS: Row[] = [
  {
    title: 'Hours and How to Reach You',
    body: "Your Page can show what you make or do, your hours, and how to reach you. Keep them right so people know when you're open.",
    plan: 'free',
  },
  {
    title: 'Your Story and Photos',
    body: "Tell people who you are in your own words, and add a photo. When you claim your Page, it shows who's behind the business.",
    plan: 'free',
  },
  {
    title: 'Start from a Draft',
    body: "Stuck on what to say? When you add your business, start from a free first draft. It's written by AI, and you can change any of it.",
    plan: 'free',
    flag: 'onboarding',
  },
  {
    title: 'More on Your Page',
    body: 'Add more photos, a video, common questions, and your social links, on Starter and up.',
    plan: 'starter',
  },
  {
    title: 'Reviews You Can Answer',
    body: "On Starter and up, reply to reviews in public so people see you're listening.",
    plan: 'starter',
  },
  {
    title: 'See Who Finds You',
    body: 'See your views, saves, and taps over the last 30 days, on Starter and up.',
    plan: 'starter',
  },
  {
    title: 'Explain My Numbers',
    body: 'A plain read of what your numbers show, on Starter and up. AI writes it.',
    plan: 'starter',
    flag: 'beta',
  },
  {
    title: 'More Drafts for Your Page',
    body: 'Get drafts of your About text, your search title and summary, and Instagram captions, on Starter and up. AI writes them, and you edit them.',
    plan: 'starter',
    flag: 'beta',
  },
]

// One sample page per layout, so an owner can see a Page filled in before
// claiming theirs. Each line names what its sample really shows
// (lib/example/fixtures). The shots are screenshots of /example itself.
const SAMPLES: { variant: ExampleVariant; shot: string; body: string }[] = [
  {
    variant: 'storefront',
    shot: '/images/for-business/sample-storefront.webp',
    body: 'For places people visit, like cafés, restaurants, shops, and salons. The sample is a café with a menu, a shop, and table bookings.',
  },
  {
    variant: 'professional',
    shot: '/images/for-business/sample-professional.webp',
    body: 'For services and advice, like consultants, accountants, and agencies. The sample is a consulting firm with prices, a team, and discovery calls.',
  },
  {
    variant: 'creative',
    shot: '/images/for-business/sample-creative.webp',
    body: 'For makers and artists, like designers, photographers, and studios. The sample is a design studio with a portfolio, commissions, and prints.',
  },
]

// Must match .claude/rules/moderation-policy.md and lib/services/trust/certification.ts.
const LADDER = [
  { tier: 0, name: 'Unclaimed', line: 'A Page we started. Nobody has claimed it yet.' },
  { tier: 1, name: 'Claimed', line: 'The owner sent a claim, and a real person approved it.' },
  {
    tier: 2,
    name: 'Verified',
    line: 'The owner sent proof, such as a business license, and we checked it by hand. Free for every owner.',
  },
  {
    tier: 3,
    name: 'BLACQList Certified',
    line: "Earned over time: 5 or more reviews, an average of 3.5 or better, 90 days since the claim, and complete details. It's automatic. Nobody can buy it.",
  },
] as const

const Arrow = () => <span aria-hidden="true">→</span>

// [Decision, founder, 2026-10-15: one owner door. Every general owner link
// lands on #start, on one question: is your business already listed? Find
// first, since claiming an existing Page avoids duplicates.] The id lives on
// the hero only; the closing band repeats the buttons without it.
function DoorButtons() {
  return (
    <div className="btns">
      <Link href="/claim" className="btn btn-gold">
        Find My Business <Arrow />
      </Link>
      <Link href="/add-business" className="btn btn-line-d">
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
  const rows = ROWS.filter(
    (r) => !r.flag || (r.flag === 'onboarding' && aiOnboardingOn) || (r.flag === 'beta' && aiBetaOn)
  )

  return (
    <div className="fb" id="fb-root">
      {/* Hero: H2 Split (DR-005). The dark panel holds the door only (DR-006). */}
      <section className="hx" aria-labelledby="door-h">
        <div className="hx-grid">
          <div className="hx-copy" id="start">
            <p className="lbl">For Business Owners</p>
            <h1 className="dq" id="door-h">
              Is Your Business Already on the List?
            </h1>
            <p className="dl">
              Search your business name first. If it&apos;s here, claim your Page free. If it
              isn&apos;t, add your business free.
            </p>
            <div className="act on-dark">
              <DoorButtons />
            </div>
            <ul className="facts">
              <li>A real person checks every claim.</li>
              <li>
                Found your business here already? It was listed from public info, and nobody has
                claimed it yet.
              </li>
            </ul>
            <p className="help">
              Search first, so your business doesn&apos;t end up with two Pages.
            </p>
            <div className="mini">
              <p className="sub-lbl">How It Works</p>
              <ol>
                {STEPS.map((step, i) => (
                  <li key={step}>
                    <span className="n" aria-hidden="true">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <div className="ph">
            <Image
              src="/images/example/cafe-interior.webp"
              alt="A café with hanging plants, wicker lamps and a counter under a slatted roof."
              fill
              priority
              sizes="(min-width: 1024px) 42vw, (min-width: 768px) 50vw, 100vw"
            />
          </div>
        </div>
      </section>

      {/* 01: compare table (DR-005, DR-006 C) */}
      <section className="band s-white" id="gets" aria-labelledby="gets-h">
        <div className="wrap">
          <div className="ch-hd">
            <h2 className="ch-h" id="gets-h">
              <span className="num">01</span>
              <span>What Your Page Can Do</span>
            </h2>
            <p className="lede">Here&apos;s what&apos;s free, and what Starter adds.</p>
          </div>
          <table className="ct" role="table" aria-label="What each plan includes">
            <colgroup>
              <col className="c1" />
              <col className="c2" />
              <col className="c3" />
            </colgroup>
            <thead role="rowgroup">
              <tr role="row">
                <th role="columnheader" scope="col">
                  Feature
                </th>
                <th role="columnheader" scope="col" className="c">
                  Free
                </th>
                <th role="columnheader" scope="col" className="c st">
                  Starter and Up
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {rows.map((row) => (
                <tr role="row" key={row.title}>
                  <th role="rowheader" scope="row">
                    <div className="fd">
                      <b>{row.title}</b>
                      <span>{row.body}</span>
                    </div>
                  </th>
                  <td role="cell">{row.plan === 'free' ? <Tick /> : <Dash />}</td>
                  <td role="cell" className="st">
                    <Tick />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {aiBetaOn && (
            <p className="fine ct-after">Your plan sets how many drafts you get every 30 days.</p>
          )}
        </div>
      </section>

      {/* 02: sample pages (ticket 206) */}
      <section className="band s-stone" aria-labelledby="samples-h">
        <div className="wrap">
          <div className="ch-hd">
            <h2 className="ch-h" id="samples-h">
              <span className="num">02</span>
              <span>See a Sample Page</span>
            </h2>
            <p className="lede">Pick the type closest to your business and see a Page filled in.</p>
          </div>
          <ul className="strip">
            {SAMPLES.map((sample) => {
              const label = EXAMPLE_VARIANT_LABEL[sample.variant]
              return (
                <li className="sm" key={sample.variant}>
                  <Link href={`/example/${sample.variant}`}>
                    <div className="shot">
                      <Image
                        src={sample.shot}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 400px, (min-width: 640px) 46vw, 84vw"
                      />
                    </div>
                    <div className="cap">
                      <h3>{label}</h3>
                      <p>{sample.body}</p>
                      <span className="go">
                        See the {label} Sample <Arrow />
                      </span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
          <p className="fine samples-fine">
            The business on these pages is made up, and so are its reviews and numbers. Some
            features need a paid plan. Live Pages look different from these samples.
          </p>
        </div>
      </section>

      {/* 03: trust ladder, round marks with the name in ink or white (DR-004, DR-006 A) */}
      <section className="band s-ember on-dark" aria-labelledby="trust-h">
        <div className="wrap">
          <div className="ch-hd">
            <h2 className="ch-h" id="trust-h">
              <span className="num">03</span>
              <span>How Trust Is Earned</span>
            </h2>
            <p className="lede">Claimed, Verified, and Certified are earned, never sold.</p>
          </div>
          <ol className="ladder">
            {LADDER.map((rung) => (
              <li key={rung.name}>
                <h3>
                  <span className="mk">
                    <TrustMark tier={rung.tier} dark size={20} />
                  </span>
                  {rung.name}
                </h3>
                <p>{rung.line}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 04: plans, the same component and data as /pricing */}
      <section className="band s-off" aria-labelledby="plans-h">
        <div className="wrap">
          <div className="ch-hd">
            <h2 className="ch-h" id="plans-h">
              <span className="num">04</span>
              <span>Free to Claim, Paid If You Want More</span>
            </h2>
            <p className="lede">You don&apos;t need Starter to claim or keep your Page.</p>
          </div>
          <div className="fb-plans">
            <PricingPlans
              availability={availability}
              showFeatured={false}
              freeHref="/for-business#start"
              waitlistHref="/pricing#pricing-waitlist"
            />
          </div>
          <div className="plans-after">
            {openLine && <p className="fine">{openLine}</p>}
            <Link href="/pricing" className="tlink">
              Compare Every Plan
            </Link>
          </div>
        </div>
      </section>

      {/* Closing door: the same two buttons, without the #start id */}
      <section className="band close s-ground on-dark" aria-labelledby="close-h">
        <div className="wrap">
          <div className="close-txt">
            <h2 className="sub-h" id="close-h">
              Claim or Add Your Business
            </h2>
            <p className="lede">
              Claiming is free, and so is adding your business.
              {starterOpen && ' Upgrade any time, or never.'}
            </p>
          </div>
          <DoorButtons />
        </div>
      </section>
    </div>
  )
}

function Tick() {
  return (
    <>
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path
          d="M3.5 9.5l3.6 3.4L14.5 5"
          fill="none"
          stroke="#1d1c1d"
          strokeWidth="1.9"
          strokeLinecap="square"
        />
      </svg>
      <span className="sr-only">Included</span>
    </>
  )
}

function Dash() {
  return (
    <>
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path d="M5 9h8" stroke="#595758" strokeWidth="1.5" />
      </svg>
      <span className="sr-only">Not included</span>
    </>
  )
}

/**
 * The round trust marks (DR-004, build spec §4): open, then filled, then
 * sealed. Always shown beside the tier name, which carries the meaning.
 */
function TrustMark({
  tier,
  dark,
  size = 16,
}: {
  tier: 0 | 1 | 2 | 3
  dark?: boolean
  size?: number
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      {tier === 0 && (
        <circle
          cx="8"
          cy="8"
          r="6"
          fill="none"
          stroke={dark ? '#8a8889' : '#595758'}
          strokeWidth="1.5"
          strokeDasharray="2.3 1.9"
        />
      )}
      {tier === 1 && <circle cx="8" cy="8" r="6.2" fill="#2563EB" />}
      {tier === 2 &&
        (dark ? (
          <circle cx="8" cy="8" r="6.2" fill="#ffd867" />
        ) : (
          <circle cx="8" cy="8" r="5.6" fill="#ffd867" stroke="#8f6600" strokeWidth="2" />
        ))}
      {tier === 3 && (
        <>
          <circle
            cx="8"
            cy="8"
            r="7.1"
            fill="none"
            stroke={dark ? '#c4a065' : '#8f6600'}
            strokeWidth="1.3"
          />
          <circle cx="8" cy="8" r="4.6" fill="#c4a065" />
        </>
      )}
    </svg>
  )
}
