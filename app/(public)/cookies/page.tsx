import type { Metadata } from 'next'
import { Section } from '@/components/layout/section'
import { PageHeader } from '@/components/layout/page-header'

export const metadata: Metadata = {
  title: 'Cookie Policy | The BLACQList',
  description: 'How The BLACQList uses cookies and similar tracking technologies.',
}

export default function CookiesPage() {
  return (
    <>
      <Section variant="pale-lavender">
        <PageHeader title="Cookie Policy" subtitle="Last updated: May 2026" />
      </Section>

      <Section variant="white">
        <div className="max-w-2xl space-y-10 font-body text-charcoal leading-relaxed">
          <div className="rounded-xl border border-amber-gold/30 bg-amber-gold/5 px-5 py-4">
            <p className="font-subhead text-sm font-semibold text-brand-black">
              Legal review required
            </p>
            <p className="font-body text-sm text-charcoal mt-1">
              This page contains placeholder cookie policy content. Have a qualified attorney review
              and finalize this document before public launch.
            </p>
          </div>

          <section className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">What Are Cookies</h2>
            <p>
              Cookies are small text files stored on your device when you visit a website. They help
              the website remember your preferences, keep you signed in, and understand how you use
              the platform.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">Cookies We Use</h2>

            <div className="space-y-6">
              <div>
                <h3 className="font-subhead font-semibold text-brand-black mb-2">
                  Essential cookies
                </h3>
                <p>
                  These cookies are required for the platform to function. They manage your
                  authentication session and keep you signed in between pages. You cannot opt out of
                  essential cookies while using the platform.
                </p>
                <ul className="list-disc list-inside space-y-1 pl-2 mt-2 text-sm">
                  <li>
                    <strong>sb-access-token</strong> — Supabase session token (authentication)
                  </li>
                  <li>
                    <strong>sb-refresh-token</strong> — Session refresh token
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-subhead font-semibold text-brand-black mb-2">
                  Analytics cookies
                </h3>
                <p>
                  We use Vercel Analytics to understand how users interact with the platform. This
                  data is anonymized and does not include personally identifiable information.
                  Vercel Analytics uses a privacy-preserving approach that does not require
                  traditional cookies.
                </p>
              </div>

              <div>
                <h3 className="font-subhead font-semibold text-brand-black mb-2">Error tracking</h3>
                <p>
                  We use Sentry for error tracking to identify and fix technical issues. Sentry may
                  set a session identifier to correlate errors within a single session.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">What We Do Not Use</h2>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>No advertising or retargeting cookies</li>
              <li>No third-party social media tracking pixels</li>
              <li>No cookies that build personal behavioral profiles</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">Managing Cookies</h2>
            <p>
              You can control cookies through your browser settings. Most browsers allow you to
              block or delete cookies. Note that blocking essential cookies will prevent you from
              signing in to the platform.
            </p>
            <p>
              For guidance on managing cookies in your browser, visit your browser&apos;s help
              documentation.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">Contact</h2>
            <p>
              Questions about our use of cookies:{' '}
              <a
                href="mailto:privacy@theblacqlist.com"
                className="text-brand-black underline underline-offset-2 hover:text-amber-gold transition-colors"
              >
                privacy@theblacqlist.com
              </a>
            </p>
          </section>
        </div>
      </Section>
    </>
  )
}
