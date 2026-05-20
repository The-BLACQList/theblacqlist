import type { Metadata } from "next"
import { Section } from "@/components/layout/section"
import { PageHeader } from "@/components/layout/page-header"

export const metadata: Metadata = {
  title: "Privacy Policy | The BLACQList",
  description: "How The BLACQList collects, uses, and protects your personal information.",
}

export default function PrivacyPage() {
  return (
    <>
      <Section variant="pale-lavender">
        <PageHeader
          title="Privacy Policy"
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
              This page contains placeholder privacy terms. Have a qualified attorney review and finalize
              this document before public launch.
            </p>
          </div>

          <section className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">1. Who We Are</h2>
            <p>
              The BLACQList (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) operates the platform at theblacqlist.com.
              We are a directory and discovery platform dedicated to Black-owned businesses across the United States.
              Questions about this policy can be sent to{" "}
              <a href="mailto:privacy@theblacqlist.com" className="text-brand-black underline underline-offset-2 hover:text-amber-gold transition-colors">
                privacy@theblacqlist.com
              </a>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">2. Information We Collect</h2>
            <p>We collect information you provide directly, including:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Account information (name, email address, password) when you register</li>
              <li>Business information when you create or claim a listing</li>
              <li>Receipt and spend data when you submit receipts to the community spend tracker</li>
              <li>Communications you send to us</li>
            </ul>
            <p>We also collect information automatically when you use our platform, including:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Log data (IP address, browser type, pages visited, time spent)</li>
              <li>Analytics events (page views, search queries, clicks) — stored anonymously</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Provide, maintain, and improve the platform</li>
              <li>Process and verify business claims</li>
              <li>Send transactional emails (account verification, claim updates)</li>
              <li>Generate anonymized community spend data for public display</li>
              <li>Detect and prevent fraud or abuse</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">4. Receipt and Spend Data</h2>
            <p>
              Receipt uploads and spend events are private by default. Your individual receipts are never displayed publicly.
              We aggregate spend data into anonymized community totals. You may opt out of community aggregation at any time
              from your account settings — your historical data will be excluded from future aggregates.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">5. Information Sharing</h2>
            <p>
              We do not sell your personal information. We may share information with:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li><strong>Service providers</strong> who help us operate the platform (Supabase for data storage, Vercel for hosting, Resend for email delivery)</li>
              <li><strong>Business directory information</strong> you choose to make public (business name, address, description, photos) — this is public by design</li>
              <li><strong>Law enforcement or regulators</strong> when required by law</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">6. Data Retention</h2>
            <p>
              We retain your account data for as long as your account is active. If you delete your account, we will delete
              your personal data within 30 days, except where retention is required by law or for legitimate business purposes
              (such as fraud prevention).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">7. Your Rights</h2>
            <p>Depending on your location, you may have the right to:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Access the personal data we hold about you</li>
              <li>Correct inaccurate data</li>
              <li>Delete your account and personal data</li>
              <li>Opt out of community spend aggregation</li>
              <li>Lodge a complaint with a supervisory authority</li>
            </ul>
            <p>
              To exercise any of these rights, contact us at{" "}
              <a href="mailto:privacy@theblacqlist.com" className="text-brand-black underline underline-offset-2 hover:text-amber-gold transition-colors">
                privacy@theblacqlist.com
              </a>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">8. Security</h2>
            <p>
              We use industry-standard security measures including encryption in transit (HTTPS), encrypted storage,
              row-level security on our database, and access controls. No method of transmission over the internet
              is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify registered users of material changes
              by email. Your continued use of the platform after changes take effect constitutes acceptance of the
              updated policy.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-headline text-xl text-brand-black">10. Contact</h2>
            <p>
              For privacy questions or requests, contact us at{" "}
              <a href="mailto:privacy@theblacqlist.com" className="text-brand-black underline underline-offset-2 hover:text-amber-gold transition-colors">
                privacy@theblacqlist.com
              </a>.
            </p>
          </section>

        </div>
      </Section>
    </>
  )
}
