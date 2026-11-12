import type { Metadata } from 'next'

import { EmailPreviewForm } from '@/components/admin/EmailPreviewForm'

export const metadata: Metadata = { title: 'Email preview' }

/**
 * See a tester email exactly as a tester will, then copy it into Gmail. Two
 * emails: the invite for someone new, and the update for people already
 * testing (finish the guide, a first look at The Collective).
 *
 * No guard call here: app/admin/layout.tsx already awaits requireAdmin(), so
 * every page under /admin is behind it. The server action this page posts to
 * checks the session itself, because an action is its own endpoint and does
 * not inherit the layout's guard.
 *
 * This page renders and copies. It never sends: tester email goes from the
 * founder's own mailbox, one recipient at a time (GATE-COMMS).
 */
export default function AdminEmailPreviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-2xl text-brand-black">Email preview</h1>
        <p className="font-subhead text-sm text-charcoal-soft mt-0.5">
          Pick the invite or the tester update, paste the tester&rsquo;s one-tap link from the
          Testers page, and say whether they own a business or are here to discover. See the email
          rendered, then copy it into a Gmail compose window. One person per email. Nothing is sent
          from this page.
        </p>
      </div>

      <EmailPreviewForm />
    </div>
  )
}
