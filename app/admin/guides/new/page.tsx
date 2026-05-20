import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'

import { requireAdmin } from '@/lib/admin/guard'
import { createGuideAction } from '@/lib/actions/editorial/guides'
import { GuideAdminForm } from '@/components/editorial/AdminEditorialForm'

export const metadata: Metadata = { title: 'New Guide' }

export default async function NewGuidePage() {
  await requireAdmin()

  return (
    <div className="max-w-[640px] space-y-6">
      <div>
        <Link
          href="/admin/guides"
          className="inline-flex items-center gap-1.5 font-subhead text-xs font-semibold text-charcoal/50 hover:text-amber-gold mb-4 transition-colors"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Guides
        </Link>
        <h1 className="font-headline text-2xl text-brand-black">New guide</h1>
        <p className="font-subhead text-sm text-charcoal/60 mt-0.5">
          Create a new city guide. Add sections after saving.
        </p>
      </div>

      <div className="rounded-xl border border-charcoal/10 bg-white p-6">
        <GuideAdminForm action={createGuideAction} redirectOnSuccess="/admin/guides" />
      </div>
    </div>
  )
}
