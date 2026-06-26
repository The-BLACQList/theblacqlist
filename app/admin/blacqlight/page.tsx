import Link from 'next/link'
import type { Metadata } from 'next'
import { Plus } from 'lucide-react'

import { requireAdmin } from '@/lib/admin/guard'
import { createServiceClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'BLACQLight Articles' }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default async function AdminBlacqlightPage() {
  await requireAdmin()
  const serviceClient = createServiceClient()

  const { data: articles } = await serviceClient
    .from('editorial_articles')
    .select('id, title, slug, author_name, status, published_at, created_at, tags')
    .order('created_at', { ascending: false })

  const items = articles ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl text-brand-black">BLACQLight</h1>
          <p className="font-subhead text-sm text-charcoal-soft mt-0.5">
            Manage editorial articles and spotlight stories.
          </p>
        </div>
        <Link
          href="/admin/blacqlight/new"
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors shrink-0"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          New article
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-charcoal/10 bg-white px-6 py-12 text-center">
          <p className="font-subhead text-sm font-semibold text-brand-black mb-1">
            No articles yet
          </p>
          <p className="font-body text-sm text-charcoal-soft mb-4">
            Write your first BLACQLight story.
          </p>
          <Link
            href="/admin/blacqlight/new"
            className="inline-flex items-center gap-1.5 h-9 px-5 rounded-full bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            New article
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
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal-soft uppercase tracking-wide hidden lg:table-cell">
                  Author
                </th>
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal-soft uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal-soft uppercase tracking-wide hidden md:table-cell">
                  Published
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal/5">
              {items.map((a) => (
                <tr key={a.id} className="hover:bg-[#f9f9fb] transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-subhead text-sm font-semibold text-brand-black">{a.title}</p>
                    <p className="font-body text-xs text-charcoal-faint mt-0.5">{a.slug}</p>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="font-body text-xs text-charcoal-soft">
                      {a.author_name ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-subhead font-semibold ${
                        a.status === 'published'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-charcoal/5 text-charcoal-soft'
                      }`}
                    >
                      {a.status === 'published' ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="font-body text-xs text-charcoal-soft">
                      {a.published_at ? formatDate(a.published_at) : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/blacqlight/${a.id}/edit`}
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
