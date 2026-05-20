import Link from "next/link"
import type { Metadata } from "next"

import { requireAdmin } from "@/lib/admin/guard"
import { createServiceClient } from "@/lib/supabase/server"
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge"
import { QueueItemActions } from "@/components/admin/QueueItemActions"

export const metadata: Metadata = { title: "Reports & Corrections" }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

interface PageProps {
  searchParams: Promise<{ status?: string; type?: string; page?: string }>
}

export default async function AdminReportsPage({ searchParams }: PageProps) {
  await requireAdmin()
  const { status = "pending", type = "all", page = "1" } = await searchParams

  const pageNum = Math.max(1, parseInt(page))
  const limit = 25
  const offset = (pageNum - 1) * limit

  const serviceClient = createServiceClient()

  let query = serviceClient
    .from("moderation_queue")
    .select("id, queue_type, status, entity_id, entity_type, priority, created_at", { count: "exact" })
    .in("queue_type", ["correction", "flagged_listing"])
    .eq("status", status)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1)

  if (type !== "all") {
    query = query.eq("queue_type", type)
  }

  const { data: items, count } = await query
  const totalPages = Math.ceil((count ?? 0) / limit)

  // Join listing names for each queue item
  const entityIds = (items ?? []).map((i) => i.entity_id)
  const listingMap: Record<string, { name: string; slug: string }> = {}
  if (entityIds.length > 0) {
    const { data: listings } = await serviceClient
      .from("listings")
      .select("id, name, slug")
      .in("id", entityIds)
    for (const l of listings ?? []) {
      listingMap[l.id] = { name: l.name, slug: l.slug }
    }
  }

  const STATUS_TABS = [
    { value: "pending", label: "Pending" },
    { value: "assigned", label: "Assigned" },
    { value: "resolved", label: "Resolved" },
    { value: "dismissed", label: "Dismissed" },
  ]

  const TYPE_TABS = [
    { value: "all", label: "All types" },
    { value: "correction", label: "Corrections" },
    { value: "flagged_listing", label: "Flagged listings" },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-2xl text-brand-black">Reports & corrections</h1>
        <p className="font-subhead text-sm text-charcoal/60 mt-0.5">
          Handle user-submitted correction requests and flagged listings.
        </p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-charcoal/10">
        {STATUS_TABS.map(({ value, label }) => (
          <Link
            key={value}
            href={`/admin/reports?status=${value}&type=${type}`}
            className={`px-4 py-2 font-subhead text-sm font-semibold border-b-2 -mb-px transition-colors ${
              status === value
                ? "border-amber-gold text-amber-gold"
                : "border-transparent text-charcoal/60 hover:text-brand-black"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Type filter */}
      <div className="flex gap-2">
        {TYPE_TABS.map(({ value, label }) => (
          <Link
            key={value}
            href={`/admin/reports?status=${status}&type=${value}`}
            className={`px-3 py-1 rounded-full border font-subhead text-xs font-semibold transition-colors ${
              type === value
                ? "bg-brand-black text-white border-brand-black"
                : "border-charcoal/15 text-charcoal/60 hover:border-charcoal/30 hover:text-brand-black"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Table */}
      {!items || items.length === 0 ? (
        <div className="rounded-xl border border-charcoal/10 bg-white px-6 py-12 text-center">
          <p className="font-subhead text-sm text-charcoal/60">
            No {status} {type !== "all" ? type.replace("_", " ") : ""} reports found.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-charcoal/10 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-charcoal/10 bg-[#f9f9fb]">
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal/60 uppercase tracking-wide">
                  Listing
                </th>
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal/60 uppercase tracking-wide hidden md:table-cell">
                  Type
                </th>
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal/60 uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal/60 uppercase tracking-wide hidden md:table-cell">
                  Submitted
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal/5">
              {items.map((item) => {
                const listing = listingMap[item.entity_id]
                return (
                  <tr key={item.id} className="hover:bg-[#f9f9fb] transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-subhead text-sm font-semibold text-brand-black">
                        {listing?.name ?? "Unknown listing"}
                      </p>
                      <p className="font-mono text-xs text-charcoal/40 mt-0.5">
                        {item.entity_id.slice(0, 8)}…
                      </p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="font-subhead text-xs text-charcoal/60">
                        {item.queue_type === "flagged_listing" ? "Flagged listing" : "Correction"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <AdminStatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="font-body text-xs text-charcoal/60">
                        {formatDate(item.created_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {listing && (
                          <Link
                            href={`/admin/entities/${item.entity_id}`}
                            className="font-subhead text-xs font-semibold text-charcoal/60 hover:text-brand-black"
                          >
                            View listing
                          </Link>
                        )}
                        {status === "pending" || status === "assigned" ? (
                          <QueueItemActions queueId={item.id} revalidatePath="/admin/reports" />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-charcoal/10">
              <p className="font-body text-xs text-charcoal/60">
                {count} total · page {pageNum} of {totalPages}
              </p>
              <div className="flex gap-2">
                {pageNum > 1 && (
                  <Link
                    href={`/admin/reports?status=${status}&type=${type}&page=${pageNum - 1}`}
                    className="px-3 py-1.5 rounded border border-charcoal/15 font-subhead text-xs text-brand-black hover:border-amber-gold/40"
                  >
                    ← Prev
                  </Link>
                )}
                {pageNum < totalPages && (
                  <Link
                    href={`/admin/reports?status=${status}&type=${type}&page=${pageNum + 1}`}
                    className="px-3 py-1.5 rounded border border-charcoal/15 font-subhead text-xs text-brand-black hover:border-amber-gold/40"
                  >
                    Next →
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
