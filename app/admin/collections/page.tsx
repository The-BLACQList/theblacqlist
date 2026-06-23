import Link from 'next/link'
import type { Metadata } from 'next'
import { Plus } from 'lucide-react'

import { requireAdmin } from '@/lib/admin/guard'
import { createServiceClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Collections' }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default async function AdminCollectionsPage() {
  await requireAdmin()
  const serviceClient = createServiceClient()

  const { data: collections } = await serviceClient
    .from('collections')
    .select('id, title, slug, is_active, display_order, created_at')
    .order('display_order', { ascending: true })

  const { data: counts } = await serviceClient.from('collection_items').select('collection_id')

  const countMap: Record<string, number> = {}
  for (const row of counts ?? []) {
    countMap[row.collection_id] = (countMap[row.collection_id] ?? 0) + 1
  }

  const items = collections ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl text-brand-black">Collections</h1>
          <p className="font-subhead text-sm text-charcoal-soft mt-0.5">
            Manage curated listing collections visible on the public site.
          </p>
        </div>
        <Link
          href="/admin/collections/new"
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors shrink-0"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          New collection
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-charcoal/10 bg-white px-6 py-12 text-center">
          <p className="font-subhead text-sm font-semibold text-brand-black mb-1">
            No collections yet
          </p>
          <p className="font-body text-sm text-charcoal-soft mb-4">
            Create your first collection to curate listings for the public site.
          </p>
          <Link
            href="/admin/collections/new"
            className="inline-flex items-center gap-1.5 h-9 px-5 rounded-full bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            New collection
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-charcoal/10 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-charcoal/10 bg-[#f9f9fb]">
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal-soft uppercase tracking-wide">
                  Title
                </th>
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal-soft uppercase tracking-wide hidden md:table-cell">
                  Slug
                </th>
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal-soft uppercase tracking-wide hidden lg:table-cell">
                  Listings
                </th>
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal-soft uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal-soft uppercase tracking-wide hidden md:table-cell">
                  Created
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal/5">
              {items.map((c) => (
                <tr key={c.id} className="hover:bg-[#f9f9fb] transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-subhead text-sm font-semibold text-brand-black">{c.title}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="font-body text-xs text-charcoal-soft">{c.slug}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="font-body text-xs text-charcoal-soft">
                      {countMap[c.id] ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-subhead font-semibold ${
                        c.is_active
                          ? 'bg-green-50 text-green-700'
                          : 'bg-charcoal/5 text-charcoal-soft'
                      }`}
                    >
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="font-body text-xs text-charcoal-soft">
                      {formatDate(c.created_at)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/collections/${c.id}/edit`}
                      className="font-subhead text-xs font-semibold text-amber hover:text-light-gold"
                    >
                      Edit →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
