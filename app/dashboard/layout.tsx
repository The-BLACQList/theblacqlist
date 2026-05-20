import { requireOwner } from "@/lib/dashboard/guard"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const owner = await requireOwner()

  return (
    <div className="flex min-h-screen bg-pale-lavender">
      <DashboardSidebar ownerEmail={owner.user.email} />
      <main className="flex-1 min-w-0 p-6 md:p-8">{children}</main>
    </div>
  )
}
