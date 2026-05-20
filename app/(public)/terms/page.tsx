import type { Metadata } from "next"
import { Section } from "@/components/layout/section"
import { PageHeader } from "@/components/layout/page-header"

export const metadata: Metadata = {
  title: "Terms of Service | The BLACQList",
  description: "The terms governing your use of The BLACQList platform.",
}

export default function TermsPage() {
  return (
    <>
      <Section variant="pale-lavender">
        <PageHeader
          title="Terms of Service"
          subtitle="Last updated: May 2026"
        />
      </Section>

      <Section variant="white">
        <div className="max-w-2xl space-y-10 font-body text-charcoal leading-relaxed">

          <div className="rounded-xl border border-amber-gold/30 bg-amber-gold/5 px-5 py-4">
            <p className="font-subhead text-sm font-semibold text-brand-black">
              Legal review required
            </p>
            <p className="font-body text-sm text-charcoal mt-1">
              This page contains placeholder terms. Have a qualified attorney review and finalize
              this document before public launch.
            </p>
          </div>

          <section className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">1. Acceptance of Terms</h2>
            <p>
              By accessing or using The BLACQList (&ldquo;the Platform&rdquo;), you agree to be bound by these Terms of Service.
              If you do not agree, do not use the Platform. These terms apply to all visitors, registered users, and
              business owners who create or claim listings.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">2. The Platform</h2>
            <p>
              The BLACQList is a directory and discovery platform for Black-owned businesses in the United States.
              We provide tools for businesses to create, manage, and promote their listings, and for community
              members to discover and support those businesses.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">3. User Accounts</h2>
            <p>To create an account, you must:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Provide accurate and complete registration information</li>
              <li>Be at least 18 years of age</li>
              <li>Keep your password secure and not share it with others</li>
              <li>Notify us immediately of any unauthorized access to your account</li>
            </ul>
            <p>You are responsible for all activity that occurs under your account.</p>
          </section>

          <section className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">4. Business Listings</h2>
            <p>
              Business owners who create or claim listings represent and warrant that:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>They have authority to represent the business</li>
              <li>All information submitted is accurate and not misleading</li>
              <li>The business is genuinely Black-owned as represented</li>
              <li>Any images submitted do not violate third-party intellectual property rights</li>
            </ul>
            <p>
              We reserve the right to remove or modify any listing that violates these terms, contains false
              information, or is otherwise inconsistent with the purpose of the Platform.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">5. Community Content</h2>
            <p>
              By submitting reviews, receipts, or other community content, you grant The BLACQList a
              non-exclusive, worldwide, royalty-free license to use, display, and distribute that content
              on the Platform. You retain ownership of your content.
            </p>
            <p>You may not submit content that is:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>False, defamatory, or misleading</li>
              <li>Harassing, abusive, or discriminatory</li>
              <li>In violation of any third party&apos;s rights</li>
              <li>Spam or commercially motivated beyond genuine sharing</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">6. Receipt and Spend Data</h2>
            <p>
              When you submit receipts through the community spend feature, you confirm that:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>The receipt represents a genuine transaction you made</li>
              <li>You are the submitting party</li>
              <li>You consent to your spend data being included in anonymized community aggregates (unless you opt out)</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">7. Prohibited Uses</h2>
            <p>You may not use the Platform to:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Scrape, crawl, or systematically extract data without written permission</li>
              <li>Submit false or fraudulent business claims</li>
              <li>Attempt to gain unauthorized access to any part of the Platform</li>
              <li>Interfere with the Platform&apos;s operation or other users&apos; experience</li>
              <li>Use the Platform for any unlawful purpose</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">8. Intellectual Property</h2>
            <p>
              The BLACQList name, logo, and original Platform content are owned by The BLACQList and protected
              by intellectual property laws. Business listing content uploaded by business owners remains the
              property of those business owners.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">9. Disclaimers</h2>
            <p>
              The Platform is provided &ldquo;as is.&rdquo; We do not warrant that listing information is accurate,
              complete, or current. We are not responsible for the quality of goods or services offered by
              listed businesses. Always verify business information independently before transacting.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">10. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, The BLACQList shall not be liable for indirect, incidental,
              special, or consequential damages arising from your use of the Platform. Our total liability to you
              shall not exceed the amount you paid us in the twelve months preceding the claim.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">11. Termination</h2>
            <p>
              We may suspend or terminate your account at any time for violation of these terms. You may
              delete your account at any time from your account settings. Termination does not affect any
              public listing data that has already been indexed by search engines.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">12. Changes to Terms</h2>
            <p>
              We may update these terms at any time. We will notify users of material changes by email.
              Continued use of the Platform after changes take effect constitutes acceptance.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">13. Contact</h2>
            <p>
              Questions about these terms:{" "}
              <a href="mailto:legal@theblacqlist.com" className="text-brand-black underline underline-offset-2 hover:text-amber-gold transition-colors">
                legal@theblacqlist.com
              </a>
            </p>
          </section>

        </div>
      </Section>
    </>
  )
}
