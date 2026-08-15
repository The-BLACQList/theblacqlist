import type { Metadata } from 'next'
import Link from 'next/link'
import { Section } from '@/components/layout/section'
import { PageHeader } from '@/components/layout/page-header'

export const metadata: Metadata = {
  title: 'Privacy Policy | The BLACQList',
  description: 'How The BLACQList collects, uses, and protects your personal information.',
  robots: { index: true, follow: true },
}

export const revalidate = false

export default function PrivacyPage() {
  return (
    <>
      <Section variant="pale-lavender">
        <PageHeader title="Privacy Policy" subtitle="Last updated: June 30, 2026" />
      </Section>

      <Section variant="white">
        <div className="max-w-2xl space-y-10 font-body text-charcoal leading-relaxed">
          <nav aria-label="Page contents" className="rounded-xl border border-gray-100 bg-white px-5 py-4">
            <p className="font-subhead text-sm font-semibold text-brand-black mb-3">Contents</p>
            <ol className="list-decimal ml-5 space-y-1 text-sm">
              <li><a href="#who-we-are" className="text-amber hover:underline">Who We Are</a></li>
              <li><a href="#information-collected" className="text-amber hover:underline">Information We Collect</a></li>
              <li><a href="#how-we-use" className="text-amber hover:underline">How We Use Your Information</a></li>
              <li><a href="#receipt-data" className="text-amber hover:underline">Receipt and Spend Data</a></li>
              <li><a href="#information-sharing" className="text-amber hover:underline">Information Sharing</a></li>
              <li><a href="#third-party-services" className="text-amber hover:underline">Third-Party Services</a></li>
              <li><a href="#data-retention" className="text-amber hover:underline">Data Retention</a></li>
              <li><a href="#your-rights" className="text-amber hover:underline">Your Rights</a></li>
              <li><a href="#security" className="text-amber hover:underline">Security</a></li>
              <li><a href="#changes" className="text-amber hover:underline">Changes to This Policy</a></li>
              <li><a href="#contact" className="text-amber hover:underline">Contact Us</a></li>
            </ol>
          </nav>

          <section id="who-we-are" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">1. Who We Are</h2>
            <p>
              The BLACQList (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) operates the
              platform at theblacqlist.com, a directory and discovery platform dedicated to Black-owned
              businesses across the United States. This Privacy Policy explains how we collect, use,
              disclose, and safeguard your information when you visit or use our platform. Questions
              about this policy can be directed to{' '}
              <a
                href="mailto:privacy@theblacqlist.com"
                className="text-brand-black underline underline-offset-2 hover:text-amber transition-colors"
              >
                privacy@theblacqlist.com
              </a>
              .
            </p>
          </section>

          <section id="information-collected" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">2. Information We Collect</h2>

            <h3 className="font-subhead font-semibold text-brand-black">Information you provide directly</h3>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Account registration information (name, email address, password)</li>
              <li>Business listing information (business name, description, address, photos, hours, contact details) when you create or claim a listing</li>
              <li>Receipt and spend data when you submit receipts through the community spend feature</li>
              <li>Reviews and community content you submit</li>
              <li>Communications you send to us through email or support channels</li>
            </ul>

            <h3 className="font-subhead font-semibold text-brand-black mt-4">Information collected automatically</h3>
            <p>When you use the platform, we automatically collect:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Log data (browser type, operating system, referring URLs, pages visited, time and date of your visit). Your IP address is used transiently to deliver and secure the service and, where recorded for analytics, is stored only in irreversible hashed form. We do not retain your raw IP address</li>
              <li>Usage data (search queries, listings viewed, saves, clicks on calls-to-action), stored in anonymized form</li>
              <li>Device information (device type, screen resolution)</li>
              <li>Session authentication tokens managed through cookies (see our <Link href="/cookies" className="text-brand-black underline underline-offset-2 hover:text-amber transition-colors">Cookie Policy</Link>)</li>
            </ul>
          </section>

          <section id="how-we-use" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Create and maintain your account and business listings</li>
              <li>Process and verify business claim submissions</li>
              <li>Display business listing content to visitors searching the platform</li>
              <li>Send transactional emails you have requested (account verification, claim status updates, password reset)</li>
              <li>Generate anonymized community spend data for public display on the Circulation Map</li>
              <li>Provide analytics to business owners about their listing performance (page views, saves, CTA clicks, all anonymized at the user level)</li>
              <li>Detect, investigate, and prevent fraudulent or unauthorized activity</li>
              <li>Improve platform performance and features</li>
              <li>Comply with applicable legal obligations</li>
            </ul>
            <p>
              We do not use your information for behavioral advertising, sell your data to data brokers,
              or share your information with third parties for their own marketing purposes.
            </p>
          </section>

          <section id="receipt-data" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">4. Receipt and Spend Data</h2>
            <p>
              Receipt uploads are stored privately and are never displayed publicly or shared with third parties
              beyond what is required for our platform to operate. We use receipt data solely to:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Verify the transaction and match it to a listed business</li>
              <li>Generate anonymized, aggregated community spend totals (e.g., &ldquo;$X tracked through the community this month&rdquo;)</li>
              <li>Display personal spend summaries to you in your account</li>
            </ul>
            <p>
              Individual receipt data (amounts, dates, specific businesses visited) is visible only to you.
              Aggregated data shown publicly contains no personally identifiable information and cannot be
              traced back to any individual.
            </p>
            <p>
              You may opt out of community spend aggregation at any time through your account settings.
              Opting out removes your spend data from future aggregate calculations; it does not delete
              historical records already incorporated into prior aggregates.
            </p>
          </section>

          <section id="information-sharing" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">5. Information Sharing</h2>
            <p>
              <strong>We do not sell your personal information.</strong> We share information only in
              the following circumstances:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>
                <strong>Service providers:</strong> We share information with companies that help us
                operate the platform (see Section 6 for the full list). These providers access your
                information only to perform services on our behalf and are contractually obligated to
                protect it.
              </li>
              <li>
                <strong>Business listing content you make public:</strong> When you create a listing,
                the business name, description, address, photos, hours, and contact information you
                submit are displayed publicly on the platform and may be indexed by search engines.
                This is the intended purpose of a business listing.
              </li>
              <li>
                <strong>Legal compliance:</strong> We may disclose information when required by law,
                court order, or government request, or when we believe disclosure is necessary to
                protect the rights, property, or safety of The BLACQList, our users, or the public.
              </li>
              <li>
                <strong>Business transfers:</strong> If The BLACQList is acquired, merged, or its
                assets are transferred, user information may be transferred as part of that transaction.
                We will notify registered users by email of any such change in ownership.
              </li>
            </ul>
          </section>

          <section id="third-party-services" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">6. Third-Party Services</h2>
            <p>
              We use the following third-party services to operate the platform. Each processes data
              according to their own privacy policies, which we link below.
            </p>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm border-collapse">
                <caption className="sr-only">Third-party services used by The BLACQList</caption>
                <thead>
                  <tr>
                    <th scope="col" className="bg-brand-black text-white p-3 text-left">Service</th>
                    <th scope="col" className="bg-brand-black text-white p-3 text-left">Purpose</th>
                    <th scope="col" className="bg-brand-black text-white p-3 text-left">Privacy Policy</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border-b border-gray-200 p-3">Supabase</td>
                    <td className="border-b border-gray-200 p-3">Database and authentication</td>
                    <td className="border-b border-gray-200 p-3">
                      <a
                        href="https://supabase.com/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Supabase privacy policy (opens in new window)"
                        className="text-amber hover:underline"
                      >
                        supabase.com/privacy
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td className="border-b border-gray-200 p-3">Vercel</td>
                    <td className="border-b border-gray-200 p-3">Hosting and CDN</td>
                    <td className="border-b border-gray-200 p-3">
                      <a
                        href="https://vercel.com/legal/privacy-policy"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Vercel privacy policy (opens in new window)"
                        className="text-amber hover:underline"
                      >
                        vercel.com/legal/privacy-policy
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td className="border-b border-gray-200 p-3">Resend</td>
                    <td className="border-b border-gray-200 p-3">Transactional email delivery</td>
                    <td className="border-b border-gray-200 p-3">
                      <a
                        href="https://resend.com/legal/privacy-policy"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Resend privacy policy (opens in new window)"
                        className="text-amber hover:underline"
                      >
                        resend.com/legal/privacy-policy
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td className="border-b border-gray-200 p-3">Sentry</td>
                    <td className="border-b border-gray-200 p-3">Error monitoring</td>
                    <td className="border-b border-gray-200 p-3">
                      <a
                        href="https://sentry.io/privacy/"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Sentry privacy policy (opens in new window)"
                        className="text-amber hover:underline"
                      >
                        sentry.io/privacy
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3">Stripe</td>
                    <td className="p-3">Payment processing, used when paid features become available</td>
                    <td className="p-3">
                      <a
                        href="https://stripe.com/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Stripe privacy policy (opens in new window)"
                        className="text-amber hover:underline"
                      >
                        stripe.com/privacy
                      </a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section id="data-retention" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">7. Data Retention</h2>
            <p>
              We retain your account data and personal information for as long as your account is
              active. If you delete your account:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Your profile and personal information will be deleted within 30 days</li>
              <li>Business listings you own may be retained in an anonymized or unclaimed state for the benefit of the directory (you may request full removal)</li>
              <li>Anonymized analytics data and aggregated spend totals that have already been incorporated into community statistics will not be retroactively removed</li>
              <li>We may retain certain records longer when required by law, for fraud prevention, or for legitimate business purposes such as resolving disputes</li>
            </ul>
          </section>

          <section id="your-rights" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">8. Your Rights</h2>
            <p>
              Depending on your location, you may have the following rights regarding your personal
              information:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
              <li><strong>Correction:</strong> Request correction of inaccurate or incomplete data</li>
              <li><strong>Deletion:</strong> Delete your account and personal data yourself from Account → Settings, or request deletion by email</li>
              <li><strong>Opt-out of aggregation:</strong> Opt your spend data out of community aggregation at any time from your account settings</li>
              <li><strong>Portability:</strong> Request a copy of your data; we will provide it in a structured, machine-readable format where technically feasible</li>
              <li><strong>Complaint:</strong> Lodge a complaint with a data protection supervisory authority in your jurisdiction</li>
            </ul>
            <p className="mt-2">
              <strong>California residents</strong> (CCPA): You have the right to know what personal
              information we collect, the right to delete it, and the right to opt out of its sale.
              We do not sell personal information. To exercise your rights, contact us at{' '}
              <a
                href="mailto:privacy@theblacqlist.com"
                className="text-brand-black underline underline-offset-2 hover:text-amber transition-colors"
              >
                privacy@theblacqlist.com
              </a>
              .
            </p>
            <p>
              To exercise any of these rights, email{' '}
              <a
                href="mailto:privacy@theblacqlist.com"
                className="text-brand-black underline underline-offset-2 hover:text-amber transition-colors"
              >
                privacy@theblacqlist.com
              </a>{' '}
              with the subject line &ldquo;Privacy Request.&rdquo; We will respond within 30 days.
            </p>
          </section>

          <section id="security" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">9. Security</h2>
            <p>
              We implement industry-standard security measures to protect your information, including:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Encryption in transit (HTTPS/TLS) for all platform traffic</li>
              <li>Row-level security policies on our database that restrict data access by user identity</li>
              <li>Access controls limiting staff access to personal data on a need-to-know basis</li>
              <li>Error monitoring to detect and respond to security incidents</li>
            </ul>
            <p>
              No method of transmission over the internet or electronic storage is 100% secure. While
              we use commercially reasonable measures to protect your information, we cannot guarantee
              absolute security.
            </p>
          </section>

          <section id="changes" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time to reflect changes in our practices,
              technology, legal requirements, or for other operational reasons. We will notify
              registered users of material changes by email at least 14 days before they take effect.
              The &ldquo;Last updated&rdquo; date at the top of this page reflects when the most
              recent revision was made.
            </p>
            <p>
              Your continued use of the platform after changes take effect constitutes acceptance of
              the updated Privacy Policy.
            </p>
          </section>

          <section id="contact" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">11. Contact Us</h2>
            <p>
              For privacy questions, rights requests, or concerns about how we handle your information:
            </p>
            <p>
              <strong>Email:</strong>{' '}
              <a
                href="mailto:privacy@theblacqlist.com"
                className="text-brand-black underline underline-offset-2 hover:text-amber transition-colors"
              >
                privacy@theblacqlist.com
              </a>
            </p>
            <p>
              <strong>The BLACQList</strong>, operated by The BLACQList, LLC
              <br />
              3133 Maple Dr NE, Ste 240 #1130
              <br />
              Atlanta, GA 30305
            </p>
          </section>

          <div className="mt-16 pt-8 border-t border-gray-200">
            <Link
              href="/terms"
              className="text-amber font-bold text-lg hover:underline"
            >
              Read our Terms of Service →
            </Link>
          </div>
        </div>
      </Section>
    </>
  )
}
