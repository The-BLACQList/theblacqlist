import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import { requireAdmin } from '@/lib/admin/guard'
import { createClient } from '@/lib/supabase/server'
import { SponsoredPlacementForm } from './SponsoredPlacementForm'

export const metadata: Metadata = { title: 'New Sponsored Placement | Admin' }

export default async function NewSponsoredPlacementPage() {
  await requireAdmin()
  const supabase = await createClient()

  const [{ data: cities }, { data: categories }] = await Promise.all([
    supabase.from('cities').select('id, name').order('name'),
    supabase.from('categories').select('id, name').order('name'),
  ])

  return (
    <div className="max-w-[640px] space-y-6">
      <div>
        <Link
          href="/admin/sponsored"
          className="inline-flex items-center gap-1.5 font-subhead text-xs font-semibold text-charcoal-soft hover:text-amber mb-4 transition-colors"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Sponsored Placements
        </Link>
        <h1 className="font-headline text-2xl text-brand-black">New sponsored placement</h1>
        <p className="font-subhead text-sm text-charcoal-soft mt-0.5">
          Configure a listing to appear at a fixed position in discover results.
        </p>
      </div>

      <div className="rounded-xl border border-charcoal/10 bg-white p-6">
        <SponsoredPlacementForm
          cities={(cities ?? []) as { id: string; name: string }[]}
          categories={(categories ?? []) as { id: string; name: string }[]}
        />
      </div>

      <div className="rounded-xl border border-amber-gold/20 bg-amber-gold/5 px-5 py-4">
        <p className="font-subhead text-xs font-semibold text-charcoal-soft mb-1">
          How placements work
        </p>
        <ul className="font-body text-xs text-charcoal-soft space-y-1 list-disc list-inside">
          <li>
            Positions 1–3 reserve the first, second, and third card slots in discover results.
          </li>
          <li>
            If city and category are both set, the placement only shows when both filters match.
          </li>
          <li>If left blank, the placement shows across all cities/categories respectively.</li>
          <li>The &ldquo;Sponsored&rdquo; badge is always visible — it cannot be hidden.</li>
        </ul>
      </div>
    </div>
  )
}
