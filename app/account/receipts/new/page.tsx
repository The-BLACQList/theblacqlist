import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { ReceiptSubmissionForm } from '@/components/spend/ReceiptSubmissionForm'

export const metadata: Metadata = { title: 'Submit a Receipt' }

export default async function NewReceiptPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in?next=/account/receipts/new')

  return (
    <main className="min-h-screen bg-pale-lavender pt-16 pb-12 px-4">
      <div className="max-w-[560px] mx-auto space-y-6">
        <div>
          <Link
            href="/account/receipts"
            className="inline-flex items-center gap-1.5 font-subhead text-xs font-semibold text-charcoal/50 hover:text-amber-gold mb-4 transition-colors"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            My receipts
          </Link>
          <h1 className="font-headline text-2xl text-brand-black">Submit a receipt</h1>
          <p className="font-subhead text-sm text-charcoal/60 mt-0.5">
            Record a purchase at a Black-owned business to track your community impact.
          </p>
        </div>

        <div className="rounded-xl bg-white border border-charcoal/10 p-6">
          <ReceiptSubmissionForm />
        </div>
      </div>
    </main>
  )
}
