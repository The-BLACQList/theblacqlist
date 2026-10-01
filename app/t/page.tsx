import Link from 'next/link'
import type { Metadata } from 'next'

import { GoldBrandMark } from '@/components/ui/gold-brand-mark'
import { StartTourButton } from './StartTourButton'

// The landing page for a one-tap tester link, <origin>/t#<token>. The page
// itself holds nothing secret: the token is in the fragment, which never
// reaches the server, and nothing is spent until the tester taps Start.
// Plan: docs/blacqlist/ops/tester-week/one-tap-link-plan-2026-10-01.md.

export const metadata: Metadata = {
  title: 'Start your tour',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default function TesterLinkPage() {
  return (
    <div className="min-h-screen bg-deep-bg flex items-start justify-center px-4 py-12 md:py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link
            href="/"
            aria-label="The BLACQList home"
            className="group flex flex-col items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2 focus-visible:ring-offset-deep-bg"
          >
            <GoldBrandMark className="h-12 w-12 transition-[filter] group-hover:brightness-110" />
            <span className="font-headline text-xl font-medium tracking-[0.14em] text-white">
              THE BLACQLIST
            </span>
          </Link>
        </div>

        <main className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="font-headline text-[26px] text-brand-black mb-1">You&rsquo;re in</h1>
          <p className="font-subhead text-sm text-charcoal mb-6">
            Thanks for testing The BLACQList. Tap Start and we&rsquo;ll sign you in and open a
            short tour. No password needed.
          </p>
          <StartTourButton />
        </main>

        <p className="text-center text-xs font-subhead text-white/60 mt-6">
          &copy; {new Date().getFullYear()} The BLACQList. All rights reserved.
        </p>
      </div>
    </div>
  )
}
