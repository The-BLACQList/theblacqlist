import type { Metadata } from 'next'
import Link from 'next/link'
import { Section } from '@/components/layout/section'
import { PageHeader } from '@/components/layout/page-header'

export const metadata: Metadata = {
  title: 'Terms of Service | The BLACQList',
  description: 'The terms governing your use of The BLACQList platform.',
  robots: { index: true, follow: true },
}

export const revalidate = false

export default function TermsPage() {
  return (
    <>
      <Section variant="pale-lavender">
        <PageHeader title="Terms of Service" subtitle="Last updated: June 30, 2026" />
      </Section>

      <Section variant="white">
        <div className="max-w-2xl space-y-10 font-body text-charcoal leading-relaxed">
          <nav aria-label="Page contents" className="rounded-xl border border-gray-100 bg-white px-5 py-4">
            <p className="font-subhead text-sm font-semibold text-brand-black mb-3">Contents</p>
            <ol className="list-decimal ml-5 space-y-1 text-sm">
              <li><a href="#acceptance" className="text-amber hover:underline">Acceptance of Terms</a></li>
              <li><a href="#the-platform" className="text-amber hover:underline">The Platform</a></li>
              <li><a href="#user-accounts" className="text-amber hover:underline">User Accounts</a></li>
              <li><a href="#business-listings" className="text-amber hover:underline">Business Listings</a></li>
              <li><a href="#community-content" className="text-amber hover:underline">Community Content</a></li>
              <li><a href="#receipt-data" className="text-amber hover:underline">Receipt and Spend Data</a></li>
              <li><a href="#prohibited-uses" className="text-amber hover:underline">Prohibited Uses</a></li>
              <li><a href="#intellectual-property" className="text-amber hover:underline">Intellectual Property</a></li>
              <li><a href="#disclaimers" className="text-amber hover:underline">Disclaimers</a></li>
              <li><a href="#limitation-of-liability" className="text-amber hover:underline">Limitation of Liability</a></li>
              <li><a href="#termination" className="text-amber hover:underline">Termination</a></li>
              <li><a href="#governing-law" className="text-amber hover:underline">Governing Law</a></li>
              <li><a href="#changes" className="text-amber hover:underline">Changes to Terms</a></li>
              <li><a href="#contact" className="text-amber hover:underline">Contact</a></li>
            </ol>
          </nav>

          <section id="acceptance" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">1. Acceptance of Terms</h2>
            <p>
              By accessing or using The BLACQList (&ldquo;the Platform&rdquo;), you agree to be bound
              by these Terms of Service (&ldquo;Terms&rdquo;) and our{' '}
              <Link href="/privacy" className="text-brand-black underline underline-offset-2 hover:text-amber transition-colors">
                Privacy Policy
              </Link>
              , which is incorporated by reference. If you do not agree to these Terms, do not use
              the Platform.
            </p>
            <p>
              These Terms apply to all visitors, registered users, business owners who create or
              claim listings, and any other person who accesses or uses the Platform. By creating
              an account or submitting a listing, you represent that you are at least 18 years of
              age and have the legal authority to enter into this agreement.
            </p>
          </section>

          <section id="the-platform" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">2. The Platform</h2>
            <p>
              The BLACQList is a directory and discovery platform for Black-owned businesses in the
              United States. We provide tools that allow businesses to create, manage, and promote
              their listings, and that allow community members to discover, save, review, and support
              those businesses.
            </p>
            <p>
              The BLACQList does not independently verify all information submitted by business
              owners. Listings with a &ldquo;Verified&rdquo; or &ldquo;BLACQList Certified&rdquo;
              badge have been reviewed through our verification process, but we cannot guarantee
              the accuracy of any listing information. Users should verify business information
              independently before transacting.
            </p>
          </section>

          <section id="user-accounts" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">3. User Accounts</h2>
            <p>To create an account, you must:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Provide accurate, complete, and current registration information</li>
              <li>Be at least 18 years of age</li>
              <li>Keep your account credentials secure and not share them with others</li>
              <li>Notify us immediately of any unauthorized use of your account at{' '}
                <a href="mailto:support@theblacqlist.com" className="text-brand-black underline underline-offset-2 hover:text-amber transition-colors">
                  support@theblacqlist.com
                </a>
              </li>
            </ul>
            <p>
              You are responsible for all activity that occurs under your account, whether or not
              you authorized it. We will not be liable for losses arising from unauthorized use of
              your account where you failed to maintain the security of your credentials.
            </p>
            <p>
              You may not create more than one account per person. Accounts created to circumvent
              suspension or to misrepresent business ownership are prohibited.
            </p>
          </section>

          {/* [Needs professional review] The §4 ownership definitions and the
              label-conditional warranty below are legally load-bearing (they interact
              with the §1981 / editorial-directory analysis in
              docs/blacqlist/legal/legal-pages-and-discrimination-risk-review.md and the
              attorney redline). Have counsel review before this ships to production. */}
          <section id="business-listings" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">4. Business Listings</h2>
            <p>
              <strong>Editorial focus.</strong> The BLACQList is an editorial directory that centers
              and elevates Black-owned businesses. Every business is labeled either
              &ldquo;Black-Owned&rdquo; or &ldquo;Ally.&rdquo; &ldquo;Black-Owned&rdquo; means a
              business in which Black or African American individual(s) hold majority ownership
              (≥51%) and exercise meaningful operational control or management authority.
              &ldquo;Ally&rdquo; means a business that supports Black-owned businesses but is not
              itself majority Black-owned. How listings are presented, prioritized, and featured is
              an editorial decision. We reserve the right to decline, remove, or re-label any
              submission, and to exercise that discretion without prior notice and without liability.
            </p>
            <p>Business owners who create or claim listings represent and warrant that:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>They have authority to represent the business (as an owner, partner, or authorized agent)</li>
              <li>All information submitted is accurate, complete, and not misleading</li>
              <li>
                The ownership label they select is accurate: a &ldquo;Black-Owned&rdquo; listing is
                genuinely majority Black-owned (≥51% Black or African American ownership and
                operational control), and an &ldquo;Ally&rdquo; listing supports Black-owned
                businesses and is not itself majority Black-owned
              </li>
              <li>Any images, logos, or content submitted do not violate third-party intellectual property rights</li>
              <li>The business is operating lawfully and in compliance with applicable laws</li>
            </ul>
            <p>
              We reserve the right to remove, modify, or decline any listing that violates these
              Terms, contains false or misleading information, is submitted fraudulently, or is
              otherwise inconsistent with the purpose and values of the Platform. We may exercise
              this right without prior notice and without liability to you.
            </p>
            <p>
              Business listing content you make public (business name, description, address, hours,
              contact information, and photos) may be indexed by search engines and distributed by
              third-party data aggregators. We are not responsible for how third parties use
              publicly listed information.
            </p>
          </section>

          <section id="community-content" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">5. Community Content</h2>
            <p>
              By submitting reviews, receipts, photos, or other content to the Platform
              (&ldquo;User Content&rdquo;), you grant The BLACQList a non-exclusive, worldwide,
              royalty-free, perpetual license to use, reproduce, display, distribute, and prepare
              derivative works of that content solely for the purpose of operating and improving
              the Platform. You retain ownership of your User Content.
            </p>
            <p>You represent that your User Content:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Is accurate to the best of your knowledge</li>
              <li>Does not infringe any third party&apos;s intellectual property, privacy, or publicity rights</li>
              <li>Does not contain false, defamatory, harassing, abusive, or discriminatory material</li>
              <li>Is not spam or commercially motivated beyond genuine community sharing</li>
              <li>Does not violate any applicable law or regulation</li>
            </ul>
            <p>
              We reserve the right to review, moderate, edit, or remove User Content that violates
              these Terms or our community standards.
            </p>
          </section>

          <section id="receipt-data" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">6. Receipt and Spend Data</h2>
            <p>When you submit receipts through the community spend feature, you confirm that:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>The receipt represents a genuine transaction you made</li>
              <li>You are the submitting party and have the right to upload the receipt</li>
              <li>You consent to your spend data being reviewed by our team for verification purposes</li>
              <li>You consent to your anonymized spend data being included in community aggregate totals, unless you opt out in your account settings</li>
            </ul>
            <p>
              Submitting fraudulent receipts, receipts for transactions you did not make, or
              doctored receipts is a material breach of these Terms and may result in immediate
              account termination and referral to appropriate authorities.
            </p>
          </section>

          <section id="prohibited-uses" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">7. Prohibited Uses</h2>
            <p>You may not use the Platform to:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Scrape, crawl, or systematically extract data without our prior written permission</li>
              <li>Submit false, fraudulent, or misleading business claims or listing information</li>
              <li>Submit fraudulent receipts or spend data</li>
              <li>Attempt to gain unauthorized access to any part of the Platform, its systems, or other users&apos; accounts</li>
              <li>Interfere with, disrupt, or degrade the Platform&apos;s operation or other users&apos; experience</li>
              <li>Use the Platform for any unlawful purpose or in violation of applicable law</li>
              <li>Harass, threaten, or intimidate other users or business owners</li>
              <li>Impersonate another person or entity</li>
              <li>Post content containing viruses, malware, or other harmful code</li>
            </ul>
          </section>

          <section id="intellectual-property" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">8. Intellectual Property</h2>
            <p>
              The BLACQList name, logo, wordmark, design system, platform software, and all original
              Platform content created by us are owned by The BLACQList and protected by copyright,
              trademark, and other intellectual property laws. You may not reproduce, distribute,
              modify, or create derivative works from our proprietary content without our prior
              written permission.
            </p>
            <p>
              Business listing content uploaded by business owners (business name, description,
              photos, logos) remains the property of those business owners, subject to the license
              granted in Section 5.
            </p>
            <h3 className="font-subhead font-semibold text-brand-black mt-4">
              Copyright complaints (DMCA)
            </h3>
            <p>
              We respect intellectual property rights and respond to valid notices of alleged
              copyright infringement. If you believe content on the Platform infringes your
              copyright, send a written notice to our designated agent at{' '}
              <a
                href="mailto:notice@theblacqlist.com"
                className="text-brand-black underline underline-offset-2 hover:text-amber transition-colors"
              >
                notice@theblacqlist.com
              </a>{' '}
              including: your contact information, identification of the copyrighted work, the
              location of the allegedly infringing material on the Platform, a statement of good-faith
              belief that the use is unauthorized, a statement under penalty of perjury that your
              notice is accurate and you are authorized to act, and your physical or electronic
              signature. We will remove infringing material in appropriate cases and may terminate
              the accounts of repeat infringers.
            </p>
            <p className="text-sm text-charcoal-soft">
              Our designated agent for copyright notices is The BLACQList, LLC, registered with the
              U.S. Copyright Office (Registration No. DMCA-1074879). Written notices may be sent to
              the designated agent at notice@theblacqlist.com or by mail at 3133 Maple Dr NE, Ste 240
              #1130, Atlanta, GA 30305.
            </p>
          </section>

          <section id="disclaimers" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">9. Disclaimers</h2>
            <p>
              The Platform is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without
              warranties of any kind, either express or implied, including but not limited to implied
              warranties of merchantability, fitness for a particular purpose, or non-infringement.
            </p>
            <p>We do not warrant that:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Listing information is accurate, complete, or current</li>
              <li>The Platform will be uninterrupted, error-free, or secure</li>
              <li>Any goods or services offered by listed businesses meet any particular standard of quality</li>
            </ul>
            <p>
              The BLACQList is not a party to any transaction between users and listed businesses.
              We are not responsible for the quality, safety, legality, or any other aspect of
              goods or services offered by businesses listed on the Platform. Always verify
              business information independently before transacting.
            </p>
          </section>

          <section id="limitation-of-liability" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">10. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by applicable law, The BLACQList and its officers,
              directors, employees, and agents shall not be liable for any indirect, incidental,
              special, consequential, or punitive damages, including but not limited to loss of
              profits, data, goodwill, or other intangible losses, arising from:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Your access to or use of (or inability to access or use) the Platform</li>
              <li>Any conduct or content of third parties on the Platform</li>
              <li>Inaccurate business listing information submitted by third parties</li>
              <li>Unauthorized access to or alteration of your data</li>
            </ul>
            <p>
              Our total liability to you for all claims arising from or relating to these Terms or
              the Platform shall not exceed the greater of (a) $100 USD or (b) the total amount
              you paid to The BLACQList in the twelve months preceding the claim.
            </p>
            <p>
              Some jurisdictions do not allow the exclusion of certain warranties or limitations
              of liability, so some of the above limitations may not apply to you.
            </p>
          </section>

          <section id="termination" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">11. Termination</h2>
            <p>
              We may suspend or terminate your account or access to the Platform at any time, with
              or without notice, for violation of these Terms, fraudulent activity, conduct harmful
              to other users or the Platform, or for any other reason at our discretion.
            </p>
            <p>
              You may delete your account at any time through your account settings. Upon account
              deletion, your personal information will be removed as described in our Privacy Policy.
              Publicly indexed listing content may persist in search engine caches beyond our control.
            </p>
            <p>
              Provisions that by their nature should survive termination will survive, including
              Sections 5, 8, 9, 10, and 12.
            </p>
          </section>

          <section id="governing-law" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">12. Governing Law</h2>
            <p>
              These Terms are governed by and construed in accordance with the laws of the United
              States and the state of Georgia, without regard to its conflict of law principles.
              Any disputes arising from or relating to these Terms or the Platform shall be subject
              to the exclusive jurisdiction of the state and federal courts located in Georgia.
            </p>
            <p>
              If any provision of these Terms is found to be unenforceable, the remaining provisions
              will remain in full force and effect.
            </p>
          </section>

          <section id="changes" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">13. Changes to Terms</h2>
            <p>
              We may update these Terms at any time. We will notify registered users of material
              changes by email at least 14 days before they take effect. The &ldquo;Last updated&rdquo;
              date at the top of this page reflects the most recent revision.
            </p>
            <p>
              Continued use of the Platform after changes take effect constitutes your acceptance
              of the updated Terms. If you do not agree to the updated Terms, you must stop using
              the Platform.
            </p>
          </section>

          <section id="contact" className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">14. Contact</h2>
            <p>
              Questions about these Terms:{' '}
              <a
                href="mailto:legal@theblacqlist.com"
                className="text-brand-black underline underline-offset-2 hover:text-amber transition-colors"
              >
                legal@theblacqlist.com
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
              href="/privacy"
              className="text-amber font-bold text-lg hover:underline"
            >
              Read our Privacy Policy →
            </Link>
          </div>
        </div>
      </Section>
    </>
  )
}
