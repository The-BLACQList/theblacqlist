import type { ReactNode } from 'react'
import Link from 'next/link'
import { Section } from '@/components/layout/section'
import { PageHeader } from '@/components/layout/page-header'
import { PRIVACY_PROVIDERS_UPDATE, type PolicyVersion } from '@/lib/legal/policyUpdate'

interface PrivacyPolicyProps {
  /** `current` is the June 30 text. `next` adds the October 2026 update (ticket 139). */
  version: PolicyVersion
  /** Shown under the title, for the "update coming" or "preview" note. */
  notice?: ReactNode
}

// [Needs professional review] Everything inside an `isNext` block is the
// October 2026 update from docs/blacqlist/legal/ai-and-site-import-policy-update-2026-10.md.
// Counsel reviews it before the notice email goes out.
export function PrivacyPolicy({ version, notice }: PrivacyPolicyProps) {
  const isNext = version === 'next'
  return (
    <>
      <Section variant="pale-lavender">
        <PageHeader
          title="Privacy Policy"
          subtitle={
            isNext
              ? `Last updated: ${PRIVACY_PROVIDERS_UPDATE.postedOnLabel}`
              : 'Last updated: June 30, 2026'
          }
        />
        {notice}
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
              platform at theblacqlist.com, {isNext ? (
                <>
                  a directory and discovery platform that centers Black-owned businesses across the
                  United States, along with Ally businesses that support them.
                </>
              ) : (
                <>a directory and discovery platform dedicated to Black-owned businesses across the United States.</>
              )}{' '}
              This Privacy Policy explains how we collect, use,
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

            {isNext && (
              <>
                <h3 className="font-subhead font-semibold text-brand-black mt-4">Information from a website you give us</h3>
                <p>
                  If you own a business and give us a link to your business website or link-in-bio
                  page, we read that public page when you ask. We look for things you&apos;ve already
                  published there, like your business name, description, phone number, email,
                  address, hours, social links, and photos. See{' '}
                  <a href="#bringing-in-your-website" className="text-amber hover:underline">
                    &ldquo;Bringing in your website&rdquo;
                  </a>{' '}
                  in Section 3.
                </p>
              </>
            )}

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
              {isNext && (
                <>
                  <li>Fill in your business page draft from a public web page you point us to, when you ask</li>
                  <li>
                    Offer optional AI writing help to business owners (see{' '}
                    <a href="#ai-writing-help" className="text-amber hover:underline">&ldquo;AI writing help&rdquo;</a>{' '}
                    below)
                  </li>
                </>
              )}
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

            {isNext && (
              <>
                <h3 id="bringing-in-your-website" className="font-subhead font-semibold text-brand-black mt-6 scroll-mt-24">
                  Bringing in your website (business owners only)
                </h3>
                <p>
                  When you add a business, you can give us a link to your business website or
                  link-in-bio page instead of typing everything.
                </p>
                <p>
                  We read the public page you give us once, when you ask. Nothing is copied that you
                  don&apos;t pick.
                </p>
                <ul className="list-disc list-inside space-y-1 pl-2">
                  <li>We read the page the way a visitor&apos;s browser would. We follow the site&apos;s robots.txt rules, we don&apos;t log in, and we don&apos;t use cookies.</li>
                  <li>What we find shows up in your draft so you can check it, change it, or remove it. Only what you save becomes part of your page.</li>
                  <li>Photos are copied to our storage only if you pick them. Before we save a photo, we remove its location data (like GPS) and other hidden details stored in the file.</li>
                  <li>We note which website a page was set up from, so our team can spot a page set up from someone else&apos;s site.</li>
                  <li>We don&apos;t keep a copy of the web page itself.</li>
                </ul>

                <h3 id="ai-writing-help" className="font-subhead font-semibold text-brand-black mt-6 scroll-mt-24">
                  AI writing help (business owners only)
                </h3>
                <p>
                  If you use our writing help when you set up or manage a business page, we send some
                  of your business information to Anthropic, the company that makes the Claude AI
                  model, so it can suggest drafts. Drafts can include a tagline, an About section, a
                  search title and description, and a category for your business.
                </p>
                <p>
                  <strong>What we send:</strong> your business name, your city, category names, and
                  the words you type or bring in from your website to describe your business. Before
                  we send those words, we cut them to 500 characters and take out anything that looks
                  like an email address, a phone number, or a street address, along with your name.
                  If your name is part of your business name, it stays in the business name. Our
                  filter can miss things, so leave out anything you don&apos;t want shared. For a page that&apos;s already live, the writing help can also use your current
                  tagline and About text, and simple totals like how many people viewed your page in
                  the last 30 days. It never gets anything about who those people are.
                </p>
                <p>
                  <strong>What we never add:</strong> we don&apos;t attach your account name, your email
                  address, your phone number, your street address, your password or login details, or
                  your receipts to what we send.
                </p>
                <p>
                  <strong>You decide what&apos;s used.</strong> Nothing an AI writes goes on your page
                  until you choose to use it. You can edit a draft, ask for another, or skip it. AI
                  drafts can be wrong, so read them before you use them.
                </p>
                <p>
                  {/* [VERIFY BEFORE POSTING] Add Anthropic's current commercial terms for our
                      account (training use, retention) once confirmed. No number from memory. */}
                  <strong>What Anthropic does with it:</strong> Anthropic handles this information for
                  us as a service provider, under a contract that limits what it can do with it. You
                  can read{' '}
                  <a
                    href="https://www.anthropic.com/legal/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Anthropic's privacy policy (opens in new window)"
                    className="text-amber hover:underline"
                  >
                    Anthropic&apos;s privacy policy
                  </a>
                  .
                </p>
                <p>
                  <strong>What we keep:</strong> a record that a draft was requested (which tool, when,
                  and how much text, by count only). We don&apos;t keep the text we send. Drafts you
                  don&apos;t use during page setup aren&apos;t saved. Suggestions on your owner
                  dashboard are saved to your account so you can review them, stop working after 7
                  days, and are deleted if the listing is deleted.
                </p>
                <p>
                  <strong>It&apos;s optional.</strong> You can set up and run your page without it.
                </p>
                <p>
                  <strong>The home page guide.</strong> If you type what you need into the guide on our
                  home page, we send those words to Anthropic so it can match them to our categories
                  and cities. Before we send them, we take out anything that looks like an email
                  address, a phone number, a street address, or a link. We don&apos;t save what you
                  type, and we don&apos;t link it to you or your account. We only keep a record that
                  the guide was used (when, and whether it worked). If you tap Near me under the
                  guide, we round your location to about a city block and use it only to sort that
                  search by distance. We don&apos;t send it to Anthropic and we don&apos;t save it. If
                  you&apos;d rather not use AI, our{' '}
                  <Link href="/search" className="text-brand-black underline underline-offset-2 hover:text-amber transition-colors">
                    Search page
                  </Link>{' '}
                  works without it.
                </p>
              </>
            )}
          </section>

          {/* [Needs professional review] The aggregation opt-out described in this
              section and in the §8 rights list was corrected (founder decision
              2026-08-17, merged 2026-10-19). Both previously promised an
              account-settings opt-out available "at any time"; the product
              provides a per-receipt choice that locks when a reviewer approves the
              receipt (lib/actions/spend/updateReceiptSubmission.ts). A stated data
              right that is narrower than it was is a change counsel should see,
              particularly against CCPA/GDPR erasure expectations.
              tests/opt-out-copy.test.ts pins this wording to the guard that
              enforces it. */}
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
              The choice about community aggregation belongs to each receipt individually. You make it
              when you submit the receipt, and you may change it from Account &rarr; Receipts for as long
              as that receipt is still awaiting review. Once a reviewer approves a receipt, its choice is
              fixed, because the amount has by then been included in the totals.
            </p>
            <p>
              There is no account-wide setting, and no automated way to withdraw spend that has already
              been counted. If you need spend removed after approval, contact us at{' '}
              <a
                href="mailto:privacy@theblacqlist.com"
                className="text-brand-black underline underline-offset-2 hover:text-amber transition-colors"
              >
                privacy@theblacqlist.com
              </a>{' '}
              and we will process the request by hand.
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
                    <td className="border-b border-gray-200 p-3">
                      {isNext
                        ? 'Hosting, CDN, and privacy-friendly page analytics (Vercel Analytics and Speed Insights)'
                        : 'Hosting and CDN'}
                    </td>
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
                  <tr className={isNext ? 'border-b border-gray-200' : undefined}>
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
                  {isNext && (
                    <>
                      <tr>
                        <td className="border-b border-gray-200 p-3">Anthropic</td>
                        <td className="border-b border-gray-200 p-3">Optional AI writing help for business owners (drafts you choose whether to use), and the home page guide that matches what a visitor types to our categories and cities (not saved)</td>
                        <td className="border-b border-gray-200 p-3">
                          <a
                            href="https://www.anthropic.com/legal/privacy"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Anthropic privacy policy (opens in new window)"
                            className="text-amber hover:underline"
                          >
                            anthropic.com/legal/privacy
                          </a>
                        </td>
                      </tr>
                      <tr>
                        <td className="border-b border-gray-200 p-3">OpenStreetMap (Nominatim)</td>
                        <td className="border-b border-gray-200 p-3">Puts business addresses on the map, and finds the place name or ZIP code you type into the map search. It gets only the address or the words you typed, sent from our server</td>
                        <td className="border-b border-gray-200 p-3">
                          <a
                            href="https://osmfoundation.org/wiki/Privacy_Policy"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="OpenStreetMap Foundation privacy policy (opens in new window)"
                            className="text-amber hover:underline"
                          >
                            osmfoundation.org/wiki/Privacy_Policy
                          </a>
                        </td>
                      </tr>
                      <tr>
                        <td className="p-3">Cloudflare Turnstile</td>
                        <td className="p-3">Checks that a person, not a bot, is using our sign-up, sign-in, password reset, claim, review, correction, and waitlist forms</td>
                        <td className="p-3">
                          <a
                            href="https://www.cloudflare.com/privacypolicy/"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Cloudflare privacy policy (opens in new window)"
                            className="text-amber hover:underline"
                          >
                            cloudflare.com/privacypolicy
                          </a>
                          {' and the '}
                          <a
                            href="https://www.cloudflare.com/turnstile-privacy-policy/"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Cloudflare Turnstile privacy addendum (opens in new window)"
                            className="text-amber hover:underline"
                          >
                            Turnstile privacy addendum
                          </a>
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
            {isNext && (
              <p>
                On some forms, Cloudflare Turnstile checks that you&apos;re a person and not a bot. To
                do this, Cloudflare&apos;s script runs in your browser and Cloudflare receives
                technical information like your IP address and details about your browser and device.
                We only get back a pass or fail answer.
              </p>
            )}
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
              {isNext && (
                <>
                  <li>When you bring in your website, we don&apos;t keep a copy of the page. We keep only what you save to your page, plus a note of which website it came from.</li>
                  <li>For AI writing help, we keep a record that a draft was requested, without the text. If you delete your account, your name is removed from those records.</li>
                </>
              )}
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
              <li><strong>Opt-out of aggregation:</strong> Choose, for each receipt you submit, whether it is included in community aggregate totals &mdash; changeable from Account &rarr; Receipts until that receipt is approved (see Section 4)</li>
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
