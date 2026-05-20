import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { requireAdmin } from "@/lib/admin/guard"
import { createServiceClient } from "@/lib/supabase/server"
import { updateArticleAction } from "@/lib/actions/editorial/articles"
import { ArticleAdminForm } from "@/components/editorial/AdminEditorialForm"

export const metadata: Metadata = { title: "Edit Article" }

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditArticlePage({ params }: Props) {
  await requireAdmin()
  const { id } = await params
  const serviceClient = createServiceClient()

  const { data: article } = await serviceClient
    .from("editorial_articles")
    .select("id, title, slug, subtitle, body, author_name, meta_description, tags, status")
    .eq("id", id)
    .single()

  if (!article) notFound()

  const defaultValues = {
    ...article,
    tags: article.tags ?? undefined,
    author_name: article.author_name ?? "The BLACQList Team",
  }

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
        <h1 className="font-headline text-2xl text-brand-black">Edit article</h1>
        <p className="font-subhead text-sm text-charcoal/60 mt-0.5">{article.title}</p>
      </div>

      <div className="rounded-xl border border-charcoal/10 bg-white p-6">
        <ArticleAdminForm
          action={updateArticleAction}
          defaultValues={defaultValues}
          redirectOnSuccess="/admin/blacqlight"
        />
      </div>

      {article.status === "published" && (
        <div className="rounded-lg bg-amber-gold/10 border border-amber-gold/20 px-4 py-3">
          <p className="font-subhead text-sm text-brand-black">
            This article is live at{" "}
            <Link
              href={`/blacqlight/${article.slug}`}
              target="_blank"
              className="underline underline-offset-2 hover:text-amber-gold"
            >
              /blacqlight/{article.slug}
            </Link>
          </p>
        </div>
      )}
    </div>
  )
}
