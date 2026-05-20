import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'

import { requireAdmin } from '@/lib/admin/guard'
import { createArticleAction } from '@/lib/actions/editorial/articles'
import { ArticleAdminForm } from '@/components/editorial/AdminEditorialForm'

export const metadata: Metadata = { title: 'New Article' }

export default async function NewArticlePage() {
  await requireAdmin()

  return (
    <div className="max-w-[720px] space-y-6">
      <div>
        <Link
          href="/admin/blacqlight"
          className="inline-flex items-center gap-1.5 font-subhead text-xs font-semibold text-charcoal/50 hover:text-amber-gold mb-4 transition-colors"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          BLACQLight
        </Link>
        <h1 className="font-headline text-2xl text-brand-black">New article</h1>
        <p className="font-subhead text-sm text-charcoal/60 mt-0.5">
          Write a new BLACQLight story or spotlight piece.
        </p>
      </div>

      <div className="rounded-xl border border-charcoal/10 bg-white p-6">
        <ArticleAdminForm action={createArticleAction} redirectOnSuccess="/admin/blacqlight" />
      </div>
    </div>
  )
}
