import Link from 'next/link'
import { GoldBrandMark } from '@/components/ui/gold-brand-mark'
import { confirmOtpAction } from '@/lib/actions/auth/confirmOtp'
import { defaultNextFor, parseConfirmLinkType } from '@/lib/services/auth/confirmLink'

// Interstitial that confirms a password-reset or sign-up email link. It lives at
// /auth/* (so the coming-soon gate allowlists it) and is intentionally NOT in the
// (auth) route group, so it replicates the auth card styling inline. It does NOT
// verify on load — verification happens only when the user clicks Continue (a
// POST), which keeps email link-scanners from consuming the one-time token. See
// confirmOtp.ts and lib/services/auth/confirmLink.ts.

interface ConfirmPageProps {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>
}

const COPY = {
  recovery: {
    heading: 'Reset your password',
    body: 'Click continue to set a new password for your account.',
    invalidHeading: 'Link invalid or expired',
    invalidBody:
      'This password-reset link is missing information or has expired. Request a new one to continue.',
    invalidHref: '/forgot-password',
    invalidCta: 'Request a new link',
  },
  signup: {
    heading: 'Confirm your email',
    body: 'Click continue to confirm your email and finish setting up your account.',
    invalidHeading: 'Link invalid or expired',
    invalidBody:
      'This confirmation link is missing information or has expired. If you already confirmed your email, just sign in.',
    invalidHref: '/sign-in',
    invalidCta: 'Go to sign in',
  },
} as const

export default async function ConfirmPage({ searchParams }: ConfirmPageProps) {
  const { token_hash, type: typeRaw, next } = await searchParams
  const type = parseConfirmLinkType(typeRaw)
  const valid = !!token_hash && type !== null
  // A link with no recognisable type is most likely a sign-up link from a
  // hand-edited template, so the invalid state points at sign-in, not reset.
  const copy = type === 'recovery' ? COPY.recovery : COPY.signup
  const defaultNext = type ? defaultNextFor(type) : '/onboarding'

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

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {valid ? (
            <>
              <h1 className="font-headline text-[26px] text-brand-black mb-1">{copy.heading}</h1>
              <p className="font-subhead text-sm text-charcoal mb-6">{copy.body}</p>
              <form action={confirmOtpAction}>
                <input type="hidden" name="token_hash" value={token_hash} />
                <input type="hidden" name="type" value={type ?? ''} />
                <input type="hidden" name="next" value={next ?? defaultNext} />
                <button
                  type="submit"
                  className="w-full h-11 rounded-full bg-brand-black text-white font-body font-bold text-sm hover:bg-charcoal transition-colors"
                >
                  Continue
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="font-headline text-[26px] text-brand-black mb-1">
                {copy.invalidHeading}
              </h1>
              <p className="font-subhead text-sm text-charcoal mb-6">{copy.invalidBody}</p>
              <Link
                href={copy.invalidHref}
                className="inline-flex w-full h-11 items-center justify-center rounded-full bg-brand-black text-white font-body font-bold text-sm hover:bg-charcoal transition-colors"
              >
                {copy.invalidCta}
              </Link>
            </>
          )}
        </div>

        <p className="text-center text-xs font-subhead text-white/60 mt-6">
          &copy; {new Date().getFullYear()} The BLACQList. All rights reserved.
        </p>
      </div>
    </div>
  )
}
