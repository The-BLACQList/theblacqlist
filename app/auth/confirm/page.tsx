import Link from 'next/link'
import { BrandMark } from '@/components/ui/brand-mark'
import { confirmOtpAction } from '@/lib/actions/auth/confirmOtp'

// Interstitial that confirms a password-reset link. It lives at /auth/* (so the
// coming-soon gate allowlists it) and is intentionally NOT in the (auth) route
// group, so it replicates the auth card styling inline. It does NOT verify on
// load — verification happens only when the user clicks Continue (a POST), which
// keeps email link-scanners from consuming the one-time token. See confirmOtp.ts.

interface ConfirmPageProps {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>
}

export default async function ConfirmPage({ searchParams }: ConfirmPageProps) {
  const { token_hash, type, next } = await searchParams
  const valid = !!token_hash && type === 'recovery'

  return (
    <div className="min-h-screen bg-deep-bg flex items-start justify-center px-4 py-12 md:py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link
            href="/"
            aria-label="The BLACQList home"
            className="group flex flex-col items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2 focus-visible:ring-offset-deep-bg"
          >
            <BrandMark className="h-12 w-12 text-gold transition-colors group-hover:text-light-gold" />
            <span className="font-headline text-xl font-medium tracking-[0.14em] text-white">
              THE BLACQLIST
            </span>
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {valid ? (
            <>
              <h1 className="font-headline text-[26px] text-brand-black mb-1">
                Reset your password
              </h1>
              <p className="font-subhead text-sm text-charcoal mb-6">
                Click continue to set a new password for your account.
              </p>
              <form action={confirmOtpAction}>
                <input type="hidden" name="token_hash" value={token_hash} />
                <input type="hidden" name="type" value={type} />
                <input type="hidden" name="next" value={next ?? '/reset-password'} />
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
                Link invalid or expired
              </h1>
              <p className="font-subhead text-sm text-charcoal mb-6">
                This password-reset link is missing information or has expired. Request a new one to
                continue.
              </p>
              <Link
                href="/forgot-password"
                className="inline-flex w-full h-11 items-center justify-center rounded-full bg-brand-black text-white font-body font-bold text-sm hover:bg-charcoal transition-colors"
              >
                Request a new link
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
