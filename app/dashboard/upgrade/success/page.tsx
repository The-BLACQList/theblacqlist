import Link from 'next/link'
import type { Metadata } from 'next'
import { CheckCircle } from 'lucide-react'
import { requireOwner } from '@/lib/dashboard/guard'

export const metadata: Metadata = { title: 'Upgrade Successful | BLACQList Dashboard' }

export default async function UpgradeSuccessPage() {
  await requireOwner()

  return (
    <div className="max-w-lg">
      <div className="rounded-xl border border-charcoal/10 bg-white px-8 py-12 text-center">
        <CheckCircle className="size-12 text-amber mx-auto mb-4" aria-hidden="true" />
        <h1 className="font-headline text-2xl text-brand-black mb-2">You&apos;re upgraded!</h1>
        <p className="font-body text-sm text-charcoal-soft mb-8 max-w-sm mx-auto">
          Your subscription is active. Your new plan features are available now.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center h-10 px-6 rounded-full bg-brand-black text-white font-body font-bold text-sm hover:bg-charcoal transition-colors"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/dashboard/upgrade"
            className="inline-flex items-center justify-center h-10 px-6 rounded-full border border-charcoal/20 text-brand-black font-body font-bold text-sm hover:bg-charcoal/5 transition-colors"
          >
            View Plan Details
          </Link>
        </div>
      </div>
    </div>
  )
}
