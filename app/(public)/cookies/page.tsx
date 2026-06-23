import type { Metadata } from 'next'
import Link from 'next/link'
import { Section } from '@/components/layout/section'
import { PageHeader } from '@/components/layout/page-header'

export const metadata: Metadata = {
  title: 'Cookie Policy | The BLACQList',
  description: 'How The BLACQList uses cookies and similar tracking technologies.',
  robots: { index: true, follow: true },
}

export const revalidate = false

export default function CookiesPage() {
  return (
    <>
      <Section variant="pale-lavender">
        <PageHeader title="Cookie Policy" subtitle="Last updated: June 20, 2026" />
      </Section>

      <Section variant="white">
        <div className="max-w-2xl space-y-10 font-body text-charcoal leading-relaxed">
          <nav aria-label="Page contents" className="rounded-xl border border-gray-100 bg-white px-5 py-4">
            <p className="font-subhead text-sm font-semibold text-brand-black mb-3">Contents</p>
            <ol className="list-decimal ml-5 space-y-1 text-sm">
              <li><a href="#what-are-cookies" className="text-amber hover:underline">What Are Cookies</a></li>
              <li><a href="#cookies-we-use" className="text-amber hover:underline">Cookies We Use</a></li>
              <li><a href="#what-we-dont-use" className="text-amber hover:underline">What We Do Not Use</a></li>
              <li><a href="#managing-cookies" className="text-amber hover:underline">Managing Cookies</a></li>
              <li><a href="#contact" className="text-amber hover:underline">Contact</a></li>
            </ol>
          </nav>

          <section id="what-are-cookies" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">1. What Are Cookies</h2>
            <p>
              Cookies are small text files stored on your device when you visit a website. They help
              the website remember information about your visit — such as keeping you signed in — and
              help us understand how the platform is being used so we can improve it.
            </p>
            <p>
              In addition to cookies, we use similar technologies like local storage for session
              management. This policy covers all such technologies collectively.
            </p>
          </section>

          <section id="cookies-we-use" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">2. Cookies We Use</h2>

            <div className="space-y-6">
              <div>
                <h3 className="font-subhead font-semibold text-brand-black mb-2">
                  Essential cookies (required)
                </h3>
                <p>
                  These cookies are strictly necessary for the platform to function. They manage
                  your authentication session and keep you signed in between pages. You cannot
                  opt out of essential cookies while using an authenticated session on the platform.
                </p>
                <ul className="list-disc list-inside space-y-1 pl-2 mt-2 text-sm">
                  <li>
                    <strong>sb-access-token</strong> — Supabase authentication token; required to
                    identify your session server-side
                  </li>
                  <li>
                    <strong>sb-refresh-token</strong> — Used to refresh your session without
                    requiring you to sign in again
                  </li>
                </ul>
                <p className="text-sm text-charcoal-soft mt-2">
                  These tokens are stored in httpOnly cookies and are not accessible to JavaScript
                  running in your browser, which reduces the risk of token theft.
                </p>
              </div>

              <div>
                <h3 className="font-subhead font-semibold text-brand-black mb-2">
                  Analytics (privacy-preserving, no personal tracking)
                </h3>
                <p>
                  We use Vercel Analytics and Vercel Speed Insights to understand how visitors
                  interact with the platform — for example, which pages are most visited, where
                  users encounter issues, and how quickly pages load. These tools are designed
                  without traditional tracking cookies: they do not set a persistent identifier
                  cookie, do not track you across sites, and do not build a personal behavioral
                  profile.
                </p>
                <p className="mt-2">
                  Data collected through Vercel Analytics is aggregated and cannot be used to
                  identify individual users.
                </p>
              </div>

              <div>
                <h3 className="font-subhead font-semibold text-brand-black mb-2">
                  Error tracking (Sentry)
                </h3>
                <p>
                  We use Sentry to detect and diagnose technical errors on the platform. Sentry
                  may set a session identifier to group related errors from the same session,
                  which helps our engineering team reproduce and fix issues. This session
                  identifier is not linked to your account or personal information.
                </p>
              </div>
            </div>
          </section>

          <section id="what-we-dont-use" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">3. What We Do Not Use</h2>
            <p>We do not use:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Advertising or retargeting cookies (no ad networks, no remarketing pixels)</li>
              <li>Third-party social media tracking pixels (no Facebook Pixel, no Twitter/X Pixel)</li>
              <li>Cookies that build personal behavioral profiles or track you across other websites</li>
              <li>Fingerprinting technologies intended to identify you without a cookie</li>
            </ul>
          </section>

          <section id="managing-cookies" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">4. Managing Cookies</h2>
            <p>
              You can control cookies through your browser settings. Most browsers allow you to
              view, block, or delete cookies. Common browsers and their cookie settings:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-sm">
              <li>
                <a
                  href="https://support.google.com/chrome/answer/95647"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Chrome cookie settings (opens in new window)"
                  className="text-amber hover:underline"
                >
                  Google Chrome
                </a>
              </li>
              <li>
                <a
                  href="https://support.mozilla.org/en-US/kb/enhanced-tracking-protection-firefox-desktop"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Firefox cookie settings (opens in new window)"
                  className="text-amber hover:underline"
                >
                  Mozilla Firefox
                </a>
              </li>
              <li>
                <a
                  href="https://support.apple.com/en-us/guide/safari/sfri11471/mac"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Safari cookie settings (opens in new window)"
                  className="text-amber hover:underline"
                >
                  Safari
                </a>
              </li>
            </ul>
            <p className="mt-2">
              <strong>Please note:</strong> Blocking essential authentication cookies will prevent
              you from signing in to the platform. Anonymous browsing of public listings does not
              require any cookies.
            </p>
          </section>

          <section id="contact" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">5. Contact</h2>
            <p>
              Questions about our use of cookies or similar technologies:{' '}
              <a
                href="mailto:privacy@theblacqlist.com"
                className="text-brand-black underline underline-offset-2 hover:text-amber transition-colors"
              >
                privacy@theblacqlist.com
              </a>
            </p>
          </section>

          <div className="mt-16 pt-8 border-t border-gray-200 flex flex-col gap-3 sm:flex-row sm:gap-8">
            <Link href="/privacy" className="text-amber font-bold text-lg hover:underline">
              Read our Privacy Policy →
            </Link>
            <Link href="/terms" className="text-amber font-bold text-lg hover:underline">
              Read our Terms of Service →
            </Link>
          </div>
        </div>
      </Section>
    </>
  )
}
