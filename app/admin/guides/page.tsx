import Link from "next/link"
import type { Metadata } from "next"
import { Plus } from "lucide-react"

import { requireAdmin } from "@/lib/admin/guard"
import { createServiceClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Guides" }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default async function AdminGuidesPage() {
  await requireAdmin()
  const serviceClient = createServiceClient()

  const { data: guides } = await serviceClient
    .from("guides")
    .select("id, title, slug, city, status, published_at, created_at")
    .order("created_at", { ascending: false })

  const items = guides ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl text-brand-black">Guides</h1>
          <p className="font-subhead text-sm text-charcoal/60 mt-0.5">
            Manage city guides and their sections.
          </p>
        </div>
        <Link
          href="/admin/guides/new"
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors shrink-0"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          New guide
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-charcoal/10 bg-white px-6 py-12 text-center">
          <p className="font-subhead text-sm font-semibold text-brand-black mb-1">
            No guides yet
          </p>
          <p className="font-body text-sm text-charcoal/60 mb-4">
            Create your first city guide.
          </p>
          <Link
            href="/admin/guides/new"
            className="inline-flex items-center gap-1.5 h-9 px-5 rounded-full bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            New guide
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-charcoal/10 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-charcoal/10 bg-[#f9f9fb]">
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal/60 uppercase tracking-wide">
                  Title
                </th>
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal/60 uppercase tracking-wide hidden md:table-cell">
                  City
                </th>
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal/60 uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal/60 uppercase tracking-wide hidden md:table-cell">
                  Published
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal/5">
              {items.map((g) => (
                <tr key={g.id} className="hover:bg-[#f9f9fb] transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-subhead text-sm font-semibold text-brand-black">
                      {g.title}
                    </p>
                    <p className="font-body text-xs text-charcoal/40 mt-0.5">{g.slug}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="font-body text-xs text-charcoal/60">{g.city ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-subhead font-semibold ${
                        g.status === "published"
                          ? "bg-green-50 text-green-700"
                          : "bg-charcoal/5 text-charcoal/60"
                      }`}
                    >
                      {g.status === "published" ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="font-body text-xs text-charcoal/60">
                      {g.published_at ? formatDate(g.published_at) : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/guides/${g.id}/edit`}
                      className="font-subhead text-xs font-semibold text-amber-gold hover:text-light-gold"
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
