import Link from "next/link"
import type { Metadata } from "next"

import { requireAdmin } from "@/lib/admin/guard"
import { createServiceClient } from "@/lib/supabase/server"
import { AdminRoleActions } from "@/components/admin/AdminRoleActions"

export const metadata: Metadata = { title: "Users" }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

interface PageProps {
  searchParams: Promise<{ page?: string }>
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const session = await requireAdmin()
  const { page = "1" } = await searchParams

  const pageNum = Math.max(1, parseInt(page))
  const perPage = 50

  const serviceClient = createServiceClient()

  // Auth users — paginated
  const { data: authData } = await serviceClient.auth.admin.listUsers({
    page: pageNum,
    perPage,
  })

  const users = authData?.users ?? []
  const totalCount = (authData as { total?: number } | null)?.total ?? 0
  const totalPages = Math.ceil(totalCount / perPage)

  const userIds = users.map((u) => u.id)

  // Fetch profiles
  const profileMap: Record<string, string | null> = {}
  if (userIds.length > 0) {
    const { data: profiles } = await serviceClient
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds)
    for (const p of profiles ?? []) {
      profileMap[p.id] = p.display_name
    }
  }

  // Fetch platform admin roles (admin / super_admin only — not owner roles)
  const adminRoleMap: Record<string, { id: string; role: string }[]> = {}
  if (userIds.length > 0) {
    const { data: roleRows } = await serviceClient
      .from("user_roles")
      .select("id, user_id, role")
      .in("user_id", userIds)
      .in("role", ["admin", "super_admin"])
    for (const r of roleRows ?? []) {
      if (!adminRoleMap[r.user_id]) adminRoleMap[r.user_id] = []
      adminRoleMap[r.user_id]!.push({ id: r.id, role: r.role })
    }
  }

  const isSuperAdmin = session.role === "super_admin"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-2xl text-brand-black">Users</h1>
        <p className="font-subhead text-sm text-charcoal/60 mt-0.5">
          All registered users and their platform roles.
          {totalCount > 0 && (
            <span className="ml-1 text-charcoal/40">({totalCount} total)</span>
          )}
        </p>
      </div>

      {users.length === 0 ? (
        <div className="rounded-xl border border-charcoal/10 bg-white px-6 py-12 text-center">
          <p className="font-subhead text-sm text-charcoal/60">No users found.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-charcoal/10 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-charcoal/10 bg-[#f9f9fb]">
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal/60 uppercase tracking-wide">
                  User
                </th>
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal/60 uppercase tracking-wide hidden md:table-cell">
                  Admin roles
                </th>
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal/60 uppercase tracking-wide hidden lg:table-cell">
                  Joined
                </th>
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal/60 uppercase tracking-wide hidden lg:table-cell">
                  Last sign in
                </th>
                {isSuperAdmin && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal/5">
              {users.map((user) => {
                const displayName = profileMap[user.id]
                const adminRoles = adminRoleMap[user.id] ?? []
                const isAdmin = adminRoles.length > 0

                return (
                  <tr key={user.id} className="hover:bg-[#f9f9fb] transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-subhead text-sm font-semibold text-brand-black">
                        {displayName ?? user.email ?? "—"}
                      </p>
                      {displayName && (
                        <p className="font-body text-xs text-charcoal/50 mt-0.5">
                          {user.email}
                        </p>
                      )}
                      <p className="font-mono text-xs text-charcoal/30 mt-0.5">
                        {user.id.slice(0, 8)}…
                      </p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {isAdmin ? (
                        <div className="flex flex-wrap gap-1">
                          {adminRoles.map((r) => (
                            <span
                              key={r.id}
                              className="inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold font-subhead bg-amber-gold/10 text-amber-800 border-amber-200"
                            >
                              {r.role === "super_admin" ? "Super Admin" : "Admin"}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="font-body text-xs text-charcoal/30">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="font-body text-xs text-charcoal/60">
                        {user.created_at ? formatDate(user.created_at) : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="font-body text-xs text-charcoal/60">
                        {user.last_sign_in_at ? formatDate(user.last_sign_in_at) : "Never"}
                      </span>
                    </td>
                    {isSuperAdmin && (
                      <td className="px-4 py-3 text-right">
                        <AdminRoleActions
                          userId={user.id}
                          adminRoles={adminRoles}
                          isSelf={user.id === session.user.id}
                        />
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-charcoal/10">
              <p className="font-body text-xs text-charcoal/60">
                {totalCount} total · page {pageNum} of {totalPages}
              </p>
              <div className="flex gap-2">
                {pageNum > 1 && (
                  <Link
                    href={`/admin/users?page=${pageNum - 1}`}
                    className="px-3 py-1.5 rounded border border-charcoal/15 font-subhead text-xs text-brand-black hover:border-amber-gold/40"
                  >
                    ← Prev
                  </Link>
                )}
                {pageNum < totalPages && (
                  <Link
                    href={`/admin/users?page=${pageNum + 1}`}
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
