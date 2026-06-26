import { redirect } from 'next/navigation'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Auth-only gate — a signed-in user with zero listings reaches the dashboard and
  // sees an empty state rather than being bounced to /account. Per-listing routes
  // still enforce ownership via requireOwner().
  const owner = await getOwnerSession()
  if (!owner) redirect('/sign-in?next=/dashboard')

  return (
    <div className="flex min-h-screen bg-pale-lavender">
      <DashboardSidebar ownerEmail={owner.user.email} />
      <main className="flex-1 min-w-0 p-6 md:p-8">{children}</main>
    </div>
  )
}
