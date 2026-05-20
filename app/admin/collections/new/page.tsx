import Link from "next/link"
import type { Metadata } from "next"
import { ArrowLeft } from "lucide-react"

import { requireAdmin } from "@/lib/admin/guard"
import { createCollectionAction } from "@/lib/actions/editorial/collections"
import { CollectionAdminForm } from "@/components/editorial/AdminEditorialForm"

export const metadata: Metadata = { title: "New Collection" }

export default async function NewCollectionPage() {
  await requireAdmin()

  return (
    <div className="max-w-[640px] space-y-6">
      <div>
        <Link
          href="/admin/collections"
          className="inline-flex items-center gap-1.5 font-subhead text-xs font-semibold text-charcoal/50 hover:text-amber-gold mb-4 transition-colors"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Collections
        </Link>
        <h1 className="font-headline text-2xl text-brand-black">New collection</h1>
        <p className="font-subhead text-sm text-charcoal/60 mt-0.5">
          Create a curated list of listings for the public collections page.
        </p>
      </div>

      <div className="rounded-xl border border-charcoal/10 bg-white p-6">
        <CollectionAdminForm
          action={createCollectionAction}
          redirectOnSuccess="/admin/collections"
        />
      </div>
    </div>
  )
}
